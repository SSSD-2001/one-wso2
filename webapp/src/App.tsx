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

import { Suspense, lazy } from "react";
import { Skeleton } from "@wso2/oxygen-ui";
import { Navigate, Route, Routes } from "react-router";
import { landingPath } from "@config/landingConfig";
import SettingsPage from "@features/settings/pages/SettingsPage";
import MenuHomePage from "@features/menu/pages/MenuHomePage";
import TilEntryRoute from "@features/til/pages/TilEntryRoute";
import TilHomePage from "@features/til/pages/TilHomePage";
import OrgChartPage from "@features/org-chart/pages/OrgChartPage";
import SalesMeetingsPage from "@features/sales/pages/SalesMeetingsPage";
import MeetingDetailPage from "@features/sales/pages/MeetingDetailPage";
import SalesDealsPage from "@features/sales/pages/SalesDealsPage";
import DealPage from "@features/sales/pages/DealPage";
import PromotionHistoryPage from "@features/promotion/pages/PromotionHistoryPage";
import PromotionRequiresEmployeeRoute from "@features/promotion/components/PromotionRequiresEmployeeRoute";
import PromotionRequiresLeadRoute from "@features/promotion/components/PromotionRequiresLeadRoute";
import LeadPortalPage, { LeadPortalIndex } from "@features/promotion/pages/LeadPortalPage";
import LeadPendingRequestsTab from "@features/promotion/pages/LeadPendingRequestsTab";
import LeadHistoryTab from "@features/promotion/pages/LeadHistoryTab";
import TeamPromotionHistoryPage, {
  TeamPromotionHistoryIndex,
} from "@features/promotion/pages/TeamPromotionHistoryPage";
import TeamDirectReportsTab from "@features/promotion/pages/TeamDirectReportsTab";
import TeamIndirectReportsTab from "@features/promotion/pages/TeamIndirectReportsTab";
import PromotionRequiresFunctionalLeadRoute from "@features/promotion/components/PromotionRequiresFunctionalLeadRoute";
import FunctionalLeadPortalPage, {
  FunctionalLeadPortalIndex,
} from "@features/promotion/pages/FunctionalLeadPortalPage";
import FLActiveRequestsTab from "@features/promotion/pages/FLActiveRequestsTab";
import FLApprovedListTab from "@features/promotion/pages/FLApprovedListTab";
import FLRejectedListTab from "@features/promotion/pages/FLRejectedListTab";
import FLTimeBasedTab from "@features/promotion/pages/FLTimeBasedTab";
import PromotionRequiresPromotionBoardRoute from "@features/promotion/components/PromotionRequiresPromotionBoardRoute";
import PromotionBoardPortalPage, {
  PromotionBoardPortalIndex,
} from "@features/promotion/pages/PromotionBoardPortalPage";
import PBActiveRequestsTab from "@features/promotion/pages/PBActiveRequestsTab";
import PBApprovedListTab from "@features/promotion/pages/PBApprovedListTab";
import PBRejectedListTab from "@features/promotion/pages/PBRejectedListTab";
import PBFLRejectedListTab from "@features/promotion/pages/PBFLRejectedListTab";
import PromotionRequiresHrAdminRoute from "@features/promotion/components/PromotionRequiresHrAdminRoute";
import PromotionAdminPortalPage, {
  PromotionAdminPortalIndex,
} from "@features/promotion/pages/PromotionAdminPortalPage";
import AdminPromotionCycleTab from "@features/promotion/pages/AdminPromotionCycleTab";
import AdminTimeBasedPromotionsTab from "@features/promotion/pages/AdminTimeBasedPromotionsTab";
import AdminIndividualContributorTab from "@features/promotion/pages/AdminIndividualContributorTab";
import AdminWithdrawalRequestsTab from "@features/promotion/pages/AdminWithdrawalRequestsTab";
import AdminUserManagementTab from "@features/promotion/pages/AdminUserManagementTab";
import PromotionRequiresCycleHistoryRoute from "@features/promotion/components/PromotionRequiresCycleHistoryRoute";
import PromotionCycleHistoryPage, {
  PromotionCycleHistoryIndex,
} from "@features/promotion/pages/PromotionCycleHistoryPage";
import CycleHistoryTab from "@features/promotion/pages/CycleHistoryTab";
import PeopleHrArchiveTab from "@features/promotion/pages/PeopleHrArchiveTab";
import AuthGuard from "@layouts/AuthGuard";
import { isPreviewEnabled } from "@config/previewFeatures";
import AppLayout from "@layouts/AppLayout";
import ActiveEmployeesReportPage from "@features/people-ops/pages/ActiveEmployeesReportPage";
import ResignationsReportPage from "@features/people-ops/pages/ResignationsReportPage";
import OrgStructurePage from "@features/people-ops/pages/OrgStructurePage";
import MySubscriptionsPage from "@features/subscriptions/pages/MySubscriptionsPage";
import ManageSubscriptionsPage from "@features/subscriptions/pages/ManageSubscriptionsPage";
import EmployeeDetailPage from "@features/people-ops/pages/EmployeeDetailPage";
import MyProfilePage from "@features/my/pages/MyProfilePage";
import ParGroupPage, {
  ParGroupIndex,
  ParRequiresActiveCycleRoute,
  ParRequiresLeadRoute,
  ParRequiresSomethingToShowRoute,
} from "@features/par/pages/ParGroupPage";
import ParLeadGroupPage, { ParLeadGroupIndex, ParRequiresTeamLeadRoute } from "@features/par/pages/ParLeadGroupPage";
import ParAdminGroupPage, { ParAdminGroupIndex, ParRequiresAdminRoute } from "@features/par/pages/ParAdminGroupPage";
// Lazy on purpose, same reasoning as the leave report tabs below —
// react-quill-new, jspdf/jspdf-autotable and dompurify are pulled in
// transitively, and only someone who opens /me/performance needs them.
const ParEmployeeFeedbackTab = lazy(() => import("@features/par/pages/ParEmployeeFeedbackTab"));
const ParRequestFeedbackTab = lazy(() => import("@features/par/pages/ParRequestFeedbackTab"));
const ParProvideFeedbackTab = lazy(() => import("@features/par/pages/ParProvideFeedbackTab"));
const ParF2fTab = lazy(() => import("@features/par/pages/ParF2fTab"));
const ParHistoryTab = lazy(() => import("@features/par/pages/ParHistoryTab"));
const ParLeadDirectReportsTab = lazy(() => import("@features/par/pages/ParLeadDirectReportsTab"));
const ParLeadAdditionalReportsTab = lazy(() => import("@features/par/pages/ParLeadAdditionalReportsTab"));
const ParLeadReportChainTab = lazy(() => import("@features/par/pages/ParLeadReportChainTab"));
const ParLeadEmployeeHistoryTab = lazy(() => import("@features/par/pages/ParLeadEmployeeHistoryTab"));
const ParLeadAllocationTab = lazy(() => import("@features/par/pages/ParLeadAllocationTab"));
const ParAdminOngoingTab = lazy(() => import("@features/par/pages/ParAdminOngoingTab"));
const ParAdminHistoryTab = lazy(() => import("@features/par/pages/ParAdminHistoryTab"));
const ParAdminGlobalConfigTab = lazy(() => import("@features/par/pages/ParAdminGlobalConfigTab"));
import EmailGroupsPage from "@features/my/email-groups/pages/EmailGroupsPage";
import EmailSignaturePage from "@features/my/email-signature/pages/EmailSignaturePage";
import BankingRoute from "@features/my/banking/components/BankingRoute";
import BankingPage, { BankingIndex } from "@features/my/banking/pages/BankingPage";
import MyAccountsTab from "@features/my/banking/pages/MyAccountsTab";
import SummaryTab from "@features/my/banking/pages/SummaryTab";
import BankingAdminRoute from "@features/banking-admin/components/BankingAdminRoute";
import BankingAdminTabRoute from "@features/banking-admin/components/BankingAdminTabRoute";
import BankingAdminPage, { BankingAdminIndex } from "@features/banking-admin/pages/BankingAdminPage";
import ChangeRequestsTab from "@features/banking-admin/pages/ChangeRequestsTab";
import ReportTab from "@features/banking-admin/pages/ReportTab";
import EmployeeOperationsTab from "@features/banking-admin/pages/EmployeeOperationsTab";
import AdminTab from "@features/banking-admin/pages/AdminTab";
import MyTeamPage from "@features/my/my-team/pages/MyTeamPage";
import TeamMemberPage from "@features/my/my-team/pages/TeamMemberPage";
import PerspectiveLanding from "@components/perspective-landing/PerspectiveLanding";
import SriLankaRoute from "@components/route-guards/SriLankaRoute";
import MasterDataRoute from "@components/route-guards/MasterDataRoute";
import AdCampaignsAnalyticsPage from "@features/marketing-ops/ad-campaigns/pages/AdCampaignsAnalyticsPage";
import CampaignTrackerPage from "@features/marketing-ops/ad-campaigns/pages/CampaignTrackerPage";
import UtmGeneratorPage from "@features/marketing-ops/utilities/pages/UtmGeneratorPage";
import AssetNameGeneratorPage from "@features/marketing-ops/utilities/pages/AssetNameGeneratorPage";
import UtmSettingsPage from "@features/marketing-ops/admin/pages/UtmSettingsPage";
import AssetNameSettingsPage from "@features/marketing-ops/admin/pages/AssetNameSettingsPage";
import EmailWorkbenchSettingsPage from "@features/marketing-ops/admin/pages/EmailWorkbenchSettingsPage";
import BlockCatalogPage from "@features/marketing-ops/email-workbench/pages/BlockCatalogPage";
import EventsSettingsPage from "@features/marketing-ops/admin/pages/EventsSettingsPage";
import PostBuilderPage from "@features/marketing-ops/design-studio/pages/PostBuilderPage";
import {
  EventsMinePage,
  EventsReviewPage,
} from "@features/marketing-ops/events/pages/EventsPages";
import { eventPlatformRoutes } from "@features/marketing-ops/event-platform/routes";
import {
  CrmUploadPipelinesPage,
  CrmUploadRecordsPage,
  CrmUploadReviewPage,
  CrmUploadRunLogPage,
} from "@features/marketing-ops/crm-upload/pages/CrmUploadPages";
import {
  EmailWorkbenchCreatePage,
  EmailWorkbenchHistoryPage,
  EmailWorkbenchManagePage,
} from "@features/marketing-ops/email-workbench/pages/EmailWorkbenchPages";
import LeavePage, {
  LeaveIndex,
  LeaveKindRoute,
  LeaveTabIndex,
} from "@features/leave/pages/LeavePage";
import GeneralApplyTab from "@features/leave/pages/LeaveApplyPage";
import GeneralHistoryTab, {
  SabbaticalHistoryTab,
} from "@features/leave/pages/LeaveHistoryPage";
import SabbaticalApproveTab from "@features/leave/components/SabbaticalApproveTab";
import SabbaticalApprovalHistoryTab from "@features/leave/components/SabbaticalApprovalHistoryTab";
// Lazy on purpose. This is the only screen that pulls in the DataGrid, which
// costs ~115 kB gzipped — and only leads and People Ops can open it, so loading
// it for everyone taxes the many for the few. The sabbatical approve and report
// screens will share the same chunk when they land.
const GeneralReportTab = lazy(() => import("@features/leave/pages/LeaveReportsPage"));
const SabbaticalReportTab = lazy(
  () => import("@features/leave/components/SabbaticalReportTab"),
);
// Sales Library: only routed when the `smartSearch` preview flag is on.
const LibraryPage = lazy(() => import("@features/sales/smartSearch/pages/LibraryPage"));

