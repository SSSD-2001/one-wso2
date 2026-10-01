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

import { Alert, AlertTitle, Avatar, Box, Chip, Divider, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import { humanizeHttpError } from "@api/http";
import type { PromotionRequestFull } from "../api/types";
import { decodePromotionText } from "../util/promotionRichText";
import { recommendationColor } from "../util/promotionStatus";
import { usePromotionEmployeeInfo } from "../api/usePromotionEmployeeInfo";
import { usePromotionHistory } from "../api/usePromotionHistory";
import PromotionRichTextContent from "./PromotionRichTextContent";
import PromotionTimeline from "./PromotionTimeline";

// Request detail panel: an employee avatar, a rejection-reason alert (only
// for a REJECTED/FL_REJECTED request), every lead recommendation on the
// request (statement + additional comment, decoded and sanitized), and the
// employee's full promotion history, rendered with the same PromotionTimeline
// that PromotionEmployeeHistoryDialog.tsx uses, fed by the same two hooks.
export default function PromotionRequestDetailPanel({ request }: { request: PromotionRequestFull }) {
  const isRejected = request.status === "REJECTED" || request.status === "FL_REJECTED";
  const info = usePromotionEmployeeInfo(request.employeeEmail);
  const history = usePromotionHistory(request.employeeEmail, true);

  return (
    <Box sx={{ p: 2.5, display: "flex", gap: 3 }}>
      {isRejected && request.reasonForRejection && (
        <Alert severity="error" sx={{ position: "absolute", top: 8, left: 8, right: 8 }}>
          <AlertTitle>Reason For Rejection</AlertTitle>
          {request.reasonForRejection}
        </Alert>
      )}

      <Avatar sx={{ width: 100, height: 100, flexShrink: 0, mt: isRejected ? 6 : 0 }}>
        {request.employeeEmail.charAt(0).toUpperCase()}
      </Avatar>

      <Box sx={{ flex: 1, minWidth: 0, mt: isRejected ? 6 : 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1 }}>Lead Recommendations</Typography>
        {request.recommendations.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
            There are no lead recommendations.
          </Typography>
        ) : (
          <Stack spacing={1.5} sx={{ maxHeight: 260, overflow: "auto", pr: 1 }}>
            {request.recommendations.map((rec) => (
              <Box key={rec.recommendationID} sx={{ borderTop: 1, borderColor: "divider", pt: 1.5 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{rec.leadEmail}</Typography>
                  {/* Show the raw status, not recommendationStatusLabel's
                      SUBMITTED→"APPROVED" remap. That remap applies only to the
                      Lead Portal History tab. */}
                  <Chip
                    label={rec.recommendationStatus}
                    size="small"
                    sx={{ bgcolor: recommendationColor(rec.recommendationStatus), color: "white", height: 20, fontSize: 10.5 }}
                  />
                </Stack>
                <PromotionRichTextContent content={decodePromotionText(rec.recommendationStatement)} />
                {rec.recommendationAdditionalComment && (
                  <>
                    <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: "text.secondary", mt: 0.5 }}>
                      Additional Comment
                    </Typography>
                    <PromotionRichTextContent content={decodePromotionText(rec.recommendationAdditionalComment)} />
                  </>
                )}
              </Box>
            ))}
          </Stack>
        )}
      </Box>

      <Divider orientation="vertical" flexItem />

      <Box sx={{ flex: 1, minWidth: 0, mt: isRejected ? 6 : 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1 }}>Promotion History</Typography>
        <Box sx={{ maxHeight: 350, overflow: "auto" }}>
          {info.isPending || history.isPending ? (
            <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1 }} />
          ) : info.isError ? (
            <Alert severity="error">{humanizeHttpError(info.error)}</Alert>
          ) : history.isError ? (
            <Alert severity="error">{humanizeHttpError(history.error)}</Alert>
          ) : info.data ? (
            <PromotionTimeline employeeInfo={info.data.employeeInfo} requests={history.data?.promotionRequests ?? []} />
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}
