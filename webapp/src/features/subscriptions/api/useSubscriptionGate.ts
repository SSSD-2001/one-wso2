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
import { describeError } from "@api/errors";
import { hasAnyGroup, useAsgardeoGroups } from "@hooks/useAsgardeoGroups";
import { useSubscriptionsMetaInfo } from "./useSubscriptionData";

// Who may manage subscriptions for other people, and who pays.
//
// The shape of this gate is dictated by the backend, which differs from every
// other perspective in One WSO2 and is worth stating plainly:
//
//   - Marketing Ops has `/api/me`, so its gate ASKS THE BACKEND and trusts the
//     answer. That is the better arrangement and should stay the default.
//   - The subscription service has no such endpoint. It publishes the NAMES of
//     its two admin groups on /subscriptions/meta-info (`commuteAdminGroup`,
//     `lunchAdminGroup`, both configurable per deployment) and leaves the
//     comparison against the caller's own Asgardeo groups to the client —
//     which is exactly what its standalone app did.
//
// So this gate joins two halves: the group NAMES from the backend, and the
// caller's MEMBERSHIPS from the id_token. Neither half is hard-coded, which is
// what keeps a group rename from becoming a frontend release.
//
// This decides what is worth showing, and nothing more. Every endpoint behind
// these screens re-derives the same groups from the JWT and refuses a caller
// who doesn't hold them — `/employees` 403s, and so does any subscribe or
// unsubscribe aimed at someone else's address. A forged token buys a screen
// whose every button fails, not access.
//
// The two admin groups are INDEPENDENT: holding the commute group does not
// imply the lunch one. They are surfaced separately rather than collapsed into
// one boolean, because a commute admin who also sees a LaaS panel gets a 403
// from a control we told them they could use.

export interface SubscriptionGate {
  /** May manage PickMe Commute for other employees. */
  isCommuteAdmin: boolean;
  /** May manage LaaS for other employees. */
  isLunchAdmin: boolean;
  /** Holds EITHER admin group — the test for showing the admin screen at all. */
  isAdmin: boolean;
  /**
   * In a group that uses the services free of charge (interns, today). Drives
   * the price line only; it does not change what anyone may do.
   */
  isInExcludedGroup: boolean;
  /** What to show a fee-exempt member instead of a price. */
  serviceChargeMsg: string;
  /**
   * True while either half is still resolving. Hold gated UI until it clears:
   * rendering the decision early denies an admin their own screen on every
   * single load, then corrects itself a moment later.
   */
  isResolving: boolean;
  /**
   * The meta-info request or the token decode failed.
   *
   * Deliberately distinct from `isAdmin === false`, for the reason the other
   * gates in this app state: both leave us holding no privileges, and they
   * mean opposite things to the person reading the screen. "You're not in the
   * group" sends someone to ask an admin; "the request failed" is a reason to
   * press Retry. Reporting the second as the first sends them chasing a
   * permission they already have.
   */
  isError: boolean;
  errorMessage?: string;
  retry: () => void;
}

export function useSubscriptionGate(enabled = true): SubscriptionGate {
  const meta = useSubscriptionsMetaInfo(enabled);
  const identity = useAsgardeoGroups();

  const groups = identity.groups;
  const commuteAdminGroup = meta.data?.commuteAdminGroup ?? "";
  const lunchAdminGroup = meta.data?.lunchAdminGroup ?? "";

  // `hasAnyGroup` ignores empty names, so a deployment that configures only
  // one of the two groups grants only that one — an unset group name can never
  // match and accidentally admit everybody.
  const isCommuteAdmin = hasAnyGroup(groups, [commuteAdminGroup]);
  const isLunchAdmin = hasAnyGroup(groups, [lunchAdminGroup]);

  return {
    isCommuteAdmin,
    isLunchAdmin,
    isAdmin: isCommuteAdmin || isLunchAdmin,
    isInExcludedGroup: hasAnyGroup(groups, meta.data?.excludedGroups ?? []),
    serviceChargeMsg: meta.data?.serviceChargeMsg ?? "Free of charge",
    // `isPending` rather than `isLoading`, so the window before the Asgardeo
    // `sub` resolves counts as resolving too — with `isLoading` the query is
    // merely "not fetching" then, which reads as a finished check with no
    // privileges and flashes a denial at every admin on a cold load.
    isResolving: enabled && (meta.isPending || !identity.ready),
    // A disabled gate must not report a token-decode or meta failure. The
    // subscriptions adapter stays on every perspective, and an unguarded
    // identity error would stop Me from opening.
    isError: enabled && (meta.isError || Boolean(identity.error)),
    errorMessage: enabled
      ? meta.isError
        ? describeError(meta.error)
        : (identity.error ?? undefined)
      : undefined,
    // Both halves, unconditionally — a caller here (SubscriptionsShell's
    // ErrorNotice) has no way to tell which one actually failed, and retrying
    // the healthy half is a harmless no-op. Retrying only meta.refetch() left
    // an identity-decode failure with no way to recover short of a reload.
    retry: () => {
      void meta.refetch();
      identity.retry();
    },
  };
}

export function subscriptionVisibility(gate: SubscriptionGate): VisibilityAnswer {
  const canSee = (id: string) =>
    id === "people-subscriptions-manage" ? gate.isAdmin && !gate.isResolving : true;
  return gate.isError
    ? { canSee, resolving: gate.isResolving, error: gate.errorMessage, retry: gate.retry }
    : { canSee, resolving: gate.isResolving, retry: () => undefined };
}
