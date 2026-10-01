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

import { useMemo } from "react";
import { SRI_LANKA_ONLY_ITEM_IDS, type PerspectiveSection } from "@constants/perspectives";
import { capabilitiesFromPrivileges } from "@constants/appMenu";
import { isPreviewEnabled } from "@config/previewFeatures";
import { infraVisibility, useInfraGate } from "@features/infra/api/useInfraGate";
import { useActivePerspective } from "@context/perspective/PerspectiveContext";
import { useUserInfo } from "@api/useUserInfo";
import { useMeProfile } from "@features/my/api/useMeProfile";
import { financeVisibility, useFinanceGate } from "@features/finance/api/useFinanceGate";
import { misVisibility, useMisGate } from "@features/finance/mis/api/useMisGate";
import { leaveVisibility, useLeaveGate } from "@features/leave/api/useLeaveGate";
import { bankingVisibility, useBankingAccess } from "@features/my/api/useBankingAccess";
import { bankingAdminVisibility, useBankingAdminAccess } from "@features/my/api/useBankingAdminAccess";
import { marketingVisibility, useMarketingOpsGate } from "@features/marketing-ops/api/useMarketingOpsGate";
import { dueDiligenceVisibility, useDueDiligenceGate } from "@features/due-diligence/api/useDueDiligenceGate";
import { securityVisibility, useSecurityGate } from "@features/security/api/useSecurityGate";
import { salesVisibility, useSalesRailGate } from "@features/sales/api/useSalesGate";
import { subscriptionVisibility, useSubscriptionGate } from "@features/subscriptions/api/useSubscriptionGate";
import { parVisibility } from "@features/par/api/parVisibility";
import { useParCanSeeLeadPortal, useParEmployeeItemVisible } from "@features/par/api/useParData";
import { useParIsAdmin } from "@features/par/api/useParIsAdmin";
import { promotionVisibility, usePromotionPrivileges } from "@features/promotion/api/usePromotionRoles";
import { umtVisibility, useUmtGate } from "@features/umt/api/useUmtGate";
import { isSriLankaWorkLocation } from "@utils/locationGate";
import { visibleLeavesOf } from "./railActive";
import {
  claimOf,
  claimsForPerspective,
  foldVisibility,
  sectionIdsIn,
  type AdapterName,
  type VisibilityAdapter,
  type VisibilityAnswer,
} from "./visibilityFold";

/**
 * Who can see what in the active perspective.
 *
 * Lifted out of SideRail so the rail is no longer the only thing that knows.
 * A perspective's landing route needs the SAME answer — it sends you to your
 * first visible item — and a second, separately-derived copy of these gates
 * would eventually disagree with the rail. That failure is ugly and quiet: the
 * rail offers one screen while the landing opens another, or opens one the
 * rail is deliberately hiding from you.
 *
 * Every gate below is enabled only while the perspective that needs it is
 * active, so this costs no extra request on the perspectives that don't.
 */
export interface PerspectiveVisibility {
  /** May this section or child be shown? Fails closed while gates resolve. */
  resolveVisible: (s: PerspectiveSection) => boolean;
  /**
   * True while a gate the active perspective depends on is still answering.
   *
   * Anything that NAVIGATES on this hook's answer has to wait for it: every
   * gate fails closed while resolving, so "your first visible item" read
   * mid-flight is either the wrong item or no item at all. The rail itself
   * does not wait — it renders what is known and fills the rest in, which
   * reads as the menu settling rather than as a wrong answer.
   */
  isResolving: boolean;
  /**
   * Every visible leaf of the active perspective, in rail order.
   *
   * Leaves only: a group is not a destination, and only leaves carry a path.
   * Rail order, so "the first one" means the same thing here as it does on
   * screen.
   */
  visibleLeaves: PerspectiveSection[];
  /**
   * True when something this perspective needed to answer the question failed.
   *
   * Only worth asking where an empty `visibleLeaves` is about to be shown to
   * someone as a verdict — "you have nothing here" and "we could not find out"
   * are different sentences, and only one of them is worth a Retry button.
   *
   * Partial, and deliberately so. Marketing Ops, Due Diligence, Sales,
   * Subscriptions, Infra, and Finance MIS report a failed read here. Finance,
   * Leave, Security, and the others fold a failed read into "not allowed", so
   * an entry that could not be checked stays hidden. So this means "something
   * we needed definitely failed", never "everything else succeeded".
   */
  isError: boolean;
  /** The first failure worth naming, for ErrorNotice. */
  error?: unknown;
  /** Refetches whatever failed. No-op when nothing did. */
  retry: () => void;
}

