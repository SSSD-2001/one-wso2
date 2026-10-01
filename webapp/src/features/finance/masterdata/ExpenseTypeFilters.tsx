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

import { Autocomplete, Box, Button, Chip, Stack, TextField } from "@wso2/oxygen-ui";
import type { ExpenseTypeAutoComplete, ExpenseTypeFilter, LabelledId } from "./masterDataTypes";

/**
 * The six filters above the expense-type table.
 *
 * Expense types are the one collection fetched through a POST filter rather
 * than a plain GET, so unlike the other three tabs this bar is not a
 * convenience over rows already on screen: it is how rows are asked for at
 * all. Apply is what issues the request.
 */

/** The two statuses a row can carry. */
const STATUS_OPTIONS = ["active", "inactive"] as const;

const FIELD_SX = { minWidth: 200, flex: 1 } as const;

/** Multi-select over plain strings. */
function StringFilter({
  label,
  values,
  options,
  onChange,
}: {
  label: string;
  values: string[];
  options: readonly string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <Autocomplete
      multiple
      size="small"
      sx={FIELD_SX}
      options={options}
      value={values}
      onChange={(_e, next) => onChange(next as string[])}
      renderTags={(tags, getTagProps) =>
        tags.map((tag, index) => (
          <Chip {...getTagProps({ index })} key={tag} label={tag} size="small" />
        ))
      }
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  );
}

/** Multi-select that shows labels and reports ids. */
function IdFilter({
  label,
  values,
  options,
  onChange,
}: {
  label: string;
  values: number[];
  options: readonly LabelledId[];
  onChange: (next: number[]) => void;
}) {
  const selected = options.filter((o) => values.includes(o.id));
  return (
    <Autocomplete
      multiple
      size="small"
      sx={FIELD_SX}
      options={options}
      value={selected}
      getOptionLabel={(o) => o.label}
      isOptionEqualToValue={(o, v) => o.id === v.id}
      onChange={(_e, next) => onChange(next.map((o) => o.id))}
      renderTags={(tags, getTagProps) =>
        tags.map((tag, index) => (
          <Chip {...getTagProps({ index })} key={tag.id} label={tag.label} size="small" />
        ))
      }
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  );
}

export default function ExpenseTypeFilters({
  draft,
  options,
  optionsLoading,
  busy,
  onChange,
  onApply,
  onClear,
}: {
  /** The filters being edited — not the ones the table is showing. */
  draft: ExpenseTypeFilter;
  options?: ExpenseTypeAutoComplete;
  optionsLoading: boolean;
  busy: boolean;
  onChange: (next: ExpenseTypeFilter) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  // A key set to an empty array is dropped rather than sent as `[]`. Doing
  // it as the value changes keeps the object that reaches the query key
  // clean, so two ways of expressing "no category filter" don't produce two
  // cache entries.
  const set = <K extends keyof ExpenseTypeFilter>(key: K, value: ExpenseTypeFilter[K]) => {
    const next = { ...draft };
    if (!value || (value as unknown[]).length === 0) delete next[key];
    else next[key] = value;
    onChange(next);
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" flexWrap="wrap" gap={1.5} sx={{ mb: 1.5 }}>
        <IdFilter
          label="Expense Category"
          values={draft.expenseCategoryIds ?? []}
          options={options?.expenseCategoryIds ?? []}
          onChange={(v) => set("expenseCategoryIds", v)}
        />
        <IdFilter
          label="Gl code"
          values={draft.glCodeIds ?? []}
          options={options?.glCodeIds ?? []}
          onChange={(v) => set("glCodeIds", v)}
        />
        <StringFilter
          label="Expense type"
          values={draft.expenseTypes ?? []}
          options={options?.expenseTypes ?? []}
          onChange={(v) => set("expenseTypes", v)}
        />
        <StringFilter
          label="Engagement code"
          values={draft.engagementCodes ?? []}
          options={options?.engagementCodes ?? []}
          onChange={(v) => set("engagementCodes", v)}
        />
        <StringFilter
          label="Engagement suffix"
          values={draft.engagementCodeSuffixes ?? []}
          options={options?.engagementCodeSuffixes ?? []}
          onChange={(v) => set("engagementCodeSuffixes", v)}
        />
        <StringFilter
          label="Status"
          values={draft.status ?? []}
          options={STATUS_OPTIONS}
          onChange={(v) => set("status", v)}
        />
      </Stack>
      <Stack direction="row" gap={1}>
        <Button variant="contained" size="small" onClick={onApply} disabled={busy || optionsLoading}>
          Apply Filters
        </Button>
        <Button
          variant="outlined"
          color="error"
          size="small"
          onClick={onClear}
          disabled={busy || optionsLoading}
        >
          Clear
        </Button>
      </Stack>
    </Box>
  );
}
