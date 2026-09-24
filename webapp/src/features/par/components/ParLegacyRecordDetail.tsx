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

import { Accordion, AccordionDetails, AccordionSummary, Avatar, Chip, Divider, Grid, Stack, Typography } from "@wso2/oxygen-ui";
import { ChevronDownIcon } from "@wso2/oxygen-ui-icons-react";
import { deriveLegacyRatingFromScore, parseLegacyQuestionAnswers } from "../util/parLegacyHistory";
import { employeeChipLabel } from "../util/parLabels";
import { ParCommentView } from "./ParContent";
import ParLegacyReviewSection from "./ParLegacyReviewSection";
import type { ParLegacyHistory } from "../api/types";

function InfoItem({ title, subtitle1, subtitle2 }: { title: string; subtitle1: string; subtitle2: string }) {
  return (
    <Grid size="grow">
      <Typography variant="body1">{title || "—"}</Typography>
      <Typography variant="body2" color="text.secondary">
        {subtitle1}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {subtitle2 || "—"}
      </Typography>
    </Grid>
  );
}

function isMeaningfulLegacyText(text: string | null | undefined): text is string {
  return Boolean(text) && text!.trim() !== "" && text!.trim() !== "N/A";
}

// One legacy record's full detail — extracted out of ParEmployeeHistoryView.tsx
// (which shows it for one fixed employee's own history) so
// ParAdminLegacyCycleView.tsx's org-wide drill-down can render the exact
// same content for any employee's record without duplicating this rendering.
export default function ParLegacyRecordDetail({
  record,
  employeeEmail,
  employeeName,
  thumbnail,
}: {
  record: ParLegacyHistory;
  employeeEmail: string;
  employeeName: string;
  thumbnail?: string;
}) {
  const legacyEmployeeContent = parseLegacyQuestionAnswers(record.questionAnswers)
    .map((qa) => qa.employeeAnswer)
    .filter(isMeaningfulLegacyText)
    .join("\n\n");
  const legacyLeadContent = isMeaningfulLegacyText(record.overallCommentManager) ? record.overallCommentManager! : "";
  const derived = deriveLegacyRatingFromScore(record.managerScoreCode);
  const rating = record.overallRating ?? derived.rating;
  const special = record.overallSpecialRating ?? derived.special;

  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid size="auto">
          <Avatar variant="rounded" src={thumbnail} alt="Employee Thumbnail" sx={{ width: 100, height: 100 }} />
        </Grid>
        <Grid size="grow">
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {special && special !== "NOT_ASSIGNED" && (
              <Chip size="small" color={employeeChipLabel(special).color} label={employeeChipLabel(special).label} />
            )}
            {rating && <Chip size="small" color={employeeChipLabel(rating).color} label={employeeChipLabel(rating).label} />}
          </Stack>
          {(record.reviewerEmail || record.reviewerName) && (
            <Chip size="small" sx={{ mt: 1 }} label={`PAR shared by: ${record.reviewerEmail ?? record.reviewerName}`} />
          )}
        </Grid>
        <InfoItem title={employeeName} subtitle1="Employee" subtitle2={employeeEmail} />
        <InfoItem title={record.reviewerName ?? record.reviewerEmail ?? ""} subtitle1="Lead" subtitle2={record.reviewerEmail ?? ""} />
        <InfoItem title={record.team ?? ""} subtitle1="Team" subtitle2={record.department ?? ""} />
      </Grid>

      <Divider />

      <Accordion disabled={!legacyEmployeeContent} defaultExpanded={Boolean(legacyEmployeeContent)} sx={{ mt: 1 }}>
        <AccordionSummary expandIcon={<ChevronDownIcon size={18} />}>Employee PAR</AccordionSummary>
        <AccordionDetails>
          <Divider sx={{ my: 1 }} />
          <ParCommentView html={legacyEmployeeContent} />
        </AccordionDetails>
      </Accordion>
      <Accordion disabled={!legacyLeadContent} defaultExpanded={Boolean(legacyLeadContent)} sx={{ mt: 1 }}>
        <AccordionSummary expandIcon={<ChevronDownIcon size={18} />}>Lead's Feedback</AccordionSummary>
        <AccordionDetails>
          <Divider sx={{ my: 1 }} />
          <ParCommentView html={legacyLeadContent} />
        </AccordionDetails>
      </Accordion>

      <Divider />

      <ParLegacyReviewSection feedback360={record.feedback360} />
    </Stack>
  );
}
