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

import type {
  CreditCard,
  CreditCardPayload,
  Department,
  DepartmentPayload,
  ExpenseType,
  ExpenseTypePayload,
  MasterDataPayload,
  MasterDataRow,
  MasterDataTab,
  Subsidiary,
  SubsidiaryPayload,
} from "./masterDataTypes";

/**
 * Everything the Submit button's enabled state depends on.
 *
 * The per-tab rules are declared once, in `OPTIONAL_FIELDS` and
 * `EITHER_OR_GROUPS` below, and the operations that follow just read them —
 * a table both tabs can be checked against side by side, rather than the
 * same knowledge threaded separately through each function.
 */

/** Fields that may be left blank. */
const OPTIONAL_FIELDS: Record<MasterDataTab, readonly string[]> = {
  subsidiaries: [],
  departments: [],
  expenseTypes: ["expenseTypeDescription"],
  creditCards: ["comment"],
};

/**
 * Field groups where at least one member must be filled, rather than each
 * one.
 *
 * Expense types are the only tab with one: an expense type is scoped by
 * engagement codes, by engagement-code suffixes, or by both, and the form
 * says so in as many words ("Please fill in at least one of the following
 * fields").
 */
const EITHER_OR_GROUPS: Record<MasterDataTab, readonly (readonly string[])[]> = {
  subsidiaries: [],
  departments: [],
  expenseTypes: [["engagementCodes", "engagementCodeSuffixes"]],
  creditCards: [],
};

/** Which column each tab sorts by on first paint. */
export const INITIAL_SORT_FIELD: Record<MasterDataTab, string> = {
  subsidiaries: "legalName",
  departments: "employeeDepartment",
  expenseTypes: "expenseType",
  creditCards: "employeeEmail",
};

/**
 * A blank payload, or an existing row flattened into one.
 *
 * A number field starts at 0 and a nullable string at "" — the same values
 * `isFormComplete` below reads as "empty". That coupling is deliberate: 0 is
 * not a selectable GL code or tax id, so it doubles as "nothing chosen yet".
 */
export function initialFormData(tab: MasterDataTab, row?: MasterDataRow): MasterDataPayload {
  switch (tab) {
    case "subsidiaries": {
      const r = row as Subsidiary | undefined;
      return {
        taxCodeInternalId: r?.taxCodeInternalId ?? 0,
        taxCode: r?.taxCode ?? "",
        legalName: r?.legalName ?? "",
        code: r?.code ?? "",
      } satisfies SubsidiaryPayload;
    }
    case "departments": {
      const r = row as Department | undefined;
      return {
        employeeDepartment: r?.employeeDepartment ?? "",
        engagementCode: r?.engagementCode ?? "",
        glCodeId: r?.glCodeId ?? 0,
      } satisfies DepartmentPayload;
    }
    case "expenseTypes": {
      const r = row as ExpenseType | undefined;
      return {
        expenseCategoryId: r?.expenseCategoryId ?? 0,
        glCodeId: r?.glCodeId ?? 0,
        expenseType: r?.expenseType ?? "",
        expenseTypeDescription: r?.expenseTypeDescription ?? "",
        engagementCodes: r?.engagementCodes ?? [],
        engagementCodeSuffixes: r?.engagementCodeSuffixes ?? [],
      } satisfies ExpenseTypePayload;
    }
    case "creditCards": {
      const r = row as CreditCard | undefined;
      return {
        ccNumber: r?.ccNumber ?? "",
        ccProviderCode: r?.ccProviderCode ?? "",
        employeeEmail: r?.employeeEmail ?? "",
        leadEmails: r?.leadEmails ?? [],
        comment: r?.comment ?? "",
      } satisfies CreditCardPayload;
    }
  }
}

/**
 * Whether a card number matches the shape its provider issues.
 *
 * Returns false, rather than throwing, for a provider outside the pair.
 * This runs on every keystroke while the form is open, so a bad provider
 * value would take the dialog down instead of just refusing to enable
 * Submit. Both providers come from a fixed two-item list, so in practice
 * this only changes what happens on a path that should not exist.
 */
export function isCreditCardNumberValid(providerCode: string, ccNumber: string): boolean {
  if (providerCode === "AMEX") return /^\d{3}-\d{5}$/.test(ccNumber);
  if (providerCode === "SVB") return /^\d{4}-\d{4}$/.test(ccNumber);
  return false;
}

/** "" for a string, 0 for a number, [] (or all-blank) for a list. */
function isBlank(value: unknown): boolean {
  if (Array.isArray(value)) return value.every((v) => String(v).trim() === "");
  if (typeof value === "number") return value === 0;
  return String(value ?? "").trim() === "";
}

/**
 * Whether Submit may be enabled.
 *
 * Required means filled; an either-or group means at least one member filled;
 * and on the card tab the number must also match its provider's format.
 */
export function isFormComplete(tab: MasterDataTab, form: MasterDataPayload): boolean {
  const optional = OPTIONAL_FIELDS[tab];
  const groups = EITHER_OR_GROUPS[tab];

  for (const [key, value] of Object.entries(form)) {
    if (optional.includes(key)) continue;

    const group = groups.find((g) => g.includes(key));
    if (group) {
      // Satisfied by any member, so a blank one is only a failure when every
      // other member is blank too.
      const anyFilled = group.some((member) => !isBlank(form[member as keyof MasterDataPayload]));
      if (!anyFilled) return false;
      continue;
    }

    if (isBlank(value)) return false;
  }

  // A well-formed card number is part of "filled in", not a separate check
  // the reader discovers only after pressing Submit.
  if (tab === "creditCards") {
    const { ccProviderCode, ccNumber } = form as CreditCardPayload;
    if (ccProviderCode.length > 0 && !isCreditCardNumberValid(ccProviderCode, ccNumber)) return false;
  }

  return true;
}

/**
 * Whether the form still matches the row it was opened on.
 *
 * Only the payload's own keys are compared; a row carries resolved display
 * columns (glCode, glAccountName, …) that the form never edits. A null on the
 * row reads as "" so an untouched empty comment does not count as a change.
 */
export function isUnchanged(row: MasterDataRow, form: MasterDataPayload): boolean {
  return Object.entries(form).every(([key, formValue]) => {
    const rowValue = (row as unknown as Record<string, unknown>)[key] ?? "";
    if (Array.isArray(formValue)) {
      const before = [...((rowValue as string[]) ?? [])].sort();
      const after = [...formValue].sort();
      return JSON.stringify(before) === JSON.stringify(after);
    }
    return rowValue === formValue;
  });
}

/**
 * The changed fields only.
 *
 * PATCH bodies are partial on this backend, and sending the untouched fields
 * back would make every edit look like a change to every column in whatever
 * the service writes to its audit trail.
 */
export function changedFields(row: MasterDataRow, form: MasterDataPayload): Partial<MasterDataPayload> {
  const patch: Record<string, unknown> = {};
  for (const [key, formValue] of Object.entries(form)) {
    const rowValue = (row as unknown as Record<string, unknown>)[key] ?? "";
    const same = Array.isArray(formValue)
      ? JSON.stringify([...((rowValue as string[]) ?? [])].sort()) === JSON.stringify([...formValue].sort())
      : rowValue === formValue;
    if (!same) patch[key] = formValue;
  }
  return patch as Partial<MasterDataPayload>;
}
