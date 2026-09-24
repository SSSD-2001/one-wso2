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

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Chip,
  CircularProgress,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@wso2/oxygen-ui";
import { CheckIcon, EditIcon, FileTextIcon } from "@wso2/oxygen-ui-icons-react";
import { useParams } from "react-router";
import { pdf } from "@react-pdf/renderer";
import DueDiligenceShell from "@features/due-diligence/components/DueDiligenceShell";
import { DUE_DILIGENCE_EYEBROW } from "@constants/dueDiligenceApps";
import { useDueDiligenceGate } from "@features/due-diligence/api/useDueDiligenceGate";
import { useDueDiligenceAppConfig } from "@features/due-diligence/api/useDueDiligenceAppConfig";
import { authedGet, humanizeHttpError } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { dueDiligenceServiceUrls } from "@config/apiConfig";
import { FORM_STATUS, formStatusChipColor, getFormStatusLabel } from "@features/due-diligence/constants";
import {
  useChangePartnerFormStatus,
  useSendApprovalEmail,
  useUpdatePartner,
  usePartnerInfo,
  type ApprovalSummaryData,
} from "../api/usePartners";
import type { FinanceAnswerData, PartnerQuestionData } from "../api/financeTypes";
import type { LegalAnswerData, LegalQuestionData } from "../api/legalTypes";
import type { CreditScoreData } from "../api/creditScoreTypes";
import ProfileTab from "../components/ProfileTab";
import FinanceTab from "../components/FinanceTab";
import LegalTab from "../components/LegalTab";
import ApprovalTab from "../components/ApprovalTab";
import AdminPdfReport from "../components/AdminPdfReport";
import ConfirmationDialog, {
  type ConfirmationContent,
} from "@components/confirmation-dialog/ConfirmationDialog";
import { useDueDiligenceNavigate } from "@features/due-diligence/api/useDueDiligenceNavigate";

const TAB_NAMES = ["profile", "finance", "legal", "approvalsummary"] as const;
type TabName = (typeof TAB_NAMES)[number];

