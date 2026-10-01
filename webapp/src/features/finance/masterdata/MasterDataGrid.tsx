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

import { Box, Chip, DataGrid, IconButton, Stack, TextField, Tooltip, Typography } from "@wso2/oxygen-ui";
import {
  DownloadIcon,
  InfoIcon,
  ListFilterIcon,
  PencilIcon,
  SearchIcon,
  TrashIcon,
} from "@wso2/oxygen-ui-icons-react";
import { FINANCE_GRID_SX } from "../util/financeGridSx";
import { INITIAL_SORT_FIELD } from "./masterDataForm";
import type { Department, ExpenseType, MasterDataRow, MasterDataTab } from "./masterDataTypes";

/**
 * The one table all four master-data screens are drawn with.
 *
 * The per-tab column list is a plain declaration below, and the cell
 * behaviour shared across tabs is three named renderers, because "which
 * columns does Subsidiaries have" is the question a reader actually
 * arrives with.
 */

/** Empty cells read as a dash, not as blank. */
const EMPTY = "-";

/** Lists render as chips; `valueFormatter` keeps CSV export readable. */
function ChipList({ values }: { values: string[] }) {
  if (!values || values.length === 0) return <>{EMPTY}</>;
  return (
    <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ py: 0.75 }}>
      {values.map((v) => (
        <Chip key={v} label={v} title={v} size="small" sx={{ fontSize: 11, fontWeight: 600 }} />
      ))}
    </Stack>
  );
}

/**
 * Active / inactive.
 *
 * The source hardcodes four hex values for the two states. Here it is the
 * theme's success and error colours through `Chip`'s own `color` prop, which
 * is the same green-means-active reading and survives a theme change.
 */
function StatusChip({ value }: { value: string }) {
  const label = (value ?? "").toLowerCase();
  return (
    <Chip
      label={label}
      title={label}
      size="small"
      variant="outlined"
      color={label === "active" ? "success" : "error"}
      sx={{ fontWeight: 600, textTransform: "capitalize" }}
    />
  );
}

/**
 * A value with an info icon carrying the fields that did not get a column.
 *
 * `TooltipCell.tsx` — a GL code is only meaningful alongside its internal id,
 * account name and cost centre, but four columns for one concept would crowd
 * out the rest of the table. The icon is omitted entirely when there is
 * nothing to show, rather than offering an empty tooltip.
 */
function InfoCell({ text, details }: { text: string; details: [string, string][] }) {
  const shown = details.filter(([, v]) => v && v !== EMPTY);
  return (
    <Stack direction="row" alignItems="center" gap={0.5} sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: 12.5, wordBreak: "break-word" }}>{text || EMPTY}</Typography>
      {shown.length > 0 && (
        <Tooltip
          arrow
          placement="left"
          title={
            <Box sx={{ p: 0.5 }}>
              {details.map(([k, v]) => (
                <Typography key={k} sx={{ fontSize: 12.5, py: 0.25 }}>
                  {k}: <strong>{v || "N/A"}</strong>
                </Typography>
              ))}
            </Box>
          }
        >
          {/* `flexShrink: 0` so the icon is not squeezed away by a long value. */}
          <InfoIcon size={13} style={{ flexShrink: 0, opacity: 0.7 }} />
        </Tooltip>
      )}
    </Stack>
  );
}

/** Plain text cell — dash when empty. */
const text = (): Partial<DataGrid.GridColDef> => ({
  renderCell: (p) => (p.value === null || p.value === undefined || p.value === "" || p.value === 0
    ? EMPTY
    : String(p.value)),
});

const chips = (): Partial<DataGrid.GridColDef> => ({
  renderCell: (p) => <ChipList values={(p.value as string[]) ?? []} />,
  // Export writes "a, b", not "[object Object]".
  valueFormatter: (value) => ((value as string[])?.length ? (value as string[]).join(", ") : EMPTY),
});

