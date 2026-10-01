// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { useCallback, useEffect, useState } from "react";
import { useAsgardeo } from "@asgardeo/react";
import type { UseQueryResult } from "@tanstack/react-query";
import { getSessionExpiredSnapshot, rawIdToken, refreshIdToken } from "@api/authBridge";
import { classifyToken } from "@api/tokenExpiry";

// Resolves the current Asgardeo user's `sub` claim. Used as an identity
// discriminator in downstream query keys so a sign-out → different-user
// sign-in in the same tab can't briefly serve the previous user's cached
// data.
//
// We can't use useAsgardeo().user for this — that field is only populated
// when `preferences.user.fetchUserProfile` is true (we disable it) or on
// the AsgardeoV2 platform (our tenant isn't). Decoding the id_token via
// the SDK is the one path that always works.
//
// Returns a three-state value so a caller can distinguish loading
// (`{status: "loading"}`), success (`{status: "ready", sub}`), and
// terminal failure (`{status: "error", message}`). Callers surface the
// error state in the UI instead of leaving downstream queries silently
// disabled with an undefined key.
//
// Single-source-of-truth by design: every hook that needs the user's
// `sub` (useMeProfile, useUserInfo, and others) consumes this hook, so
// the resolved `sub` is byte-identical across every consumer within a
// render tree.
/**
 * A loggable one-liner for a rejection of unknown shape.
 *
 * Asgardeo's exception type is a plain class with no `extends Error` and no
 * toString, so `String(it)` yields "[object Object]". The readable text sits on
 * `name`, an identifier on `code`, and `message` is itself the underlying
 * error object — which is why it is not read here: it can carry the token that
 * failed to decode, and that must not reach a console.
 */
function describeForLog(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === "object" && error !== null) {
    const { name, code } = error as { name?: unknown; code?: unknown };
    const parts = [typeof code === "string" ? code : null, typeof name === "string" ? name : null];
    const described = parts.filter(Boolean).join(" ");
    if (described) return described;
  }
  return "unknown error";
}

export type SubState =
  | { status: "loading" }
  | { status: "ready"; sub: string }
  | { status: "error"; message: string };

/**
 * Whether the cached id_token is still within its own lifetime.
 *
 * Reads the RAW token — `getDecodedIdToken()` is the call that just failed, so
 * asking it again proves nothing. Anything unreadable answers `false`, which
 * routes to the pre-existing re-auth path: this check may only ever narrow
 * when a re-auth is attempted, never widen it.
 */
async function idTokenStillLive(): Promise<boolean> {
  try {
    return classifyToken(await rawIdToken()).kind === "live";
  } catch {
    return false;
  }
}

