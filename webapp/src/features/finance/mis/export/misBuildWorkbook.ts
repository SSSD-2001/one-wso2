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

// A Build table, described as a sheet.
//
// An export path is required scope rather than a caveat: a
// hand-rolled `<table>` gets none of the select-and-paste a data grid gives
// free, and that paste IS Finance's existing workflow.
//
// ---- the one thing this must not do ----------------------------------------
//
// `BuildTable`'s cells are already formatted — `BuildCell.text` is what
// `formatMisValue` returned, so at Scale "Values in '000" it is a figure
// already divided by a thousand, written as a string with separators in it.
// An export that walked the table would inherit both, and the rule against
// exactly that is: "a finance export that is silently 1000x wrong is
// worse than no export at all, because it is believed."
//
// Both halves are real. Writing `formatNumber(value)` — a STRING — into every
// figure cell means a column of them cannot be summed.
//
// So this builder reads the RAW figures and never the table's text, and it
// takes no Scale parameter at all. There is no argument a caller could pass the
// reader's thousands setting through, which makes the rule structural rather
// than documentary — the same shape `formatMisValue` uses for the same rule.
//
// A percentage is the one figure that changes on the way in, below.

import type { BuildColumnGroup, BuildRow } from "../components/buildTableModel";
import {
  MIS_VALUE_TYPES,
  amountUnitCaption,
  misValueTypeForRow,
  type MisValueType,
} from "../util/misMoney";
import { MIS_SCALES } from "../util/misViewVocabulary";
import {
  MIS_NUMBER_FORMATS,
  misSheetName,
  type MisWorkbookCell,
  type MisWorkbookRow,
  type MisWorkbookSheet,
} from "./misWorkbook";

/** A raw figure, as the ARR backend sent it — never the screen's text. */
export type MisRawValue = number | string | null | undefined;

/**
 * One Build table, in the terms `BuildTable` already takes.
 *
 * Named after that component's props deliberately: a page hands the SAME
 * `rows`, `columnGroups` and `subColumns` variables to both, so the sheet and
 * the screen cannot disagree about which rows or which Periods are in the
 * export. The one thing that differs is `value`, and it differs because it has
 * to — see the note at the top of this file.
 */
export interface MisBuildSheetInput<L extends MisLeadColumn = MisLeadColumn> {
  /** The table's name. Made safe for a sheet tab here, not by the caller. */
  name: string;
  /**
   * Header over the row-label column. Only read when there are no
   * `leadColumns` — with them, the first column's own label is the header.
   */
  rowLabelHeader?: string;
  /** Identity columns, left of the figures. The first is the row label. */
  leadColumns?: readonly L[];
  /**
   * The value in an identity column after the first.
   *
   * Handed the caller's OWN column object, not a key — `BuildTable`'s
   * `leadCell` is generic for exactly this reason, and says why: a column that
   * knows how to read itself can just be asked, "instead of looking the column
   * up again by key on every cell of a table built for thousands of rows". The
   * customers table has seventeen identity columns and the export walks every
   * row, so a lookup here would be the very scan that note rules out.
   */
  leadCell?: (row: BuildRow, column: L) => MisRawValue;
  /** One per Period, in display order. Empty for a table with no figures. */
  columnGroups: readonly BuildColumnGroup[];
  /** Repeated under every Period. */
  subColumns: readonly { key: string; label: string; width: number }[];
  rows: readonly BuildRow[];
  /** The RAW figure behind one cell. */
  value: (row: BuildRow, group: BuildColumnGroup, subColumnKey: string) => MisRawValue;
  /**
   * What kind of number a row holds, and therefore which number format it gets.
   *
   * Defaults to `misValueTypeForRow`, which is what the Subscription Build
   * needs: its rows are the named metric lines that mix money, headcounts and
   * ratios in one column, and that function is where the Scale rule lives.
   *
   * The other three tables pass their own, because they KNOW: every figure on
   * the Customers table and on both summaries is currency, and each of them
   * says so on screen by handing `formatMisValue` a literal `"currency"`.
   * Inferring it here instead would let the sheet and the screen disagree about
   * an account or a region whose name happened to collide with a metric label.
   */
  valueType?: (row: BuildRow) => MisValueType;
  rowLabelWidth?: number;
}

export interface MisLeadColumn {
  key: string;
  label: string;
  width: number;
  /**
   * A FIGURE in an identity column rather than text — the customer drill-down's
   * Amount, which is the one column of a flat table that holds money.
   *
   * Absent, the column is text and goes into the sheet as the words the screen
   * shows, "N/A" and blanks included.
   */
  valueType?: MisValueType;
}

/** `BuildTable`'s own default, so an export is as wide as what it exported. */
const ROW_LABEL_WIDTH = 260;

/**
 * A column width in px, as the character-ish unit Excel measures in.
 *
 * Roughly one digit of the default font per 7px. It matters rather than being
 * cosmetic: a numeric column too narrow for its figure shows `#####` instead of
 * the number, which is the one rendering failure a finance reader cannot work
 * around from inside the file.
 */
const excelWidth = (px: number): number => Math.max(10, Math.round(px / 7));

/** Every row of the tree, outermost first, with how deep it sits. */
function allRows(rows: readonly BuildRow[]): { row: BuildRow; depth: number }[] {
  const out: { row: BuildRow; depth: number }[] = [];
  const walk = (list: readonly BuildRow[], depth: number): void => {
    for (const row of list) {
      out.push({ row, depth });
      walk(row.children ?? [], depth + 1);
    }
  };
  walk(rows, 0);
  return out;
}

