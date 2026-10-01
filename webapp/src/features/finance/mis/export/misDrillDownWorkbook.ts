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

// The customers behind one figure, as a sheet.
//
// The dialog is a consumer of the same builders as the Build. A bespoke CSV
// here would be a second export path.
//
// It is a `misBuildSheet` with no Periods in it — the same degenerate case the
// dialog already renders `BuildTable` in, hitting the same code rather than a
// branch beside it.

import {
  drillDownColumns,
  drillDownRows,
  type DrillDownColumn,
  type DrillDownCustomer,
} from "../components/drillDownColumns";
import { MIS_VALUE_TYPES } from "../util/misMoney";
import { misBuildSheet } from "./misBuildWorkbook";
import type { MisWorkbookSheet } from "./misWorkbook";

export interface MisDrillDownSheetInput {
  /** The Build row that was opened. Decides the columns, as in the dialog. */
  rowId: string;
  customers: readonly DrillDownCustomer[];
  /** The Applied filter labels the list was computed under. */
  filterLabels?: readonly string[];
}

/** A dialog column, plus what the sheet needs to know about its kind. */
type DrillDownSheetColumn = DrillDownColumn & { valueType?: typeof MIS_VALUE_TYPES.CURRENCY };

export function misDrillDownSheet({
  rowId,
  customers,
  filterLabels = [],
}: MisDrillDownSheetInput): MisWorkbookSheet {
  const rows = drillDownRows(customers);
  // Zipped by POSITION, exactly as the dialog does and for its reason:
  // `drillDownRows` suffixes a repeated account id, so a row id is not always
  // an account id and keying by it would hand the same customer to both rows.
  const byRowId = new Map(rows.map((row, index) => [row.id, customers[index]]));
  // The dialog's own columns, with their readers carried through. `leadCell`
  // below is handed the column itself rather than its key, so it can just ask
  // the column to read a customer — instead of looking one up by key on every
  // row, which is the scan `BuildTable`'s own `leadCell` exists to avoid.
  const columns: readonly DrillDownSheetColumn[] = drillDownColumns(rowId).map((column) => ({
    ...column,
    // Money where the column says it reads a figure, text everywhere else.
    valueType: column.rawValue ? MIS_VALUE_TYPES.CURRENCY : undefined,
  }));

  const sheet = misBuildSheet<DrillDownSheetColumn>({
    name: "Customers",
    leadColumns: columns,
    leadCell: (row, column) => {
      const customer = byRowId.get(row.id);
      if (!customer) return null;
      // The money column gives its figure; every other column gives the words
      // the dialog shows, "N/A" and the four deliberately-blank ones included.
      //
      // A missing amount is the one place the sheet reads differently from the
      // dialog, which puts "N/A" there: an empty cell is right in a column of
      // figures, where the words would be text sitting in the middle of a sum.
      return column.rawValue ? column.rawValue(customer) : column.value(customer);
    },
    // A flat list of customers. Every column is identity and there is nothing
    // to put under a Period, which is what the dialog hands `BuildTable` too.
    columnGroups: [],
    subColumns: [],
    rows,
    value: () => null,
  });

  if (filterLabels.length === 0) return sheet;
  // Under the units caption, before the blank row and the headers. The
  // filename only carries the row and the Period, so without this line a
  // filtered list and a whole-book list of the same cell look identical.
  return {
    ...sheet,
    rows: [sheet.rows[0], { cells: [{ value: filterLabels.join(" · ") }] }, ...sheet.rows.slice(1)],
  };
}
