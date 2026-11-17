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

// Reads a token's own `exp` so a 401 can be attributed rather than guessed at.
//
// Until this existed, every 401 was treated as possible evidence that our
// session had died: the 401 provoked a silent re-auth, and that attempt failing
// raised the session-expired dialog for the whole app. One backend answering
// 401 for its own reasons — a bad audience, a misconfigured gateway, a bug —
// could therefore take down every screen, including the ones it has nothing to
// do with.
//
// The token says who is at fault. If it has not expired, our credentials are
// fine and the 401 belongs to the backend that sent it.
//
// Asgardeo issues JWT access tokens in this tenant, so `exp` is readable
// client-side without a network call. Nothing here verifies the SIGNATURE and
// nothing may start: a client-side check decides whose fault a 401 is, never
// whether to trust a token. The backend does that.

/** Seconds of tolerance for a client clock that disagrees with the IdP's. */
const CLOCK_TOLERANCE_SECONDS = 30;

export type TokenStatus =
  /** Decoded, and `exp` is in the future (beyond tolerance). */
  | { kind: "live"; expiresAt: number }
  /** Decoded, and `exp` has passed. */
  | { kind: "expired"; expiresAt: number }
  /** Not a readable JWT, or carries no usable `exp`. */
  | { kind: "unknown"; reason: string };

function b64urlDecode(segment: string): string {
  const b64 = segment.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((segment.length + 3) % 4);
  const bin = atob(b64);
  // Percent-encode each byte so multi-byte UTF-8 claims survive the decode.
  return decodeURIComponent(
    Array.from(bin, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""),
  );
}

/**
 * Decoded JWT payload, or null when the token is not a readable three-part JWT.
 * Does not verify the signature.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const payload: unknown = JSON.parse(b64urlDecode(parts[1]));
    if (!payload || typeof payload !== "object") return null;
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Classifies a raw JWT by its `exp` claim.
 *
 * Returns "unknown" rather than throwing for anything unreadable — an opaque
 * token, a malformed one, a missing claim. Callers MUST treat "unknown" as
 * "cannot tell" and fall back to their previous behaviour, so switching this
 * tenant to opaque access tokens can only ever restore the old conduct, never
 * open a new hole.
 */
export function classifyToken(rawToken: string, nowMs: number = Date.now()): TokenStatus {
  if (!rawToken) return { kind: "unknown", reason: "no token" };
  // Exactly three. Two or four segments with a readable payload would decode
  // and could classify as `live`, and "live" is the answer that SUPPRESSES a
  // re-auth — so anything that is not the shape we expect has to fall through
  // to `unknown`, which restores the old conduct rather than narrowing it.
  const parts = rawToken.split(".");
  if (parts.length !== 3) return { kind: "unknown", reason: "not a JWT" };

  let payload: unknown;
  try {
    payload = JSON.parse(b64urlDecode(parts[1]));
  } catch {
    return { kind: "unknown", reason: "payload is not readable JSON" };
  }

  const exp = (payload as { exp?: unknown } | null)?.exp;
  if (typeof exp !== "number" || !Number.isFinite(exp)) {
    return { kind: "unknown", reason: "no numeric exp claim" };
  }

  const expiresAt = exp * 1000;
  // Tolerance is applied so a slightly-fast client clock does not call a live
  // token expired. Erring this way is the safe direction: the cost is one
  // pointless re-auth attempt, where the opposite would suppress a real one.
  return nowMs > expiresAt + CLOCK_TOLERANCE_SECONDS * 1000
    ? { kind: "expired", expiresAt }
    : { kind: "live", expiresAt };
}

// ── Corroboration ────────────────────────────────────────────────────────────
//
// `exp` cannot see a token revoked BEFORE it expires — someone disabled at the
// IdP, or a session terminated there. In that case the token still reads as
// live while every backend rejects it.
//
// What separates that from a faulty backend is how many distinct backends are
// refusing. Our credentials being dead is not a thing one backend can know
// privately: if the token is genuinely bad, everything rejects it. One origin
// out of the ~15 this app talks to is that origin's problem.

/** How long a 401 keeps counting toward corroboration. */
const WINDOW_MS = 60_000;

/**
 * Distinct origins needed before a live-looking token is doubted.
 *
 * Two, not three: this app has ~15 backends and a typical page has several in
 * flight, so two is reached quickly when the credentials really are dead —
 * while remaining out of reach for a single broken service, which is the whole
 * point.
 */
export const ORIGINS_BEFORE_DOUBT = 2;

const recent = new Map<string, number>();

function originOf(url: string): string {
  try {
    return new URL(url, window.location.href).origin;
  } catch {
    return url;
  }
}

/**
 * Records a 401 and reports whether enough DISTINCT origins have refused
 * recently to suspect our own credentials rather than one backend.
 */
export function noteUnauthorized(url: string, nowMs: number = Date.now()): boolean {
  const cutoff = nowMs - WINDOW_MS;
  for (const [origin, at] of recent) {
    if (at < cutoff) recent.delete(origin);
  }
  recent.set(originOf(url), nowMs);
  return recent.size >= ORIGINS_BEFORE_DOUBT;
}

/** Test seam, and called on sign-out so one session cannot seed the next. */
export function resetUnauthorizedOrigins(): void {
  recent.clear();
}
