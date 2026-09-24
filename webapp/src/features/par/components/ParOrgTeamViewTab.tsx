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
import { Box, Chip, DataGrid, IconButton, InputAdornment, Skeleton, Stack, TextField, Tooltip } from "@wso2/oxygen-ui";
import { ArrowRightIcon, SearchIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useParAdminTeams } from "../api/useParAdmin";
import { ParGridToolbar } from "./parGridToolbar";
import ParEmptyState from "./ParEmptyState";
import type { ParCycle, ParTeamSummary } from "../api/types";

// Team View tab — every team org-wide, no leadEmail filter.
// `onSelectTeam` drives ParOrgSummary.tsx's drill-in into ParOrgTeamRoster.tsx.
export default function ParOrgTeamViewTab({
  cycle,
  onSelectTeam,
}: {
  cycle: ParCycle;
  onSelectTeam: (team: ParTeamSummary) => void;
}) {
  const teams = useParAdminTeams(cycle.parCycleId);
  const [searchText, setSearchText] = useState("");

  if (teams.isLoading) {
    return <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1.5 }} />;
  }
  if (teams.isError) {
    return (
      <ErrorNotice error={teams.error} onRetry={() => teams.refetch()} retrying={teams.isFetching}>
        Error occurred while fetching teams
      </ErrorNotice>
    );
  }

  const rows = teams.data ?? [];
  if (rows.length === 0) {
    return <ParEmptyState text="No teams found" />;
  }

  // Searches every field of the row, not just the ones shown as columns.
  const filteredRows = searchText
    ? rows.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(searchText.toLowerCase())))
    : rows;

  const columns: DataGrid.GridColDef<ParTeamSummary>[] = [
    { field: "parBusinessUnit", headerName: "BU", flex: 1 },
    { field: "parDepartment", headerName: "Department", flex: 1 },
    { field: "parTeam", headerName: "Team", flex: 1 },
    { field: "parSubTeam", headerName: "Sub Team", flex: 1 },
    { field: "parLeadEmail", headerName: "Lead", flex: 1 },
    {
      field: "employeePar",
      headerName: "Employee PAR",
      flex: 0.7,
      renderCell: (params) => (
        <Chip size="small" label={`${params.row.summary.employeeParCompletedCount}/${params.row.numberOfTeamMembers}`} />
      ),
    },
    {
      field: "leadFeedback",
      headerName: "Lead's Feedback",
      flex: 0.7,
      renderCell: (params) => (
        <Chip size="small" label={`${params.row.summary.leadsReviewCompletedCount}/${params.row.numberOfTeamMembers}`} />
      ),
    },
    {
      field: "f2f",
      headerName: "F2F",
      flex: 0.5,
      renderCell: (params) => <Chip size="small" label={`${params.row.summary.f2fCompletedCount}/${params.row.numberOfTeamMembers}`} />,
    },
    { field: "numberOf5pSlots", headerName: "5% Slots", flex: 0.5 },
    { field: "numberOf20pSlots", headerName: "20% Slots", flex: 0.5 },
    {
      field: "actions",
      headerName: "",
      sortable: false,
      flex: 0.5,
      renderCell: (params) => (
        <Tooltip title="Open Team" arrow>
          <IconButton onClick={() => onSelectTeam(params.row)}>
            <ArrowRightIcon size={18} />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Stack spacing={1.5}>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <TextField
          size="small"
          placeholder="Search Team"
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
        getRowId={(row) => row.parTeamId}
        rowHeight={56}
        disableRowSelectionOnClick
        onRowClick={(params) => onSelectTeam(params.row)}
        showToolbar
        slots={{ toolbar: ParGridToolbar }}
        sx={{ border: "none", "& .MuiDataGrid-row": { cursor: "pointer" } }}
        initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        pageSizeOptions={[10, 20, 25]}
      />
    </Stack>
  );
}
