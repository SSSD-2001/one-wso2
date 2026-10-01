/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useMemo, type RefObject } from "react";
import { Box, Chip, DataGrid, Stack, Tooltip, Typography } from "@wso2/oxygen-ui";
import { FINANCE_GRID_SX } from "@features/finance/util/financeGridSx";
import { MIS_VALUE_TYPES, formatMisValue } from "../util/misMoney";
import { analysisYearsLabel } from "../util/misAnalysisFilters";
import type { MisScale } from "../util/misViewVocabulary";
import type { AnalysisAccountRow } from "./analysisAccountRows";

// The account table: one row per account, eleven columns, flat.
//
// ---- the one screen in MIS that takes the DataGrid --------------------------
//
// The Build tables are hand-rolled, not a data grid; this is the exception.
// The Build needs pinned columns, three-level collapsible sections, hand-
// computed totals and row windowing over thousands of rows, none of which the
// community grid has. This table needs none of them: it is flat, it sorts, and
// Finance wants it as a spreadsheet. That is precisely the condition
// `LeaveReportsPage.tsx:315-318` documents for reaching for the component we
// already ship rather than rebuilding sorting, paging, a filter panel, column
// visibility and CSV by hand.
//
// ---- the CSV, and the foot-gun it would otherwise walk into ----------------
//
// The grid's CSV exporter takes each cell's `formattedValue`,
// which is `valueFormatter`'s output when a column defines one
// (`csvSerializer.js:24-44`). So formatting a money column through
// `valueFormatter` — the obvious way — would export the reader's Scale, giving
// Finance a file a thousand times off with nothing in it saying so.
//
// Every money column therefore formats in `renderCell`, and its
// `valueFormatter` is `RAW_NUMBER` — the identity — so the cell's value reaches
// the CSV untouched. Nothing structural enforces that;
// `AnalysisAccountGrid.test.tsx` asserts it on the bytes the exporter actually
// produces.
//
// `RAW_NUMBER` is not belt-and-braces. A column typed `number` arrives with a
// formatter already fitted — `value.toLocaleString()`
// (`gridNumericColDef.js:12`) — so leaving the field unset does not mean "no
// formatting": it means the grid's, and the CSV then carries `"1,234,567.89"`.
// That string is a number only in a locale whose thousands separator is a
// comma. The identity formatter writes `1234567.89` instead: a dot decimal
// and no thousands separator. It is still a CSV, not an Excel number. A
// decimal-comma locale may not parse the dot as a decimal when the file is
// opened directly. The toolbar says so.
//
// The same trade decides the Products column: chips have no text for the
// exporter to take, so its VALUE is the backend's comma string and the chips
// are `renderCell`'s doing.
//
// ---- the community tier's limits are the design, not an obstacle -----------
//
//   · `pageSize` above 100 THROWS (`gridPaginationUtils.js:25`) — it does not
//     degrade, it takes the table off the screen. The options below stay well
//     under it.
//   · Pagination cannot be turned off in this tier, so the table pages rather
//     than scrolling as one list. Finance's whole-book question is answered by
//     the CSV, which exports every row regardless of the page on screen.
//   · Multi-column sort and multi-item filter are forced off
//     (`useDataGridProps.js:10-11`). Sorting one column at a time is what this
//     table needs; narrowing by more than one thing at a time is what the
//     filter panel above it is for, which is why the toolbar's own filter is
//     relabelled to say it only narrows the rows already listed.

export interface AnalysisAccountGridProps {
  rows: AnalysisAccountRow[];
  /** Currency columns only — counts and years are never scaled. */
  scale: MisScale;
  isLoading: boolean;
  /** For the suite, which reads the CSV the toolbar's own button would write. */
  apiRef?: RefObject<DataGrid.GridApi | null>;
}

export default function AnalysisAccountGrid({
  rows,
  scale,
  isLoading,
  apiRef,
}: AnalysisAccountGridProps) {
  const columns = useMemo(() => analysisAccountColumns(scale), [scale]);

  return (
    <Box sx={{ height: 660, width: "100%" }}>
      <DataGrid.DataGrid
        apiRef={apiRef}
        rows={rows}
        columns={columns}
        loading={isLoading}
        disableRowSelectionOnClick
        // Rows grow only when the product chips wrap. An estimate is required
        // alongside `auto`, or the grid cannot size its scrollbar before it has
        // measured.
        getRowHeight={() => "auto"}
        getEstimatedRowHeight={() => 40}
        columnHeaderHeight={48}
        // Both under the community ceiling of 100, above which the grid throws.
        pageSizeOptions={[25, 50]}
        initialState={{ pagination: { paginationModel: { pageSize: 50, page: 0 } } }}
        showToolbar
        slots={{ toolbar: AnalysisGridToolbar }}
        // The Filters panel above the table chooses which accounts are here;
        // this toolbar only narrows the rows already listed. Two controls that
        // both say "filter" and mean different things is the confusion worth
        // spending a few strings on.
        localeText={{
          toolbarFilters: "Filter these rows",
          toolbarFiltersLabel: "Filter these rows",
          toolbarFiltersTooltipShow: "Filter these rows",
          toolbarQuickFilterPlaceholder: "Search these rows",
        }}
        sx={{ border: "none", ...FINANCE_GRID_SX }}
      />
    </Box>
  );
}

