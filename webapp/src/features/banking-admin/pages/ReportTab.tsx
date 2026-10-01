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
import { Autocomplete, Box, Button, TextField } from "@wso2/oxygen-ui";
import { useReportAccounts } from "@features/my/api/useReportAccounts";
import type { AccountStatus, AccountType, ReportFilters } from "@features/my/api/types";
import BankAccountsTable from "../components/BankAccountsTable";
import {
  ACCOUNT_ID_COLUMN,
  ACCOUNT_NAME_COLUMN,
  ACCOUNT_NUMBER_COLUMN,
  ACCOUNT_TYPE_COLUMN,
  BANK_CODE_COLUMN,
  EFFECTIVE_MONTH_COLUMN,
  EMPLOYEE_EMAIL_COLUMN,
  type BankAccountsTableColumn,
} from "../bankAccountsColumns";

const ACCOUNT_TYPES: AccountType[] = ["SALARY", "CONSULTANCY", "REIMBURSEMENT"];
const ACCOUNT_STATUSES: AccountStatus[] = ["ACTIVE", "INACTIVE", "REJECTED", "REQUESTED"];

const BLANK_FILTERS: ReportFilters = { createdFrom: "", createdTo: "", accountTypesArray: [], statusArray: [] };

// Source's own reportings.tsx default-visible column set for this view, in
// its own order.
const COLUMNS: BankAccountsTableColumn[] = [
  ACCOUNT_ID_COLUMN,
  EMPLOYEE_EMAIL_COLUMN,
  ACCOUNT_NAME_COLUMN,
  ACCOUNT_NUMBER_COLUMN,
  BANK_CODE_COLUMN,
  { label: "Branch Name", render: (a) => a.branchName ?? "-" },
  EFFECTIVE_MONTH_COLUMN,
  ACCOUNT_TYPE_COLUMN,
];

// The Report tab — a filterable, all-employee bank-account table. Nothing
// is fetched until Search is pressed (appliedFilters starts undefined).
export default function ReportTab() {
  const [draft, setDraft] = useState<ReportFilters>(BLANK_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters | undefined>(undefined);
  const accountsQuery = useReportAccounts(appliedFilters);

  // Clears the filter controls back to blank but never dispatches a fetch
  // or a reset action, so a result set already on screen from a previous
  // Search stays until Search is pressed again.
  function handleReset() {
    setDraft(BLANK_FILTERS);
  }

  const rows = accountsQuery.data?.bankAccounts ?? [];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
        <TextField
          label="Start Date"
          type="date"
          size="small"
          value={draft.createdFrom}
          onChange={(e) => setDraft((f) => ({ ...f, createdFrom: e.target.value }))}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="End Date"
          type="date"
          size="small"
          value={draft.createdTo}
          onChange={(e) => setDraft((f) => ({ ...f, createdTo: e.target.value }))}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Autocomplete
          multiple
          size="small"
          options={ACCOUNT_TYPES}
          value={draft.accountTypesArray}
          onChange={(_, next) => setDraft((f) => ({ ...f, accountTypesArray: next }))}
          sx={{ width: 260 }}
          renderInput={(params) => <TextField {...params} label="Account Type" />}
        />
        <Autocomplete
          multiple
          size="small"
          options={ACCOUNT_STATUSES}
          value={draft.statusArray}
          onChange={(_, next) => setDraft((f) => ({ ...f, statusArray: next }))}
          sx={{ width: 260 }}
          renderInput={(params) => <TextField {...params} label="Account State" />}
        />
        <Button variant="contained" onClick={() => setAppliedFilters(draft)}>
          Search
        </Button>
        <Button variant="outlined" onClick={handleReset}>
          Reset Filters
        </Button>
      </Box>

      <BankAccountsTable accounts={rows} columns={COLUMNS} emptyMessage="No bank account records found." />
    </Box>
  );
}
