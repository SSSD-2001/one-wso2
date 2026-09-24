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

import { Box, Breadcrumbs, Chip, DataGrid, Divider, IconButton, Link, Stack, Typography } from "@wso2/oxygen-ui";
import { ArrowLeftIcon } from "@wso2/oxygen-ui-icons-react";
import { completionPercent, completionSeverity } from "../util/parCompletionSeverity";
import { ParGridToolbar } from "./parGridToolbar";
import type { ParCycle, ParTeamSummary } from "../api/types";

interface CompletionRow {
  id: number;
  parBusinessUnit: string;
  parDepartment: string;
  parTeam?: string;
  employeePARCompletion: number;
  leadReviewCompletion: number;
  f2fCompletion: number;
}

function percentChip(value: number) {
  const severity = completionSeverity(value);
  return <Chip size="small" color={severity === "success" ? "default" : severity} label={`${value.toFixed(1)}%`} />;
}

// Ports Completion.tsx — reuses the SAME teams data ParOrgSummary already
// fetched (source's own Completion.tsx reads teamSlice rather than
// refetching), just re-expressed as per-team percentages instead of the
// "x/y" counts the Team View tab shows.
export default function ParCompletionOverview({
  cycle,
  teams,
  onBack,
}: {
  cycle: ParCycle;
  teams: ParTeamSummary[];
  onBack: () => void;
}) {
  const rows: CompletionRow[] = teams.map((team) => ({
    id: team.parTeamId,
    parBusinessUnit: team.parBusinessUnit,
    parDepartment: team.parDepartment,
    parTeam: team.parTeam,
    employeePARCompletion: completionPercent(team.summary.employeeParCompletedCount, team.numberOfTeamMembers),
    leadReviewCompletion: completionPercent(team.summary.leadsReviewCompletedCount, team.numberOfTeamMembers),
    f2fCompletion: completionPercent(team.summary.f2fCompletedCount, team.numberOfTeamMembers),
  }));

  const columns: DataGrid.GridColDef<CompletionRow>[] = [
    { field: "parBusinessUnit", headerName: "BU", flex: 1 },
    { field: "parDepartment", headerName: "Department", flex: 1 },
    { field: "parTeam", headerName: "Team", flex: 1 },
    {
      field: "employeePARCompletion",
      headerName: "Employee PAR (%)",
      flex: 0.9,
      renderCell: (params) => percentChip(params.row.employeePARCompletion),
    },
    {
      field: "leadReviewCompletion",
      headerName: "Lead's Feedback (%)",
      flex: 0.9,
      renderCell: (params) => percentChip(params.row.leadReviewCompletion),
    },
    {
      field: "f2fCompletion",
      headerName: "F2F (%)",
      flex: 0.7,
      renderCell: (params) => percentChip(params.row.f2fCompletion),
    },
  ];

  return (
    <Stack spacing={1.5}>
      <Box>
        <Breadcrumbs>
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton aria-label="back" color="primary" onClick={onBack}>
              <ArrowLeftIcon size={18} />
            </IconButton>
            <Link component="button" underline="hover" color="inherit" onClick={onBack}>
              {cycle.parCycleName}
            </Link>
            <Typography color="text.secondary">Completion Overview</Typography>
          </Stack>
        </Breadcrumbs>
        <Divider />
      </Box>

      <DataGrid.DataGrid
        rows={rows}
        columns={columns}
        rowHeight={52}
        disableRowSelectionOnClick
        showToolbar
        slots={{ toolbar: ParGridToolbar }}
        sx={{ border: "none" }}
        initialState={{
          pagination: { paginationModel: { pageSize: 25 } },
          columns: { columnVisibilityModel: { f2fCompletion: false } },
        }}
        pageSizeOptions={[25, 50, 100]}
      />
    </Stack>
  );
}
