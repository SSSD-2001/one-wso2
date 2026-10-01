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

import { Box, Chip } from "@wso2/oxygen-ui";
import type { MisFilterChip } from "../util/misAppliedFilterChips";
import type { MisFilterControl } from "../util/misViewVocabulary";

// The Applied filters as a strip of chips, under the controls that set them.
//
// A list rather than a row of buttons, because that is what it is: a reader on a
// screen reader hears "Applied filters, list, six items" and can step through
// what the figures above them have been narrowed by.
//
// A drill-down shows the filters it inherited without letting anyone change
// them from inside it. Omitting `onRemove` already renders a strip nothing
// can dismiss, so there is no separate read-only flag.

export default function MisAppliedFilterChips({
  chips,
  onRemove,
}: {
  chips: readonly MisFilterChip[];
  /** Called with the control a dismissed chip stands for. Omit for a read-only strip. */
  onRemove?: (key: MisFilterControl) => void;
}) {
  if (!chips.length) return null;

  return (
    <Box
      component="ul"
      aria-label="Applied filters"
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: 0.75,
        listStyle: "none",
        m: 0,
        mt: 1.25,
        p: 0,
      }}
    >
      {chips.map((chip) => {
        const remove = chip.removable && onRemove ? () => onRemove(chip.key) : undefined;
        return (
          <Box component="li" key={chip.key} sx={{ display: "flex" }}>
            <Chip
              size="small"
              variant="outlined"
              label={chip.label}
              onDelete={remove}
              // Named by what dismissing it DOES, not by what it says. "EMEA,
              // APAC" is the filter; "Remove Sales Region: EMEA, APAC" is the
              // button, and the two need different words.
              aria-label={remove ? `Remove ${chip.label}` : undefined}
              sx={{ height: 24, fontSize: 12 }}
            />
          </Box>
        );
      })}
    </Box>
  );
}
