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

import type { ReactNode } from "react";
import type { BankAccount } from "@features/my/api/types";

// Report and Employee Operations both render the same underlying dataset
// (BankAccount[]) as a plain table (see BankAccountsTable) — these are the
// columns byte-identical between the two, shared here instead of once per
// tab. Each tab appends its own extra column(s) (Report: Branch Name;
// Employee Operations: Account Status + Actions) in its own field order, per
// its own default-visible set in the spec. Kept in its own plain (non-JSX)
// module rather than alongside BankAccountsTable's component so that file
// stays component-only for fast refresh.
export interface BankAccountsTableColumn {
  label: string;
  render: (account: BankAccount) => ReactNode;
}

export const ACCOUNT_ID_COLUMN: BankAccountsTableColumn = { label: "Account ID", render: (a) => a.accountId };
export const EMPLOYEE_EMAIL_COLUMN: BankAccountsTableColumn = {
  label: "Employee Email",
  render: (a) => a.employeeEmail,
};
export const ACCOUNT_NAME_COLUMN: BankAccountsTableColumn = { label: "Account Name", render: (a) => a.accountName };
export const ACCOUNT_NUMBER_COLUMN: BankAccountsTableColumn = {
  label: "Account Number",
  render: (a) => a.accountNumber,
};
export const BANK_CODE_COLUMN: BankAccountsTableColumn = { label: "Bank Code", render: (a) => a.bankCode ?? "-" };
export const EFFECTIVE_MONTH_COLUMN: BankAccountsTableColumn = {
  label: "Effective Month",
  render: (a) => a.effectiveFrom,
};
export const ACCOUNT_TYPE_COLUMN: BankAccountsTableColumn = { label: "Account Type", render: (a) => a.accountType };
