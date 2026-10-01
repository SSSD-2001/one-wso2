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
import ExcelJS from "exceljs";
import {
  MIS_NUMBER_FORMATS,
  misSheetName,
  writeMisWorkbook,
  type MisWorkbookSpec,
} from "./misWorkbook";

// The generated workbook loads back via `wb.xlsx.load` with the expected
// sheet names, cell values and number formats. Nothing else in this repo
// asserts workbook formatting; this test is the only guard.
//
// So the assertion is deliberately made on the FILE rather than on the spec
// that produced it. A spec is this module's own vocabulary and a test over it
// would agree with the builder by construction; the bytes are what Finance
// opens, and the round trip through exceljs is the only thing that can
// disagree.

/** Write a spec and read the bytes back as a workbook, the way Excel would. */
async function roundTrip(spec: MisWorkbookSpec): Promise<ExcelJS.Workbook> {
  const bytes = await writeMisWorkbook(spec);
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(bytes);
  return loaded;
}

describe("the workbook that is written", () => {
  it("comes back with its sheet names, cell values and number formats", async () => {
    const workbook = await roundTrip({
      sheets: [
        {
          name: "ARR Build",
          columns: [{ width: 34 }, { width: 18 }],
          rows: [
            {
              cells: [
                { value: "Opening ARR" },
                { value: 1_234_567.5, numFmt: MIS_NUMBER_FORMATS.CURRENCY },
              ],
            },
            {
              cells: [
                { value: "Opening Customers" },
                { value: 412, numFmt: MIS_NUMBER_FORMATS.COUNT },
              ],
            },
            {
              cells: [
                { value: "Net Dollar Retention" },
                // 98.25% as Excel holds a percentage — see the test below.
                { value: 0.9825, numFmt: MIS_NUMBER_FORMATS.PERCENTAGE },
              ],
            },
          ],
        },
      ],
    });

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["ARR Build"]);

    const sheet = workbook.getWorksheet("ARR Build");
    expect(sheet).toBeDefined();
    expect(sheet!.getCell("A1").value).toBe("Opening ARR");
    // A NUMBER, not the "1,234,567.50" the screen shows. The formatting is the
    // cell's, so the figure stays something the spreadsheet can compute on.
    expect(sheet!.getCell("B1").value).toBe(1_234_567.5);
    expect(sheet!.getCell("B1").numFmt).toBe(MIS_NUMBER_FORMATS.CURRENCY);
    expect(sheet!.getCell("B2").value).toBe(412);
    // The discriminating pair. A headcount has no decimals where money has two,
    // so this assertion can actually fail if the two ever got confused.
    expect(sheet!.getCell("B2").numFmt).toBe(MIS_NUMBER_FORMATS.COUNT);
    expect(sheet!.getCell("B2").numFmt).not.toBe(MIS_NUMBER_FORMATS.CURRENCY);
    expect(sheet!.getCell("B3").value).toBe(0.9825);
    expect(sheet!.getCell("B3").numFmt).toBe("0.00%");
  });

  it("writes a percentage in Excel's own percent format, which is not money's", () => {
    // A bare "98.25" under money's format looks like money. A percentage
    // sitting in a column of money is a figure the reader has to be told the
    // kind of.
    //
    // Excel's percent format multiplies by 100 on display, so the FIGURE is
    // what changes: `misBuildSheet` writes 98.25 as 0.9825, and the cell shows
    // "98.25%". That is the number Excel means by 98.25%, so a formula that
    // multiplies by it is right, where one over a 98.25 would be 100x out.
    expect(MIS_NUMBER_FORMATS.PERCENTAGE).toBe("0.00%");
    expect(MIS_NUMBER_FORMATS.PERCENTAGE).not.toBe(MIS_NUMBER_FORMATS.CURRENCY);
  });

  // Account and customer names arrive from the backend and are written as they
  // came, so a name that opens with = + - or @ is exactly what formula injection
  // needs. exceljs types a plain string as text whatever it starts with, which
  // is what keeps this safe — and it is a property of the library, not of this
  // code, so a version bump or a cell written some other way could lose it.
  it("writes text that looks like a formula as the text it is", async () => {
    const names = ["=SUM(A1:A10)", "+1", "-1", "@SUM(A1)"];
    const workbook = await roundTrip({
      sheets: [
        {
          name: "Customers",
          columns: [{ width: 34 }],
          rows: names.map((name) => ({ cells: [{ value: name }] })),
        },
      ],
    });

    const sheet = workbook.getWorksheet("Customers")!;
    names.forEach((name, index) => {
      const cell = sheet.getCell(index + 1, 1);
      expect(cell.type, name).toBe(ExcelJS.ValueType.String);
      expect(cell.value, name).toBe(name);
    });
  });
});

// Excel's own rules, not ours: a sheet name is at most 31 characters and may
// not contain \ / ? * [ ] : . A workbook that breaks either does not open —
// and both are reachable from real data rather than hypothetically. A TTM
// Period column reads "2025/01/01 - 2025/12/31", and the region and business
// unit names a sheet can be titled after arrive from the live tenant.
describe("a sheet name", () => {
  it("keeps one Excel already accepts", () => {
    expect(misSheetName("Subscription")).toBe("Subscription");
  });

  it("replaces the characters Excel refuses", () => {
    // The slashes are a date's, so a hyphen keeps it readable rather than
    // blanking it: "2025-01-01 - 2025-12-31" is still the range it names.
    expect(misSheetName("2025/01/01 - 2025/12/31")).toBe("2025-01-01 - 2025-12-31");
    expect(misSheetName("Lost [APAC]: why?")).toBe("Lost -APAC-- why-");
  });

  it("cuts one that is too long to the 31 characters Excel allows", () => {
    // MIS_ROW_LABELS.TRANSFERRED_IN_CUSTOMERS, chosen over the other long
    // labels because its 32nd character is a letter rather than a space. That
    // is what makes this test able to fail: with a label that breaks on a
    // space, an off-by-one in the cut is tidied away by the `trim` afterwards
    // and a limit of 32 passes here just as well as 31.
    const name = misSheetName("Transferred In Customers (included in new)");
    expect(name).toBe("Transferred In Customers (inclu");
    expect(name.length).toBe(31);
  });

  it("falls back rather than writing a sheet with no name", () => {
    // Reachable rather than defensive: MIS_ROW_LABELS.EMPTY is "", the blank
    // separator line between a Build's sections, and it is a row a reader can
    // open a drill-down from.
    expect(misSheetName("")).toBe("Sheet1");
    expect(misSheetName("   ")).toBe("Sheet1");
  });
});
