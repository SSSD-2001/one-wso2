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
import { Box, DataGrid, Dialog, DialogContent, DialogTitle, Divider, IconButton, InputAdornment, Skeleton, TextField } from "@wso2/oxygen-ui";
import { SearchIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useParAllRatings } from "../api/useParAdmin";
import { ParGridToolbar } from "./parGridToolbar";
import ParStatusChip from "./ParStatusChip";
import type { ParCycle, ParRating } from "../api/types";

export default function ParViewReportsDialog({
  open,
  onClose,
  cycle,
}: {
  open: boolean;
  onClose: () => void;
  cycle: ParCycle;
}) {
  const ratings = useParAllRatings(cycle.parCycleId, open);
  const [searchText, setSearchText] = useState("");

  const rows = ratings.data ?? [];
  const filteredRows = searchText
    ? rows.filter((row) => Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(searchText.toLowerCase())))
    : rows;

  const columns: DataGrid.GridColDef<ParRating>[] = [
    { field: "parEmployeeEmail", headerName: "Employee Email", flex: 1.2 },
    { field: "parEmployeeName", headerName: "Employee Name", flex: 1.2 },
    // Hidden by default (columnVisibilityModel below) — same as source's
    // Report.tsx, which shows these only once toggled on via its column
    // selector rather than in the default view.
    { field: "parCompany", headerName: "Company", flex: 0.8 },
    { field: "parLocation", headerName: "Location", flex: 0.8 },
    { field: "parBusinessUnit", headerName: "Business Unit", flex: 1 },
    { field: "parDepartment", headerName: "Department", flex: 1 },
    { field: "parTeam", headerName: "Team", flex: 1 },
    { field: "parSubTeam", headerName: "Sub Team", flex: 1 },
    { field: "parLeadEmail", headerName: "Lead Email", flex: 1.2 },
    {
      field: "parRating",
      headerName: "Rating",
      flex: 0.8,
      renderCell: (params) => <ParStatusChip content={params.row.parRating ?? ""} />,
    },
    {
      field: "parSpecialRating",
      headerName: "Top 5%/20% Rating",
      flex: 0.9,
      renderCell: (params) => <ParStatusChip content={params.row.parSpecialRating ?? ""} />,
    },
    {
      field: "parEmployeeStatus",
      headerName: "Employee Status",
      flex: 0.8,
      renderCell: (params) => <ParStatusChip content={params.row.parEmployeeStatus} />,
    },
    {
      field: "parLeadStatus",
      headerName: "Lead Status",
      flex: 0.8,
      renderCell: (params) => <ParStatusChip content={params.row.parLeadStatus} />,
    },
    {
      field: "parF2fStatus",
      headerName: "F2F Status",
      flex: 0.8,
      renderCell: (params) => <ParStatusChip content={params.row.parF2fStatus} />,
    },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {cycle.parCycleName} / Report
        <IconButton onClick={onClose} aria-label="close">
          <XIcon size={18} />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent>
        {ratings.isLoading && <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1.5, mt: 2 }} />}
        {ratings.isError && (
          <ErrorNotice error={ratings.error} onRetry={() => ratings.refetch()} retrying={ratings.isFetching}>
            Couldn't load the report data.
          </ErrorNotice>
        )}
        {ratings.isSuccess && (
          <Box sx={{ mt: 2 }}>
            <TextField
              size="small"
              placeholder="Search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              sx={{ mb: 1.5 }}
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
            <DataGrid.DataGrid
              rows={filteredRows}
              columns={columns}
              getRowId={(row) => row.parRatingId}
              rowHeight={52}
              disableRowSelectionOnClick
              showToolbar
              slots={{ toolbar: ParGridToolbar }}
              sx={{ border: "none" }}
              initialState={{
                pagination: { paginationModel: { pageSize: 25 } },
                columns: { columnVisibilityModel: { parCompany: false, parLocation: false } },
              }}
              pageSizeOptions={[25, 50, 100]}
            />
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
