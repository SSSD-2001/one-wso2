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
import { isDueDiligenceBackendConfigured } from "@config/apiConfig";
import { useDueDiligenceMe } from "./useDueDiligenceMe";
import { hasDueDiligenceRole, type DueDiligenceRole } from "./dueDiligenceTypes";

// Menu ids gated on "any due-diligence role at all" — mirrors the source
// app's own top-level access check (App.js's `isAuthorised`: holding ANY of
// the app's roles unlocks the whole admin app). Everything except Preferences
// falls here; Preferences is admin-only (see ADMIN_ONLY_IDS below).
const ADMIN_ONLY_IDS = new Set(["dd-preferences"]);

export interface DueDiligenceGate {
  // May this menu item be shown? Used by the rail (under both Finance and
  // Legal) and by every page's DueDiligenceShell alike, so a visible item is
  // always one whose page the caller can actually use.
  canSee: (itemId: string) => boolean;
  // Does the caller hold any due-diligence role at all. False for an
  // authenticated WSO2 employee who simply isn't in any of the mapped
  // Asgardeo groups — the app should say so plainly rather than render an
  // empty rail or a blank page.
  isAuthorized: boolean;
  isAdmin: boolean;
  // Check any one role directly — for internal, per-action gating inside a
  // page (e.g. "only a legalApprover may edit this field"), the same shape
  // as the source app's `checkIfRoleExists(roles.X)`.
  hasRole: (role: DueDiligenceRole) => boolean;
  // True while /user-info is in flight. Callers should hold off on
  // rendering an "unauthorized" state until this clears, or every load
  // flashes a denial.
  isResolving: boolean;
  // /user-info itself failed — the network, the gateway, or the identity
  // lookup. Distinguishable from `isAuthorized === false` for the same
  // reason as every sibling gate in this app (see useMarketingOpsGate):
  // "you're not in the right Asgardeo group" asks someone to go find an
  // admin, while "the request failed" is a reason to retry — collapsing
  // them sends people chasing a permission they already have.
  isError: boolean;
  errorMessage?: string;
  retry: () => void;
}

// Gates the Due Diligence app against ITS OWN backend's roles rather than
// the coarse One WSO2 capabilities derived from people-app. The rail (under
// both Finance and Legal) and every page use it, so a menu item or page only
// renders for someone who can actually use it.
//
// `enabled` avoids firing /user-info when neither the Finance nor Legal
// perspective is active.
export function useDueDiligenceGate(enabled = true): DueDiligenceGate {
  const me = useDueDiligenceMe(enabled);

  const hasRole = (role: DueDiligenceRole): boolean => hasDueDiligenceRole(me.data, role);
  // "some role other than employeeRole", not just "some role": the backend's
  // Config.toml maps employeeRole to "wso2-everyone" — the baseline group
  // every authenticated WSO2 employee is in, used as the minimum privilege
  // for "All Requests" (see modules/authorisation/constants.bal). It isn't a
  // due-diligence-specific role at all, so treating it as sufficient to
  // unlock the app (as a plain `roles.length > 0` does) meant every employee
  // could see and open Due Diligence under Finance/Legal, regardless of
  // whether they held any of the actual admin/finance/legal groups.
  const isAuthorized = Boolean(me.data && me.data.roles.some((r) => r !== "employeeRole"));
  const isAdmin = hasRole("adminRole");

  const canSee = (itemId: string): boolean => {
    // Nothing in this app is visible to a caller the backend hasn't granted
    // at least one role to. Checked before anything else so an unauthorized
    // caller can't see a single item.
    if (!isAuthorized) return false;
    if (ADMIN_ONLY_IDS.has(itemId)) return isAdmin;
    return true;
  };

  return {
    canSee,
    isAuthorized,
    isAdmin,
    hasRole,
    // `isPending` rather than `isLoading`, so the window in which the
    // Asgardeo sub hasn't resolved yet counts as resolving too — see the
    // identical note on useMarketingOpsGate. Gated on `configured` as well:
    // useDueDiligenceMe's query stays permanently disabled (and therefore
    // permanently `isPending`) when the backend URL isn't set, so without
    // this an unconfigured deployment never stops "resolving" — and
    // usePerspectiveVisibility ORs this straight into the aggregate the rail
    // and the Finance/Legal landing both read, which would otherwise hold
    // those two perspectives on a spinner forever.
    isResolving: enabled && isDueDiligenceBackendConfigured() && me.isPending,
    isError: me.isError,
    errorMessage: me.isError ? describeError(me.error) : undefined,
    retry: () => void me.refetch(),
  };
}

export function dueDiligenceVisibility(gate: DueDiligenceGate): VisibilityAnswer {
  return gate.isError
    ? { canSee: gate.canSee, resolving: gate.isResolving, error: gate.errorMessage, retry: gate.retry }
    : { canSee: gate.canSee, resolving: gate.isResolving, retry: () => undefined };
}
