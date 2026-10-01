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
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@wso2/oxygen-ui";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { MASTER_DATA_FORM_COPY, MASTER_DATA_SNACK } from "./masterDataCopy";
import { changedFields, initialFormData, isFormComplete, isUnchanged } from "./masterDataForm";
import {
  CreditCardNumberInput,
  IdSelectInput,
  MultiSelectInput,
  SelectInput,
  TextInput,
} from "./masterDataFields";
import { useCreateMasterData, useUpdateMasterData } from "./useMasterDataMutations";
import {
  CREDIT_CARD_PROVIDERS,
  type CreditCardPayload,
  type DepartmentPayload,
  type ExpenseTypeAutoComplete,
  type ExpenseTypePayload,
  type GlCode,
  type MasterDataPayload,
  type MasterDataRow,
  type MasterDataTab,
  type SubsidiaryPayload,
} from "./masterDataTypes";

/**
 * Add / edit, for all four tabs.
 *
 * One dialog rather than four: the submit path, the enable rule and the
 * snackbars are identical across tabs, and only the field list differs. The
 * field list is the `switch` at the bottom.
 *
 * Submit is enabled only when the form is complete AND — when editing —
 * something has actually changed. Pressing it on an unchanged record would
 * PATCH an empty body.
 */
export default function MasterDataFormDialog({
  tab,
  open,
  row,
  glCodes,
  autoComplete,
  employeeEmails,
  onClose,
}: {
  tab: MasterDataTab;
  open: boolean;
  /** Absent = creating. Present = editing that record. */
  row?: MasterDataRow;
  /** Department form's GL Code dropdown. */
  glCodes?: GlCode[];
  /** Expense-type form's category / GL code / type option lists. */
  autoComplete?: ExpenseTypeAutoComplete;
  /** Credit-card form's employee + lead pickers. */
  employeeEmails?: string[];
  onClose: () => void;
}) {
  const isCreate = !row;
  const copy = MASTER_DATA_FORM_COPY[tab];
  const { showSuccess, showError } = useNotifications();
  const create = useCreateMasterData(tab);
  const update = useUpdateMasterData(tab);

  // Seeded once per mount. The page keys this dialog on the row being edited,
  // so opening a different record remounts it rather than carrying the last
  // one's values across.
  const [form, setForm] = useState<MasterDataPayload>(() => initialFormData(tab, row));

  const pending = create.isPending || update.isPending;
  const complete = isFormComplete(tab, form);
  const unchanged = row ? isUnchanged(row, form) : false;
  const canSubmit = complete && !unchanged && !pending;

  const set = (key: string, value: string | number | string[]) =>
    setForm((prev) => {
      // Switching provider empties the number. AMEX and SVB have different
      // formats, so a number typed for one is invalid for the other, and
      // leaving it in place would show a filled field that silently fails
      // validation.
      if (key === "ccProviderCode" && value !== (prev as CreditCardPayload).ccProviderCode) {
        return { ...prev, ccProviderCode: value as string, ccNumber: "" };
      }
      return { ...prev, [key]: value };
    });

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (row) {
      update.mutate(
        { id: row.id, patch: changedFields(row, form) },
        {
          onSuccess: () => {
            showSuccess(MASTER_DATA_SNACK.success.updated);
            onClose();
          },
          onError: () => showError(MASTER_DATA_SNACK.error.updating),
        },
      );
    } else {
      create.mutate(form, {
        onSuccess: () => {
          showSuccess(MASTER_DATA_SNACK.success.added);
          onClose();
        },
        onError: () => showError(MASTER_DATA_SNACK.error.adding),
      });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={pending ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="master-data-form-title"
    >
      <DialogTitle id="master-data-form-title">
        {isCreate ? copy.addTitle : copy.editTitle}
      </DialogTitle>
      <DialogContent dividers>
        <Fields
          tab={tab}
          form={form}
          set={set}
          glCodes={glCodes}
          autoComplete={autoComplete}
          employeeEmails={employeeEmails}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={pending} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!canSubmit}
          startIcon={pending ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {isCreate ? "Submit" : "Update"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** The one thing that differs per tab: which fields, in which order. */
function Fields({
  tab,
  form,
  set,
  glCodes,
  autoComplete,
  employeeEmails,
}: {
  tab: MasterDataTab;
  form: MasterDataPayload;
  set: (key: string, value: string | number | string[]) => void;
  glCodes?: GlCode[];
  autoComplete?: ExpenseTypeAutoComplete;
  employeeEmails?: string[];
}) {
  switch (tab) {
    case "subsidiaries": {
      const f = form as SubsidiaryPayload;
      return (
        <>
          <TextInput
            id="legalName"
            label="Subsidiary Legal Name"
            value={f.legalName}
            required
            onChange={set}
          />
          <TextInput id="code" label="Subsidiary Code" value={f.code} required onChange={set} />
          <TextInput
            id="taxCodeInternalId"
            label="Tax ID"
            value={f.taxCodeInternalId}
            required
            numeric
            onChange={set}
          />
          <TextInput id="taxCode" label="Tax Code" value={f.taxCode} required onChange={set} />
        </>
      );
    }

    // The GL Code dropdown shows the code and reports its row id, which is
    // what the payload carries.
    case "departments": {
      const f = form as DepartmentPayload;
      const options = (glCodes ?? []).map((g) => ({ id: g.id, label: g.glCode }));
      return (
        <>
          <TextInput
            id="employeeDepartment"
            label="Department"
            value={f.employeeDepartment}
            required
            onChange={set}
          />
          <TextInput
            id="engagementCode"
            label="Engagement Code"
            value={f.engagementCode}
            required
            onChange={set}
          />
          <IdSelectInput
            id="glCodeId"
            label="GL Code"
            value={f.glCodeId}
            options={options}
            required
            onChange={set}
          />
        </>
      );
    }

    case "expenseTypes": {
      const f = form as ExpenseTypePayload;
      return (
        <>
          <IdSelectInput
            id="expenseCategoryId"
            label="Expense Category"
            value={f.expenseCategoryId}
            options={autoComplete?.expenseCategoryIds ?? []}
            required
            onChange={set}
          />
          <IdSelectInput
            id="glCodeId"
            label="Gl Code"
            value={f.glCodeId}
            options={autoComplete?.glCodeIds ?? []}
            required
            onChange={set}
          />
          <SelectInput
            id="expenseType"
            label="Expense Type"
            value={f.expenseType}
            options={autoComplete?.expenseTypes ?? []}
            required
            freeSolo
            onChange={set}
          />
          <TextInput
            id="expenseTypeDescription"
            label="Expense Type Description"
            value={f.expenseTypeDescription}
            required={false}
            multiline
            onChange={set}
          />
          {/* Boxed together under a warning line, because the rule binding
              these two fields is not visible from either one on its own. */}
          <Alert severity="warning" variant="outlined" sx={{ mt: 2, mb: 1 }}>
            Please fill in at least one of the following fields
          </Alert>
          <Box sx={{ pl: 0.5 }}>
            <MultiSelectInput
              id="engagementCodes"
              label="Engagement Codes"
              values={f.engagementCodes}
              options={autoComplete?.engagementCodes ?? []}
              required={false}
              onChange={set}
            />
            <MultiSelectInput
              id="engagementCodeSuffixes"
              label="Engagement Code Suffixes"
              values={f.engagementCodeSuffixes}
              options={autoComplete?.engagementCodeSuffixes ?? []}
              required={false}
              onChange={set}
            />
          </Box>
        </>
      );
    }

    case "creditCards": {
      const f = form as CreditCardPayload;
      const emails = employeeEmails ?? [];
      return (
        <>
          <SelectInput
            id="ccProviderCode"
            label="CC Provider Code"
            value={f.ccProviderCode}
            options={CREDIT_CARD_PROVIDERS}
            required
            onChange={set}
          />
          <CreditCardNumberInput
            id="ccNumber"
            label="CC Number"
            value={f.ccNumber}
            providerCode={f.ccProviderCode}
            required
            onChange={set}
          />
          <SelectInput
            id="employeeEmail"
            label="Employee Email"
            value={f.employeeEmail}
            options={emails}
            required
            onChange={set}
          />
          <MultiSelectInput
            id="leadEmails"
            label="Lead Email / Emails"
            values={f.leadEmails}
            options={emails}
            required
            onChange={set}
          />
          <TextInput
            id="comment"
            label="Comment"
            value={f.comment}
            required={false}
            multiline
            onChange={set}
          />
        </>
      );
    }
  }
}
