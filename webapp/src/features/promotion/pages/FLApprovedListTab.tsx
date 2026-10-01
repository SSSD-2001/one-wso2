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

// Ports promotion-app's own view/functionalLead/panels/approvedList.tsx —
// every request THIS functional lead approved (FL_APPROVED/APPROVED/
// REJECTED — the last two are what the Promotion Board decided
// afterwards, which is why this "approved" tab includes a rejected state:
// it's tracking what happens next to a request this lead already signed
// off on, not re-litigating it). Read-only — no bulk actions, no edit.
import { useState } from "react";
import { Box, DataGrid, Divider, IconButton, Skeleton, Stack, Tooltip, Typography } from "@wso2/oxygen-ui";
import { ChevronDownIcon, InboxIcon, RefreshCwIcon, TriangleAlertIcon } from "@wso2/oxygen-ui-icons-react";
import { humanizeHttpError } from "@api/http";
import { useActivePromotionCycle } from "../api/usePromotionCycle";
import { usePromotionRequests } from "../api/usePromotionRequests";
import { basePromotionRequestColumns } from "../components/promotionRequestColumns";
import PromotionEmptyState from "../components/PromotionEmptyState";
import { PromotionGridToolbar } from "../components/PromotionGridToolbar";
import PromotionRequestDetailDialog from "../components/PromotionRequestDetailDialog";
import { GRID_NO_POINTER_FOCUS_SX } from "@utils/dataGridSx";
import type { PromotionRequestFull } from "../api/types";

// Source's own transformFLState — the Promotion Board's decision, in the
// functional lead's own terms (FL_APPROVED just means "still with the
// board"). A TIME_BASED request never reaches the board at all (the Lead
// Portal's own submit already finalizes it), so it reads "N/A" here rather
// than a real status.
function boardStatusLabel(request: PromotionRequestFull): string {
  if (request.promotionType === "TIME_BASED") return "N/A";
  if (request.status === "FL_APPROVED") return "Pending";
  if (request.status === "APPROVED") return "Approved";
  return "Rejected";
}

const ROW_COLOR_SX = {
  "& .row-approved": { bgcolor: "success.50" },
  "& .row-rejected": { bgcolor: "error.50" },
};

export default function FLApprovedListTab() {
  const cycle = useActivePromotionCycle();
  const requests = usePromotionRequests(
    { statusArray: ["FL_APPROVED", "APPROVED", "REJECTED"], enableBuFilter: true, cycleId: cycle.cycle?.id },
    !cycle.isPending && Boolean(cycle.cycle),
  );
  const [viewingRequest, setViewingRequest] = useState<PromotionRequestFull | null>(null);

  const rows = requests.data?.promotionRequests ?? [];
  const boardApprovedCount = rows.filter((r) => r.status === "APPROVED" && r.promotionType !== "TIME_BASED").length;
  const boardRejectedCount = rows.filter((r) => r.status === "REJECTED").length;

  const columns: DataGrid.GridColDef<PromotionRequestFull>[] = [
    ...basePromotionRequestColumns(),
    {
      field: "status",
      headerName: "Promotion Board Approval Status",
      flex: 1.2,
      minWidth: 180,
      valueGetter: (_value, row) => boardStatusLabel(row),
    },
    {
      field: "action",
      headerName: "",
      sortable: false,
      filterable: false,
      disableExport: true,
      width: 60,
      renderCell: (params) => (
        <Tooltip title="View details">
          <IconButton size="small" onClick={() => setViewingRequest(params.row)}>
            <ChevronDownIcon size={16} />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      <PromotionRequestDetailDialog request={viewingRequest} onClose={() => setViewingRequest(null)} />

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Tooltip title="Refresh">
          <IconButton
            size="small"
            onClick={() => {
              if (!cycle.isError && cycle.cycle) void requests.refetch();
              else void cycle.refetch();
            }}
          >
            <RefreshCwIcon size={16} />
          </IconButton>
        </Tooltip>
        {rows.length > 0 && (
          <Stack direction="row" spacing={2} divider={<Divider orientation="vertical" flexItem />} alignItems="center">
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>All Count: {rows.length}</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "success.main" }}>
              Promotion Board Approved Count: {boardApprovedCount}
            </Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "error.main" }}>
              Promotion Board Rejected Count: {boardRejectedCount}
            </Typography>
          </Stack>
        )}
      </Box>

      {cycle.isPending || (Boolean(cycle.cycle) && requests.isPending) ? (
        <Skeleton variant="rectangular" height={360} sx={{ borderRadius: 1 }} />
      ) : cycle.isError ? (
        <PromotionEmptyState
          icon={<TriangleAlertIcon size={28} />}
          tone="error"
          message={`Unable to load the promotion cycle. ${humanizeHttpError(cycle.error)}`}
        />
      ) : requests.isError ? (
        <PromotionEmptyState
          icon={<TriangleAlertIcon size={28} />}
          tone="error"
          message={`Unable to load promotion requests. ${humanizeHttpError(requests.error)}`}
        />
      ) : rows.length === 0 ? (
        <PromotionEmptyState icon={<InboxIcon size={28} />} message="There are no pending promotion requests" />
      ) : (
        <DataGrid.DataGrid
          rows={rows}
          columns={columns}
          getRowClassName={(params) =>
            params.row.status === "APPROVED"
              ? "row-approved"
              : params.row.status === "REJECTED"
                ? "row-rejected"
                : ""
          }
          showToolbar
          slots={{ toolbar: PromotionGridToolbar }}
          sx={{ border: "none", ...GRID_NO_POINTER_FOCUS_SX, ...ROW_COLOR_SX }}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          pageSizeOptions={[10, 25, 50]}
        />
      )}
    </>
  );
}