/** Per-tab columns, headers and widths, in the order they're read left to right. */
const MASTER_DATA_COLUMNS: Record<MasterDataTab, DataGrid.GridColDef[]> = {
  subsidiaries: [
    { field: "legalName", headerName: "Subsidiary Legal Name", flex: 4, minWidth: 220, ...text() },
    { field: "code", headerName: "Subsidiary Code", flex: 3, minWidth: 170, ...text() },
    { field: "taxCodeInternalId", headerName: "Tax ID", flex: 1, minWidth: 90, ...text() },
    { field: "taxCode", headerName: "Tax Code", flex: 2, minWidth: 120, ...text() },
  ],
  departments: [
    { field: "employeeDepartment", headerName: "Employee Department", flex: 4, minWidth: 220, ...text() },
    { field: "engagementCode", headerName: "Engagement Code", flex: 2, minWidth: 150, ...text() },
    {
      field: "glCode",
      headerName: "GL Code",
      flex: 2,
      minWidth: 140,
      renderCell: (p) => {
        const r = p.row as Department;
        return (
          <InfoCell
            text={r.glCode}
            details={[
              ["Internal ID", String(r.glCodeInternalId ?? "")],
              ["Account Name", r.glAccountName ?? ""],
              ["Cost Center", r.costCenter ?? ""],
            ]}
          />
        );
      },
    },
  ],
  expenseTypes: [
    { field: "expenseCategory", headerName: "Expense Category", flex: 2, minWidth: 160, ...text() },
    {
      field: "glCode",
      headerName: "Gl Code",
      flex: 1.5,
      minWidth: 130,
      renderCell: (p) => {
        const r = p.row as ExpenseType;
        return (
          <InfoCell
            text={r.glCode}
            details={[
              ["Internal ID", String(r.glCodeInternalId ?? "")],
              ["Account Name", r.glAccountName ?? ""],
              ["Cost Center", r.costCenter ?? ""],
            ]}
          />
        );
      },
    },
    {
      field: "expenseType",
      headerName: "Expense Type",
      flex: 2.5,
      minWidth: 180,
      renderCell: (p) => {
        const r = p.row as ExpenseType;
        return (
          <InfoCell
            text={r.expenseType}
            details={[["Expense Type Description", r.expenseTypeDescription ?? ""]]}
          />
        );
      },
    },
    { field: "engagementCodes", headerName: "Engagement Code", flex: 2, minWidth: 160, ...chips() },
    {
      field: "engagementCodeSuffixes",
      headerName: "Engagement Code Suffix",
      flex: 2,
      minWidth: 170,
      ...chips(),
    },
    {
      field: "status",
      headerName: "Status",
      flex: 1,
      minWidth: 110,
      renderCell: (p) => <StatusChip value={p.value as string} />,
    },
  ],
  creditCards: [
    { field: "ccNumber", headerName: "CC Number", flex: 1.5, minWidth: 130, ...text() },
    { field: "ccProviderCode", headerName: "CC Provider Code", flex: 1.5, minWidth: 150, ...text() },
    { field: "employeeEmail", headerName: "Employee Email", flex: 2.2, minWidth: 210, ...text() },
    { field: "leadEmails", headerName: "Lead Email", flex: 2.2, minWidth: 210, ...chips() },
    { field: "comment", headerName: "Comment", flex: 2, minWidth: 160, ...text() },
    {
      field: "status",
      headerName: "Status",
      flex: 1.2,
      minWidth: 110,
      renderCell: (p) => <StatusChip value={p.value as string} />,
    },
  ],
};

/**
 * Columns, Column Search, Export and an always-visible search box.
 *
 * "Column Search" rather than "Filters": on a reference table you filter a
 * column to find a record, and that label says so directly. The columns
 * button stays visible, unlike density and the column selector — these
 * tables are wide, and hiding a column you do not need is worth the extra
 * button.
 */