// Ported from the source app's Resellers/ResellerDashboard/ResellerDashboard.js
// — the per-partner tabbed workspace, including "Generate Report" (the
// @react-pdf/renderer PDF export, ported as AdminPdfReport.tsx).
export default function PartnerDashboardPage() {
  const { id, tabName } = useParams<{ id: string; tabName: string }>();
  const navigate = useDueDiligenceNavigate();
  const gate = useDueDiligenceGate();
  const appConfig = useDueDiligenceAppConfig();
  const partnerInfo = usePartnerInfo(id ?? "");
  const changeFormStatus = useChangePartnerFormStatus();
  const updatePartner = useUpdatePartner();
  const sendApprovalEmail = useSendApprovalEmail();
  const getAccessToken = useAccessToken();

  const companyData = partnerInfo.data?.[0];

  const [confirmation, setConfirmation] = useState<ConfirmationContent | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; severity: "success" | "error"; message: string }>({
    open: false,
    severity: "success",
    message: "",
  });
  const [generatingReport, setGeneratingReport] = useState(false);

  // Fetches everything the PDF needs on demand — this page only mounts the
  // Finance/Legal/Credit-Score data hooks for the currently active tab, so
  // "Generate Report" can't rely on them already being loaded.
  const generateReport = async () => {
    if (!companyData) return;
    setGeneratingReport(true);
    try {
      const accessToken = await getAccessToken();
      const [questionData, financeAnswerData, legalQuestionData, legalAnswerData, creditScoreData, approvalSummaryData] =
        await Promise.all([
          authedGet<PartnerQuestionData>(dueDiligenceServiceUrls.partnerQuestions, accessToken),
          authedGet<FinanceAnswerData>(dueDiligenceServiceUrls.partnerAnswers(companyData.companyId), accessToken),
          authedGet<LegalQuestionData>(dueDiligenceServiceUrls.legalQuestions(companyData.companyId), accessToken),
          authedGet<LegalAnswerData>(dueDiligenceServiceUrls.legalAnswers(companyData.companyId), accessToken),
          authedGet<CreditScoreData>(dueDiligenceServiceUrls.creditScoreItemsForPartner(companyData.companyId), accessToken),
          authedGet<ApprovalSummaryData>(dueDiligenceServiceUrls.approvalSummary(companyData.companyId), accessToken),
        ]);

      const summary = approvalSummaryData.summary[0];
      const resellerStatus = approvalSummaryData.resellerLinks.find((l) => l.linkId === companyData.linkId)?.status;

      const blob = await pdf(
        <AdminPdfReport
          companyData={companyData}
          financeCategories={questionData.questionCategoryInfo}
          financeQuestions={questionData.questionInfo}
          financeSubQuestions={questionData.subQuestionInfo}
          financeAnswers={financeAnswerData.answers}
          financeComments={financeAnswerData.comments}
          creditScoreData={{
            year1: creditScoreData.items.find((i) => i.year === 1),
            year2: creditScoreData.items.find((i) => i.year === 2),
            year3: creditScoreData.items.find((i) => i.year === 3),
            ratios: creditScoreData.ratios,
            currency: creditScoreData.currency[0]?.descriptionAnswer ?? "",
          }}
          legalQuestions={legalQuestionData.questions}
          legalSubQuestions={legalQuestionData.subQuestions}
          legalAnswers={legalAnswerData.answers}
          legalComments={legalAnswerData.comments}
          approvalData={{
            financeResult: summary?.financeResult,
            legalResult: summary?.legalResult,
            financeSpecialApproval: summary?.financeSpecialApproval,
            resellerStatus,
          }}
          reportDate={new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
        />,
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${companyData.companyName || "partner"}-due-diligence-report.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setSnack({ open: true, severity: "error", message: `Couldn't generate report. ${humanizeHttpError(err)}` });
    } finally {
      setGeneratingReport(false);
    }
  };

  // Not just financeRole: the four internal notification/approval emails go
  // to financeApprover, financialCreator, financialReviewer, and
  // financeSpecialApprover — none of which is financeRole — so a strict
  // financeRole-only check bounced every one of those emails' actual
  // recipients to Profile the moment they clicked through. Same class of gap
  // as canSeeLegal's missing legalApprover, above.
  const canSeeFinance =
    gate.hasRole("financeRole") ||
    gate.hasRole("financeApprover") ||
    gate.hasRole("financeSpecialApprover") ||
    gate.hasRole("financialCreator") ||
    gate.hasRole("financialReviewer") ||
    gate.hasRole("superRole");
  const canSeeLegal =
    gate.hasRole("legalRole") ||
    gate.hasRole("legalApprover") ||
    gate.hasRole("financialCreator") ||
    gate.hasRole("financialReviewer") ||
    gate.hasRole("financeApprover");

  // A tab the caller can't use redirects to Profile, mirroring the source's
  // switchToTab() pushing to the no-access page — Profile is always open,
  // so landing there instead of a dead end is the more useful failure.
  //
  // Gated on `!gate.isResolving`: canSeeFinance/canSeeLegal are computed from
  // gate.hasRole, which reads `/user-info`'s response — on first mount that
  // hasn't loaded yet, so both are false regardless of the caller's actual
  // roles. Without this guard, landing directly on .../finance (e.g. from an
  // email link) fired this redirect on that very first render, before the
  // real role check ever got a chance to run, and by the time the roles
  // loaded a moment later the URL had already changed to .../profile.
  useEffect(() => {
    if (gate.isResolving) return;
    if (tabName === "finance" && !canSeeFinance) navigate(`/due-diligence/partners/${id}/profile`, { replace: true });
    if (tabName === "legal" && !canSeeLegal) navigate(`/due-diligence/partners/${id}/profile`, { replace: true });
    if (tabName && !TAB_NAMES.includes(tabName as TabName)) {
      navigate(`/due-diligence/partners/${id}/profile`, { replace: true });
    }
  }, [tabName, canSeeFinance, canSeeLegal, id, navigate, gate.isResolving]);

  const activeTab: TabName = TAB_NAMES.includes(tabName as TabName) ? (tabName as TabName) : "profile";

  const isTrEditingAllowed =
    companyData?.formStatus === FORM_STATUS.TR_EDIT_REQUESTED || companyData?.formStatus === FORM_STATUS.TR_DRAFTED;
  const isFullEditingAllowed =
    companyData?.formStatus === FORM_STATUS.DRAFTED ||
    companyData?.formStatus === FORM_STATUS.ACTIVE ||
    companyData?.formStatus === FORM_STATUS.FULL_EDIT_REQUESTED;
  // `allowEdit` shares one mutation across both buttons — `.variables` (the
  // args of whichever call is currently in flight) says which one, so each
  // button can show its own spinner instead of both lighting up together.
  const isTrEditingRequestPending =
    changeFormStatus.isPending && changeFormStatus.variables?.formStatus === FORM_STATUS.TR_EDIT_REQUESTED;
  const isFullEditingRequestPending =
    changeFormStatus.isPending && changeFormStatus.variables?.formStatus === FORM_STATUS.FULL_EDIT_REQUESTED;

  const allowEdit = (formStatus: string) => {
    if (!companyData) return;
    changeFormStatus.mutate(
      { companyId: companyData.companyId, formStatus, clientUrl: appConfig.data?.clientBaseUrl ?? "" },
      {
        onSuccess: () => setSnack({ open: true, severity: "success", message: "Updated successfully" }),
        onError: (err) =>
          setSnack({ open: true, severity: "error", message: `Couldn't update. ${humanizeHttpError(err)}` }),
      },
    );
  };

  const onChangeTradeReference = (enabled: boolean) => {
    if (!companyData) return;
    setConfirmation({
      title: "You are about to make a change to a reseller!",
      text: `Are you sure you want to ${enabled ? "enable" : "disable"} Trade Reference for this reseller?`,
      confirmAction: () =>
        updatePartner.mutate(
          { linkId: companyData.linkId, isTradeReferenceEnabled: enabled },
          {
            onSuccess: () => setSnack({ open: true, severity: "success", message: "Updated successfully" }),
            onError: (err) =>
              setSnack({ open: true, severity: "error", message: `Couldn't update. ${humanizeHttpError(err)}` }),
          },
        ),
    });
  };

  // Guarded on companyData itself (not just optional-chained fields inside),
  // since `companyData.formStatus !== FORM_STATUS.SIGNED` below isn't safe to
  // evaluate before the partner has actually loaded — undefined here simply
  // means the shell renders no header actions yet, same as before this moved
  // out of the loaded-content branch and up next to the title.
  const headerActions = companyData && gate.hasRole("adminRole") && (
    <ButtonGroup variant="outlined">
      <Button
        startIcon={generatingReport ? <CircularProgress size={15} /> : <FileTextIcon size={15} />}
        disabled={generatingReport}
        onClick={() => void generateReport()}
        sx={{ textTransform: "none" }}
      >
        Generate Report
      </Button>
      <Button
        startIcon={
          isTrEditingRequestPending ? <CircularProgress size={15} /> : isTrEditingAllowed ? <CheckIcon size={15} /> : <EditIcon size={15} />
        }
        disabled={isTrEditingAllowed || changeFormStatus.isPending}
        onClick={() => allowEdit(FORM_STATUS.TR_EDIT_REQUESTED)}
        sx={{ textTransform: "none" }}
      >
        {isTrEditingAllowed ? "Only TR Editing Allowed" : "Allow Only TR Editing"}
      </Button>
      <Button
        startIcon={
          isFullEditingRequestPending ? <CircularProgress size={15} /> : isFullEditingAllowed ? <CheckIcon size={15} /> : <EditIcon size={15} />
        }
        disabled={isFullEditingAllowed || changeFormStatus.isPending}
        onClick={() => allowEdit(FORM_STATUS.FULL_EDIT_REQUESTED)}
        sx={{ textTransform: "none" }}
      >
        {isFullEditingAllowed ? "Full Editing Allowed" : "Allow Full Editing"}
      </Button>
      {companyData.formStatus !== FORM_STATUS.SIGNED &&
        (gate.hasRole("financeRole") || gate.hasRole("legalRole") || gate.hasRole("adminRole")) && (
          <Button
            startIcon={updatePartner.isPending ? <CircularProgress size={15} /> : undefined}
            disabled={updatePartner.isPending}
            onClick={() => onChangeTradeReference(!companyData.isTradeReferenceEnabled)}
            sx={{ textTransform: "none" }}
          >
            {companyData.isTradeReferenceEnabled ? "Disable TR" : "Enable TR"}
          </Button>
        )}
    </ButtonGroup>
  );

  return (
    <DueDiligenceShell
      back={{ label: "Return to Partners", onClick: () => navigate("/due-diligence/partners") }}
      eyebrow={DUE_DILIGENCE_EYEBROW}
      title="Partner dashboard"
      headerActions={headerActions}
    >
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.message}
        </Alert>
      </Snackbar>

      {partnerInfo.isLoading ? (
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            Loading partner…
          </Typography>
        </Stack>
      ) : partnerInfo.isError || !companyData ? (
        <Alert severity="error">Couldn't load this partner. {humanizeHttpError(partnerInfo.error)}</Alert>
      ) : (
        <>
          {/* Colored, not the plain neutral outline it had before — that read
              as another button next to the (equally neutral, equally
              outlined) ButtonGroup up in the title row. The color alone now
              tells the two apart without needing a different shape. */}
          <Chip
            variant="outlined"
            color={formStatusChipColor(getFormStatusLabel(companyData.formStatus, "active"))}
            label={`Form Status: ${getFormStatusLabel(companyData.formStatus, "active")}`}
            size="small"
            sx={{ mb: 2 }}
          />

          <Tabs
            value={activeTab}
            onChange={(_, value: TabName) => navigate(`/due-diligence/partners/${id}/${value}`)}
          >
            <Tab value="profile" label="Profile" />
            <Tab value="finance" label="Finance" disabled={!canSeeFinance} />
            <Tab value="legal" label="Legal" disabled={!canSeeLegal} />
            <Tab value="approvalsummary" label="Approval" />
          </Tabs>

          <Box sx={{ bgcolor: "background.paper", borderRadius: 1, mt: 1 }}>
            {activeTab === "profile" && <ProfileTab companyId={id ?? ""} />}
            {activeTab === "finance" && (
              <FinanceTab
                companyId={id ?? ""}
                applicantEmail={companyData.applicantEmail}
                approvalEmailSent={companyData.sentForApproval === 1}
                sendingApprovalEmail={sendApprovalEmail.isPending}
                onSendApprovalEmail={() =>
                  sendApprovalEmail.mutate(
                    { id: companyData.companyId, name: companyData.companyName ?? "" },
                    {
                      onSuccess: () => setSnack({ open: true, severity: "success", message: "Sent for approval" }),
                      onError: (err) =>
                        setSnack({ open: true, severity: "error", message: `Couldn't send. ${humanizeHttpError(err)}` }),
                    },
                  )
                }
              />
            )}
            {activeTab === "legal" && <LegalTab companyId={id ?? ""} applicantEmail={companyData.applicantEmail} />}
            {activeTab === "approvalsummary" && <ApprovalTab companyId={id ?? ""} />}
          </Box>
        </>
      )}

      <ConfirmationDialog content={confirmation} onClose={() => setConfirmation(null)} />
    </DueDiligenceShell>
  );
}
