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
// view/promotionCycleHistory/panels/cycleHistory.tsx — pick a closed
// cycle, see its own dates/deadlines, and every request it produced.
// HR_ADMIN sees every request org-wide; a FUNCTIONAL_LEAD (who isn't also
// HR_ADMIN) sees only requests within their own BU access
// (enableBuFilter=true) — source's own role branch (getAllPromotionRequests
// vs getAllFLPromotionApplications), reproduced here as the same
// usePromotionRequests call with/without enableBuFilter rather than two
// separate endpoints.
import { useState } from "react";
import { Box, Chip, DataGrid, Grid, IconButton, MenuItem, Select, Skeleton, Tooltip, Typography } from "@wso2/oxygen-ui";
import { ChevronDownIcon, InboxIcon, RefreshCwIcon, TriangleAlertIcon } from "@wso2/oxygen-ui-icons-react";
import { humanizeHttpError } from "@api/http";
import { useUserInfo } from "@api/useUserInfo";
import { useAsgardeoUser } from "@hooks/useAsgardeoUser";
import { useInactivePromotionCycles } from "../api/usePromotionCycle";
import { usePromotionPrivileges } from "../api/usePromotionRoles";
import { usePromotionRequests } from "../api/usePromotionRequests";
import { basePromotionRequestColumns } from "../components/promotionRequestColumns";
import PromotionEmptyState from "../components/PromotionEmptyState";
import PromotionRequestDetailDialog from "../components/PromotionRequestDetailDialog";
import { PromotionGridToolbar } from "../components/PromotionGridToolbar";
import { promotionRequestColor } from "../util/promotionStatus";
import { GRID_NO_POINTER_FOCUS_SX } from "@utils/dataGridSx";
import type { PromotionRequestFull } from "../api/types";

const ROW_COLOR_SX = { "& .row-approved": { bgcolor: "success.50" } };

export default function CycleHistoryTab() {
  const userInfo = useUserInfo();
  const asgardeoUser = useAsgardeoUser();
  const workEmail = userInfo.data?.workEmail ?? asgardeoUser.email;
  const role = usePromotionPrivileges(workEmail);

  const cycles = useInactivePromotionCycles();
  const [selectedCycleId, setSelectedCycleId] = useState<number | "">("");
  const [viewingRequest, setViewingRequest] = useState<PromotionRequestFull | null>(null);
  const selectedCycle = cycles.data?.promotionCycles.find((c) => c.id === selectedCycleId);

  // Source's own role branch is an `if (HR_ADMIN) ... else if (FUNCTIONAL_LEAD)`
  // — HR_ADMIN takes priority when a caller somehow holds both.
  const enableBuFilter = !role.isHrAdmin && role.isFunctionalLead;
  const requests = usePromotionRequests(
    { cycleId: selectedCycleId || undefined, enableBuFilter },
    // Wait for the role privileges to resolve too — firing while `role` is
    // still loading would use enableBuFilter's default-false reading
    // (org-wide) for a functional lead who isn't also HR_ADMIN, then
    // immediately refire scoped once the real answer lands a moment later.
    selectedCycleId !== "" && !role.isLoading,
  );

  const columns: DataGrid.GridColDef<PromotionRequestFull>[] = [
    ...basePromotionRequestColumns(),
    {
      field: "status",
      headerName: "Promotion Board Approval Status",
      flex: 1.2,
      minWidth: 180,
      renderCell: (params) => (
        <Chip label={params.value} size="small" sx={{ bgcolor: promotionRequestColor(params.value), color: "white" }} />
      ),
    },
    {
      field: "action",
      headerName: "Action",
      sortable: false,
      filterable: false,
      disableExport: true,
      width: 90,
      renderCell: (params) => (
        <Tooltip title="View details">
          <IconButton size="small" onClick={() => setViewingRequest(params.row)}>
            <ChevronDownIcon size={16} />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  const rows = requests.data?.promotionRequests ?? [];

  return (
    <>
      <PromotionRequestDetailDialog request={viewingRequest} onClose={() => setViewingRequest(null)} />

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, gap: 1.5 }}>
        <Tooltip title="Refresh">
          <IconButton
            size="small"
            onClick={() => {
              void cycles.refetch();
              if (selectedCycleId !== "") void requests.refetch();
            }}
          >
            <RefreshCwIcon size={16} />
          </IconButton>
        </Tooltip>
        <Select
          size="small"
          displayEmpty
          sx={{ minWidth: 240 }}
          value={selectedCycleId}
          onChange={(e) => setSelectedCycleId(e.target.value as number)}
        >
          <MenuItem value="" disabled>
            Select a promotion cycle
          </MenuItem>
          {(cycles.data?.promotionCycles ?? []).map((cycle) => (
            <MenuItem key={cycle.id} value={cycle.id}>
              {cycle.name}
            </MenuItem>
          ))}
          {cycles.data && cycles.data.promotionCycles.length === 0 && (
            <MenuItem value="" disabled>
              No past promotion cycles
            </MenuItem>
          )}
        </Select>
      </Box>

      {cycles.isPending ? (
        <Skeleton variant="rectangular" height={360} sx={{ borderRadius: 1 }} />
      ) : cycles.isError ? (
        <PromotionEmptyState
          icon={<TriangleAlertIcon size={28} />}
          tone="error"
          message={`Unable to load promotion cycles. ${humanizeHttpError(cycles.error)}`}
        />
      ) : !selectedCycle ? (
        <PromotionEmptyState icon={<InboxIcon size={28} />} message="Select a promotion cycle to view details." />
      ) : (
        <>
          <Grid container spacing={3} sx={{ p: 2.5, mb: 2, border: 1, borderColor: "divider", borderRadius: 1 }}>
            <Grid size={{ xs: 6, md: 2 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary" }}>Cycle Name</Typography>
              <Typography sx={{ fontSize: 14 }}>{selectedCycle.name}</Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary" }}>Start Date</Typography>
              <Typography sx={{ fontSize: 14 }}>{selectedCycle.startDate}</Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary" }}>End Date</Typography>
              <Typography sx={{ fontSize: 14 }}>{selectedCycle.endDate}</Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary" }}>Lead Deadline</Typography>
              <Typography sx={{ fontSize: 14 }}>{selectedCycle.leadDeadline}</Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary" }}>FL Deadline</Typography>
              <Typography sx={{ fontSize: 14 }}>{selectedCycle.functionalLeadDeadline}</Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary" }}>Board Deadline</Typography>
              <Typography sx={{ fontSize: 14 }}>{selectedCycle.promotionBoardDeadline}</Typography>
            </Grid>
          </Grid>

          {requests.isPending ? (
            <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 1 }} />
          ) : requests.isError ? (
            <PromotionEmptyState
              icon={<TriangleAlertIcon size={28} />}
              tone="error"
              message={`Unable to load promotion requests. ${humanizeHttpError(requests.error)}`}
            />
          ) : rows.length === 0 ? (
            <PromotionEmptyState icon={<InboxIcon size={28} />} message="There is no promotion request in this cycle." />
          ) : (
            <DataGrid.DataGrid
              rows={rows}
              columns={columns}
              getRowClassName={(params) => (params.row.status === "APPROVED" ? "row-approved" : "")}
              showToolbar
              slots={{ toolbar: PromotionGridToolbar }}
              sx={{ border: "none", ...GRID_NO_POINTER_FOCUS_SX, ...ROW_COLOR_SX }}
              initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
              pageSizeOptions={[10, 25, 50]}
            />
          )}
        </>
      )}
    </>
  );
}
