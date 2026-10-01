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

import type { VisibilityAnswer } from "@components/side-rail/visibilityFold";
import { useEffect } from "react";
import { describeError } from "@api/errors";
import { SIGNING_OUT_EVENT } from "@constants/appEvents";
import { UMT_ROLE_ID, type UmtRole } from "./umtTypes";
import { useUmtUserInfo } from "./useUmtUserInfo";

export interface UmtGate {
  /** The caller holds at least one role accepted by UMT. */
  isAuthorized: boolean;
  isUser: boolean;
  isAdmin: boolean;
  isProductLead: boolean;
  hasRole: (role: UmtRole) => boolean;
  /** True until identity and /update/user-info produce an access decision. */
  isResolving: boolean;
  /** A failed access check, distinct from a completed denial. */
  isError: boolean;
  errorMessage?: string;
  retry: () => void;
}

// `/update/user-info` deliberately exposes numeric privileges. Convert them at
// the authorization boundary so dashboard consumers only deal with the named
// UMT roles rather than service-specific IDs.
function umtRolesFromIds(roleIds: readonly number[] | undefined): Set<UmtRole> {
  const roles = new Set<UmtRole>();
  if (!roleIds) return roles;

  for (const [role, id] of Object.entries(UMT_ROLE_ID) as [UmtRole, number][]) {
    if (roleIds.includes(id)) roles.add(role);
  }

  return roles;
}

// Module-level, not React state: every top-level UMT page renders its own
// UmtShell, so navigating between them (e.g. /umt -> /umt/updates) unmounts
// and remounts the whole useUmtGate -> useUmtUserInfo -> useAsgardeoSub
// chain. useAsgardeoSub resolves the Asgardeo subject via local component
// state, so a fresh mount briefly has no `sub`, which briefly changes
// useUmtUserInfo's query key and makes it look unresolved again even though
// the real answer was already known a moment ago on the page just left.
// Remembering the last real role set here — surviving the remount — avoids
// re-flashing "Checking your UMT access..." on every navigation. The
// SIGNING_OUT_EVENT listener below clears it so a different account in the
// same tab can never see it.
let lastKnownRoles: Set<UmtRole> | null = null;

// Registered at module load rather than inside the hook: AuthGuard swaps
// <Outlet/> for a spinner in the same commit that `isSignedIn` flips false, so
// this hook is unmounted before it could ever observe the transition itself.
// Same mechanism (and same reasoning) as pinnedStore.ts. SIGNING_OUT_EVENT is
// dispatched only by a deliberate sign-out, never by a silent re-auth, so the
// anti-flicker cache survives a token refresh as intended.
if (typeof window !== "undefined") {
  window.addEventListener(SIGNING_OUT_EVENT, () => {
    lastKnownRoles = null;
  });
}

export function __resetUmtGateCacheForTests(): void {
  lastKnownRoles = null;
}

// Translates UMT's numeric service roles into the named decisions consumed by
// the shell and dashboard. Any recognised role grants entry to the perspective;
// `isAdmin` additionally gates product management and release-chunk creation.
//
// This deliberately does not read People capabilities. UMT owns a separate
// role vocabulary, returned by its own /update/user-info endpoint.
export function useUmtGate(enabled = true): UmtGate {
  const userInfo = useUmtUserInfo(enabled);
  const roleIds = userInfo.data?.roles;
  // TanStack keeps the last successful `data` in the cache through a failed
  // background refetch (`isError` and `data` are not mutually exclusive) —
  // so a request that has ever succeeded still has usable data even while
  // `isError` is currently true. Only a check that has *never* produced a
  // real answer (first load, or one already cleared to nothing) has none.
  const hasData = userInfo.data !== undefined;

  // Mutating module state must happen as an effect, not during render (React
  // may render this hook more than once per commit) — the read below is
  // still a plain, pure read of whatever a *previous* commit last wrote.
  useEffect(() => {
    if (hasData) {
      lastKnownRoles = umtRolesFromIds(roleIds);
    } else if (userInfo.isError) {
      // A failed check that has never returned real data must never leave a
      // remembered grant behind for a later remount (e.g. navigating away
      // and back while /update/user-info is still erroring) to resurrect.
      lastKnownRoles = null;
    }
  }, [hasData, roleIds, userInfo.isError]);

  // `lastKnownRoles` exists only to smooth over a remount while the SAME
  // decision is still in flight (see the comment above the module variable);
  // it must not be consulted once a check has genuinely failed with no data
  // to fall back on, or an admin whose role was just revoked keeps seeing
  // admin-only controls enabled for as long as `/update/user-info` keeps
  // erroring. This has to be checked here, not only in the effect above:
  // writing to a module variable in an effect doesn't itself trigger a
  // re-render, so the render that first observes `isError` would otherwise
  // still compute roles from the not-yet-cleared cache.
  //
  // A background refetch failing while `data` is still cached (a transient
  // blip on an already-authorized session) is deliberately NOT treated as a
  // denial here: `hasData` takes priority over `isError`, so the last real
  // answer keeps being used instead of blanking an already-working page.
  const roles = hasData
    ? umtRolesFromIds(roleIds)
    : userInfo.isError
      ? new Set<UmtRole>()
      : (lastKnownRoles ?? new Set<UmtRole>());
  const hasRole = (role: UmtRole): boolean => roles.has(role);

  return {
    isAuthorized: roles.size > 0,
    isUser: hasRole("UMT_USER"),
    isAdmin: hasRole("UMT_ADMIN"),
    isProductLead: hasRole("PRODUCT_LEAD"),
    hasRole,
    // `isPending`, not `isLoading`: the query is disabled while the Asgardeo
    // subject resolves, but the authorization decision is still outstanding.
    // Only shown when there's truly no prior decision to fall back on — i.e.
    // the session's actual first load, not a remount of an already-known one.
    isResolving: enabled && userInfo.isPending && !lastKnownRoles,
    // Only surfaced when there's no cached answer to fall back on — a
    // background refetch failure with `data` still cached is absorbed above
    // instead of being reported as a request failure to the caller.
    isError: userInfo.isError && !hasData,
    errorMessage: userInfo.isError && !hasData ? describeError(userInfo.error) : undefined,
    retry: () => void userInfo.refetch(),
  };
}

/** Product Management is an admin section. A failed read hides it; the landing does not retry. */
export function umtVisibility(gate: UmtGate): VisibilityAnswer {
  return {
    canSee: () => gate.isAdmin && !gate.isResolving,
    resolving: gate.isResolving,
    retry: () => undefined,
  };
}
