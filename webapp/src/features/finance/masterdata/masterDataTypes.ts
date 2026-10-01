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

// The finance-master-data wire types, field for field. The backend decides
// these names — a rename here is a broken request, not a tidy-up.

/** The four collections, in the order the rail lists them. */
export type MasterDataTab = "subsidiaries" | "departments" | "expenseTypes" | "creditCards";

/**
 * Path segment per tab.
 *
 * The camelCase tab key and the kebab-case endpoint differ for two of the
 * four, so this map is what turns one into the other. Both spellings are load
 * bearing; neither is derivable from the other.
 */
export const MASTER_DATA_ENDPOINTS: Record<MasterDataTab, string> = {
  subsidiaries: "subsidiaries",
  departments: "departments",
  expenseTypes: "expense-types",
  creditCards: "credit-cards",
};

/** Page/tab titles. */
export const MASTER_DATA_LABELS: Record<MasterDataTab, string> = {
  subsidiaries: "Subsidiaries",
  departments: "Departments",
  expenseTypes: "Expense Types",
  creditCards: "Credit Cards",
};

// ---- Subsidiaries ---------------------------------------------------------

export interface Subsidiary {
  id: number;
  taxCodeInternalId: number;
  taxCode: string;
  legalName: string;
  code: string;
}

export interface SubsidiaryPayload {
  taxCodeInternalId: number;
  taxCode: string;
  legalName: string;
  code: string;
}

// ---- Departments ----------------------------------------------------------

export interface Department {
  id: number;
  employeeDepartment: string;
  engagementCode: string;
  glCodeId: number;
  glCode: string;
  glCodeInternalId: number;
  glAccountName: string;
  costCenter: string | null;
}

export interface DepartmentPayload {
  employeeDepartment: string;
  engagementCode: string;
  glCodeId: number;
}

// ---- GL codes (a dropdown source, not a tab) ------------------------------

export interface GlCode {
  id: number;
  internalId: number;
  glCode: string;
  glAccountName: string;
  costCenter: string | null;
}

// ---- Expense types --------------------------------------------------------

export interface ExpenseType {
  id: number;
  expenseCategoryId: number;
  expenseCategory: string;
  expenseDescription: string | null;
  glCodeId: number;
  glCode: string;
  glCodeInternalId: number;
  glAccountName: string;
  costCenter: string;
  expenseType: string;
  expenseTypeDescription: string | null;
  engagementCodes: string[];
  engagementCodeSuffixes: string[];
  status: string;
}

export interface ExpenseTypePayload {
  expenseCategoryId: number;
  glCodeId: number;
  expenseType: string;
  expenseTypeDescription: string;
  engagementCodes: string[];
  engagementCodeSuffixes: string[];
}

/** POST body for `search-expense-types`. Every key is optional. */
export interface ExpenseTypeFilter {
  expenseCategoryIds?: number[];
  glCodeIds?: number[];
  expenseTypes?: string[];
  engagementCodes?: string[];
  engagementCodeSuffixes?: string[];
  status?: string[];
}

/** An id + its display label, for the two filters that filter on an id. */
export interface LabelledId {
  id: number;
  label: string;
}

export interface ExpenseTypeAutoComplete {
  expenseCategoryIds: LabelledId[];
  glCodeIds: LabelledId[];
  expenseTypes: string[];
  engagementCodes: string[];
  engagementCodeSuffixes: string[];
}

// ---- Credit cards ---------------------------------------------------------

export interface CreditCard {
  id: number;
  ccNumber: string;
  ccProviderCode: string;
  comment: string | null;
  employeeEmail: string;
  leadEmails: string[];
  status: string;
}

export interface CreditCardPayload {
  ccNumber: string;
  ccProviderCode: string;
  comment: string;
  employeeEmail: string;
  leadEmails: string[];
}

/** The two card providers this backend supports. */
export const CREDIT_CARD_PROVIDERS = ["AMEX", "SVB"] as const;
export type CreditCardProvider = (typeof CREDIT_CARD_PROVIDERS)[number];

/** `/employees/email` rows. */
export interface EmployeeEmail {
  workEmail: string;
}

// ---- Unions ---------------------------------------------------------------

export type MasterDataRow = Subsidiary | Department | ExpenseType | CreditCard;
export type MasterDataPayload =
  | SubsidiaryPayload
  | DepartmentPayload
  | ExpenseTypePayload
  | CreditCardPayload;

/**
 * The row type each tab holds, so a page can name its tab once and have the
 * grid, the dialogs and the mutations all agree on what a row is.
 */
export interface MasterDataRowFor {
  subsidiaries: Subsidiary;
  departments: Department;
  expenseTypes: ExpenseType;
  creditCards: CreditCard;
}

export interface MasterDataPayloadFor {
  subsidiaries: SubsidiaryPayload;
  departments: DepartmentPayload;
  expenseTypes: ExpenseTypePayload;
  creditCards: CreditCardPayload;
}
