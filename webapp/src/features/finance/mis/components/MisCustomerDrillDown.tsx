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

import { useMemo } from "react";
import {
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { XIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import BuildTable from "./BuildTable";
import MisAppliedFilterChips from "./MisAppliedFilterChips";
import { drillDownColumns, drillDownRows, type DrillDownColumn } from "./drillDownColumns";
import type { MisFilterChip } from "../util/misAppliedFilterChips";
import type { DrillDownState } from "../api/useDrillDownCustomers";
import MisExportButton from "./MisExportButton";
import { misDrillDownSheet } from "../export/misDrillDownWorkbook";
import { misExportFilename, misFilenameRange, misFilenameWord } from "../export/misExportFilename";

// Who is inside this number.
//
// Opened by clicking a figure in the Build; the row and the Period decide both
// the question asked of the backend and the columns shown back.
//
// ---- it renders through BuildTable, with no Periods at all ------------------
//
// A flat list of eleven or thirteen columns. That looks like a job for a plain
// table until the volume is considered: `/arr-summary/customers` takes no
// limit and no offset, so a Closing drill-down on every business unit returns
// the entire customer book in one payload. `BuildTable` windows the rows —
// along with the frozen first column, the sticky header and horizontal scroll
// at thirteen columns. It is handed no `columnGroups`, which is why that table
// now renders a single header row when there are no figure columns.
//
// ---- the export, on the shared builders ------------------------------------
//
// The export is an .xlsx from `misDrillDownSheet`, the same builders the
// Build uses. A bespoke CSV in this dialog would be a second export path,
// and a column of text cannot be summed against the figure it was opened
// from.

export interface MisCustomerDrillDownProps {
  open: boolean;
  onClose: () => void;
  /** The Build row that was opened. Decides the columns — see `drillDownColumns`. */
  rowId: string;
  /** That row's label, for the title. */
  rowLabel: string;
  /** The column's header, for the title. */
  periodColumn: string;
  /** The Build's Applied filters, shown but not editable. */
  chips: readonly MisFilterChip[];
  state: DrillDownState;
}

export default function MisCustomerDrillDown({
  open,
  onClose,
  rowId,
  rowLabel,
  periodColumn,
  chips,
  state,
}: MisCustomerDrillDownProps) {
  const columns = useMemo(() => drillDownColumns(rowId), [rowId]);
  const rows = useMemo(() => drillDownRows(state.customers), [state.customers]);
  // Zipped by POSITION rather than keyed by account id. `drillDownRows`
  // suffixes a repeated id so two customers cannot share a DOM id, which means
  // the row id is no longer always the account id — and looking the customer up
  // by it would hand the same one to both rows.
  const byRowId = useMemo(
    () => new Map(rows.map((row, index) => [row.id, state.customers[index]])),
    [rows, state.customers],
  );

  // The title is the row, a middle dot, the column. It is the
  // only thing tying the list back to the cell the reader clicked.
  const title = `${rowLabel} · ${periodColumn}`;

  // The filename, rule for rule: a fixed prefix, the row with its
  // punctuation stripped, the Period column with its hyphen KEPT so a range
  // survives as one, and the date. Pacific, not UTC — `misExportFilename`
  // says why.
  const filename = () =>
    misExportFilename([
      "customer_details",
      misFilenameWord(rowLabel),
      misFilenameRange(periodColumn),
    ]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700, pr: 6 }}>
        {title}
        <IconButton
          aria-label="Close"
          onClick={onClose}
          size="small"
          sx={{ position: "absolute", right: 12, top: 12, color: "text.secondary" }}
        >
          <XIcon size={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {/* Below the title rather than inside it: the dialog's accessible name
            should be the figure it is explaining, and a chip strip folded into
            the title reads out as part of that name.

            No onRemove, which is what makes the strip read-only. These are the
            Build's filters, and changing one from in here would leave the list
            describing a different figure from the one it was opened from. */}
        <MisAppliedFilterChips chips={chips} />
        {/* Only once there is a list to take away. A button over a spinner, an
            error or an empty result would export a workbook with nothing in
            it. */}
        {Boolean(state.customers.length) && !state.isLoading && !state.isError && (
          <Stack direction="row" sx={{ justifyContent: "flex-end", mb: 0.75 }}>
            <MisExportButton
              workbook={() => ({
                sheets: [
                  misDrillDownSheet({
                    rowId,
                    customers: state.customers,
                    filterLabels: chips.map((chip) => chip.label),
                  }),
                ],
              })}
              filename={filename}
            />
          </Stack>
        )}
        <DrillDownBody state={state} rows={rows} columns={columns} byRowId={byRowId} />
      </DialogContent>
    </Dialog>
  );
}

function DrillDownBody({
  state,
  rows,
  columns,
  byRowId,
}: {
  state: DrillDownState;
  rows: ReturnType<typeof drillDownRows>;
  columns: readonly DrillDownColumn[];
  byRowId: ReadonlyMap<string, Parameters<DrillDownColumn["value"]>[0] | undefined>;
}) {
  if (state.isLoading) {
    // A fixed height in every branch, so the dialog does not jump when the
    // answer lands.
    return (
      <Box sx={{ height: 420, display: "grid", placeItems: "center", gap: 1 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  // A failed drill-down must not render an empty grid. On a screen whose
  // purpose is to explain a figure, an empty list reads as "this number is
  // made of nobody".
  if (state.isError) {
    return (
      <ErrorNotice onRetry={state.retry} sx={{ my: 2 }}>
        Couldn&apos;t load the customers behind this figure. {state.errorMessage}
      </ErrorNotice>
    );
  }

  if (!rows.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
        No customers behind this figure.
      </Typography>
    );
  }

  return (
    <BuildTable
      label="Customers behind this figure"
      rowLabelHeader={columns[0].label}
      leadColumns={columns}
      leadCell={(row, column) => {
        const customer = byRowId.get(row.id);
        return customer ? column.value(customer) : "";
      }}
      columnGroups={[]}
      subColumns={[]}
      rows={rows}
      // No figures: every column of this table is identity. Required by the
      // component and never called.
      cell={() => ({ text: "" })}
      maxBodyHeight={420}
    />
  );
}