function MasterDataToolbar() {
  return (
    <DataGrid.Toolbar>
      {/* `Toolbar` is a bare container and takes no `sx`, so the row's
          spacing and the muted button colour live on a Box inside it. */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          p: 1.5,
          width: "100%",
          "& .MuiButtonBase-root": { color: "text.secondary" },
        }}
      >
        <DataGrid.FilterPanelTrigger render={<DataGrid.ToolbarButton />}>
          <ListFilterIcon size={16} style={{ marginRight: 6 }} />
          Column Search
        </DataGrid.FilterPanelTrigger>
        <DataGrid.ExportCsv render={<DataGrid.ToolbarButton />}>
          <DownloadIcon size={16} style={{ marginRight: 6 }} />
          Export
        </DataGrid.ExportCsv>
        <Box sx={{ flex: 1 }} />
        {/* `expanded`, so the field is on screen rather than behind a
            magnifier the reader has to click first. */}
        <DataGrid.QuickFilter expanded>
          <DataGrid.QuickFilterControl
            render={(props) => (
              <TextField
                {...props}
                variant="standard"
                size="small"
                placeholder="Search..."
                sx={{ minWidth: 220 }}
                InputProps={{
                  startAdornment: <SearchIcon size={16} style={{ marginRight: 6, opacity: 0.6 }} />,
                }}
              />
            )}
          />
        </DataGrid.QuickFilter>
      </Box>
    </DataGrid.Toolbar>
  );
}

/**
 * One tab's table, with an Actions column of Edit and Delete.
 *
 * Rows auto-size their height (`getRowHeight: () => "auto"`) because an
 * expense type can carry a dozen engagement-code chips and a fixed row
 * would clip all but the first line.
 */
export default function MasterDataGrid({
  tab,
  rows,
  loading,
  onEdit,
  onDelete,
}: {
  tab: MasterDataTab;
  rows: MasterDataRow[];
  loading: boolean;
  onEdit: (row: MasterDataRow) => void;
  onDelete: (row: MasterDataRow) => void;
}) {
  const columns: DataGrid.GridColDef[] = [
    ...MASTER_DATA_COLUMNS[tab],
    {
      field: "actions",
      headerName: "Actions",
      headerAlign: "right",
      align: "right",
      flex: 1.2,
      minWidth: 110,
      sortable: false,
      filterable: false,
      disableExport: true,
      disableColumnMenu: true,
      renderCell: (p) => (
        <Stack direction="row" justifyContent="flex-end" gap={0.5}>
          <Tooltip title="Edit">
            <IconButton size="small" aria-label="Edit" onClick={() => onEdit(p.row as MasterDataRow)}>
              <PencilIcon size={16} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              color="error"
              aria-label="Delete"
              onClick={() => onDelete(p.row as MasterDataRow)}
            >
              <TrashIcon size={16} />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <Box sx={{ flex: 1, minHeight: 420, width: "100%" }}>
      <DataGrid.DataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        getRowId={(r) => (r as MasterDataRow).id}
        getRowHeight={() => "auto"}
        disableRowSelectionOnClick
        disableColumnMenu
        slots={{ toolbar: MasterDataToolbar }}
        localeText={{ toolbarFilters: "Column Search" }}
        initialState={{
          sorting: { sortModel: [{ field: INITIAL_SORT_FIELD[tab], sort: "asc" }] },
          pagination: { paginationModel: { pageSize: 100, page: 0 } },
        }}
        pageSizeOptions={[25, 50, 100]}
        sx={{
          ...FINANCE_GRID_SX,
          // Wrap a long header rather than clipping it — two of these tables
          // have headers longer than their column ("Engagement Code Suffix").
          "& .MuiDataGrid-columnHeaderTitle": { whiteSpace: "normal", lineHeight: 1.3 },
          // Auto row height needs its own vertical padding; without it the
          // chips sit flush against the row divider.
          "& .MuiDataGrid-cell": { py: 1, alignItems: "center" },
        }}
      />
    </Box>
  );
}
