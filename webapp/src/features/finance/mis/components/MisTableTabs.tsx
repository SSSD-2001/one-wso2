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

import { ToggleButton, ToggleButtonGroup } from "@wso2/oxygen-ui";
import { MIS_TABLE_LABELS, MIS_TABLE_ORDER, type MisTable } from "../util/misViewVocabulary";

// Which of the Build's four tables is on screen.
//
// It COMMITS ON CLICK for the same reason the
// unit tabs do: a different Table is a different report, not a narrowing of
// this one, so it goes straight into the address rather than waiting for Apply.
// That is also what makes the view shareable — the Table is in the link.
//
// The selection is read from the view rather than held here. The URL is the
// source of truth, and a second copy would disagree with it after a back button
// or a pasted link.

export default function MisTableTabs({
  table,
  onChange,
}: {
  table: MisTable;
  onChange: (next: MisTable) => void;
}) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={table}
      aria-label="Table"
      // `null` when the reader clicks the table they are already on. Ignored
      // rather than treated as "no table": ToggleButtonGroup reports a
      // deselection, and there is no such thing here — one of the four is
      // always being read.
      onChange={(_event, next: MisTable | null) => next && onChange(next)}
      sx={{ mb: 1.5, flexWrap: "wrap" }}
    >
      {MIS_TABLE_ORDER.map((one) => (
        <ToggleButton key={one} value={one} sx={{ textTransform: "none", px: 1.5 }}>
          {MIS_TABLE_LABELS[one]}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
