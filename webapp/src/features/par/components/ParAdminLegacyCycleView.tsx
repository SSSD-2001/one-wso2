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

import { useMemo, useState } from "react";
import { Box, Chip, DataGrid, IconButton, InputAdornment, Link, Skeleton, Stack, TextField, Tooltip, Typography } from "@wso2/oxygen-ui";
import { ArrowRightIcon, SearchIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useLeaveEmployees } from "@features/leave/api/useLeaveData";
import { useLegacyParHistoryByCycle } from "../api/useParAdmin";
import { formatShortDate } from "../util/parDate";
import { deriveLegacyRatingFromScore } from "../util/parLegacyHistory";
import { groupLegacyParticipantsByTeam, type LegacyTeamGroup } from "../util/parAdminHistory";
import ParEmptyState from "./ParEmptyState";
import ParLegacyRecordDetail from "./ParLegacyRecordDetail";
import { ParGridToolbar } from "./parGridToolbar";
import type { ParLegacyHistory } from "../api/types";

type Selection = { level: "groups" } | { level: "roster"; group: LegacyTeamGroup } | { level: "record"; group: LegacyTeamGroup; record: ParLegacyHistory };

function LegacyChip() {
  return <Chip label="Legacy" size="small" color="warning" variant="outlined" sx={{ ml: 1.5 }} />;
}

function Breadcrumb({ items, current }: { items: { label: string; onClick: () => void }[]; current: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
      {items.map((item) => (
        <Box key={item.label} sx={{ display: "flex", alignItems: "center" }}>
          <Link component="button" underline="hover" onClick={item.onClick} sx={{ mr: 0.5 }}>
            {item.label}
          </Link>
          <Typography component="span" sx={{ mx: 0.5 }}>
            /
          </Typography>
        </Box>
      ))}
      <Typography component="span" variant="h5">
        {current}
      </Typography>
      <LegacyChip />
    </Box>
  );
}

