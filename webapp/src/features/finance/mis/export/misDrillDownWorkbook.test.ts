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
import type { DrillDownCustomer } from "../components/drillDownColumns";
import { MIS_NUMBER_FORMATS } from "./misWorkbook";
import { misDrillDownSheet } from "./misDrillDownWorkbook";

// The dialog is a consumer of these builders alongside the Build. A bespoke
// CSV in the dialog would be a second export path.

const CUSTOMERS: readonly DrillDownCustomer[] = [
  {
    accountId: "0013000001aBcDeAAA",
    name: "Contoso Ltd",
    salesRegion: "EMEA",
    subRegion: "UK & Ireland",
    amount: 145_200.75,
    accountOwner: "R. Fernando",
  },
  {
    accountId: "0013000001aBcDfAAA",
    name: "Fabrikam",
    salesRegion: "AMER",
    subRegion: "US East",
    amount: 98_000,
  },
];

const INPUT = { rowId: "opening-arr", customers: CUSTOMERS };

describe("the customers behind a figure, as a sheet", () => {
  it("has one header row, because a drill-down has no Periods", () => {
    // `BuildTable` renders a single header row here for the same reason — the
    // dialog hands it `columnGroups: []`. A blank row where the Period row
    // would have been reads as a missing header rather than as an absent one.
    const sheet = misDrillDownSheet(INPUT);
    expect(sheet.rows[2].cells.slice(0, 3).map((cell) => cell.value)).toEqual([
      "Account ID",
      "Account Name",
      "Amount (USD)",
    ]);
    expect(sheet.rows[3].cells[0].value).toBe("0013000001aBcDeAAA");
  });

  it("writes the amount as a number, not as the dialog's text", () => {
    // The dialog renders "145,200.75" — `drillDownColumns`' amount formatter,
    // hard-coded to units. The sheet needs the figure itself: a customer list
    // is exported to be summed against the Build figure it was opened from, and
    // a column of strings cannot be.
    const amount = misDrillDownSheet(INPUT).rows[3].cells[2];
    expect(amount.value).toBe(145_200.75);
    expect(amount.numFmt).toBe(MIS_NUMBER_FORMATS.CURRENCY);
  });

  it("keeps the words the dialog shows where a value is missing", () => {
    // "N/A" in the columns that guard a missing value, blank in the four that do not —
    // reproduced for parity rather than tidied. The sheet
    // shows the reader what the dialog showed them.
    const cells = misDrillDownSheet(INPUT).rows[4].cells;
    const labels = misDrillDownSheet(INPUT).rows[2].cells.map((cell) => cell.value);
    expect(cells[labels.indexOf("Account Owner")].value).toBe("N/A");
    expect(cells[labels.indexOf("Sales Region")].value).toBe("AMER");
  });

  it("records the filters the list was computed under, under the units caption", () => {
    const sheet = misDrillDownSheet({
      ...INPUT,
      filterLabels: ["Region: EMEA", "Business Unit: APIM"],
    });
    expect(sheet.rows[0].cells[0].value).toBe("All amounts in USD");
    expect(sheet.rows[1].cells[0].value).toBe("Region: EMEA · Business Unit: APIM");
    expect(sheet.rows[3].cells[0].value).toBe("Account ID");
  });

  it("takes its Lost columns from the row that was opened", () => {
    const labels = misDrillDownSheet({ rowId: "lost", customers: CUSTOMERS }).rows[2].cells.map(
      (cell) => cell.value,
    );
    expect(labels).toContain("Lost Reason Category");
    expect(misDrillDownSheet(INPUT).rows[2].cells.map((cell) => cell.value)).not.toContain(
      "Lost Reason Category",
    );
  });
});
