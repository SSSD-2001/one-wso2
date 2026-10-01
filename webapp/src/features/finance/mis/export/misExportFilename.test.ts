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
import { misExportFilename, misFilenameRange, misFilenameWord } from "./misExportFilename";

// Two different clean-up rules, and a date that is Pacific rather than UTC.
// The rules stay because they are right. The UTC date does not.

describe("the words a filename is built from", () => {
  it("strips a row label down to letters, digits and underscores", () => {
    // `\s+` to `_`, then everything outside
    // [a-zA-Z0-9_] away, then lower case. A row label has no range in it, so a
    // hyphen in one is punctuation and goes.
    expect(misFilenameWord("Opening ARR")).toBe("opening_arr");
    expect(misFilenameWord("Transferred In (included in new)")).toBe(
      "transferred_in_included_in_new",
    );
    // The leading underscore is kept: the `%` is stripped AFTER the space
    // beside it has already become one. Two exports of the same figure then
    // file under the same name.
    expect(misFilenameWord("% New Total")).toBe("_new_total");
  });

  it("keeps the hyphen in a period column, because a range is two dates", () => {
    // The second rule, and the reason there are two: the allowed set
    // here includes `-`, so a TTM column survives as the range it is rather
    // than collapsing into one unreadable number.
    expect(misFilenameRange("2025/09/03 - 2026/09/03")).toBe("20250903_-_20260903");
    expect(misFilenameRange("2025")).toBe("2025");
  });
});

describe("the filename", () => {
  it("joins its parts and ends in the Pacific date", () => {
    // 04:30 UTC on the 15th is 21:30 on the 14th in California. A UTC stamp
    // from `toISOString()` would file an export taken on a Pacific evening
    // under tomorrow, and a reader sorting a folder by name gets the wrong
    // day. Every other date in the app is already Pacific.
    const evening = new Date("2026-09-15T04:30:00Z");
    expect(
      misExportFilename(
        [
          "customer_details",
          misFilenameWord("Opening ARR"),
          misFilenameRange("2025/09/03 - 2026/09/03"),
        ],
        evening,
      ),
    ).toBe("customer_details_opening_arr_20250903_-_20260903_2026-09-14.xlsx");
  });

  it("drops a part that has nothing left in it", () => {
    // A drill-down
    // can be opened from MIS_ROW_LABELS.EMPTY, the blank separator line, and an
    // unguarded part would leave a doubled underscore in the name.
    const evening = new Date("2026-09-15T04:30:00Z");
    expect(misExportFilename(["arr_build", misFilenameWord("")], evening)).toBe(
      "arr_build_2026-09-14.xlsx",
    );
  });
});