import SabbaticalApplyTab from "@features/leave/pages/LeaveSabbaticalPage";
import ClaimsPage, { ClaimsIndex } from "@features/finance/claims/ClaimsPage";
import OpdNewClaimPage from "@features/finance/opd/pages/OpdNewClaimPage";
// The company-wide analytics screen, not a personal one — everyone's spend,
// not your own. Claim History used to live here too as its own Finance app;
// retired once Me → Claims → OPD covered the same queue, filters and all.
import OpdDashboardScreen from "@features/finance/opd/dashboard/OpdDashboardScreen";
import ExpenseDashboardScreen from "@features/finance/expense/dashboard/ExpenseDashboardScreen";
import OpdClaimsTab from "@features/finance/opd/pages/OpdHistoryPage";
import FinanceOverviewPage from "@features/finance/overview/FinanceOverviewPage";
import { FINANCE_OVERVIEW_ROUTE } from "@features/finance/overview/financeOverviewPaths";
import CcDashboardPage from "@features/finance/cc/pages/CcDashboardPage";
import CcNewTransactionsPage from "@features/finance/cc/pages/CcNewTransactionsPage";
import CcPendingPage from "@features/finance/cc/pages/CcPendingPage";
import CcApprovePage from "@features/finance/cc/pages/CcApprovePage";
import CcHistoryPage from "@features/finance/cc/pages/CcHistoryPage";
import CcSettingsPage from "@features/finance/cc/pages/CcSettingsPage";
import SubsidiariesPage from "@features/finance/masterdata/pages/SubsidiariesPage";
import DepartmentsPage from "@features/finance/masterdata/pages/DepartmentsPage";
import ExpenseTypesPage from "@features/finance/masterdata/pages/ExpenseTypesPage";
import CreditCardsPage from "@features/finance/masterdata/pages/CreditCardsPage";
import ExpenseNewClaimPage from "@features/finance/expense/pages/ExpenseNewClaimPage";
import MisArrBuildPage from "@features/finance/mis/pages/MisArrBuildPage";
import MisSession from "@features/finance/mis/components/MisSession";
import { misPaths } from "@constants/misApps";
import { MIS_PERIODS } from "@features/finance/mis/util/misViewVocabulary";
import MisArrAnalysisPage from "@features/finance/mis/pages/MisArrAnalysisPage";
import MisAnalysisRedirect from "@features/finance/mis/pages/MisAnalysisRedirect";
import ExpenseClaimsTab from "@features/finance/expense/pages/ExpenseHistoryPage";
import ClaimApprovalPage, {
  ClaimApprovalIndex,
  ClaimApprovalTabRoute,
} from "@features/finance/approvals/ClaimApprovalPage";
import NeedsYouTab from "@features/finance/approvals/NeedsYouTab";
import DecidedTab from "@features/finance/approvals/DecidedTab";
import NdaPage from "@features/legal/pages/NdaPage";
import { riskRoutes } from "@features/security/grc/modules/risk/routes";
import { auditRoutes } from "@features/security/grc/modules/audit/routes";
import { adminRoutes } from "@features/security/grc/modules/admin/routes";
import { evidenceRoutes } from "@features/security/evidence-portal/routes";
import { cado2Routes } from "@features/sales/cado2/routes";
import PartnersListPage from "@features/due-diligence/partners/pages/PartnersListPage";
import PartnerPendingPage from "@features/due-diligence/partners/pages/PartnerPendingPage";
import PartnerDashboardPage from "@features/due-diligence/partners/pages/PartnerDashboardPage";
import TradeReferencesListPage from "@features/due-diligence/trade-references/pages/TradeReferencesListPage";
import TradeReferenceDashboardPage from "@features/due-diligence/trade-references/pages/TradeReferenceDashboardPage";
import TradeReferencePendingPage from "@features/due-diligence/trade-references/pages/TradeReferencePendingPage";
import TradeReferenceRejectedPage from "@features/due-diligence/trade-references/pages/TradeReferenceRejectedPage";
import TradeReferenceDeactivatedPage from "@features/due-diligence/trade-references/pages/TradeReferenceDeactivatedPage";
import DueDiligencePreferencesPage from "@features/due-diligence/preferences/pages/PreferencesPage";
import ViewPdfPage from "@features/due-diligence/shared/pages/ViewPdfPage";
import ViewImagePage from "@features/due-diligence/shared/pages/ViewImagePage";
import UmtCreateReleaseChunkPage from "@features/umt/pages/UmtCreateReleaseChunkPage";
import UmtHomePage from "@features/umt/pages/UmtHomePage";
import UmtProductsPage from "@features/umt/pages/UmtProductsPage";
import UmtReleaseChunksPage from "@features/umt/pages/UmtReleaseChunksPage";
import UmtStatisticsPage from "@features/umt/pages/UmtStatisticsPage";
import UmtUpdateView from "@features/umt/pages/UmtUpdateView";
import UmtUpdatesPage from "@features/umt/pages/UmtUpdatesPage";
import { engineeringRoutes } from "@features/engineering/routes";
import InfraHomePage from "@features/infra/pages/InfraHomePage";
import InfraNewRepositoryPage from "@features/infra/pages/InfraNewRepositoryPage";
import InfraGitHubCallbackPage from "@features/infra/pages/InfraGitHubCallbackPage";
import InfraRepositoryAccessPage from "@features/infra/pages/InfraRepositoryAccessPage";
import InfraGitHubSettingsPage from "@features/infra/pages/InfraGitHubSettingsPage";
import InfraMyRequestsPage from "@features/infra/pages/InfraMyRequestsPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>
          {/* Where the app opens: the user's own choice, or Me. */}
          <Route index element={<Navigate to={landingPath()} replace />} />
          {/* Me home — the full profile page including Connected apps. */}
          <Route path="me" element={<MyProfilePage />} />
          {/* Engineering → Download Stats, routed as perspective / app / screen,
              with the earlier addresses forwarding. The feature owns the
              tree, as CadO2 and the GRC modules own theirs. */}
          {engineeringRoutes}
          {/* Engineering → UMT. UmtShell owns its role gate. Behind the same
              preview flag as its rail group — hiding only the rail entries
              would leave the routes reachable by URL. Nested under
              /engineering/ so the Engineering rail renders around them. */}
          {isPreviewEnabled("umt") && (
            <>
              <Route path="engineering/umt" element={<UmtHomePage />} />
              <Route path="engineering/umt/updates" element={<UmtUpdatesPage />} />
              <Route path="engineering/umt/updates/:id" element={<UmtUpdateView />} />
              {/* Admin-only: UmtProductsPage itself enforces this via UmtShell's
                  requireAdmin, independent of the rail item's own visibility. */}
              <Route path="engineering/umt/products" element={<UmtProductsPage />} />
              <Route path="engineering/umt/release-chunks" element={<UmtReleaseChunksPage />} />
              <Route path="engineering/umt/release-chunks/new" element={<UmtCreateReleaseChunkPage />} />
              <Route path="engineering/umt/statistics" element={<UmtStatisticsPage />} />
            </>
          )}
          {isPreviewEnabled("infra") && (
            <>
              <Route path="infra" element={<InfraHomePage />} />
              <Route
                  path="infra/github/repository-requests"
                  element={<InfraNewRepositoryPage />}
              />
              <Route path="infra/github/callback" element={<InfraGitHubCallbackPage />} />
              <Route
                path="infra/github/repository-access-requests"
                element={<InfraRepositoryAccessPage />}
              />
              <Route path="infra/admin/github-settings" element={<InfraGitHubSettingsPage />} />
              <Route path="infra/github/my-requests" element={<InfraMyRequestsPage />} />
            </>
          )}
          {/* My Team — placeholder for now; the real subordinates view is on
              hold this iteration (mirrors people-app's lead-only nav item). */}
          {/* My Team — a lead's reporting chain, ported from people-app. */}
          <Route path="me/my-team" element={<MyTeamPage />} />
          <Route path="me/my-team/:employeeId" element={<TeamMemberPage />} />
          {/* Me → Leave: native screens ported from leave-app. Lives here
              (not People Ops) — it's something every employee does for
              themself, not an HR-team tool. */}
          {/* Me → Leave. ONE entry, tabs named for the action, and the kind of
              leave as a route segment inside the tabs that offer both — the
              source's own nesting (route.ts:47-150). The kind is in the URL
              rather than in state because these guards are the enforcement:
              a hidden toggle is not access control. See leaveTabs.ts. */}
          <Route path="me/leave" element={<LeavePage />}>
            <Route index element={<LeaveIndex />} />

            <Route path="apply">
              <Route index element={<LeaveTabIndex segment="apply" />} />
              <Route
                path="general"
                element={
                  <LeaveKindRoute gateId="leave-apply">
                    <GeneralApplyTab />
                  </LeaveKindRoute>
                }
              />
              <Route
                path="sabbatical"
                element={
                  <LeaveKindRoute gateId="leave-sabbatical-own">
                    <SabbaticalApplyTab />
                  </LeaveKindRoute>
                }
              />
            </Route>

            <Route path="history">
              <Route index element={<LeaveTabIndex segment="history" />} />
              <Route
                path="general"
                element={
                  <LeaveKindRoute gateId="leave-history">
                    <GeneralHistoryTab />
                  </LeaveKindRoute>
                }
              />
              <Route
                path="sabbatical"
                element={
                  <LeaveKindRoute gateId="leave-sabbatical-own">
                    <SabbaticalHistoryTab />
                  </LeaveKindRoute>
                }
              />
            </Route>

            {/* Single-kind tabs carry no kind segment: general leave has no
                approval step, so there is no choice to name in the URL. */}
            <Route
              path="approvals"
              element={
                <LeaveKindRoute gateId="leave-approve">
                  <SabbaticalApproveTab />
                </LeaveKindRoute>
              }
            />
            <Route
              path="approval-history"
              element={
                <LeaveKindRoute gateId="leave-approve">
                  <SabbaticalApprovalHistoryTab />
                </LeaveKindRoute>
              }
            />

            <Route path="reports">
              <Route index element={<LeaveTabIndex segment="reports" />} />
              <Route
                path="general"
                element={
                  <LeaveKindRoute gateId="leave-reports-general">
                    {/* Skeleton rather than null: the chunk is fetched on
                        navigation, and a blank frame reads as a broken link. */}
                    <Suspense fallback={<Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1.5 }} />}>
                      <GeneralReportTab />
                    </Suspense>
                  </LeaveKindRoute>
                }
              />
              <Route
                path="sabbatical"
                element={
                  <LeaveKindRoute gateId="leave-reports-sabbatical">
                    <Suspense fallback={<Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1.5 }} />}>
                      <SabbaticalReportTab />
                    </Suspense>
                  </LeaveKindRoute>
                }
              />
            </Route>
          </Route>
          {/* Me → digiops-finance claim apps: native screens ported from the
              three finance apps (opd-claims, cc-expenses, expense-claims).
              Moved in from the Finance perspective — same rationale as
              Leave, an employee submits/tracks these for themself (a
              lead/finance-approver subset of items approves others'). What is
              left in the Finance perspective is approving other people's. */}
          {/* Me → Claims: the two things you file for yourself, one entry with
              a tab each. The forms keep routes of their own — both are long,
              both hold a draft, and both are worth linking to directly — and
              are reached through the New claim menu, because no single form
              could take both types. See features/finance/claims. */}
          <Route path="me/claims" element={<ClaimsPage />}>
            <Route index element={<ClaimsIndex />} />
            <Route path="expense" element={<ExpenseClaimsTab />} />
            {/* Colombo-office perk, so the ROUTE refuses it too — hiding the
                tab only stopped it being offered, not being typed. Note the
                similarly-named /finance/claim-approval/opd is NOT guarded: a
                finance approver anywhere may decide a Colombo employee's OPD
                claim. */}
            <Route
              path="opd"
              element={
                <SriLankaRoute>
                  <OpdClaimsTab />
                </SriLankaRoute>
              }
            />
          </Route>
          <Route path="me/claims/expense/new" element={<ExpenseNewClaimPage />} />
          <Route
            path="me/claims/opd/new"
            element={
              <SriLankaRoute>
                <OpdNewClaimPage />
              </SriLankaRoute>
            }
          />
          {/* Finance → Overview. One route for both dashboards, tab-switched
              inside — see FinanceOverviewPage. The two screens it switches
              between keep their own routes below too: nothing that already
              linked straight to one of them (a bookmark, `cc-dashboard`'s old
              rail favourite) should go dead. */}
          <Route path={FINANCE_OVERVIEW_ROUTE} element={<FinanceOverviewPage />} />
          {/* Moved here out of the plain cc routes below: this is the same
              screen the "Dashboard" item used to point at when it lived
              inside Credit Card Expenses. */}
          <Route path="finance/cc/dashboard" element={<CcDashboardPage />} />
          <Route path="finance/cc/new" element={<CcNewTransactionsPage />} />
          <Route path="finance/cc/pending" element={<CcPendingPage />} />
          <Route path="finance/cc/approve" element={<CcApprovePage />} />
          <Route path="finance/cc/history" element={<CcHistoryPage />} />
          <Route path="finance/cc/settings" element={<CcSettingsPage />} />
          <Route path="finance/opd/dashboard" element={<OpdDashboardScreen />} />
          <Route path="finance/expense/dashboard" element={<ExpenseDashboardScreen />} />
          {/* Finance → Master Data: the four reference tables the other
              finance apps are keyed against, each its own route.
              MasterDataRoute-guarded: this backend has no role scheme of its
              own, so the frontend's admin + preview-flag check is the only
              access control in front of it — it has to hold at the route,
              not just hide the rail item. */}
          <Route
            path="finance/master-data/subsidiaries"
            element={<MasterDataRoute><SubsidiariesPage /></MasterDataRoute>}
          />
          <Route
            path="finance/master-data/departments"
            element={<MasterDataRoute><DepartmentsPage /></MasterDataRoute>}
          />
          <Route
            path="finance/master-data/expense-types"
            element={<MasterDataRoute><ExpenseTypesPage /></MasterDataRoute>}
          />
          <Route
            path="finance/master-data/credit-cards"
            element={<MasterDataRoute><CreditCardsPage /></MasterDataRoute>}
          />
          {/* Finance MIS. Nested under /finance/ rather than /finance-mis/,
              because findPerspectiveByPath matches with a bare
              pathname.startsWith — "/finance-mis" resolves to the finance
              perspective and would render its rail around a MIS screen.

              All four screens are routed, and each joined the registry in the
              same change that gave it a route — the rail renders every visible
              child of a group whether or not it carries a path, so an entry
              without one is a row that silently does nothing.

              Access is NOT enforced here: MisShell asks useMisGate, so typing a
              URL you may not use gives a legible locked state rather than a
              redirect that leaves the reader guessing.

              Portfolio is the one exception, and it is a different question.
              `productsUsageEnabled` decides whether that screen EXISTS rather
              than who may read it, so with the flag off its route redirects to
              ARR Build — see MisArrAnalysisPage, which holds the redirect
              itself so that a flag not yet known is neither. */}
          {/* A layout route for one reason: the session Years Back. A reader
              who has set three years keeps three years across MIS screens, and
              it is held in memory alone (it dies with the tab) — so its provider
              has to outlive any one
              screen. Inside MisShell it would be remounted on every navigation
              between these two. See YearsBackSessionContext. */}
          {/* All three Builds INSIDE `MisSession`, not beside it. The session
              Years Back lives in that layout route, and a Period switch is a
              NAVIGATION rather than a tab — so a Build mounted outside it would
              lose the reader's Years Back on the way over, which is precisely
              the journey the value exists for. Quarterly and Monthly default to
              1 where Annually defaults to 5, so a missed route shows up as a
              Build that silently re-narrows itself. */}
          <Route element={<MisSession />}>
            <Route
              path="finance/mis/arr-build"
              element={<MisArrBuildPage period={MIS_PERIODS.ANNUALLY} />}
            />
            <Route
              path="finance/mis/qrr-build"
              element={<MisArrBuildPage period={MIS_PERIODS.QUARTERLY} />}
            />
            <Route
              path="finance/mis/mrr-build"
              element={<MisArrBuildPage period={MIS_PERIODS.MONTHLY} />}
            />
            <Route path="finance/mis/portfolio" element={<MisArrAnalysisPage />} />
            <Route path={misPaths.legacyAnalysis} element={<MisAnalysisRedirect />} />
          </Route>
          <Route path="people-ops" element={<PerspectiveLanding />} />
          {/* People Ops → Org Chart: the company's reporting hierarchy, ported
              from the standalone org-chart app. Unlike every other People Ops
              screen, this is NOT admin-gated — it has its own access model.
              The UI is deliberately redesigned (outline instead of pan/zoom
              canvas). */}
          <Route path="people-ops/org-chart" element={<OrgChartPage />} />
          {/* People Ops → Subscriptions: PickMe Commute and LaaS, ported from
              the digiops-hr subscription-app — until now a mobile microapp
              with no web view at all.

              Neither route is guarded here, and the manage route's absence of
              a guard is deliberate rather than an oversight: the service's own
              admin groups decide it, and SubscriptionsShell turns a refusal
              into an explanation. Someone who types the URL gets a sentence
              telling them who to ask, not a blank page — and the backend
              refuses the calls regardless. */}
          {/* Self-service sits under Me; managing on someone's behalf stays
              under People Ops. */}
          <Route
            path="me/subscriptions"
            element={
              <SriLankaRoute>
                <MySubscriptionsPage />
              </SriLankaRoute>
            }
          />
          <Route
            path="people-ops/subscriptions/manage"
            element={
              <SriLankaRoute>
                <ManageSubscriptionsPage />
              </SriLankaRoute>
            }
          />
          {/* Me → Promotion: an employee's own promotion history, for the
              employment types it applies to — PromotionRequiresEmployeeRoute
              redirects the rest to /me. */}
          <Route
            path="me/promotion"
            element={
              <PromotionRequiresEmployeeRoute>
                <PromotionHistoryPage />
              </PromotionRequiresEmployeeRoute>
            }
          />
          {/* Me → PAR: the employee half of par-app, ported one screen at a
              time. Tab names match par-app's own OngoingCycleView tab bar
              (Employee Feedback / Request 360° Feedback / Provide 360°
              Feedback / F2F) rather than invented ones. Not gated beyond
              signing in — every employee has their own PAR — except an intern, who
              never does, regardless of lead or active-cycle status;
              ParRequiresSomethingToShowRoute redirects them to /me. Same
              shape as ParRequiresAdminRoute below. See
              useParEmployeeItemVisible for the full reasoning. */}
          <Route
            path="me/performance"
            element={
              <ParRequiresSomethingToShowRoute>
                <ParGroupPage />
              </ParRequiresSomethingToShowRoute>
            }
          >
            <Route index element={<ParGroupIndex />} />
            {/* Employee Feedback and Request 360° are hidden from a leadless
                employee entirely in the source (OngoingCycleView.tsx), not
                merely disabled — ParRequiresLeadRoute enforces that at the
                route, the same way the tab bar itself is filtered.
                ParRequiresActiveCycleRoute wraps every tab but History:
                none of them has anything to act on once the cycle closes. */}
            <Route
              path="employee-feedback"
              element={
                <ParRequiresActiveCycleRoute>
                  <ParRequiresLeadRoute>
                    <Suspense fallback={<Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />}>
                      <ParEmployeeFeedbackTab />
                    </Suspense>
                  </ParRequiresLeadRoute>
                </ParRequiresActiveCycleRoute>
              }
            />
            <Route
              path="request-360"
              element={
                <ParRequiresActiveCycleRoute>
                  <ParRequiresLeadRoute>
                    <Suspense fallback={<Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />}>
                      <ParRequestFeedbackTab />
                    </Suspense>
                  </ParRequiresLeadRoute>
                </ParRequiresActiveCycleRoute>
              }
            />
            <Route
              path="provide-360"
              element={
                <ParRequiresActiveCycleRoute>
                  <Suspense fallback={<Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />}>
                    <ParProvideFeedbackTab />
                  </Suspense>
                </ParRequiresActiveCycleRoute>
              }
            />
            {/* F2F is leadless-gated too — OngoingCycleView.tsx's leadless
                branch has no F2F tab at all, same as Employee Feedback and
                Request 360°. */}
            <Route
              path="f2f"
              element={
                <ParRequiresActiveCycleRoute>
                  <ParRequiresLeadRoute>
                    <Suspense fallback={<Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />}>
                      <ParF2fTab />
                    </Suspense>
                  </ParRequiresLeadRoute>
                </ParRequiresActiveCycleRoute>
              }
            />
            <Route
              path="history"
              element={
                <Suspense fallback={<Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />}>
                  <ParHistoryTab />
                </Suspense>
              }
            />
          </Route>
          {/* People Ops → PAR → Lead Portal: par-app's LeadPortal.tsx, ported
              one tab at a time — all five tabs are now live. Reviewing and
              rating your reports' PAR is People-Ops-team work, unlike the
              employee half (now under Me).
              Gated on ParRequiresTeamLeadRoute (par-app's own Role.TEAM_LEAD
              gate on /lead-portal). */}
          <Route
            path="people-ops/performance/lead"
            element={
              <ParRequiresTeamLeadRoute>
                <ParLeadGroupPage />
              </ParRequiresTeamLeadRoute>
            }
          >
            <Route index element={<ParLeadGroupIndex />} />
            <Route
              path="direct-reports"
              element={
                <Suspense fallback={<Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />}>
                  <ParLeadDirectReportsTab />
                </Suspense>
              }
            />
            <Route
              path="additional-reports"
              element={
                <Suspense fallback={<Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />}>
                  <ParLeadAdditionalReportsTab />
                </Suspense>
              }
            />
            <Route
              path="report-chain"
              element={
                <Suspense fallback={<Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />}>
                  <ParLeadReportChainTab />
                </Suspense>
              }
            />
            <Route
              path="employee-history"
              element={
                <Suspense fallback={<Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />}>
                  <ParLeadEmployeeHistoryTab />
                </Suspense>
              }
            />
            <Route
              path="allocation"
              element={
                <Suspense fallback={<Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />}>
                  <ParLeadAllocationTab />
                </Suspense>
              }
            />
          </Route>
          {/* People Ops → PAR → Admin Portal. ParRequiresAdminRoute reads
              isAdmin off the backend's own GET /employees/{workEmail}
              self-lookup, the same adminLdapGroup check every admin
              endpoint already enforces server-side. */}
          <Route
            path="people-ops/performance/admin"
            element={
              <ParRequiresAdminRoute>
                <ParAdminGroupPage />
              </ParRequiresAdminRoute>
            }
          >
            <Route index element={<ParAdminGroupIndex />} />
            <Route
              path="ongoing"
              element={
                <Suspense fallback={<Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />}>
                  <ParAdminOngoingTab />
                </Suspense>
              }
            />
            <Route
              path="history"
              element={
                <Suspense fallback={<Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />}>
                  <ParAdminHistoryTab />
                </Suspense>
              }
            />
            <Route
              path="configurations"
              element={
                <Suspense fallback={<Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />}>
                  <ParAdminGlobalConfigTab />
                </Suspense>
              }
            />
          </Route>
          {/* People Ops → Promotion (Lead/Team History/Functional Lead/
              Board/Admin/Cycle History portals). Each portal's own role guard
              (PromotionRequires*Route) decides who can open it. */}
          {/* Lead Portal ("Time Based Promotions"): reviewing and deciding on
              other people's promotions is People-Ops-team work, the same
              split PAR's Lead Portal above already applies. Gated on
              PromotionRequiresLeadRoute (the lead privilege read back from
              GET /employee-privileges). */}
          <Route
            path="people-ops/promotion/lead"
            element={
              <PromotionRequiresLeadRoute>
                <LeadPortalPage />
              </PromotionRequiresLeadRoute>
            }
          >
            <Route index element={<LeadPortalIndex />} />
            <Route path="pending" element={<LeadPendingRequestsTab />} />
            <Route path="history" element={<LeadHistoryTab />} />
          </Route>
          {/* Team Promotion History: a separate screen from the Lead Portal
              above, listing promotions received by a lead's direct and
              indirect reports. Gated on PromotionRequiresLeadRoute. */}
          <Route
            path="people-ops/promotion/team-history"
            element={
              <PromotionRequiresLeadRoute>
                <TeamPromotionHistoryPage />
              </PromotionRequiresLeadRoute>
            }
          >
            <Route index element={<TeamPromotionHistoryIndex />} />
            <Route path="direct-reports" element={<TeamDirectReportsTab />} />
            <Route path="indirect-reports" element={<TeamIndirectReportsTab />} />
          </Route>
          {/* Functional Lead Portal: gated on the functional lead privilege
              via PromotionRequiresFunctionalLeadRoute. */}
          <Route
            path="people-ops/promotion/functional-lead"
            element={
              <PromotionRequiresFunctionalLeadRoute>
                <FunctionalLeadPortalPage />
              </PromotionRequiresFunctionalLeadRoute>
            }
          >
            <Route index element={<FunctionalLeadPortalIndex />} />
            <Route path="active" element={<FLActiveRequestsTab />} />
            <Route path="approved" element={<FLApprovedListTab />} />
            <Route path="rejected" element={<FLRejectedListTab />} />
            <Route path="time-based" element={<FLTimeBasedTab />} />
          </Route>
          {/* Promotion Board Portal: gated on the promotion board member
              privilege via PromotionRequiresPromotionBoardRoute. */}
          <Route
            path="people-ops/promotion/board"
            element={
              <PromotionRequiresPromotionBoardRoute>
                <PromotionBoardPortalPage />
              </PromotionRequiresPromotionBoardRoute>
            }
          >
            <Route index element={<PromotionBoardPortalIndex />} />
            <Route path="active" element={<PBActiveRequestsTab />} />
            <Route path="approved" element={<PBApprovedListTab />} />
            <Route path="rejected" element={<PBRejectedListTab />} />
            <Route path="fl-rejected" element={<PBFLRejectedListTab />} />
          </Route>
          {/* Admin Portal: gated on the HR admin privilege via
              PromotionRequiresHrAdminRoute. */}
          <Route
            path="people-ops/promotion/admin"
            element={
              <PromotionRequiresHrAdminRoute>
                <PromotionAdminPortalPage />
              </PromotionRequiresHrAdminRoute>
            }
          >
            <Route index element={<PromotionAdminPortalIndex />} />
            <Route path="cycle" element={<AdminPromotionCycleTab />} />
            <Route path="time-based" element={<AdminTimeBasedPromotionsTab />} />
            <Route path="individual-contributor" element={<AdminIndividualContributorTab />} />
            <Route path="withdrawal-requests" element={<AdminWithdrawalRequestsTab />} />
            <Route path="users" element={<AdminUserManagementTab />} />
          </Route>
          {/* Promotion Cycle History: gated on the HR admin or functional
              lead privilege via PromotionRequiresCycleHistoryRoute. */}
          <Route
            path="people-ops/promotion/cycle-history"
            element={
              <PromotionRequiresCycleHistoryRoute>
                <PromotionCycleHistoryPage />
              </PromotionRequiresCycleHistoryRoute>
            }
          >
            <Route index element={<PromotionCycleHistoryIndex />} />
            <Route path="by-cycle" element={<CycleHistoryTab />} />
            <Route path="people-hr-archive" element={<PeopleHrArchiveTab />} />
          </Route>
          {/* People Ops reports. Admin-only, but enforced by the backend and
              explained by PeopleOpsShell — there is no route-level guard, so
              a non-admin reaching this URL gets the shell's "no access"
              message rather than a blank page. */}
          <Route
            path="people-ops/reports/active-employees"
            element={<ActiveEmployeesReportPage />}
          />
          <Route
            path="people-ops/reports/resignations"
            element={<ResignationsReportPage />}
          />
          {/* Master Data → Org Structure. The four org-chart entity tabs;
              the hierarchy drill-down is still to come. */}
          <Route
            path="people-ops/master-data/org-structure"
            element={<OrgStructurePage />}
          />
          {/* One employee's record, reached from a report row. Same admin
              gate; the backend allows an admin to read any employee. */}
          <Route
            path="people-ops/employees/:employeeId"
            element={<EmployeeDetailPage />}
          />
          {/* Finance perspective — skeleton "coming soon" tile; the actual
              claim apps are the me/claims routes above. */}
          <Route path="finance" element={<PerspectiveLanding />} />
          {/* Finance → Claim approval. Approving is work you do for other
              people, so it sits here rather than under Me with the things you
              do for yourself; submitting and history stay there. Each tab is a
              real route, gated by its own rule at the route rather than only
              hidden from the bar. See features/finance/approvals. */}
          <Route path="finance/claim-approval" element={<ClaimApprovalPage />}>
            <Route index element={<ClaimApprovalIndex />} />
            <Route
              path="needs-you"
              element={
                <ClaimApprovalTabRoute gateId="claim-approval">
                  <NeedsYouTab />
                </ClaimApprovalTabRoute>
              }
            />
            <Route
              path="decided"
              element={
                <ClaimApprovalTabRoute gateId="claim-approval">
                  <DecidedTab />
                </ClaimApprovalTabRoute>
              }
            />
          </Route>
          {/* Marketing Ops perspective — overview + the Phase 1 Utilities
              screens, ported from the Marketing Ops frontend. The remaining
              operations (Ad Campaigns, Email Workbench, Events, CRM Upload)
              still live in Marketing Ops; the overview deep-links out to them
              until their phase lands. */}
          <Route path="marketing-ops" element={<PerspectiveLanding />} />
          {/* Email Workbench. The editor is transient state inside these pages, not
              a route of its own — see EmailWorkbenchPages. */}
          <Route
            path="marketing-ops/email-workbench/create"
            element={<EmailWorkbenchCreatePage />}
          />
          <Route
            path="marketing-ops/email-workbench/history"
            element={<EmailWorkbenchHistoryPage />}
          />
          <Route
            path="marketing-ops/email-workbench/manage"
            element={<EmailWorkbenchManagePage />}
          />
          <Route
            path="marketing-ops/email-workbench/blocks"
            element={<BlockCatalogPage />}
          />
          {/* Ad Campaigns → Analytics. Read-only reports computed on demand. */}
          <Route
            path="marketing-ops/ad-campaigns/analytics"
            element={<AdCampaignsAnalyticsPage />}
          />
          {/* Ad Campaigns → Campaign Tracker. Register / Weekly Log / Budget
              Pacing / BU Owners — the weekly operating rhythm for live campaigns. */}
          <Route
            path="marketing-ops/ad-campaigns/campaign-tracker"
            element={<CampaignTrackerPage />}
          />
          {/* Utilities — open to any authorized Marketing Ops caller. */}
          <Route path="marketing-ops/utilities/utm" element={<UtmGeneratorPage />} />
          <Route
            path="marketing-ops/utilities/asset-name"
            element={<AssetNameGeneratorPage />}
          />
          {/* Marketing Admin — each operation's configuration lands with the
              operation, so this grows one panel per phase. Admin-gated by the
              rail and by MarketingOpsShell; the backend enforces it too. */}
          <Route path="marketing-ops/admin/utm" element={<UtmSettingsPage />} />
          <Route
            path="marketing-ops/admin/asset-name"
            element={<AssetNameSettingsPage />}
          />
          <Route path="marketing-ops/admin/pardot" element={<EmailWorkbenchSettingsPage />} />
          <Route path="marketing-ops/admin/events" element={<EventsSettingsPage />} />
          <Route path="marketing-ops/events/mine" element={<EventsMinePage />} />
          <Route path="marketing-ops/events/review" element={<EventsReviewPage />} />
          {/* Event Platform — event agendas, speakers and swag shops, a different
              app from Events above. The tree is deep enough that the feature
              owns it, as the GRC modules own theirs. See
              event-platform/eventPlatformTabs.ts. */}
          {eventPlatformRoutes}
          <Route
            path="marketing-ops/crm-upload/pipelines"
            element={<CrmUploadPipelinesPage />}
          />
          <Route path="marketing-ops/crm-upload/runs" element={<CrmUploadRunLogPage />} />
          <Route path="marketing-ops/crm-upload/records" element={<CrmUploadRecordsPage />} />
          <Route path="marketing-ops/crm-upload/review" element={<CrmUploadReviewPage />} />
          {/* Design Studio → Post Builder — the canvas editor for branded LinkedIn
              post and banner graphics. */}
          <Route
            path="marketing-ops/design-studio/post-builder"
            element={<PostBuilderPage />}
          />
          {/* Sales opens on the first rail row the caller can see, which is
              Echo → Meetings (`forwardsToFirstItem`); someone the backend
              refuses is told so here, by PerspectiveLanding. */}
          <Route path="sales" element={<PerspectiveLanding />} />
          {/* Echo → Meetings: the recorded meetings. Scheduling stays in the
              calendar add-on. No route-level guard: the backend behind
              ONE_WSO2_REVOPS_BACKEND_URL refuses a caller in no authorised
              group on every endpoint, and SalesShell turns that 403 into an
              explanation, so someone reaching this URL gets an answer rather
              than a blank page. */}
          <Route path="sales/meetings" element={<SalesMeetingsPage />} />
          {/* One meeting: the recording, and the call's details. A route rather than a
              dialog because a recording is something people send each other, and a dialog
              has no address — this survives a refresh, a bookmark and a paste into Slack.
              The transcript and smart notes land in its left column. */}
          <Route path="sales/meetings/:meetingId" element={<MeetingDetailPage />} />
          {/* Sales → CadO2, the quote tool. Its whole route tree, behind the `cado2`
              preview flag; Cado2Shell resolves access for every page. See
              @features/sales/cado2/routes and docs/ported-apps/cado2.md. */}
          {isPreviewEnabled("cado2") && cado2Routes}
          {/* Deals — MEDDPICC per Opportunity, from the MEDDPICC backend (shows a
              not-connected state when ONE_WSO2_ECHO_BACKEND_URL is unset). */}
          <Route path="sales/deals" element={<SalesDealsPage />} />
          {/* One deal, as a page rather than a drawer: it can be linked, refreshed and
              returned to with Back. ?letter= opens it filtered to one MEDDPICC Letter. */}
          <Route path="sales/deals/:opportunityId" element={<DealPage />} />
          {/* Sales → Library, Smart Search over Pitstop's content. Behind the `smartSearch` preview
              flag, and loaded lazily so nothing of it is downloaded while the flag is off. */}
          {isPreviewEnabled("smartSearch") && (
            <Route
              path="sales/library"
              element={
                <Suspense fallback={<Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />}>
                  <LibraryPage />
                </Suspense>
              }
            />
          )}
          <Route path="settings" element={<SettingsPage />} />
          {/* Me → Menu: the cafeteria screen ported from the standalone
              menu app. One page, as the original was. */}
          <Route
            path="me/menu"
            element={
              <SriLankaRoute>
                <MenuHomePage />
              </SriLankaRoute>
            }
          />
          {/* Knowledge → Today I Learned: a company-wide learnings feed.
              No SriLankaRoute wrapper — unlike Menu/Subscriptions this isn't a
              Colombo-office perk, every employee everywhere can use it. */}
          <Route path="knowledge" element={<PerspectiveLanding />} />
          <Route path="knowledge/today-i-learned" element={<TilHomePage />} />
          {/* One entry's own page — what a feed card opens inside One
              WSO2, or, with ?view=article, the full-page article a Chat
              "Read more" link lands on (AppLayout drops its shell for
              that; see layouts/fullPageRoutes). */}
          <Route path="knowledge/today-i-learned/:id" element={<TilEntryRoute />} />
          {/* Legal perspective — currently just a second entry point into Due
              Diligence, alongside Finance (see the finance/ routes below and
              DUE_DILIGENCE_APPS). */}
          <Route path="legal" element={<PerspectiveLanding />} />
          {/* Behind the same preview flag as its rail entry, so the page is not
              reachable by URL either. */}
          {isPreviewEnabled("nda") && <Route path="legal/nda" element={<NdaPage />} />}
          {/* Security — the GRC platform's Risk Hub and Admin Console, lifted
              from grc-tools rather than rewritten. The two route fragments are
              the SOURCE's own (modules/{risk,audit,admin}/routes.tsx), spread
              unedited; nesting them here is what turns the source's /risk/* and
              /audit/* into this app's /security/risk/*, /security/audit/* and
              /security/admin/*
              without touching either file. Their per-route PrivilegeGuards come
              along with them, including the deliberate absence of one on
              Risk Registers.

              evidenceRoutes is a second, separate lift — Evidence Portal, from
              grc-tools/apps/evidence-app rather than grc-platform — spread the
              same way to turn its own /evidence/* into /security/evidence/*.
              See @features/security/evidence-portal/routes for what it mounts. */}
          <Route path="security">
            <Route index element={<PerspectiveLanding />} />
            {auditRoutes}
            {riskRoutes}
            {evidenceRoutes}
            {adminRoutes}
          </Route>
          {/* Due Diligence — ported from digiops-finance/apps/due_diligence's
              admin-app. Routes live OUTSIDE both the Finance and Legal path
              prefixes (same reason /settings does): a screen reachable from
              two different rails can't itself live under either one's own
              prefix. See DUE_DILIGENCE_APPS and SideRail's fromPerspective
              navigation state for how each rail stays selected once inside. */}
          <Route path="due-diligence" element={<Navigate to="/due-diligence/partners" replace />} />
          <Route path="due-diligence/partners" element={<PartnersListPage />} />
          <Route path="due-diligence/partners/pending/:id" element={<PartnerPendingPage />} />
          <Route path="due-diligence/partners/:id/:tabName" element={<PartnerDashboardPage />} />
          <Route path="due-diligence/trade-references" element={<TradeReferencesListPage />} />
          <Route
            path="due-diligence/trade-references/pending/:linkId"
            element={<TradeReferencePendingPage />}
          />
          <Route
            path="due-diligence/trade-references/rejected/:companyId/:linkId"
            element={<TradeReferenceRejectedPage />}
          />
          <Route
            path="due-diligence/trade-references/deactivated/:linkId"
            element={<TradeReferenceDeactivatedPage />}
          />
          <Route
            path="due-diligence/trade-references/:companyId/:linkId"
            element={<TradeReferenceDashboardPage />}
          />
          <Route path="due-diligence/preferences" element={<DueDiligencePreferencesPage />} />
          <Route path="due-diligence/view-pdf" element={<ViewPdfPage />} />
          <Route path="due-diligence/view-image" element={<ViewImagePage />} />
          {/* Banking's admin/lead screens — Change Requests, Report,
              Employee Operations, and Admin views. Route lives OUTSIDE both
              the People Ops and
              Finance path prefixes, same reason Due Diligence's own routes
              do above: a screen reachable from two different rails can't
              itself live under either one's own prefix. BankingAdminRoute
              is the "any admin at all" gate; BankingAdminTabRoute is the
              finer per-tab split (Change Requests is People-Ops-only). */}
          <Route
            path="banking/admin"
            element={
              <BankingAdminRoute>
                <BankingAdminPage />
              </BankingAdminRoute>
            }
          >
            <Route index element={<BankingAdminIndex />} />
            <Route
              path="change-requests"
              element={
                <BankingAdminTabRoute gateId="people-ops-admin">
                  <ChangeRequestsTab />
                </BankingAdminTabRoute>
              }
            />
            <Route
              path="report"
              element={
                <BankingAdminTabRoute gateId="either-admin">
                  <ReportTab />
                </BankingAdminTabRoute>
              }
            />
            <Route
              path="employee-operations"
              element={
                <BankingAdminTabRoute gateId="either-admin">
                  <EmployeeOperationsTab />
                </BankingAdminTabRoute>
              }
            />
            <Route
              path="admin"
              element={
                <BankingAdminTabRoute gateId="either-admin">
                  <AdminTab />
                </BankingAdminTabRoute>
              }
            />
          </Route>
          {/* Me → Email Groups: the mailing-list subscription manager ported
              from the standalone Email Group Manager app (the email-signature
              half of that app is not part of this port). Every employee sees
              the same screen — the backend enforces access, not a route
              guard. */}
          <Route path="me/email-groups" element={<EmailGroupsPage />} />
          {/* Me → Email Signature: the other half of the same source app,
              its own menu item rather than a tab — it shares no data or
              backend with Email Groups. Pure client-side HTML generator. */}
          <Route path="me/email-signature" element={<EmailSignaturePage />} />
          {/* Me → Banking: the employee-facing panels ported from
              digiops-hr's banking webapp "Change Bank Account" tab — its
              own page rather than a dashboard card, since three Account
              Types with their own edit forms and eligibility rules don't
              fit in one. Tabbed like Claim Approval, so a later
              admin-facing tab is a new route here, not a reshape of
              BankingPage. */}
          <Route
            path="me/banking"
            element={
              <BankingRoute>
                <BankingPage />
              </BankingRoute>
            }
          >
            <Route index element={<BankingIndex />} />
            <Route path="my-accounts" element={<MyAccountsTab />} />
            <Route path="summary" element={<SummaryTab />} />
          </Route>
          {/* Catch-all → landing */}
          <Route path="*" element={<Navigate to={landingPath()} replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
