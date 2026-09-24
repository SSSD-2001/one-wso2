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

import { ME_APPS } from "@constants/meApps";
import { hasAnyLeaveTab } from "../leaveTabs";
import { LEAVE_PRIVILEGE } from "./leaveTypes";
import { useLeaveUserInfo } from "./useLeaveData";

// Role-gates the Leave menu items against the LEAVE backend's own privileges,
// not the coarse people-app capabilities the rail derives from `requires`.
//
// The two vocabularies are unrelated. people-app numbers LEAD 993 / ADMIN 999;
// the leave backend numbers LEAD 879 / PEOPLE_OPS_TEAM 789, returned by its own
// /user-info. Reading `requires` against people-app capabilities meant a leave
// lead who is not a people-app lead saw no Reports entry while the page worked
// by URL, and a people-app lead who is not a leave lead saw the entry and
// landed on a denial. Same shape of problem as Finance and Marketing Ops, and
// the same treatment — see useFinanceGate.
//
// The source enforces this at the ROUTE, building its router from a role table
// so an ineligible user gets a 404 (route.ts:129-149, AppHandler.tsx:46). We do
// the same: `canSee` gates the rail entry, the tab in the bar, AND the tab's
// route, from this one mapping — so the menu, the tab bar and the screen cannot
// disagree, and a tab that is hidden cannot be reached by typing its URL.

/** Item ids that declare a restriction and must therefore fail closed. */
const RESTRICTED_IDS = new Set(
  (ME_APPS.find((app) => app.key === "leave")?.items ?? [])
    .filter((it) => it.requires && it.requires.length > 0)
    .map((it) => it.id),
);

export interface LeaveGate {
  canSee: (itemId: string) => boolean;
  /** True while /user-info is still in flight — never render a denial on this. */
  isResolving: boolean;
  isPeopleOps: boolean;
  isLead: boolean;
}

export function useLeaveGate(enabled = true): LeaveGate {
  const userInfo = useLeaveUserInfo(enabled);
  const privileges = userInfo.data?.privileges ?? [];

  const isPeopleOps = privileges.includes(LEAVE_PRIVILEGE.PEOPLE_OPS_TEAM);
  // The privilege number, and nothing else — LeadReportTab.tsx:50. `isLead`
  // and `subordinateCount > 0` were also being accepted, which granted the
  // report to people the running app does not grant it to.
  const isLead = privileges.includes(LEAVE_PRIVILEGE.LEAD);
  const isEmployee = privileges.includes(LEAVE_PRIVILEGE.EMPLOYEE);
  const isIntern = privileges.includes(LEAVE_PRIVILEGE.INTERN);

  const canSee = (itemId: string): boolean => {
    switch (itemId) {
      // route.ts:148 — LEAD or People Ops.
      case "leave-reports":
        return isLead || isPeopleOps;
      // route.ts:94,101 — LEAD only. People Ops cannot approve.
      case "leave-approve":
        return isLead;
      // route.ts:57 — EMPLOYEE, INTERN, LEAD and PEOPLE_OPS_TEAM all apply for
      // their own leave, so this is the one screen open to everybody.
      case "leave-apply":
        return true;
      // route.ts:77-78 and :124-125 — `allowRoles: [EMPLOYEE, LEAD]` with
      // `denyRoles: [INTERN]`, on both the apply and history routes. Interns
      // cannot take a sabbatical, and a People-Ops-only user holds neither
      // allowed role, so neither sees it.
      //
      // Named explicitly rather than left to RESTRICTED_IDS, which is derived
      // from `requires`, and the people-app capabilities that field is resolved
      // against have no word for "intern".
      case "leave-sabbatical-own":
        return (isEmployee || isLead) && !isIntern;
      // route.ts:110 — `allowRoles: [EMPLOYEE, INTERN, LEAD]`. PEOPLE_OPS_TEAM
      // is deliberately absent: My History is the signed-in user's own leave,
      // and a People-Ops-only account has none. Apply (route.ts:58) *does*
      // list them, so only history is narrowed.
      case "leave-history":
        return isEmployee || isIntern || isLead;
      // The rail entry. Offered whenever ANY tab inside is — NOT when this
      // person may take leave of some particular kind. A People-Ops-only
      // account holds no leave of its own but does get both Reports, and
      // gating the entry on a personal permission would hide screens they are
      // entitled to.
      case "leave-home":
        return hasAnyLeaveTab(canSee);
      default:
        // Anything that declares a restriction and is not named above fails
        // closed, so the menu cannot drift ahead of this mapping.
        return !RESTRICTED_IDS.has(itemId);
    }
  };

  return {
    canSee,
    // `isPending`, not `isLoading`. useLeaveUserInfo is also held back until
    // the Asgardeo sub resolves, so on a cold load the query is disabled and
    // merely "not fetching" — which `isLoading` reports as a finished check
    // holding no privileges, hiding rail entries from the people who have
    // them. The distinction is WHY a query is off: lacking a role is
    // permanent and reads as not-loading; waiting on identity is a moment and
    // reads as pending.
    //
    // Still guarded on `enabled`, so a caller that switched this gate off is
    // never told it is mid-flight.
    isResolving: enabled && userInfo.isPending,
    isPeopleOps,
    isLead,
  };
}
