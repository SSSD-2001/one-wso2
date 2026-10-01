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

// Ports promotion-app's own
// view/administration/panels/individualContributorPromotions.tsx — an
// audit/monitoring list of INDIVIDUAL_CONTRIBUTOR requests for the
// currently open cycle. Read-mostly: source has no approve/reject/bulk
// action here at all (contrast every other admin/lead/board grid), the only
// mutation is editing a rejected request's own reason after the fact.
import { useState } from "react";
import { Box, Chip, DataGrid, IconButton, Skeleton, Stack, Tooltip } from "@wso2/oxygen-ui";
import { EyeIcon, InboxIcon, RefreshCwIcon, TriangleAlertIcon } from "@wso2/oxygen-ui-icons-react";
import { humanizeHttpError } from "@api/http";
import { useActivePromotionCycle } from "../api/usePromotionCycle";
import { usePromotionRequests, useUpdatePromotionRequestRejectionReason } from "../api/usePromotionRequests";
import { basePromotionRequestColumns } from "../components/promotionRequestColumns";
import PromotionEmptyState from "../components/PromotionEmptyState";
import PromotionFeedbackSnackbar from "../components/PromotionFeedbackSnackbar";
import { usePromotionFeedback } from "../util/usePromotionFeedback";
import { PromotionGridToolbar } from "../components/PromotionGridToolbar";
import DeclinedReasonDialog, { type DeclinedReasonTarget } from "../components/DeclinedReasonDialog";
import { promotionRequestColor } from "../util/promotionStatus";
import { encodePromotionText } from "../util/promotionRichText";
import { GRID_NO_POINTER_FOCUS_SX } from "@utils/dataGridSx";
import type { PromotionRequestFull } from "../api/types";

export default function AdminIndividualContributorTab() {
  const cycle = useActivePromotionCycle();
  const requests = usePromotionRequests(
    { type: "INDIVIDUAL_CONTRIBUTOR", cycleId: cycle.cycle?.id },
    !cycle.isPending && Boolean(cycle.cycle),
  );
  const updateReason = useUpdatePromotionRequestRejectionReason();
  const [editingTarget, setEditingTarget] = useState<DeclinedReasonTarget | null>(null);
  const { feedback, notifySuccess, notifyError, close } = usePromotionFeedback();

  const rows = requests.data?.promotionRequests ?? [];

  const columns: DataGrid.GridColDef<PromotionRequestFull>[] = [
    ...basePromotionRequestColumns(),
    {
      field: "status",
      headerName: "Promotion Status",
      flex: 1,
      minWidth: 150,
      renderCell: (params) => (
        <Chip label={params.value} size="small" sx={{ bgcolor: promotionRequestColor(params.value), color: "white" }} />
      ),
    },
    {
      field: "recommendations",
      headerName: "Lead Email",
      flex: 1.4,
      minWidth: 200,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ py: 0.5 }}>
          {params.row.recommendations.map((r) => (
            <Chip key={r.recommendationID} label={`Lead: ${r.leadEmail}`} size="small" variant="outlined" />
          ))}
        </Stack>
      ),
    },
    {
      field: "reasonForRejection",
      headerName: "Declined Reason",
      flex: 0.6,
      minWidth: 120,
      sortable: false,
      filterable: false,
      disableExport: true,
      renderCell: (params) =>
        params.row.status === "FL_REJECTED" || params.row.status === "REJECTED" ? (
          <Tooltip title="View / edit reason">
            <IconButton
              size="small"
              onClick={() =>
                setEditingTarget({ key: params.row.id, initialValue: params.row.reasonForRejection })
              }
            >
              <EyeIcon size={16} />
            </IconButton>
          </Tooltip>
        ) : (
          "N/A"
        ),
    },
  ];

  return (
    <>
      <PromotionFeedbackSnackbar feedback={feedback} onClose={close} />
      <DeclinedReasonDialog
        title="Declined Reason"
        target={editingTarget}
        saving={updateReason.isPending}
        onClose={() => setEditingTarget(null)}
        onSave={(text) => {
          if (!editingTarget) return;
          updateReason.mutate(
            { id: editingTarget.key, reasonForRejection: encodePromotionText(text) },
            {
              onSuccess: () => {
                setEditingTarget(null);
                notifySuccess("Declined reason updated.");
              },
              onError: (error) => notifyError(`Unable to update the declined reason. ${humanizeHttpError(error)}`),
            },
          );
        }}
      />

      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1.5 }}>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={() => void requests.refetch()}>
            <RefreshCwIcon size={16} />
          </IconButton>
        </Tooltip>
      </Box>

      {cycle.isPending ? (
        <Skeleton variant="rectangular" height={360} sx={{ borderRadius: 1 }} />
      ) : cycle.isError ? (
        <PromotionEmptyState
          icon={<TriangleAlertIcon size={28} />}
          tone="error"
          message={`Unable to load the promotion cycle. ${humanizeHttpError(cycle.error)}`}
        />
      ) : !cycle.cycle ? (
        <PromotionEmptyState icon={<InboxIcon size={28} />} message="There is no active promotion cycle" />
      ) : requests.isPending ? (
        <Skeleton variant="rectangular" height={360} sx={{ borderRadius: 1 }} />
      ) : requests.isError ? (
        <PromotionEmptyState
          icon={<TriangleAlertIcon size={28} />}
          tone="error"
          message={`Unable to load promotion requests. ${humanizeHttpError(requests.error)}`}
        />
      ) : rows.length === 0 ? (
        <PromotionEmptyState icon={<InboxIcon size={28} />} message="There are no promotion requests for the active cycle" />
      ) : (
        <DataGrid.DataGrid
          rows={rows}
          columns={columns}
          showToolbar
          slots={{ toolbar: PromotionGridToolbar }}
          sx={{ border: "none", ...GRID_NO_POINTER_FOCUS_SX }}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          pageSizeOptions={[10, 25, 50]}
        />
      )}
    </>
  );
}
