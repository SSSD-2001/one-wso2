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

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FINANCE_GRID_SX } from "./financeGridSx";

/**
 * theme.ts:281-297 in the source app removes the grid's focus ring for cells,
 * column headers and rows. Ours took the MUI default, so clicking any cell in
 * a read-only grid outlined it as though something had been selected — and
 * nothing in these screens acts on a single cell.
 *
 * A rendered assertion was tried first and could not fail: jsdom does not
 * resolve an emotion-injected `:focus` rule through getComputedStyle, so the
 * test passed with the rule deleted. This checks the rule and its wiring
 * instead, which are the two things that can actually go wrong.
 */
describe("the finance grids do not ring the cell you clicked", () => {
  it("suppresses the pointer focus outline", () => {
    expect(FINANCE_GRID_SX["& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within"]).toEqual(
      { outline: "none" },
    );
  });

  it("keeps the keyboard ring, so arrow-key navigation can still be followed", () => {
    expect(FINANCE_GRID_SX["& .MuiDataGrid-cell:focus-visible"]).toEqual({ outline: "auto 1px" });
  });

  it("keeps it on column headers too, which are keyboard-reachable", () => {
    // Removing every header ring left sorting and the column menu invisible to
    // anyone navigating by keyboard.
    expect(FINANCE_GRID_SX["& .MuiDataGrid-columnHeader:focus-visible"]).toEqual({
      outline: "auto 1px",
    });
  });

  it("is what every card grid actually passes to sx", () => {
    // The constant is worthless if a grid styles itself instead. These are the
    // DataGrids in the feature.
    const files = [
      "cc/CcTxnTable.tsx",
      "cc/pages/CcHistoryPage.tsx",
      // The statement grid, which Bank Statement Upload renders for each of
      // its three tabs. It lives beside the page rather than inside it — the
      // page is the header, the tabs and the upload dialog now.
      "cc/CcStatementGrid.tsx",
      "cc/pages/CcNewTransactionsPage.tsx",
      "cc/pages/CcPendingPage.tsx",
      "cc/pages/CcApproveBody.tsx",
    ];
    for (const f of files) {
      const src = readFileSync(join(__dirname, "..", f), "utf8");
      expect(src, f).toContain("sx={FINANCE_GRID_SX}");
      expect(src, f).not.toContain('sx={{ "& .MuiDataGrid-cell"');
    }
  });
});
