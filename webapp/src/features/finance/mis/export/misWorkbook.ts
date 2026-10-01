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

// A workbook, described as data, and the one place that turns such a
// description into bytes.
//
// ---- why a spec, rather than a function that builds a workbook -------------
//
// A function that opens ExcelJS, walks the grid and writes cells in the same
// breath cannot be tested: asserting on the workbook means running ExcelJS,
// and running ExcelJS means having a real grid to walk. So its formatting has
// never been checked by anything but a reader opening the file.
//
// Splitting it in two fixes that. A `MisWorkbookSpec` is plain data — which
// sheets, which rows, which number formats — so the builders that produce one
// are pure functions over the figures a screen already has, and a test can read
// their output directly. `writeMisWorkbook` is the only code that knows ExcelJS
// exists, it is the same nine lines whatever is being exported, and a test
// pins it by loading its bytes back.

import { saveBlob } from "@utils/saveFile";

/**
 * What one cell holds.
 *
 * A number stays a NUMBER. That is the whole discipline of this module: the
 * screen's figures have been through `formatMisValue` and are strings like
 * "1,234,567.50", and writing those would hand Finance a spreadsheet it cannot
 * sum. Presentation belongs to `numFmt`, which Excel applies to a live number.
 *
 * A string is for text that is genuinely text — a row label, a region name, and
 * the `"N/A"` and `"%"` the ARR backend answers in cells it cannot compute.
 * `null` leaves the cell empty rather than writing a zero that would be read as
 * a figure.
 */
export type MisCellValue = number | string | null;

/** Excel number formats, one per kind of figure MIS reports. */
export const MIS_NUMBER_FORMATS = {
  /**
   * Two decimals and a thousands separator — `formatMisValue`'s currency
   * branch, expressed as a format rather than as text. No currency symbol:
   * every figure in MIS is USD and the sheet says so once, in its caption.
   */
  CURRENCY: "#,##0.00",
  /** A headcount. No decimals, because a third of a customer is not a thing. */
  COUNT: "#,##0",
  /**
   * A percentage, in Excel's own percent format — which multiplies by 100 on
   * display, so the cell holds the FRACTION: the ARR backend's 98.25 means
   * 98.25% and goes in as 0.9825 (`misBuildSheet`'s `figureCell` divides, and
   * nothing else does). The reader sees "98.25%", and a formula that multiplies
   * by the cell gets the right answer.
   *
   * A bare "98.25" under money's format would look like money. A percentage
   * sitting in a column of money under money's format is a figure a reader
   * has to be told the kind of. The screen can lean on its row label; a cell
   * pasted out of the file cannot.
   */
  PERCENTAGE: "0.00%",
} as const;

export interface MisWorkbookCell {
  value: MisCellValue;
  /** One of `MIS_NUMBER_FORMATS`. Omitted for text. */
  numFmt?: string;
}

export interface MisWorkbookRow {
  cells: readonly MisWorkbookCell[];
  /** A section title, a header, a balance line. */
  bold?: boolean;
  /**
   * Depth in the tree the row came from, as Excel's own outline level — so a
   * reader folds a section in the spreadsheet the way they fold it on screen.
   *
   * Whatever the tree says, because a per-customer Build nests deeper than one.
   */
  outlineLevel?: number;
}

export interface MisWorkbookSheet {
  /** Already made safe for Excel — see `misSheetName`. */
  name: string;
  columns: readonly { width: number }[];
  rows: readonly MisWorkbookRow[];
}

/** One workbook, as data. No ExcelJS, no DOM, nothing to mock. */
export interface MisWorkbookSpec {
  sheets: readonly MisWorkbookSheet[];
}

/**
 * The spec, as the bytes of an .xlsx file.
 *
 * ExcelJS is imported here and nowhere else in Finance MIS, and dynamically:
 * it is a large dependency that only an export needs, which is the pattern
 * `events/rules/workbook.ts` and `BulkImportPanel.tsx` already set.
 */
export async function writeMisWorkbook(spec: MisWorkbookSpec): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();

  for (const sheet of spec.sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    worksheet.columns = sheet.columns.map(({ width }) => ({ width }));

    for (const row of sheet.rows) {
      const added = worksheet.addRow(row.cells.map((cell) => cell.value));
      // Composed rather than assigned: `font` is one object in ExcelJS, so a
      // bare `= { bold: true }` would drop any other font setting a later field
      // wanted beside it.
      if (row.bold) added.font = { ...added.font, bold: true };
      if (row.outlineLevel) added.outlineLevel = row.outlineLevel;
      row.cells.forEach((cell, index) => {
        // 1-based: ExcelJS counts columns from 1, as Excel does.
        if (cell.numFmt) added.getCell(index + 1).numFmt = cell.numFmt;
      });
    }
  }

  return workbook.xlsx.writeBuffer();
}

/** What Excel refuses in a sheet name, and the most it will take. */
const FORBIDDEN_IN_SHEET_NAME = /[\\/?*[\]:]/g;
const MAX_SHEET_NAME = 31;

/**
 * A name made safe to put on a sheet tab.
 *
 * Excel's rules, not ours: at most 31 characters, and none of `\ / ? * [ ] :`.
 * A workbook that breaks either does not open at all, so this is not cosmetic —
 * and both are reachable from data rather than hypothetically. A TTM Period
 * column reads `"2025/01/01 - 2025/12/31"`, and the row labels and region names
 * a sheet gets titled after come from the live tenant.
 *
 * Forbidden characters become a hyphen rather than vanishing: a date whose
 * slashes are simply deleted reads as one eight-digit number, and the sheet tab
 * is the only place the reader is told which figure the list belongs to.
 */
export function misSheetName(desired: string): string {
  const safe = desired.replace(FORBIDDEN_IN_SHEET_NAME, "-").slice(0, MAX_SHEET_NAME).trim();
  return safe || "Sheet1";
}

/** What an .xlsx is, to a browser. */
export const MIS_WORKBOOK_MEDIA_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * The spec, in the reader's downloads.
 *
 * The edge, and deliberately the whole of it: everything above this line is
 * data and pure functions, which is what lets a test assert on a workbook
 * at all. There is nothing here to test beyond the two lines themselves, and
 * `saveBlob` carries its own hard-won note about Safari.
 */
export async function saveMisWorkbook(spec: MisWorkbookSpec, filename: string): Promise<void> {
  const bytes = await writeMisWorkbook(spec);
  saveBlob(new Blob([bytes], { type: MIS_WORKBOOK_MEDIA_TYPE }), filename);
}
