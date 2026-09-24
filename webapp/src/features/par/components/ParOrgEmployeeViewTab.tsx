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
import { Avatar, Box, DataGrid, IconButton, InputAdornment, Skeleton, Stack, TextField, Tooltip, Typography } from "@wso2/oxygen-ui";
import { EyeIcon, HistoryIcon, PencilIcon, SearchIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useLeaveEmployees } from "@features/leave/api/useLeaveData";
import { useParAdminParticipants, useParAllRatings } from "../api/useParAdmin";
import { ParGridToolbar } from "./parGridToolbar";
import ParEmptyState from "./ParEmptyState";
import ParLeadHistoryModal from "./ParLeadHistoryModal";
import type { ParCycle, ParParticipant } from "../api/types";

// Employee View tab — every participant in the cycle (name + email only;
// the participants resource itself carries no status). The Review/View icon
// swap needs parLeadStatus from a separate fetch (useParAllRatings, already
// used by View Reports) — source's own version of this check reads from a
// fetch that never carries status, so it's dead code there; implemented for
// real here instead.
export default function ParOrgEmployeeViewTab({
  cycle,
  onOpenReview,
}: {
  cycle: ParCycle;
  onOpenReview: (employeeEmail: string) => void;
}) {
  const participants = useParAdminParticipants(cycle.parCycleId);
  const ratings = useParAllRatings(cycle.parCycleId);
  const employees = useLeaveEmployees();
  const [searchText, setSearchText] = useState("");
  const [historyTarget, setHistoryTarget] = useState<{ email: string; name: string } | undefined>(undefined);

  if (participants.isLoading) {
    return <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1.5 }} />;
  }
  if (participants.isError) {
    return (
      <ErrorNotice error={participants.error} onRetry={() => participants.refetch()} retrying={participants.isFetching}>
        Error occurred while fetching employees
      </ErrorNotice>
    );
  }

  const rows = participants.data ?? [];
  if (rows.length === 0) {
    return <ParEmptyState text="No employees found" />;
  }

  const thumbnailByEmail = new Map(employees.data?.map((e) => [e.workEmail, e.employeeThumbnail]) ?? []);
  const leadStatusByEmail = new Map((ratings.data ?? []).map((r) => [r.parEmployeeEmail, r.parLeadStatus]));
  const filteredRows = searchText
    ? rows.filter(
        (row) =>
          row.employeeName.toLowerCase().includes(searchText.toLowerCase()) ||
          row.workEmail.toLowerCase().includes(searchText.toLowerCase()),
      )
    : rows;

  const columns: DataGrid.GridColDef<ParParticipant>[] = [
    {
      field: "employeeName",
      headerName: "Employee Name",
      flex: 2,
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
          <Avatar
            src={thumbnailByEmail.get(params.row.workEmail) || undefined}
            slotProps={{ img: { referrerPolicy: "no-referrer" } }}
            sx={{ mr: 2, height: "2.2rem", width: "2.2rem" }}
          />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {params.row.employeeName}
          </Typography>
        </Box>
      ),
    },
    {
      field: "workEmail",
      headerName: "Employee Email",
      flex: 2,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary">
          {params.row.workEmail}
        </Typography>
      ),
    },
    {
      field: "actions",
      headerName: "",
      sortable: false,
      flex: 0.6,
      renderCell: (params) => {
        const shared = leadStatusByEmail.get(params.row.workEmail) === "SHARED";
        return (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title={shared ? "View" : "Review"} arrow>
              <IconButton onClick={() => onOpenReview(params.row.workEmail)}>
                {shared ? <EyeIcon size={18} /> : <PencilIcon size={18} />}
              </IconButton>
            </Tooltip>
            <Tooltip title="View summary of PAR history" arrow>
              <IconButton onClick={() => setHistoryTarget({ email: params.row.workEmail, name: params.row.employeeName })}>
                <HistoryIcon size={18} />
              </IconButton>
            </Tooltip>
          </Stack>
        );
      },
    },
  ];

  return (
    <Stack spacing={1.5}>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <TextField
          size="small"
          placeholder="Search Employee"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon size={16} />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>
      <DataGrid.DataGrid
        rows={filteredRows}
        columns={columns}
        getRowId={(row) => row.workEmail}
        rowHeight={56}
        disableRowSelectionOnClick
        showToolbar
        slots={{ toolbar: ParGridToolbar }}
        sx={{ border: "none" }}
        initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        pageSizeOptions={[10, 20, 25]}
      />

      {historyTarget && (
        <ParLeadHistoryModal
          open
          onClose={() => setHistoryTarget(undefined)}
          employeeEmail={historyTarget.email}
          employeeName={historyTarget.name}
        />
      )}
    </Stack>
  );
}
