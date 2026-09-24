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
import { useDistinctLegacyParCycles, useParCyclesByStatus } from "../api/useParAdmin";
import { buildAdminHistoryRows, type AdminHistoryRow } from "../util/parAdminHistory";
import { formatShortDate } from "../util/parDate";
import ParEmptyState from "../components/ParEmptyState";
import ParOrgSummary from "../components/ParOrgSummary";
import ParAdminLegacyCycleView from "../components/ParAdminLegacyCycleView";
import { ParGridToolbar } from "../components/parGridToolbar";
import type { ParCycle } from "../api/types";

type Selection = { kind: "none" } | { kind: "real"; cycle: ParCycle } | { kind: "legacy"; cycleName: string };

// Admin Portal's History tab: every closed real cycle merged with every
// distinct legacy (pre-par-app) cycle, org-wide, latest first. Selecting a
// real cycle reopens ParOrgSummary in its read-only historyMode; selecting a
// legacy cycle opens the legacy-only drill-down, since legacy data has no
// real cycle/team model to reuse ParOrgSummary for.
export default function ParAdminHistoryTab() {
  const closedCycles = useParCyclesByStatus("CLOSED");
  const legacyCycles = useDistinctLegacyParCycles();
  const [selection, setSelection] = useState<Selection>({ kind: "none" });
  const [searchText, setSearchText] = useState("");

  if (selection.kind === "real") {
    return <ParOrgSummary cycle={selection.cycle} historyMode onBack={() => setSelection({ kind: "none" })} />;
  }
  if (selection.kind === "legacy") {
    return <ParAdminLegacyCycleView cycleName={selection.cycleName} onBack={() => setSelection({ kind: "none" })} />;
  }

  if (closedCycles.isLoading || legacyCycles.isLoading) {
    return <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1.5 }} />;
  }
  if (closedCycles.isError) {
    return (
      <ErrorNotice error={closedCycles.error} onRetry={() => closedCycles.refetch()} retrying={closedCycles.isFetching}>
        Couldn't load past PAR cycles.
      </ErrorNotice>
    );
  }
  if (legacyCycles.isError) {
    return (
      <ErrorNotice error={legacyCycles.error} onRetry={() => legacyCycles.refetch()} retrying={legacyCycles.isFetching}>
        Couldn't load legacy PAR cycles.
      </ErrorNotice>
    );
  }

  const rows = buildAdminHistoryRows(closedCycles.data ?? [], legacyCycles.data ?? []);

  if (rows.length === 0) {
    return <ParEmptyState text="No past PAR cycles found." />;
  }

  const filteredRows = searchText ? rows.filter((row) => row.cycleName.toLowerCase().includes(searchText.toLowerCase())) : rows;

  const columns: DataGrid.GridColDef<AdminHistoryRow>[] = [
    {
      field: "cycleName",
      headerName: "Cycle Name",
      flex: 2,
      renderCell: (params) => (
        <Stack direction="row" alignItems="center" spacing={1}>
          <span>{params.row.cycleName}</span>
          {params.row.isLegacy && <Chip label="Legacy" size="small" color="warning" variant="outlined" />}
        </Stack>
      ),
    },
    // Raw values kept for sorting — formatShortDate's "D Mon 'YY" labels
    // would otherwise sort lexicographically, not chronologically.
    { field: "startDate", headerName: "Start Date", flex: 1, valueFormatter: (value: string | null) => (value ? formatShortDate(value) : "-") },
    { field: "endDate", headerName: "End Date", flex: 1, valueFormatter: (value: string | null) => (value ? formatShortDate(value) : "-") },
    {
      field: "actions",
      headerName: "",
      sortable: false,
      flex: 0.4,
      renderCell: (params) => (
        <Tooltip title="Open Cycle" arrow>
          <IconButton onClick={() => handleRowClick(params.row)}>
            <ArrowRightIcon size={18} />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  const handleRowClick = (row: AdminHistoryRow) => {
    if (row.isLegacy) {
      setSelection({ kind: "legacy", cycleName: row.cycleName });
    } else {
      const cycle = closedCycles.data?.find((c) => c.parCycleId === row.parCycleId);
      if (cycle) setSelection({ kind: "real", cycle });
    }
  };

  return (
    <Stack spacing={1.5}>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <TextField
          size="small"
          placeholder="Search Cycle"
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
        getRowId={(row) => row.key}
        rowHeight={56}
        disableRowSelectionOnClick
        onRowClick={(params) => handleRowClick(params.row)}
        showToolbar
        slots={{ toolbar: ParGridToolbar }}
        sx={{ border: "none", "& .MuiDataGrid-row": { cursor: "pointer" } }}
        // Pre-sorted by buildAdminHistoryRows on the raw end date — no
        // sortModel here, since sorting on endDate's rendered (formatted)
        // string would sort lexicographically rather than chronologically.
        initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        pageSizeOptions={[10, 20, 25]}
      />
    </Stack>
  );
}
