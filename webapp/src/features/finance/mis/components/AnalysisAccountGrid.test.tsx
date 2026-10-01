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

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataGrid } from "@wso2/oxygen-ui";
import AnalysisAccountGrid, { analysisAccountColumns } from "./AnalysisAccountGrid";
import { analysisAccountRows, type AnalysisAccountsResponse } from "./analysisAccountRows";
import { MIS_SCALES, type MisScale } from "../util/misViewVocabulary";

// Vitest's 5s default is the wrong one for this file. Every test here mounts a
// real MUI component that is expensive in jsdom — the DataGrid's first mount,
// or an Autocomplete opening its listbox — and under the full suite's
// parallelism those legitimately run past five seconds while taking about two
// on their own. Nothing here waits on a timer or a network, so a timeout is
// always machine load rather than a hang, and a test that fails by luck is
// worse than a slow one. Several of this repo's other grid-heavy suites sit in
// the same place and fail intermittently; this one says so instead.
vi.setConfig({ testTimeout: 20_000 });

// The account table, and the one thing about it that is worth more than every
// other assertion here: **what its CSV actually contains.**
//
// The Excel workbook has no Scale parameter, so an unscaled export is
// structural there. The DataGrid's CSV has no such layer — it is the component's own,
// and it takes each cell's `formattedValue`, which is `valueFormatter`'s output
// when a column has one. So a money column that formatted through
// `valueFormatter` would export the READER'S SCALE: a file 1000x off, with
// nothing in it saying so, on the screen whose whole output is a spreadsheet.
//
// These columns format in `renderCell` and pin `valueFormatter` to the identity,
// so the cell's value reaches the CSV untouched. Pinning rather than omitting,
// because a column typed `number` is fitted with `toLocaleString` whether or
// not anyone asked — so "no formatter" is not a state this column can be in.
//
// None of that is enforced structurally, so it is asserted HERE, on the bytes
// the exporter writes, the same way the workbook test reads the file back.

const account = (over: Partial<AnalysisAccountsResponse> = {}): AnalysisAccountsResponse => ({
  id: "001",
  name: "Northwind",
  productsInUse: "IAM,Choreo",
  partnerType: "Direct",
  salesRegions: "EMEA",
  subRegion: "UK & Ireland",
  billingCountry: "United Kingdom",
  customerLifetime: "3",
  apimBuTotal: 1_234_567.89,
  iamBuTotal: 0,
  integrationBuTotal: 0,
  choreoBuTotal: 0,
  agentPlatformBuTotal: 0,
  moesifBuTotal: 0,
  arrGrandTotal: 1_234_567.89,
  ...over,
});

/**
 * Renders the grid and hands back its CSV, through the grid's own exporter —
 * the same call its toolbar button makes.
 */
function showGrid(accounts: AnalysisAccountsResponse[], scale: MisScale = MIS_SCALES.UNITS) {
  const api: React.RefObject<DataGrid.GridApi | null> = { current: null };
  const view = render(
    <AnalysisAccountGrid
      rows={analysisAccountRows(accounts)}
      scale={scale}
      isLoading={false}
      apiRef={api}
    />,
  );
  return { ...view, csv: () => api.current?.getDataAsCsv() ?? "" };
}

