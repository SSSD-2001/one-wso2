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

import { Box, Button, Chip, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@wso2/oxygen-ui";
import { RotateCcwIcon } from "@wso2/oxygen-ui-icons-react";
import {
  MIS_UNITS_BY_CATEGORY,
  MIS_UNIT_CATEGORIES,
  MIS_UNIT_CATEGORY_LABELS,
  defaultUnitCode,
  formatUnitLabel,
  unitCategoryOf,
  type MisUnitCategory,
} from "../util/misUnits";
import { CUSTOM_UNIT } from "../util/misViewVocabulary";

// Which slice of the business the Build below is a Build of.
//
// Not part of the filter bar, and not by accident. The difference that
// matters is that these COMMIT ON CLICK — there is no
// pending state and no APPLY. Choosing a different business unit is choosing a
// different report, not narrowing this one, so it goes straight into the address.
//
// The category is read off the selection rather than held in state. The URL is
// the source of truth for which unit is selected, and a second copy here could
// disagree with it after a back button or a shared link.

export interface MisUnitSelection {
  buProductSelection: string;
  customBusinessUnits: string[];
  customProductUnits: string[];
}

export default function MisUnitTabs({
  selection,
  businessUnitOptions,
  productUnitOptions,
  onChange,
}: {
  selection: MisUnitSelection;
  /** Backend unit codes from `/app-configs`; shown only under Custom. */
  businessUnitOptions: readonly string[];
  productUnitOptions: readonly string[];
  onChange: (next: MisUnitSelection) => void;
}) {
  const category = unitCategoryOf(selection.buProductSelection);

  // Switching category always clears the custom lists. They describe the Custom
  // tab and nothing else, and leaving them behind would put a stale pair of
  // lists in the address of a view that is not custom.
  const chooseCategory = (next: MisUnitCategory) =>
    onChange({
      buProductSelection: defaultUnitCode(next),
      customBusinessUnits: [],
      customProductUnits: [],
    });

  const chooseUnit = (code: string) =>
    onChange({ buProductSelection: code, customBusinessUnits: [], customProductUnits: [] });

  // Business units and product units are mutually exclusive: a Build is cut one
  // way or the other, never both, so picking from one list empties the other.
  // Picking from one list empties the other.
  const toggleCustom = (which: "customBusinessUnits" | "customProductUnits", code: string) => {
    const current = selection[which];
    const next = current.includes(code)
      ? current.filter((item) => item !== code)
      : [...current, code];
    onChange({
      buProductSelection: CUSTOM_UNIT,
      customBusinessUnits: which === "customBusinessUnits" ? next : [],
      customProductUnits: which === "customProductUnits" ? next : [],
    });
  };

  return (
    <Box sx={{ mb: 1.5 }}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={category}
        aria-label="Build"
        onChange={(_, next: MisUnitCategory | null) => next && chooseCategory(next)}
        sx={{ flexWrap: "wrap" }}
      >
        {MIS_UNIT_CATEGORIES.map((name) => (
          <ToggleButton key={name} value={name} sx={{ textTransform: "none" }}>
            {MIS_UNIT_CATEGORY_LABELS[name]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {category === "Custom" ? (
        <CustomUnits
          businessUnitOptions={businessUnitOptions}
          productUnitOptions={productUnitOptions}
          selection={selection}
          onToggle={toggleCustom}
          onReset={() =>
            onChange({
              buProductSelection: CUSTOM_UNIT,
              customBusinessUnits: [],
              customProductUnits: [],
            })
          }
        />
      ) : (
        <ToggleButtonGroup
          exclusive
          size="small"
          value={selection.buProductSelection}
          aria-label="Unit"
          onChange={(_, next: string | null) => next && chooseUnit(next)}
          sx={{ mt: 1, flexWrap: "wrap" }}
        >
          {MIS_UNITS_BY_CATEGORY[category].map((unit) => (
            <ToggleButton key={unit.code} value={unit.code} sx={{ textTransform: "none" }}>
              {unit.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      )}
    </Box>
  );
}

function CustomUnits({
  businessUnitOptions,
  productUnitOptions,
  selection,
  onToggle,
  onReset,
}: {
  businessUnitOptions: readonly string[];
  productUnitOptions: readonly string[];
  selection: MisUnitSelection;
  onToggle: (which: "customBusinessUnits" | "customProductUnits", code: string) => void;
  onReset: () => void;
}) {
  return (
    <Box sx={{ mt: 1, p: 1.5, borderRadius: 1.5, border: 1, borderColor: "divider" }}>
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}
      >
        {/* "Product Units" sits beside Business Units. The label is the one
            Finance reconciles against. */}
        <Typography variant="body2" color="text.secondary">
          Select a combination of either a set of Business Units or Product Units.
        </Typography>
        <Button size="small" variant="outlined" startIcon={<RotateCcwIcon size={14} />} onClick={onReset}>
          Reset
        </Button>
      </Stack>

      <CustomUnitGroup
        label="Business Units"
        options={businessUnitOptions}
        selected={selection.customBusinessUnits}
        onToggle={(code) => onToggle("customBusinessUnits", code)}
      />
      <CustomUnitGroup
        label="Product Units"
        options={productUnitOptions}
        selected={selection.customProductUnits}
        onToggle={(code) => onToggle("customProductUnits", code)}
      />
    </Box>
  );
}

function CustomUnitGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: readonly string[];
  selected: readonly string[];
  onToggle: (code: string) => void;
}) {
  return (
    <Box sx={{ mt: 1.25 }} role="group" aria-label={label}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 0.5 }}>
        {options.length === 0 && (
          <Typography variant="caption" color="text.secondary">
            None available.
          </Typography>
        )}
        {options.map((code) => (
          <Chip
            key={code}
            clickable
            size="small"
            label={formatUnitLabel(code)}
            aria-pressed={selected.includes(code)}
            variant={selected.includes(code) ? "filled" : "outlined"}
            color={selected.includes(code) ? "primary" : "default"}
            onClick={() => onToggle(code)}
          />
        ))}
      </Box>
    </Box>
  );
}
