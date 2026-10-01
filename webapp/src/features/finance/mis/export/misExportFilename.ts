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

// What an exported file is called.
//
// A prefix, the row that was opened, the Period column and the date. A
// folder of these sorts into something a reader can navigate. The name
// carries the row and the Period. The Applied filters are written into the
// sheet, under the units caption.
//
// Two of the three clean-up rules are kept. The date is Pacific, not UTC.

import { pacificCivilDate } from "../util/misPacificTime";

/**
 * A word in a filename: a row label, a table name.
 *
 * Whitespace becomes an underscore, everything outside `[a-zA-Z0-9_]` goes,
 * and the result is lower case. A
 * hyphen does NOT survive here, and that is the difference from
 * `misFilenameRange` below.
 */
export const misFilenameWord = (text: string): string =>
  text.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();

/**
 * A date range in a filename: the Period column a figure was read from.
 *
 * The same rule EXCEPT that `-` is allowed through, which is why there are
 * two rules. A TTM column reads
 * `"2025/09/03 - 2026/09/03"`, and it has to survive as `20250903_-_20260903`:
 * strip the hyphen with the slashes and the two dates run together into one
 * sixteen-digit number that names nothing.
 */
export const misFilenameRange = (text: string): string =>
  text.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();

/**
 * The parts, joined, dated, and given the extension.
 *
 * ---- the date is Pacific, not UTC ------------------------------------------
 *
 * Stamping the file with `toISOString()` would use a UTC date,
 * while every other date in MIS is Pacific (not the viewer's
 * timezone and not UTC). Between 5pm and midnight in California those two are
 * different days, so an export taken on a Pacific evening is filed under
 * tomorrow. It is the quiet kind of wrong: the file is correct, its name is
 * not, and the reader who sorts a folder by name is the one who finds out.
 *
 * `instant` is a parameter so a test can hold an evening still.
 */
export function misExportFilename(parts: readonly string[], instant: Date = new Date()): string {
  const { year, month, day } = pacificCivilDate(instant);
  const on = `${year}-${pad(month)}-${pad(day)}`;
  // Empty parts dropped — a Build
  // row can be MIS_ROW_LABELS.EMPTY, and an unguarded part doubles the
  // separator.
  return [...parts.filter(Boolean), on].join("_") + ".xlsx";
}

const pad = (value: number): string => String(value).padStart(2, "0");