export function usePerspectiveVisibility(): PerspectiveVisibility {
  const active = useActivePerspective();
  const userInfo = useUserInfo();
  const caps = capabilitiesFromPrivileges(userInfo.data?.privileges);
  const infraGate = useInfraGate(active.key === "infra");

  // Finance items (OPD/credit-card/expense, surfaced under Me) gate on each
  // finance app's OWN backend roles, not the coarse people-app capabilities
  // — so someone who is a people-app lead but not a cc-expenses lead/finance
  // doesn't see "Approve Submissions". Dispatched per item id rather than
  // per perspective since Finance items are just some of Me's sections now.
  // Only fetch those roles while Me is active.
  // Both perspectives: the claim apps' own screens are under Me, and Claim
  // approval is under Finance. One gate answers for both, so it has to be
  // asked in either place.
  // `caps` for the master-data items, which have no finance backend role of
  // their own — see useFinanceGate's own note.
  const financeGate = useFinanceGate(active.key === "me" || active.key === "finance", caps);

  // Finance MIS, also under Finance, but a different backend again — the MIS
  // ARR service's own /user-info. It cannot share the finance gate above: that
  // one answers for the three claim apps and would fall through to its open
  // default for every MIS id.
  //
  // It especially cannot fall through to `sectionAllowed`. MIS privilege 987
  // and this app's PRIVILEGE.EMPLOYEE 987 are the same number meaning opposite
  // things, so a MIS id reaching the capability check would show company-wide
  // revenue reporting to every signed-in employee.
  //
  // And only while the `mis` preview flag is on. The flag holds MIS back as a
  // whole, backend included: with the ARR URL set and the flag off, a gate that
  // still asked would hold every Finance landing on /user-info, and report its
  // failure as Finance's, for screens nobody can open.
  const misGate = useMisGate(active.key === "finance" && isPreviewEnabled("mis"));

  // Leave is the same problem again: its backend numbers LEAD 879 /
  // PEOPLE_OPS_TEAM 789, unrelated to people-app's 993 / 999. Reading
  // `requires` against `caps` showed Reports to a people-app lead who cannot
  // use it, and hid it from a leave lead who can.
  const leaveGate = useLeaveGate(active.key === "me");

  // Banking is open to callers the banking backend says are employees. Its
  // entry lives under Me, so only ask while Me is active.
  const bankingAccess = useBankingAccess(active.key === "me");

  // Banking's admin screens are the same shape of problem again, reachable
  // from two perspectives (People Ops and Finance — see BANKING_ADMIN_SECTION
  // in perspectives.ts), so only fetched while either is active.
  const bankingAdminAccess = useBankingAdminAccess(active.key === "people" || active.key === "finance");

  // Marketing Ops is the same shape of problem and needs the same treatment:
  // its rail gates on the MARKETING OPS backend's own Asgardeo groups
  // (app-marketingops-*), which bear no relation to the people-app privilege
  // numbers `caps` is built from. Reading `requires` against `caps` would show
  // a people-app admin every marketing screen — including ones the marketing
  // backend then 403s — and hide them from an actual Marketing Ops admin who
  // happens not to be a people-app admin. The registry says as much at
  // @constants/perspectives: the `requires` on those sections is a coarse hint,
  // and whatever renders them has to ask this gate.
  const isMarketingOps = active.key === "marketing";
  const marketingOpsGate = useMarketingOpsGate(isMarketingOps);

  // Due Diligence is the same shape of problem again, and needs the same
  // treatment: it gates on ITS OWN backend's roles, which bear no relation to
  // the people-app privilege numbers `caps` is built from. It is reachable
  // from two perspectives (Finance and Legal — see DUE_DILIGENCE_APPS), so
  // the gate is enabled for either.
  const dueDiligenceGate = useDueDiligenceGate(active.key === "finance" || active.key === "legal");
  const securityGate = useSecurityGate(active.key === "security");
  // Sales: rows hidden when meet-app refuses the caller outright (403) -- see useSalesRailGate.
  const salesGate = useSalesRailGate(active.key === "sales");

  // Subscriptions (PickMe Commute / LaaS) is the same shape of problem once
  // more, with one extra wrinkle worth naming: its backend publishes the
  // NAMES of its two admin Asgardeo groups on /subscriptions/meta-info and
  // leaves the comparison against the caller's own groups to the client,
  // because it has no `/me` of its own. So the gate here is a join of that
  // response and the id_token, not a single backend verdict — see
  // useSubscriptionGate. Only fetched while People Ops is the active
  // perspective; every other perspective has no business calling it.
  const isPeopleOps = active.key === "people";
  const subscriptionGate = useSubscriptionGate(isPeopleOps);

  // PAR's Lead Portal is the same shape of problem once more: its
  // `isTeamLead` comes from par-app's own backend, PAR-cycle-scoped, and
  // bears no fixed relationship to people-app's generic "lead" privilege
  // `caps` is built from — the two can disagree in either direction.
  // useParCanSeeLeadPortal also ORs in the org-chart signal so the item
  // stays visible once a lead's cycle closes, matching
  // ParRequiresTeamLeadRoute (the route guard that actually enforces this).
  // Only fetched while People Ops is active; fails closed while resolving.
  const parLeadPortalGate = useParCanSeeLeadPortal(userInfo.data?.workEmail, isPeopleOps);

  // Admin Portal's own gate — a JWT decode, not a backend call, so unlike
  // every gate above there's no per-perspective fetch to avoid by disabling it.
  const parAdminPortalGate = useParIsAdmin();

  // The employee-facing "PAR" item under Me — see useParEmployeeItemVisible
  // for why this hides for interns. `useMeProfile` (not `useUserInfo`)
  // because `employmentType` only lives on the fuller /employees/{id}
  // record; sharing its query key with every other `useMeProfile()` caller
  // means this is a fresh request only the first time something asks, on
  // Me. Only fetched while Me is active — every other perspective has no
  // business asking.
  const isMe = active.key === "me";
  const meProfile = useMeProfile(undefined, isMe);
  // `isMe &&`: a disabled query's isPending stays true forever, so without
  // this isResolving would read true on every other perspective too.
  const parEmployeeItemGate = useParEmployeeItemVisible(
    meProfile.data?.employee?.employmentType,
    isMe && meProfile.isPending,
  );

  // promotion-app's Lead Portal — same shape of problem as PAR's above: its
  // Role.LEAD comes from promotion-app's own backend and bears no fixed
  // relationship to people-app's generic "lead" privilege `caps` is built
  // from. Only fetched while People Ops is active.
  const promotionLeadPortalGate = usePromotionPrivileges(
    userInfo.data?.workEmail,
    isPeopleOps && isPreviewEnabled("promotion"),
  );

  // UMT is the same shape of problem again: Product Management is
  // UMT_ADMIN-only, decided by UMT's own /update/user-info roles, which bear
  // no relation to the people-app privilege numbers `caps` is built from.
  // Only fetched while UMT is the active perspective.
  const isUmt = active.key === "umt";
  const umtGate = useUmtGate(isUmt);

  // Both services are a Colombo-office perk, so both screens are Sri-Lanka-only
  // — see isSriLankaWorkLocation. They now sit in different perspectives (self
  // service under Me, manage-on-behalf under People Ops), which is why the ids
  // are gated by SUBSCRIPTION_ITEM_IDS rather than by where they appear.
  // `userInfo` is the SAME call `caps` above already makes (people-app's
  // /user-info), so this piggybacks on an existing fetch rather than adding
  // one: no new request, just one more field read off a response already in
  // flight for every perspective. While it's unresolved, `workLocation` reads
  // as undefined and this returns false — the same fail-closed-while-loading
  // behaviour `caps`-gated items already get from `capabilitiesFromPrivileges`
  // defaulting privileges to `[]`, so a gate is never mistakenly satisfied
  // just because its data hasn't landed yet.
  //
  // Beyond that: the self-service screen is open to every Sri Lanka employee —
  // opting yourself in and out is not an HR-team action, which is why it needs
  // no subscriptionGate fetch and works on Me where the gate is not enabled.
  // Only the manage-on-behalf screen ALSO needs a group, and it stays hidden
  // while that gate is still resolving too: showing it first and withdrawing
  // it a moment later reads as the rail flickering, and failing CLOSED is the
  // right default for an admin entry point either way.
  const isSriLankaEmployee = isSriLankaWorkLocation(userInfo.data?.workLocation);

  // Memoised because `?? []` would otherwise hand a fresh array to the
  // dependency lists in SideRail on every render, defeating its useMemos.
  const sections = useMemo(() => active.sections ?? [], [active.sections]);

  const answer = (name: AdapterName): VisibilityAnswer => {
    switch (name) {
      case "par":
        return parVisibility({
          admin: parAdminPortalGate,
          lead: parLeadPortalGate,
          employee: parEmployeeItemGate,
          profileFailed: meProfile.isError,
        });
      case "marketing":
        return marketingVisibility(marketingOpsGate);
      case "due-diligence":
        return dueDiligenceVisibility(dueDiligenceGate);
      case "finance":
        return financeVisibility(financeGate);
      case "leave":
        return leaveVisibility(leaveGate);
      case "banking":
        return bankingVisibility(bankingAccess);
      case "banking-admin":
        return bankingAdminVisibility(bankingAdminAccess);
      case "infra":
        return infraVisibility(infraGate);
      case "sales":
        return salesVisibility(salesGate);
      case "promotion":
        return promotionVisibility(promotionLeadPortalGate);
      case "security":
        return securityVisibility(securityGate);
      case "umt":
        return umtVisibility(umtGate);
      case "subscriptions":
        return subscriptionVisibility(subscriptionGate);
      case "mis":
        return misVisibility(misGate);
      default: {
        const neverName: never = name;
        return neverName;
      }
    }
  };

  const snapshot = (name: AdapterName): VisibilityAdapter => ({
    name,
    claim: claimOf(name),
    ...answer(name),
  });

  const folded = foldVisibility(
    claimsForPerspective(active.key).map(snapshot),
    {
      perspectiveKey: active.key,
      sectionIds: sectionIdsIn(sections),
      sriLankaOnlyIds: SRI_LANKA_ONLY_ITEM_IDS,
      isSriLankaEmployee,
      employeeRecordResolving: userInfo.isLoading,
      employeeRecordFailed: userInfo.isError,
      employeeRecordError: userInfo.error,
      retryEmployeeRecord: () => void userInfo.refetch(),
      capabilities: caps,
    },
  );

  const resolveVisible = (section: PerspectiveSection): boolean => folded.canSee(section);
  const visibleLeaves = visibleLeavesOf(sections, resolveVisible);

  return {
    resolveVisible,
    isResolving: folded.resolving,
    visibleLeaves,
    isError: folded.failed,
    error: folded.error,
    retry: folded.retry,
  };
}

