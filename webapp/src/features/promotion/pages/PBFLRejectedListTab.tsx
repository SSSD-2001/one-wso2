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
// view/promotionBoard/panels/functionalLeadRejectedList.tsx — every request
// a functional lead rejected (FL_REJECTED), org-wide (distinct from the
// Functional Lead Portal's own FLRejectedListTab, which is BU-scoped to the
// calling lead). Gives the board visibility into requests that never
// reached them at all. Read-only, structurally identical to
// PBApprovedListTab/PBRejectedListTab.
import { useState } from "react";
import { Box, DataGrid, IconButton, Skeleton, Tooltip } from "@wso2/oxygen-ui";
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

const STRIPE_SX = {
  "& .row-stripe": { bgcolor: "action.hover" },
};

export default function PBFLRejectedListTab() {
  const cycle = useActivePromotionCycle();
  const requests = usePromotionRequests(
    { statusArray: ["FL_REJECTED"], cycleId: cycle.cycle?.id },
    !cycle.isPending && Boolean(cycle.cycle),
  );
  const [viewingRequest, setViewingRequest] = useState<PromotionRequestFull | null>(null);

  const rows = requests.data?.promotionRequests ?? [];

  const columns: DataGrid.GridColDef<PromotionRequestFull>[] = [
    ...basePromotionRequestColumns(),
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

      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1.5 }}>
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
        <PromotionEmptyState
          icon={<InboxIcon size={28} />}
          message="There are no functional lead rejected promotion requests"
        />
      ) : (
        <DataGrid.DataGrid
          rows={rows}
          columns={columns}
          getRowClassName={(params) => (params.indexRelativeToCurrentPage % 2 === 0 ? "row-stripe" : "")}
          showToolbar
          slots={{ toolbar: PromotionGridToolbar }}
          sx={{ border: "none", ...GRID_NO_POINTER_FOCUS_SX, ...STRIPE_SX }}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          pageSizeOptions={[10, 25, 50]}
        />
      )}
    </>
  );
}
