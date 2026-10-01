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

import { describe, expect, it } from "vitest";
import type { BuildRow } from "../components/buildTableModel";
import { MIS_ROW_LABELS } from "../util/misMoney";
import { MIS_NUMBER_FORMATS } from "./misWorkbook";
import { misBuildSheet, type MisBuildSheetInput } from "./misBuildWorkbook";

// A Subscription Build, cut down to the three rows that differ in KIND —
// money, a headcount and a ratio — because the one rule this has to get right
// is that only currency is scaled, and those three are the only three answers it has.
const ROWS: readonly BuildRow[] = [
  {
    id: "arr-movement",
    label: "ARR movement",
    children: [
      { id: "opening-arr", label: MIS_ROW_LABELS.OPENING_ARR, emphasis: true },
      { id: "new-arr", label: MIS_ROW_LABELS.NEW },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    children: [{ id: "opening-customers", label: MIS_ROW_LABELS.OPENING_CUSTOMERS }],
  },
  {
    id: "retention",
    label: "Retention",
    children: [{ id: "ndr", label: MIS_ROW_LABELS.NET_DOLLAR_RETENTION }],
  },
];

const FIGURES: Record<string, Record<string, number>> = {
  "opening-arr": { "2024": 1_234_567.5, "2025": 2_000_000 },
  "new-arr": { "2024": 90_000, "2025": 120_000 },
  "opening-customers": { "2024": 412, "2025": 455 },
  ndr: { "2024": 98.25, "2025": 101.4 },
};

const INPUT: MisBuildSheetInput = {
  name: "Subscription",
  rowLabelHeader: "Summary",
  columnGroups: [
    { key: "2024", label: "2024" },
    { key: "2025", label: "2025" },
  ],
  subColumns: [{ key: "amount", label: "ARR", width: 170 }],
  rows: ROWS,
  value: (row, group) => FIGURES[row.id]?.[group.key],
};

/** The cell at a 1-based row and column, as the sheet describes it. */
const at = (sheet: ReturnType<typeof misBuildSheet>, row: number, column: number) =>
  sheet.rows[row - 1].cells[column - 1];

describe("a Build, as a sheet", () => {
  it("says what its figures are in, before any of them", () => {
    // Taken BOTH ways: the figures below are unscaled AND
    // the file says so. The caption is `amountUnitCaption`'s own words rather
    // than a retyped copy — the screen's caption and the sheet's must not be
    // able to drift, because between them they are the only two places a
    // reader is ever told.
    expect(at(misBuildSheet(INPUT), 1, 1).value).toBe("All amounts in USD");
  });

  it("puts the Periods over their sub-columns, and the identity columns beside", () => {
    const sheet = misBuildSheet(INPUT);
    // Two header rows, the same two the hand-rolled table draws.
    expect(sheet.rows[2].cells.map((cell) => cell.value)).toEqual([null, "2024", "2025"]);
    expect(sheet.rows[3].cells.map((cell) => cell.value)).toEqual(["Summary", "ARR", "ARR"]);
  });

  it("writes a figure as a NUMBER, at units, whatever the screen is showing", () => {
    // The foot-gun this test exists for: writing `formatNumber(value)` — a
    // STRING — into every figure cell means a column of them cannot be summed.
    //
    // `misBuildSheet` takes no Scale at all. That is the enforcement: there is
    // no parameter a caller could pass the reader's thousands setting through,
    // so an export cannot be 1000x off however it is called.
    const sheet = misBuildSheet(INPUT);
    const openingArr = at(sheet, 6, 2);
    expect(openingArr.value).toBe(1_234_567.5);
    expect(openingArr.numFmt).toBe(MIS_NUMBER_FORMATS.CURRENCY);
  });

  it("formats a headcount and a ratio by what the row IS, not by what it looks like", () => {
    // On the sheet as on the screen: Scale never scales counts, and
    // the number format is how a spreadsheet says the same thing. Read through
    // `misValueTypeForRow`, so the sheet and the screen cannot disagree.
    const sheet = misBuildSheet(INPUT);
    expect(at(sheet, 9, 2).value).toBe(412);
    expect(at(sheet, 9, 2).numFmt).toBe(MIS_NUMBER_FORMATS.COUNT);
    expect(at(sheet, 11, 2).numFmt).toBe(MIS_NUMBER_FORMATS.PERCENTAGE);
  });

  it("writes a percentage as the fraction Excel's percent format shows as one", () => {
    // The ARR backend sends 98.25 to mean 98.25%, and Excel's "0.00%" shows a
    // cell holding 0.9825 as "98.25%". So the figure is divided on the way in,
    // here and nowhere else — and ONLY a percentage is: the Opening ARR in the
    // same column is not.
    const sheet = misBuildSheet(INPUT);
    expect(at(sheet, 11, 2).value).toBe(0.9825);
    expect(at(sheet, 11, 3).value).toBe(1.014);
    expect(at(sheet, 6, 2).value).toBe(1_234_567.5);
  });

  it("indents the tree and hands Excel its own outline to fold", () => {
    const sheet = misBuildSheet(INPUT);
    expect(at(sheet, 5, 1).value).toBe("ARR movement");
    expect(sheet.rows[4].outlineLevel).toBe(0);
    expect(sheet.rows[4].bold).toBe(true);
    // Two spaces per level, and an outline level, so
    // a reader can collapse a section in Excel the way they collapse it on
    // screen. Every row is written whatever is open on screen: a spreadsheet
    // that silently omitted the sections the reader had closed would be a
    // different Build from the one they exported.
    expect(at(sheet, 6, 1).value).toBe("  Opening ARR");
    expect(sheet.rows[5].outlineLevel).toBe(1);
  });

  it("leaves a cell the backend had nothing for empty, rather than writing a zero", () => {
    const sheet = misBuildSheet({ ...INPUT, value: () => undefined });
    expect(at(sheet, 6, 2).value).toBeNull();
  });

  it("writes a numeric string as a number, and a percentage string as the fraction", () => {
    const sheet = misBuildSheet({
      ...INPUT,
      value: (row, group) => {
        if (row.id === "opening-arr" && group.key === "2024") return "1234567.5";
        if (row.id === "ndr" && group.key === "2024") return "98.25";
        return FIGURES[row.id]?.[group.key];
      },
    });
    expect(at(sheet, 6, 2).value).toBe(1_234_567.5);
    expect(at(sheet, 6, 2).numFmt).toBe(MIS_NUMBER_FORMATS.CURRENCY);
    expect(at(sheet, 11, 2).value).toBe(0.9825);
    expect(at(sheet, 11, 2).numFmt).toBe(MIS_NUMBER_FORMATS.PERCENTAGE);
  });

  it("passes through the words the backend answers where it cannot compute", () => {
    // "N/A" and "%" are already the display value. They are text, so
    // they carry no number format.
    const sheet = misBuildSheet({ ...INPUT, value: () => "N/A" });
    expect(at(sheet, 6, 2).value).toBe("N/A");
    expect(at(sheet, 6, 2).numFmt).toBeUndefined();
  });
});
