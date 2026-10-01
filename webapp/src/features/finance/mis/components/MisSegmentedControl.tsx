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

import { Stack, ToggleButton, ToggleButtonGroup, Typography } from "@wso2/oxygen-ui";

// A labelled row of mutually exclusive choices, committing on click.
//
// The shape the MIS Build screens' Table-level controls share: Region Type,
// the Region Summary's View, and the customer table's Breakdown. Each of them
// chooses between two arrangements of a table the reader is already looking at,
// none of them is in the URL, and all three
// were the same twenty lines with different words in them.
//
// It stays a presentational control and holds no state: what the choices mean,
// which is the default, and what a change does to its siblings are the caller's
// questions, and they differ at each of the three call sites.

export default function MisSegmentedControl<T extends string>({
  label,
  ariaLabel = label,
  value,
  options,
  onChange,
}: {
  /** The words beside the control. Hidden from assistive tech — see below. */
  label: string;
  /**
   * The group's accessible name, when the visible label is too terse to stand
   * on its own. The Region Summary's reads "View" on screen and "Region Summary
   * view" to a screen reader, which is the one place the two differ.
   */
  ariaLabel?: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
      {/* Hidden from assistive tech, because the group below carries the same
          words as its accessible name. */}
      <Typography variant="body2" color="text.secondary" aria-hidden>
        {label}
      </Typography>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={value}
        aria-label={ariaLabel}
        // `null` when the reader clicks the choice they are already on. Ignored
        // rather than treated as "neither": these controls pick between
        // arrangements of a table that is on screen either way, so there is no
        // third state for the group to fall into.
        onChange={(_event, next: T | null) => next && onChange(next)}
      >
        {options.map((option) => (
          <ToggleButton
            key={option.value}
            value={option.value}
            sx={{ textTransform: "none", px: 1.5 }}
          >
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Stack>
  );
}
