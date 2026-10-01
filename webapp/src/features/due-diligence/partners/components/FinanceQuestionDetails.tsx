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

import { useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, Snackbar, Stack, Typography } from "@wso2/oxygen-ui";
import { MailIcon } from "@wso2/oxygen-ui-icons-react";
import { humanizeHttpError } from "@api/http";
import { useDueDiligenceGate } from "@features/due-diligence/api/useDueDiligenceGate";
import { SPECIAL_APPROVAL_QID } from "@features/due-diligence/constants";
import FinanceSubQuestionDetails from "./FinanceSubQuestionDetails";
import FinanceCommentInputs from "./FinanceCommentInputs";
import { useSaveFinanceFeedback, useSendSpecialApprovalEmail, type FinanceFeedbackAnswer } from "../api/useFinance";
import type {
  FileSubmission,
  FinanceComment,
  PartnerAnswer,
  QuestionCategory,
  QuestionInfo,
  SubQuestionInfo,
} from "../api/financeTypes";

/**
 * Ported from the source app's Resellers/ResellerDashboard/Finance/QuestionDetails.js.
 */
export default function FinanceQuestionDetails({
  companyId,
  category,
  question,
  subQuestions,
  answers,
  files,
  comments,
  specialApproval,
  approvalEmailSent,
  sendingApprovalEmail,
  applicantEmail,
  onSendApprovalEmail,
  onFormChanged,
}: {
  companyId: string;
  category: QuestionCategory;
  question: QuestionInfo;
  subQuestions: SubQuestionInfo[];
  answers: PartnerAnswer[];
  files: FileSubmission[];
  comments: FinanceComment[];
  specialApproval: string;
  approvalEmailSent: boolean | undefined;
  sendingApprovalEmail?: boolean;
  applicantEmail: string;
  onSendApprovalEmail?: () => void;
  onFormChanged: () => void;
}) {
  const gate = useDueDiligenceGate();
  const saveFeedback = useSaveFinanceFeedback(companyId);
  const sendSpecialApproval = useSendSpecialApprovalEmail();

  const [draftAnswers, setDraftAnswers] = useState<Map<number, FinanceFeedbackAnswer>>(new Map());
  const [editing, setEditing] = useState(false);
  const [financeResult, setFinanceResult] = useState("");
  const [specialApprovalResult, setSpecialApprovalResult] = useState("");
  const [snack, setSnack] = useState<{ open: boolean; severity: "success" | "error"; message: string }>({
    open: false,
    severity: "success",
    message: "",
  });

  if (category.categoryId !== question.categoryId) return null;
  // The special-approval question only appears once special approval has
  // actually been requested — matches the source's own guard.
  if (question.questionId === SPECIAL_APPROVAL_QID && specialApproval === "") return null;

  const isAuthorized =
    ((question.questionId === 40 || question.questionId === 41) && gate.hasRole("superRole")) ||
    (question.questionId === 44 && gate.hasRole("financeApprover")) ||
    (question.questionId === SPECIAL_APPROVAL_QID && gate.hasRole("financeSpecialApprover"));

  // Deliberately broader than isAuthorized above: isAuthorized only covers
  // the specific approval-decision questions (40/41/44/special-approval),
  // so it's false for every other question — including the file-attachment
  // one — regardless of role. Attaching a supporting document isn't a
  // decision/approval action, so the bar for it is the same one that gates
  // the Finance tab itself (see canSeeFinance in PartnerDashboardPage.tsx):
  // anyone who can be in this tab at all may attach a file, not just the
  // narrower set of people who may approve/reject this specific question.
  const canUploadFiles =
    gate.hasRole("financeRole") ||
    gate.hasRole("financeApprover") ||
    gate.hasRole("financeSpecialApprover") ||
    gate.hasRole("financialCreator") ||
    gate.hasRole("financialReviewer") ||
    gate.hasRole("superRole");

  const fieldDisabled = !editing;
  const specialApprovalRequested = specialApproval !== "";

  const relevantSubQuestions = subQuestions.filter((sq) => sq.questionId === question.questionId);

  const onAnswered = (subQuestionId: number, booleanAnswer: boolean | "", descriptionAnswer: string, isValid: boolean) => {
    if (subQuestionId === 44 && booleanAnswer === true) setFinanceResult("approved");
    else if (subQuestionId === 44 && booleanAnswer === false) setFinanceResult("rejected");
    else if (subQuestionId === 98 && booleanAnswer === true) setSpecialApprovalResult("approved");
    else if (subQuestionId === 98 && booleanAnswer === false) setSpecialApprovalResult("rejected");

    setDraftAnswers((prev) => {
      const next = new Map(prev);
      if (isValid) {
        next.set(subQuestionId, {
          subQuestionId,
          questionId: question.questionId,
          booleanAnswer: Boolean(booleanAnswer),
          descriptionAnswer,
          companyId,
        });
      } else {
        next.delete(subQuestionId);
      }
      return next;
    });
  };

  const isValid = draftAnswers.size > 0;

  const save = () => {
    const answersToSave = Array.from(draftAnswers.values());
    // The special-approval decision needs BOTH the Approve/Reject choice and
    // a comment — silently no-op'ing here (the source's own behavior) left
    // Save looking clickable but doing nothing, with no clue why.
    if (question.questionId === SPECIAL_APPROVAL_QID && answersToSave.length < 2) {
      setSnack({ open: true, severity: "error", message: "Please add a comment before saving." });
      return;
    }
    saveFeedback.mutate(
      { answers: answersToSave, financeResult, specialApprovalResult },
      {
        onSuccess: () => {
          setEditing(false);
          setDraftAnswers(new Map());
          onFormChanged();
        },
        onError: (err) => setSnack({ open: true, severity: "error", message: humanizeHttpError(err) }),
      },
    );
  };

  const requestSpecialApproval = () => {
    sendSpecialApproval.mutate(Number(companyId), {
      onSuccess: () => onFormChanged(),
      onError: (err) => setSnack({ open: true, severity: "error", message: humanizeHttpError(err) }),
    });
  };

  // Once the approver has recorded a decision on Q44, resending the approval
  // request no longer makes sense — the decision (and the button/chip that
  // led to it) is done.
  const financeDecided = answers.some((a) => a.subQuestionId === 44);

  const showSaveEdit =
    ((category.categoryId === 7 || category.categoryId === 8) &&
      question.questionDescription !== "Creator" &&
      question.questionDescription !== "Reviewer" &&
      isAuthorized) ||
    (question.questionId === SPECIAL_APPROVAL_QID && gate.hasRole("financeSpecialApprover"));

  return (
    <Box sx={{ mb: 2 }}>
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

      <Typography variant="body2" sx={{ mb: 0.5 }}>
        {question.questionHeading}
      </Typography>
      <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {category.sortIndex - 2}.{question.sortIndex} {question.questionDescription}
        </Typography>
        {question.questionId === 44 && gate.hasRole("financeRole") && onSendApprovalEmail && !financeDecided && (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            {/* Informational, not a lock: a prior send is worth surfacing,
                but the button stays clickable — there are legitimate reasons
                to send it again (a different approver, a missed email). Only
                the mutation actually being in flight disables it, which is
                what stops an accidental double-click from sending twice. */}
            {approvalEmailSent && <Chip label="Sent for approval" size="small" color="success" variant="outlined" />}
            <Button
              size="small"
              variant="contained"
              startIcon={sendingApprovalEmail ? <CircularProgress size={14} color="inherit" /> : <MailIcon size={14} />}
              disabled={sendingApprovalEmail}
              onClick={onSendApprovalEmail}
              sx={{ textTransform: "none" }}
            >
              {approvalEmailSent ? "Resend for approval" : "Send for approval"}
            </Button>
          </Stack>
        )}
      </Stack>

      {relevantSubQuestions.map((sq) => (
        <FinanceSubQuestionDetails
          key={sq.subQuestionId}
          companyId={companyId}
          question={question}
          subQuestion={sq}
          answer={answers.find((a) => a.subQuestionId === sq.subQuestionId)}
          files={files}
          comments={comments}
          approvalEmailSent={Boolean(approvalEmailSent)}
          applicantEmail={applicantEmail}
          fieldDisabled={isAuthorized ? fieldDisabled : true}
          canUploadFiles={canUploadFiles}
          onAnswered={onAnswered}
        />
      ))}

      {(question.questionId === 42 || question.questionId === 43) && (
        <FinanceCommentInputs questionId={question.questionId} companyId={companyId} comments={comments} />
      )}

      {showSaveEdit && (
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Button size="small" variant="contained" disabled={fieldDisabled || !isValid || saveFeedback.isPending} onClick={save}>
            Save
          </Button>
          <Button
            size="small"
            variant="outlined"
            disabled={!fieldDisabled || (question.questionId === 44 && !approvalEmailSent)}
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
        </Stack>
      )}

      {question.questionId === 44 && gate.hasRole("financeApprover") && (
        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
          <Button
            size="small"
            variant="contained"
            disabled={specialApprovalRequested || sendSpecialApproval.isPending}
            onClick={requestSpecialApproval}
          >
            {specialApprovalRequested ? "Special Approval Requested" : "Request Special Approval"}
          </Button>
        </Box>
      )}
    </Box>
  );
}
