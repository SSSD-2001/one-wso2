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

import { useState } from "react";
import { Autocomplete, Chip, TextField } from "@wso2/oxygen-ui";
import { isCreditCardNumberValid } from "./masterDataForm";
import type { LabelledId } from "./masterDataTypes";

/**
 * The form controls the four master-data dialogs are built from.
 *
 * Shared rule across all of them: a required field only turns red once it
 * has been touched and left empty, never while it is still being filled in
 * for the first time. Written here as a `touched` flag set on blur.
 *
 * `TextField`/`Autocomplete` come through Oxygen UI, so these pick up the
 * portal's field sizing, focus ring and dark-mode tokens automatically.
 */

const FIELD_PROPS = {
  fullWidth: true,
  margin: "dense",
  size: "small",
  autoComplete: "off",
} as const;

/**
 * A single-line text or number field.
 *
 * `type="number"` reports its value as a number and treats a blank box as 0
 * — how "nothing entered" is spelled for the numeric ids on this backend,
 * and `isFormComplete` reads it back the same way.
 */
export function TextInput({
  id,
  label,
  value,
  required,
  numeric = false,
  multiline = false,
  onChange,
}: {
  id: string;
  label: string;
  value: string | number;
  required: boolean;
  numeric?: boolean;
  multiline?: boolean;
  onChange: (id: string, value: string | number) => void;
}) {
  const [touched, setTouched] = useState(false);
  // Held locally so a number field can show an empty box rather than the 0
  // it reports upward, and so trailing whitespace survives until blur.
  const [text, setText] = useState(value === 0 ? "" : String(value ?? ""));

  const handleChange = (next: string) => {
    setText(next);
    if (numeric) {
      const parsed = Number.parseInt(next, 10);
      onChange(id, Number.isNaN(parsed) ? 0 : parsed);
    } else {
      onChange(id, next.trim());
    }
  };

  return (
    <TextField
      {...FIELD_PROPS}
      id={id}
      label={label}
      required={required}
      type={numeric ? "number" : "text"}
      multiline={multiline}
      minRows={multiline ? 2 : undefined}
      value={text}
      error={required && touched && !text.trim()}
      onBlur={() => required && setTouched(true)}
      onChange={(e) => handleChange(e.target.value)}
    />
  );
}

/**
 * Pick one of a fixed list.
 *
 * `freeSolo` lets a value be typed that is not on the list — turned on for
 * Expense Type, where the list is the types that already exist and the
 * point of the form is often to add one that does not.
 */
export function SelectInput({
  id,
  label,
  value,
  options,
  required,
  freeSolo = false,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  required: boolean;
  freeSolo?: boolean;
  onChange: (id: string, value: string) => void;
}) {
  const [touched, setTouched] = useState(false);
  return (
    <Autocomplete
      id={id}
      options={options}
      value={value || null}
      freeSolo={freeSolo}
      autoHighlight
      onBlur={() => required && setTouched(true)}
      // One handler or the other, never both — `CustomAutoCompleteTextField.tsx:89-95`.
      // A free-text single reports through `onInputChange`, because the value
      // is whatever has been typed, committed to an option or not; a fixed
      // list reports through `onChange`, which only fires on a real choice.
      onChange={freeSolo ? undefined : (_e, next) => onChange(id, next ?? "")}
      onInputChange={freeSolo ? (_e, next) => onChange(id, next ?? "") : undefined}
      renderInput={(params) => (
        <TextField
          {...params}
          {...FIELD_PROPS}
          label={label}
          required={required}
          error={required && touched && !value}
        />
      )}
    />
  );
}

/**
 * Pick one of a list whose entries are an id with a label.
 *
 * Expense Category and GL Code filter on a numeric id but read as a name, so
 * the option object goes in and the id comes out.
 */
export function IdSelectInput({
  id,
  label,
  value,
  options,
  required,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  options: readonly LabelledId[];
  required: boolean;
  onChange: (id: string, value: number) => void;
}) {
  const [touched, setTouched] = useState(false);
  // 0 is "nothing chosen", so it must not resolve to an option.
  const selected = options.find((o) => o.id === value) ?? null;
  return (
    <Autocomplete
      id={id}
      options={options}
      value={selected}
      autoHighlight
      getOptionLabel={(o) => o.label}
      isOptionEqualToValue={(o, v) => o.id === v.id}
      onBlur={() => required && setTouched(true)}
      onChange={(_e, next) => onChange(id, next ? next.id : 0)}
      renderInput={(params) => (
        <TextField
          {...params}
          {...FIELD_PROPS}
          label={label}
          required={required}
          error={required && touched && !value}
        />
      )}
    />
  );
}

/**
 * Pick any number of values, typing new ones as needed.
 *
 * Every multi-select in the source is `freeForm` — engagement codes, their
 * suffixes and lead emails are all lists the form is allowed to extend.
 */
export function MultiSelectInput({
  id,
  label,
  values,
  options,
  required,
  onChange,
}: {
  id: string;
  label: string;
  values: readonly string[];
  options: readonly string[];
  required: boolean;
  onChange: (id: string, values: string[]) => void;
}) {
  const [touched, setTouched] = useState(false);
  return (
    <Autocomplete
      id={id}
      multiple
      freeSolo
      autoHighlight
      options={options}
      value={[...values]}
      onBlur={() => required && setTouched(true)}
      // Blank entries are dropped on the way in, the way `FormDialog.tsx:96-110`
      // filters them — pressing Enter on an empty box should not add a chip
      // that then counts as "filled".
      onChange={(_e, next) => onChange(id, next.map((v) => v.trim()).filter(Boolean))}
      renderTags={(tags, getTagProps) =>
        tags.map((tag, index) => (
          <Chip {...getTagProps({ index })} key={tag} label={tag} size="small" />
        ))
      }
      renderInput={(params) => (
        <TextField
          {...params}
          {...FIELD_PROPS}
          label={label}
          required={required}
          error={required && touched && values.length === 0}
          // CustomAutoCompleteTextField.tsx:109 — every multi-select says
          // this. Without it, that these lists accept values not already on
          // them is something the reader has to guess.
          helperText="For custom text, type and press Enter"
        />
      )}
    />
  );
}

/**
 * The card number, validated against the shape its provider issues.
 *
 * `CCNumberValidateTextField.tsx` — the helper text tells you the format
 * before you type it, and says to choose a provider first when none is
 * chosen, because the format depends on which one it is.
 */
export function CreditCardNumberInput({
  id,
  label,
  value,
  providerCode,
  required,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  providerCode: string;
  required: boolean;
  onChange: (id: string, value: string) => void;
}) {
  const [touched, setTouched] = useState(false);
  const helperText = !providerCode
    ? "Please select credit card provider code"
    : providerCode === "AMEX"
      ? "Format should be 123-12345"
      : "Format should be 1234-1234";
  const valid = providerCode.length > 0 && isCreditCardNumberValid(providerCode, value);

  return (
    <TextField
      {...FIELD_PROPS}
      id={id}
      label={label}
      required={required}
      value={value}
      helperText={helperText}
      error={touched && (!value.trim() || !valid)}
      onBlur={() => required && setTouched(true)}
      onChange={(e) => onChange(id, e.target.value.trim())}
    />
  );
}