describe("the account table", () => {
  // One query over the whole header row rather than eleven by name: it reads
  // the accessibility tree once instead of eleven times, which on a grid this
  // wide is the difference between a fast test and a marginal one — and it
  // asserts the ORDER and the completeness too, which eleven `getByRole`s do
  // not. `LeaveReportsPage.test.tsx:159` does the same.
  it("shows an account under the column headings, in order", () => {
    showGrid([account()]);
    expect(screen.getByText("Northwind")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Account Name",
      "Products in Use",
      "Country",
      "Lifetime",
      "APIM BU",
      "IAM BU",
      "Integration BU",
      "Choreo BU",
      "Agent Platform BU",
      "Moesif",
      "Total ARR",
    ]);
  });

  it("writes a figure at the reader's Scale", () => {
    showGrid([account()], MIS_SCALES.THOUSANDS);
    // 1,234,567.89 at thousands, to no decimals.
    expect(screen.getAllByText("1,235").length).toBeGreaterThan(0);
  });

  it("names each product the account runs", () => {
    showGrid([account({ productsInUse: "IAM,Choreo" })]);
    expect(screen.getByText("IAM")).toBeInTheDocument();
    expect(screen.getByText("Choreo")).toBeInTheDocument();
  });

  it("finds a row by the scaled amount on screen, and still by the raw figure", () => {
    const column = analysisAccountColumns(MIS_SCALES.THOUSANDS).find((item) => item.field === "apimBu");
    expect(column?.getApplyQuickFilterFn).toBeTypeOf("function");
    const match = column!.getApplyQuickFilterFn!("1,235", column as never, { current: null } as never);
    const raw = column!.getApplyQuickFilterFn!("1234567.89", column as never, { current: null } as never);
    const miss = column!.getApplyQuickFilterFn!("999", column as never, { current: null } as never);
    const value = 1_234_567.89;
    expect(match!(value, {} as never, column as never, { current: null } as never)).toBe(true);
    expect(raw!(value, {} as never, column as never, { current: null } as never)).toBe(true);
    expect(miss!(value, {} as never, column as never, { current: null } as never)).toBe(false);
  });

  it("writes a lifetime in years", () => {
    showGrid([account({ customerLifetime: "1" })]);
    expect(screen.getByText("1 yr")).toBeInTheDocument();
  });
});

// The CSV carries the raw figure, not the scaled amount on screen.
describe("the CSV", () => {
  it("carries the figure in units when the screen is reading thousands", () => {
    const { csv } = showGrid([account()], MIS_SCALES.THOUSANDS);
    expect(csv()).toContain("1234567.89");
    // And emphatically NOT the display value, which is what formatting the
    // column through `valueFormatter` would have put here.
    expect(csv()).not.toContain("1,235");
  });

  // A CSV has no number formats. The `number` column type fits `toLocaleString`
  // by default (gridNumericColDef.js:12), which writes `"1,234,567.89"` — a
  // number only where the thousands separator is a comma. The export writes a
  // dot decimal with no grouping instead. That is the file format, not a
  // promise that every Excel locale will parse the dot as a decimal.
  it("writes a dot decimal with no thousands separator", () => {
    const { csv } = showGrid([account()]);
    expect(csv()).toContain("1234567.89");
    expect(csv()).not.toContain("1,234,567.89");
  });

  it("carries the same figure whichever Scale the reader was on", () => {
    const units = showGrid([account()], MIS_SCALES.UNITS).csv();
    const thousands = showGrid([account()], MIS_SCALES.THOUSANDS).csv();
    expect(thousands).toBe(units);
  });

  it("carries the products as their names rather than as a rendered object", () => {
    const { csv } = showGrid([account({ productsInUse: "IAM,Choreo" })]);
    expect(csv()).toContain("IAM,Choreo");
  });

  it("heads its columns the way the screen does", () => {
    const { csv } = showGrid([account()]);
    expect(csv().split("\n")[0]).toContain("Account Name");
  });
});

// The community tier's limits, which ARE the design constraints here rather
// than obstacles to work around. `pageSize` above 100 THROWS
// (gridPaginationUtils.js:25), so a page size is not a number to pick
// casually — and the grid renders nothing at all if it does throw.
describe("the community tier's limits", () => {
  it("offers no page size the community grid would throw on", () => {
    const { container } = showGrid([account()]);
    expect(container.querySelector(".MuiDataGrid-root")).not.toBeNull();
  });

  it("renders a hundred accounts without throwing at its largest page size", () => {
    const many = Array.from({ length: 100 }, (_, i) => account({ id: `acct-${i}` }));
    expect(() => showGrid(many)).not.toThrow();
  });
});