const NUMBER_FORMAT_BY_VALUE_TYPE: Readonly<Record<MisValueType, string>> = {
  [MIS_VALUE_TYPES.CURRENCY]: MIS_NUMBER_FORMATS.CURRENCY,
  [MIS_VALUE_TYPES.COUNT]: MIS_NUMBER_FORMATS.COUNT,
  [MIS_VALUE_TYPES.PERCENTAGE]: MIS_NUMBER_FORMATS.PERCENTAGE,
};

/**
 * One figure, as a cell.
 *
 * The three cases are `formatMisValue`'s three, answered for a spreadsheet
 * instead of for a screen. A number keeps being a number and gets a format. A
 * string that parses as a finite number is that number — a Ballerina decimal
 * can arrive as text — and only a string that does not ("N/A", "%") stays
 * text. Anything else leaves the cell empty, because a zero written where
 * there was no figure reads as a figure.
 *
 * A percentage is the one figure that changes on the way in: the ARR backend
 * sends per cent (98.25 for 98.25%), and Excel's percent format shows the
 * FRACTION, so it is written divided by a hundred. The only such division
 * here, as `formatMisValue`'s is the only division by a thousand — and like
 * that one, it is keyed on the kind of number rather than left to a caller.
 */
function figureCell(raw: MisRawValue, valueType: MisValueType): MisWorkbookCell {
  if (typeof raw === "string") {
    const parsed = raw.trim() === "" ? Number.NaN : Number(raw);
    if (!Number.isFinite(parsed)) return { value: raw };
    raw = parsed;
  }
  if (typeof raw !== "number" || !Number.isFinite(raw)) return { value: null };
  const value = valueType === MIS_VALUE_TYPES.PERCENTAGE ? raw / 100 : raw;
  return { value, numFmt: NUMBER_FORMAT_BY_VALUE_TYPE[valueType] };
}

export function misBuildSheet<L extends MisLeadColumn = MisLeadColumn>(
  input: MisBuildSheetInput<L>,
): MisWorkbookSheet {
  const {
    name,
    rowLabelHeader = "",
    leadColumns,
    leadCell,
    columnGroups,
    subColumns,
    rows,
    value,
    valueType = (row) => misValueTypeForRow(row.label),
    rowLabelWidth = ROW_LABEL_WIDTH,
  } = input;

  // One identity column unless the caller named more — `BuildTable`'s own
  // degenerate case, resolved the same way here so the Subscription Build is
  // the same code path as the eighteen-column customers table.
  const lead: readonly MisLeadColumn[] = leadColumns?.length
    ? leadColumns
    : [{ key: "__label", label: rowLabelHeader, width: rowLabelWidth }];

  const blanks = (count: number): MisWorkbookCell[] =>
    Array.from({ length: count }, () => ({ value: null }));

  /** An identity value: a figure when the column says so, text otherwise. */
  const leadCellSpec = (row: BuildRow, column: L): MisWorkbookCell => {
    const raw = leadCell?.(row, column);
    return column.valueType ? figureCell(raw, column.valueType) : { value: raw ?? null };
  };

  /** The Period over the first of its sub-columns; the rest of the span blank. */
  const groupHeader: MisWorkbookRow = {
    bold: true,
    cells: [
      ...blanks(lead.length),
      ...columnGroups.flatMap((group) => [
        { value: group.label } as MisWorkbookCell,
        ...blanks(subColumns.length - 1),
      ]),
    ],
  };

  const subHeader: MisWorkbookRow = {
    bold: true,
    cells: [
      ...lead.map((column) => ({ value: column.label }) as MisWorkbookCell),
      ...columnGroups.flatMap(() =>
        subColumns.map((sub) => ({ value: sub.label }) as MisWorkbookCell),
      ),
    ],
  };

  const body: MisWorkbookRow[] = allRows(rows).map(({ row, depth }) => {
    const rowValueType = valueType(row);
    return {
      // A balance line on screen is a balance line in the file, and so is a
      // section: the two things a reader's eye uses to find its way down a
      // Build.
      bold: Boolean(row.emphasis) || (row.children?.length ?? 0) > 0,
      outlineLevel: depth,
      cells: [
        // Two spaces a level. Text, not an Excel indent, so it survives
        // a copy-paste out of the sheet, which is how these figures travel.
        { value: `${"  ".repeat(depth)}${row.label}` },
        ...(leadColumns?.length
          ? leadColumns.slice(1).map((column) => leadCellSpec(row, column))
          : []),
        ...columnGroups.flatMap((group) =>
          subColumns.map((sub) => figureCell(value(row, group, sub.key), rowValueType)),
        ),
      ],
    };
  });

  return {
    name: misSheetName(name),
    columns: [
      ...lead.map((column) => ({ width: excelWidth(column.width) })),
      ...columnGroups.flatMap(() => subColumns.map((sub) => ({ width: excelWidth(sub.width) }))),
    ],
    rows: [
      // Answered both ways at once: the figures below are at
      // units, and this says so. `amountUnitCaption` rather than a retyped
      // string, so the sheet cannot drift from the caption above the grid —
      // between them they are the only two places a reader is ever told.
      { cells: [{ value: amountUnitCaption(MIS_SCALES.UNITS) }] },
      { cells: [] },
      // No Periods means no Period row — the customer drill-down, which is a
      // flat table of identity columns and nothing else. `BuildTable` draws one
      // header row there for the same reason; a blank row where the Period row
      // would have been reads as a header that failed to fill in.
      ...(columnGroups.length ? [groupHeader] : []),
      subHeader,
      ...body,
    ],
  };
}