// Admin Portal History tab's legacy-only drill-down: cycle -> team-like
// groups (department + reviewer, legacy data has no real team concept, see
// groupLegacyParticipantsByTeam) -> that group's records -> one record's
// full detail. Ports HistoryPanel.tsx's own three legacy view states, but as
// DataGrids throughout rather than plain MUI tables, matching how every
// other legacy-table screen in this port (e.g. ParOrgTeamViewTab.tsx) has
// already upgraded from source's plain tables.
export default function ParAdminLegacyCycleView({ cycleName, onBack }: { cycleName: string; onBack: () => void }) {
  const history = useLegacyParHistoryByCycle(cycleName);
  // No org-wide employee directory of our own — reuses Leave's for names and
  // avatars, same deviation ParOrgTeamRoster.tsx/ParLeadTeamRoster.tsx make;
  // legacy records only ever carry an email, never a name, for the employee
  // being reviewed.
  const employees = useLeaveEmployees();
  const employeeByEmail = useMemo(
    () => new Map(employees.data?.map((e) => [e.workEmail, e]) ?? []),
    [employees.data],
  );
  const nameFor = (email: string) => {
    const e = employeeByEmail.get(email);
    return e ? `${e.firstName} ${e.lastName}` : email;
  };

  const [selection, setSelection] = useState<Selection>({ level: "groups" });
  const [searchText, setSearchText] = useState("");

  if (history.isLoading) {
    return <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1.5 }} />;
  }
  if (history.isError) {
    return (
      <ErrorNotice error={history.error} onRetry={() => history.refetch()} retrying={history.isFetching}>
        Couldn't load this legacy cycle's PAR history.
      </ErrorNotice>
    );
  }

  const groups = groupLegacyParticipantsByTeam(history.data ?? []);

  if (selection.level === "record") {
    const { group, record } = selection;
    return (
      <Stack spacing={2}>
        <Breadcrumb
          items={[
            { label: "History", onClick: onBack },
            { label: cycleName, onClick: () => setSelection({ level: "groups" }) },
            { label: group.parLeadEmail, onClick: () => setSelection({ level: "roster", group }) },
          ]}
          current={nameFor(record.employeeEmail)}
        />
        <ParLegacyRecordDetail
          record={record}
          employeeEmail={record.employeeEmail}
          employeeName={nameFor(record.employeeEmail)}
          thumbnail={employeeByEmail.get(record.employeeEmail)?.employeeThumbnail}
        />
      </Stack>
    );
  }

  if (selection.level === "roster") {
    const { group } = selection;
    const columns: DataGrid.GridColDef<ParLegacyHistory>[] = [
      { field: "employeeEmail", headerName: "Employee", flex: 1.3, valueGetter: (_v, row) => nameFor(row.employeeEmail) },
      { field: "reviewerName", headerName: "Reviewer", flex: 1, valueGetter: (_v, row) => row.reviewerName ?? "-" },
      {
        field: "overallRating",
        headerName: "Overall Rating",
        flex: 1,
        // Same fallback ParLegacyRecordDetail uses, so a record can't show
        // "Not Assigned" here and a derived rating once opened.
        valueGetter: (_v, row) => row.overallRating ?? deriveLegacyRatingFromScore(row.managerScoreCode).rating ?? "Not Assigned",
      },
      {
        field: "reviewCompletedDate",
        headerName: "Completed Date",
        flex: 1,
        // Raw value kept for sorting — formatShortDate's "D Mon 'YY" labels
        // would otherwise sort lexicographically, not chronologically.
        valueFormatter: (value: string | null) => (value ? formatShortDate(value) : "-"),
      },
      {
        field: "actions",
        headerName: "",
        sortable: false,
        flex: 0.4,
        renderCell: (params) => (
          <Tooltip title="Open Record" arrow>
            <IconButton onClick={() => setSelection({ level: "record", group, record: params.row })}>
              <ArrowRightIcon size={18} />
            </IconButton>
          </Tooltip>
        ),
      },
    ];

    return (
      <Stack spacing={2}>
        <Breadcrumb
          items={[
            { label: "History", onClick: onBack },
            { label: cycleName, onClick: () => setSelection({ level: "groups" }) },
          ]}
          current={group.parLeadEmail}
        />
        <DataGrid.DataGrid
          rows={group.participants}
          columns={columns}
          getRowId={(row) => row.legacyHeaderId}
          rowHeight={56}
          disableRowSelectionOnClick
          onRowClick={(params) => setSelection({ level: "record", group, record: params.row })}
          showToolbar
          slots={{ toolbar: ParGridToolbar }}
          sx={{ border: "none", "& .MuiDataGrid-row": { cursor: "pointer" } }}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          pageSizeOptions={[10, 20, 25]}
        />
      </Stack>
    );
  }

  if (groups.length === 0) {
    return (
      <Stack spacing={2}>
        <Breadcrumb items={[{ label: "History", onClick: onBack }]} current={cycleName} />
        <ParEmptyState text="No records found for this legacy cycle." />
      </Stack>
    );
  }

  const filteredGroups = searchText
    ? groups.filter((g) => Object.values(g).some((value) => typeof value !== "object" && String(value).toLowerCase().includes(searchText.toLowerCase())))
    : groups;

  const columns: DataGrid.GridColDef<LegacyTeamGroup>[] = [
    { field: "parBusinessUnit", headerName: "BU", flex: 1 },
    { field: "parDepartment", headerName: "Department", flex: 1 },
    { field: "parTeam", headerName: "Team", flex: 1 },
    { field: "parSubTeam", headerName: "Sub Team", flex: 1 },
    { field: "parLeadEmail", headerName: "Lead", flex: 1 },
    {
      field: "employeeParCompletion",
      headerName: "Employee PAR",
      flex: 0.7,
      renderCell: (params) => <Chip size="small" label={params.row.employeeParCompletion} />,
    },
    {
      field: "leadFeedbackCompletion",
      headerName: "Lead's Feedback",
      flex: 0.7,
      renderCell: (params) => <Chip size="small" label={params.row.leadFeedbackCompletion} />,
    },
    { field: "numberOf5pSlots", headerName: "5% Slots", flex: 0.5 },
    { field: "numberOf20pSlots", headerName: "20% Slots", flex: 0.5 },
    {
      field: "actions",
      headerName: "",
      sortable: false,
      flex: 0.4,
      renderCell: (params) => (
        <Tooltip title="Open Group" arrow>
          <IconButton onClick={() => setSelection({ level: "roster", group: params.row })}>
            <ArrowRightIcon size={18} />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Stack spacing={2}>
      <Breadcrumb items={[{ label: "History", onClick: onBack }]} current={cycleName} />

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
        rows={filteredGroups}
        columns={columns}
        rowHeight={56}
        disableRowSelectionOnClick
        onRowClick={(params) => setSelection({ level: "roster", group: params.row })}
        showToolbar
        slots={{ toolbar: ParGridToolbar }}
        sx={{ border: "none", "& .MuiDataGrid-row": { cursor: "pointer" } }}
        initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        pageSizeOptions={[10, 20, 25]}
      />
    </Stack>
  );
}
