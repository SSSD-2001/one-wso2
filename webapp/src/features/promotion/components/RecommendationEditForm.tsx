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

import { useMemo, useState, type ReactNode } from "react";
import { Avatar, Box, Button, Grid, Stack, TextField, Tooltip, Typography } from "@wso2/oxygen-ui";
import { InfoIcon } from "@wso2/oxygen-ui-icons-react";
import { humanizeHttpError } from "@api/http";
import ConfirmationDialog, { type ConfirmationContent } from "@components/confirmation-dialog/ConfirmationDialog";
import { usePromotionEmployeeInfo } from "../api/usePromotionEmployeeInfo";
import { useSaveRecommendation, useSubmitRecommendation } from "../api/useLeadRecommendations";
import { decodePromotionText, encodePromotionText, isEmptyPromotionHtml } from "../util/promotionRichText";
import { formatDate } from "../util/promotionHistory";
import PromotionRichTextField from "./PromotionRichTextField";
import type { PromotionRecommendation } from "../api/types";

// Ports promotion-app's own component/recommendation/recommendation.tsx +
// component/forms/recommendationForm.tsx — the "Start" editing screen for
// one pending recommendation: read-only applicant info (job band, joined/
// last-promoted dates, photo) plus a single rich-text field labelled
// "Additional comments" that actually writes recommendationStatement —
// source's own field/label mismatch, kept as-is rather than "fixed", since
// this is what source's own running app shows.
export default function RecommendationEditForm({
  recommendation,
  leadEmail,
  onBack,
}: {
  recommendation: PromotionRecommendation;
  leadEmail: string;
  onBack: () => void;
}) {
  const employeeInfo = usePromotionEmployeeInfo(recommendation.employeeEmail);
  const initialStatement = useMemo(
    () => decodePromotionText(recommendation.recommendationStatement),
    [recommendation.recommendationStatement],
  );
  const [statement, setStatement] = useState(initialStatement);
  const [confirm, setConfirm] = useState<ConfirmationContent | null>(null);

  const save = useSaveRecommendation();
  const submit = useSubmitRecommendation();

  const isModified = statement !== initialStatement;
  const isValidContent = !isEmptyPromotionHtml(statement);
  const isSubmitted = recommendation.recommendationStatus === "SUBMITTED";
  const busy = save.isPending || submit.isPending;

  // recommendationAdditionalComment is passed through UNCHANGED (already
  // base64 on the wire, or null) rather than re-encoded — source's own
  // saveRecommendation/submitRecommendation thunks re-run it through
  // Buffer.from(...).toString("base64") as if it were plain text, which
  // double-encodes an already-base64 value. There's no UI anywhere in this
  // screen that edits that field (see the file header), so nothing is lost
  // by leaving it exactly as the backend sent it.
  const buildPayload = () => ({
    id: recommendation.recommendationID,
    statement: encodePromotionText(statement),
    comment: recommendation.recommendationAdditionalComment ?? "",
    leadEmail,
  });

  const handleSave = () =>
    setConfirm({
      title: "Do you want to save the application?",
      text: "Please note this will overwrite the existing content",
      confirmLabel: "save",
      confirmAction: () => save.mutate(buildPayload(), { onSuccess: onBack }),
    });

  const handleSubmit = () =>
    setConfirm({
      title: "Do you want to submit the application?",
      text: "Please note once submitted changes cannot be made",
      confirmLabel: "submit",
      confirmAction: () => submit.mutate(buildPayload(), { onSuccess: onBack }),
    });

  return (
    <>
      <ConfirmationDialog content={confirm} onClose={() => setConfirm(null)} />
      <Button onClick={onBack} sx={{ mb: 2 }}>
        ← Back to Pending Requests
      </Button>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Stack spacing={2}>
            <Field label="Applicant email">
              <TextField size="small" disabled fullWidth value={recommendation.employeeEmail} />
            </Field>
            <Field label="Job band of the recommended designation">
              <Stack direction="row" alignItems="center" spacing={1}>
                <TextField size="small" disabled sx={{ width: 200 }} value={recommendation.promotingJobBand} />
                <Tooltip title="Job Band Info">
                  <InfoIcon size={18} />
                </Tooltip>
              </Stack>
            </Field>
            <Field label="Joined Date">
              <TextField
                size="small"
                disabled
                sx={{ width: 200 }}
                value={employeeInfo.data ? formatDate(employeeInfo.data.employeeInfo.startDate) : "…"}
              />
            </Field>
            <Field label="Last Promoted Date">
              <TextField
                size="small"
                disabled
                sx={{ width: 200 }}
                value={
                  employeeInfo.data
                    ? employeeInfo.data.employeeInfo.lastPromotedDate
                      ? formatDate(employeeInfo.data.employeeInfo.lastPromotedDate)
                      : "N/A"
                    : "…"
                }
              />
            </Field>
            {employeeInfo.isError && (
              <Typography sx={{ fontSize: 12.5, color: "error.main" }}>
                Couldn&apos;t load the applicant&apos;s record. {humanizeHttpError(employeeInfo.error)}
              </Typography>
            )}
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }} sx={{ display: "flex", alignItems: "flex-start" }}>
          <Avatar
            src={employeeInfo.data?.employeeInfo.employeeThumbnail ?? undefined}
            sx={{ width: 150, height: 150 }}
          >
            {recommendation.employeeName.charAt(0)}
          </Avatar>
        </Grid>
      </Grid>

      <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
        Additional comments
      </Typography>
      <PromotionRichTextField value={statement} onChange={setStatement} disabled={isSubmitted} />

      <Stack direction="row" spacing={2} sx={{ mt: 2.5 }}>
        <Button
          size="large"
          variant="contained"
          disabled={!isValidContent || !isModified || busy}
          onClick={handleSave}
        >
          Save As Draft
        </Button>
        <Button
          size="large"
          variant="contained"
          color="success"
          disabled={!isValidContent || busy}
          onClick={handleSubmit}
        >
          Approve
        </Button>
      </Stack>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>{label}</Typography>
      {children}
    </Box>
  );
}