export function useAsgardeoSub(): { state: SubState; retry: () => void } {
  const { isSignedIn, getDecodedIdToken } = useAsgardeo();
  const [state, setState] = useState<SubState>({ status: "loading" });
  // A tick counter drives the identity-resolution effect: bumping it
  // re-runs getDecodedIdToken() so a user-visible "Retry" can recover
  // from a decode error without having to sign out and back in.
  const [retryTick, setRetryTick] = useState(0);
  const retry = useCallback(() => setRetryTick((n) => n + 1), []);

  useEffect(() => {
    if (!isSignedIn) {
      setState({ status: "loading" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    getDecodedIdToken()
      .then((token) => {
        if (cancelled) return;
        const s = (token as { sub?: string } | null | undefined)?.sub;
        if (typeof s === "string" && s.length > 0) {
          setState({ status: "ready", sub: s });
        } else {
          setState({
            status: "error",
            message: "Signed in, but the identity token has no `sub` claim.",
          });
        }
      })
      .catch(async (decodeError: unknown) => {
        if (cancelled) return;
        // getDecodedIdToken() rejects once the cached id_token has expired —
        // try one silent re-auth via the same bridge @api/http uses for 401s,
        // then retry the decode, instead of leaving every sub-keyed query
        // (useUserInfo, useLeaveUserInfo, useLeaves, ...) silently disabled
        // with no visible error.
        //
        // But ONLY once the token has actually expired. A silent re-auth is
        // not free: failing one raises the app-wide, non-dismissable
        // session-expired dialog, and this path can reach it with no HTTP
        // request involved at all — which is how a decode that failed for some
        // other reason (the SDK mid-operation, a transient fault) came to tell
        // every user their session had ended while it was perfectly healthy.
        //
        // The token says whether that is plausible. If `exp` is still in the
        // future, the session is fine and the decode failed for its own
        // reasons: retry the decode rather than reaching for the session.
        // Same rule @api/http applies to a 401 — see api/tokenExpiry.ts.
        let recoveryFailure: unknown;
        try {
          const stillLive = await idTokenStillLive();
          // Checked BEFORE either recovery path, not just the decode inside the
          // live branch. A sign-out or unmount during that await used to fall
          // straight through to refreshIdToken() — starting a silent re-auth
          // for a session the user has just ended.
          if (cancelled) return;
          if (stillLive) {
            const retried = await getDecodedIdToken();
            if (cancelled) return;
            const s = (retried as { sub?: string } | null | undefined)?.sub;
            if (typeof s === "string" && s.length > 0) {
              setState({ status: "ready", sub: s });
              return;
            }
            // Live token, and it still will not decode. Fall through to the
            // error state WITHOUT a re-auth: whatever is wrong, an expired
            // session is not it, so declaring one would be a lie.
            throw new Error("id_token is unexpired but still did not decode");
          }
          await refreshIdToken();
          const token = await getDecodedIdToken();
          if (cancelled) return;
          const s = (token as { sub?: string } | null | undefined)?.sub;
          if (typeof s === "string" && s.length > 0) {
            setState({ status: "ready", sub: s });
            return;
          }
        } catch (recoveryError: unknown) {
          // Refresh or the retried decode also failed — fall through to
          // the terminal error state below.
          recoveryFailure = recoveryError;
        }
        if (cancelled) return;
        // The user gets plain words: Asgardeo's exception type is a plain class
        // — no `extends Error`, no toString — so interpolating it printed
        // "[object Object]", and the decode reason is not something a reader
        // can act on anyway.
        //
        // It still has to go somewhere. Without this line a failed sign-in is
        // indistinguishable from an expired session, a blocked renewal iframe,
        // and a rejected token exchange — and the dialog those raise says the
        // same thing in all four cases.
        console.warn(
          "[auth] Could not resolve the user's identity.",
          `decode: ${describeForLog(decodeError)};`,
          `recovery: ${recoveryFailure ? describeForLog(recoveryFailure) : "succeeded but still no sub"}`,
        );
        // Once the bridge has declared the session dead, the session-expired
        // dialog is already up and owns the message. Going to "error" here
        // would additionally light up whichever ErrorNotice is on screen —
        // eleven different sentences blaming eleven different features for one
        // dead session, each offering a Retry that cannot help. Staying in
        // "loading" leaves the page on its skeleton behind the modal.
        if (getSessionExpiredSnapshot()) return;
        setState({ status: "error", message: "Couldn't verify your session." });
      });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getDecodedIdToken, retryTick]);

  return { state, retry };
}

// Folds identity resolution into a query's own result shape, so a page sees
// a real loading or error state (with a retry path, on error) instead of an
// indefinitely disabled query — `enabled: ... && Boolean(userSub)` never
// flips true while identity is unresolved, so the query itself never runs.
// Every sub-keyed query (leave, finance backends, ...) should route its
// result through this before returning it — this generalizes the pattern
// useMeProfile introduced for its own single query.
//
// Two branches, in order of precedence:
//
//  1. Identity failed — synthesize a real, actionable error (unchanged from
//     before). Takes precedence over whatever error state the query itself
//     happens to carry: React Query's real refetch() bypasses `enabled`
//     (see the note on useMeProfile above), so a disabled query CAN end up
//     with a real isError from some earlier forced refetch attempt (a stray
//     double-click, the devtools' manual refetch, ...) even while identity
//     is unresolved. Deferring to that instead would show whatever
//     unrelated error that fetch produced, with `.refetch` pointing at
//     React Query's real refetch — which just re-fires the same doomed
//     queryFn instead of ever retrying identity, permanently shadowing the
//     one error that's actually recoverable.
//
//  2. Identity is still resolving AND the query has no data of its own yet
//     (`isPending`) — synthesize a loading state. Without this, a disabled
//     query with no cached data reports `isLoading: false` in React Query
//     v5 (`isLoading` there is `isPending && isFetching`, and a disabled
//     query is never `isFetching`), so every caller of this hook — CC, OPD
//     and Expense Claims user-info alike — briefly read as "settled, and
//     access denied" during the gap between mount and identity resolving,
//     before the real query ever gets a chance to run. `FinanceOverviewPage`
//     and every finance rail gate compute `isResolving` from these hooks'
//     `isLoading`, so that gap read as the whole Finance section flashing
//     "not available for your role" (or its skeleton) before settling on
//     the real answer a moment later — reported as the app "continuously
//     refreshing" or "flickering". `isPending` (not `isSuccess`/`isError`)
//     is the guard: once the query has resolved for real at least once, a
//     later identity re-check (a token refresh cycle, say) must not hide
//     already-known-good data or a real error behind a fresh skeleton.
//
// The synthetic results don't match React Query's discriminated union
// exactly (the four *Result variants have exclusive boolean flags), so we
// cast through unknown — callers only read isError + error + isPending +
// isLoading + isFetching + isSuccess + refetch, and both shapes set those
// consistently.
export function foldIdentityError<TData>(
  query: UseQueryResult<TData, Error>,
  identityState: SubState,
  retryIdentity: () => void,
): UseQueryResult<TData, Error> {
  if (identityState.status === "error") {
    const synthetic = {
      ...query,
      isError: true,
      isPending: false,
      isLoading: false,
      isSuccess: false,
      isFetching: false,
      status: "error" as const,
      error: new Error(identityState.message),
      refetch: (async () => {
        retryIdentity();
        return query;
      }) as typeof query.refetch,
    };
    return synthetic as unknown as UseQueryResult<TData, Error>;
  }
  if (identityState.status === "loading" && query.isPending) {
    const synthetic = {
      ...query,
      isError: false,
      isPending: true,
      isLoading: true,
      isSuccess: false,
      isFetching: true,
      status: "pending" as const,
      fetchStatus: "fetching" as const,
    };
    return synthetic as unknown as UseQueryResult<TData, Error>;
  }
  return query;
}