/**
 * Columns, quick filter and the CSV button.
 *
 * Export is offered here where `ToolbarNoExport` withholds it on the card
 * grids, and the difference is the point of each screen: those show spend
 * nobody has submitted, this one exists to be taken into a spreadsheet.
 */
function AnalysisGridToolbar() {
  // Each trigger is wrapped in a Tooltip as well as labelled, following
  // `ccGridToolbar.tsx`: the `aria-label` names the button for a screen reader,
  // and the tooltip is the only thing that names it for a sighted reader, since
  // all three are icon-only.
  return (
    <DataGrid.Toolbar>
      <Tooltip title="Columns">
        <DataGrid.ColumnsPanelTrigger render={<DataGrid.ToolbarButton aria-label="Columns" />}>
          <DataGrid.GridColumnIcon fontSize="small" />
        </DataGrid.ColumnsPanelTrigger>
      </Tooltip>
      <Tooltip title="Filter these rows">
        <DataGrid.FilterPanelTrigger
          render={<DataGrid.ToolbarButton aria-label="Filter these rows" />}
        >
          <DataGrid.GridFilterListIcon fontSize="small" />
        </DataGrid.FilterPanelTrigger>
      </Tooltip>
      <Tooltip title="Download as CSV. Amounts use a dot decimal and no thousands separator.">
        <DataGrid.ExportCsv render={<DataGrid.ToolbarButton aria-label="Download as CSV" />}>
          <DataGrid.GridDownloadIcon fontSize="small" />
        </DataGrid.ExportCsv>
      </Tooltip>
      <Box sx={{ flex: 1 }} />
      <DataGrid.GridToolbarQuickFilter />
    </DataGrid.Toolbar>
  );
}

/**
 * The eleven columns, in this order and with these widths.
 *
 * Built per Scale rather than at module scope, because the money cells read it
 * — and memoised by the caller, since a fresh array on every render resets the
 * grid's own column state.
 */
export function analysisAccountColumns(scale: MisScale): DataGrid.GridColDef<AnalysisAccountRow>[] {
  const amount = (value: number) =>
    formatMisValue(value, MIS_VALUE_TYPES.CURRENCY, { scale, fractionDigits: 0 });

  /** One money column. Displayed through `renderCell`, exported raw. */
  const money = (
    field: keyof AnalysisAccountRow,
    headerName: string,
    minWidth: number,
  ): DataGrid.GridColDef<AnalysisAccountRow> => ({
    field,
    headerName,
    minWidth,
    type: "number",
    valueFormatter: RAW_NUMBER,
    // The CSV reads `valueFormatter` (the raw figure). The quick filter would
    // then search that same raw figure, so a reader looking for the amount on
    // screen — `1,235` when Scale is thousands — would miss the row.
    getApplyQuickFilterFn: (search) => {
      const needle = normalizeSearch(String(search ?? ""));
      if (!needle) return null;
      return (value) => {
        const shown = normalizeSearch(amount(typeof value === "number" ? value : Number(value)));
        const raw = normalizeSearch(String(value ?? ""));
        return shown.includes(needle) || raw.includes(needle);
      };
    },
    renderCell: (params) => <Typography sx={CELL_SX}>{amount(params.value as number)}</Typography>,
  });

  return [
    { field: "accountName", headerName: "Account Name", minWidth: 220, flex: 1 },
    {
      field: "productsInUse",
      headerName: "Products in Use",
      minWidth: 220,
      flex: 1,
      // Neither sortable nor filterable: the value is a comma string whose
      // order is the backend's, so sorting it would rank accounts by an
      // accident of concatenation. Narrowing by product is the Business Units
      // control's job, which asks the backend rather than the loaded page.
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Stack direction="row" flexWrap="wrap" gap={0.5} py={0.5} sx={{ width: "100%" }}>
          {params.row.products.map((product) => (
            <Chip
              key={`${params.row.id}-${product}`}
              label={product}
              size="small"
              variant="outlined"
              sx={{ height: 21, fontWeight: 600, "& .MuiChip-label": { fontSize: 11 } }}
            />
          ))}
        </Stack>
      ),
    },
    { field: "country", headerName: "Country", minWidth: 130 },
    {
      field: "lifetimeYears",
      headerName: "Lifetime",
      minWidth: 110,
      // `number`, so "10 yrs" does not sort above "2 yrs".
      type: "number",
      valueFormatter: RAW_NUMBER,
      renderCell: (params) => (
        <Typography sx={CELL_SX}>{analysisYearsLabel(params.value as number)}</Typography>
      ),
    },
    money("apimBu", "APIM BU", 135),
    money("iamBu", "IAM BU", 135),
    money("integrationBu", "Integration BU", 150),
    money("choreoBu", "Choreo BU", 140),
    money("agentPlatformBu", "Agent Platform BU", 170),
    money("moesifBu", "Moesif", 150),
    { ...money("totalArr", "Total ARR", 140) },
  ];
}

/**
 * The formatter every numeric column needs and none of them wants: the
 * identity, displacing the `number` type's own `toLocaleString`.
 *
 * `valueFormatter` is what the CSV exporter reads, so this is the line that
 * decides what Finance opens. See the note at the top of this file.
 */
const RAW_NUMBER = (value: number): number => value;

const normalizeSearch = (value: string): string => value.replace(/[,\s]/g, "").toLowerCase();

const CELL_SX = { fontSize: 12.5, fontWeight: 600 } as const;
