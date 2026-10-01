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

// DTOs from the people-ops-suite people-app backend, copied verbatim so
// field names match the wire format. If people-app's contract changes,
// mirror the change here. Source of truth:
//   src/slices/authSlice/auth.ts       (UserInfoInterface)
//   src/slices/employeeSlice/employee.ts (Employee)
//   src/slices/employeeSlice/employeePersonalInfo.ts (EmployeePersonalInfo)
//   src/types/types.tsx                 (EmergencyContact)

export interface UserInfo {
  id: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  employeeThumbnail: string | null;
  designation: string | null;
  privileges: number[];
}

// Deliberately open, and deliberately NOT tightened to a union: this is a
// free-text column on the backend, so a closed type would start lying the
// moment HR adds a value. What we SEND is closed instead — see
// EmployeeStatusFilter below.
export type EmployeeStatus = string;

/**
 * The statuses the team search may filter on. Closed, because these are values
 * we choose to send rather than values we have to accept.
 */
export type EmployeeStatusFilter = "Active" | "Marked leaver" | "Left";

export const EMPLOYEE_STATUS_FILTERS: readonly EmployeeStatusFilter[] = [
  "Active",
  "Marked leaver",
  "Left",
];

export interface Employee {
  employeeId: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  employeeThumbnail: string | null;
  secondaryJobTitle: string | null;
  jobRole: string | null;
  epf: string;
  workLocation: string;
  startDate: string;
  managerEmail: string;
  managerName: string | null;
  additionalManagerEmails: string | null;
  gender: string | null;
  continuousServiceDate: string | null;
  jobBand: number | null;
  employeeStatus: EmployeeStatus;
  probationEndDate: string | null;
  agreementEndDate: string | null;
  resignationDate: string | null;
  finalDayInOffice: string | null;
  finalDayOfEmployment: string | null;
  resignationReason: string | null;
  employmentType: string;
  designation: string;
  externalDesignation: string | null;
  company: string;
  office: string | null;
  businessUnit: string;
  team: string;
  subTeam: string | null;
  unit: string | null;
  subordinateCount: number;
  employmentTypeId: number;
  careerFunctionId: number;
  designationId: number;
  companyId: number;
  officeId: number | null;
  businessUnitId: number;
  teamId: number;
  subTeamId: number | null;
  unitId: number | null;
  house: string | null;
  houseId: number | null;
}

// Mirrors people-app's database:EmergencyContact — name/relationship/mobile
// are non-null in the Ballerina record; only telephone is nullable.
export interface EmergencyContact {
  name: string;
  relationship: string;
  telephone: string | null;
  mobile: string;
}

export interface EmployeePersonalInfo {
  id: number;
  nicOrPassport: string;
  firstName: string;
  lastName: string;
  fullName: string;
  title: string;
  dob: string;
  gender: string;
  personalEmail: string | null;
  personalPhone: string | null;
  residentNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateOrProvince: string | null;
  postalCode: string | null;
  country: string | null;
  nationality: string;
  emergencyContacts: EmergencyContact[] | null;
}

// Banking backend types — AccountType + AccountStatus enums, and the
// subset of EmployeeBankAccount fields we render.

export type AccountType = "SALARY" | "REIMBURSEMENT" | "CONSULTANCY";
export type AccountStatus = "ACTIVE" | "INACTIVE" | "REQUESTED" | "REJECTED";

export interface BankAccount {
  accountId: number;
  employeeEmail: string;
  accountName: string;
  accountNumber: string;
  accountStatus: AccountStatus;
  accountType: AccountType;
  bankCode: string | null;
  bankSwiftCode: string | null;
  bankName: string | null;
  bankLocation: string | null;
  branchCode: string | null;
  branchName: string | null;
  // Non-null on the wire (db:EmployeeBankAccount), but every Bank Account
  // rendered here comes through the same optional-chaining path as the
  // nullable fields, so nullable is the safer type to declare.
  beneficiaryAddress: string | null;
  bankAddress: string | null;
  // Only meaningful for CONSULTANCY; null for SALARY/REIMBURSEMENT.
  paymentMethod: string | null;
  effectiveFrom: string;
  createdOn: string | null;
  // NetSuite identifiers, only ever populated once an account has been
  // through NetSuite — null until then. Only the Change Requests tab's
  // detail view renders these; every other Banking screen ignores them.
  netSuiteInternalId: string | null;
  netSuiteVendorId: string | null;
  netSuitePaymentFileFormat: string | null;
}

export interface BankAccountsResponse {
  bankAccounts: BankAccount[];
  count: number;
}

// GET /employee/accounts admin filters (Report tab). `createdFrom`/
// `createdTo` are "" when unset, never undefined, so a component can
// always bind them to a controlled input.
export interface ReportFilters {
  createdFrom: string;
  createdTo: string;
  accountTypesArray: AccountType[];
  statusArray: AccountStatus[];
}

// GET /employees on the banking backend (ONE_WSO2_BANKING_BACKEND_URL) —
// its OWN employee directory. Deliberately distinct from the `Employee`
// interface above, which is a different record with a different field set:
// this data comes from the banking backend only, never borrowed from
// another backend's, even when the other backend already has an equivalent
// record.
export interface BankingEmployee {
  employeeId: string | null;
  firstName: string;
  lastName: string;
  workEmail: string;
  department: string | null;
  team: string | null;
  employeeThumbnail: string | null;
  jobRole: string;
  epf: string | null;
  location: string;
}

// GET /employee-info on the banking backend — only what the Banking page
// reads from it: the employee's HR location (drives the Reimbursement gate
// and the Bank Location options).
export interface BankingEmployeeInfo {
  location: string;
}

// GET /employee-privileges on the banking backend — what the caller may do,
// decided server-side by the same roles the backend enforces.
export interface BankingPrivileges {
  isEmployee: boolean;
  isPeopleOperationsAdmin: boolean;
  isFinanceAdmin: boolean;
}

// One `customLocationMap` entry: for an employee whose work location is
// `location`, the Consultancy Bank Location dropdown offers `customMap`.
export interface CustomLocationMapEntry {
  location: string;
  customMap: string[];
}

// GET /app-config on the banking backend: the day-of-month cutoffs,
// work-location allow-list, restricted-role list, the full country list the
// edit/add dialog's Account Holder's Country step picks from, and the
// customLocationMap that narrows Consultancy's Bank Location options.
export interface BankingAppConfig {
  salaryThreshold: number;
  consultancyThreshold: number;
  reimbursementsAllowedCountries: string[];
  consultancyRestrictedRoles: string[];
  allCountries: string[];
  customLocationMap: CustomLocationMapEntry[];
}

// GET /banks on the banking backend — the lookup list backing the bank
// autocomplete in the edit/add flow.
export interface Bank {
  bankCode: string;
  bankLocation: string;
  bankName: string;
  swiftCode: string;
}

export interface BanksResponse {
  banks: Bank[];
  count: number;
}

// PATCH /threshold body — the backend's own db:ThresholdTypes enum member
// names, sent verbatim as strings. Each key is owned by a different admin:
// People Ops owns SALARY_THRESHOLD, Finance owns CONSULTANCY_THRESHOLD.
export type ThresholdKey = "SALARY_THRESHOLD" | "CONSULTANCY_THRESHOLD";

export interface UpdateThresholdPayload {
  key: ThresholdKey;
  value: number;
}

// POST /employee/accounts body. Every Account Type sends the same shape —
// branchName/branchCode are simply empty for CONSULTANCY rather than a
// different payload shape.
export interface CreateBankAccountRequestPayload {
  employeeEmail: string;
  accountType: AccountType;
  accountName: string;
  accountNumber: string;
  beneficiaryAddress: string;
  bankName: string;
  bankSwiftCode: string;
  bankCode: string;
  bankLocation: string;
  bankAddress: string;
  branchName: string;
  branchCode: string;
  effectiveFrom: string;
  /** Required by the backend's request record (note the plural); Consultancy also builds the vendor address from it. */
  accountHoldersCountry: string;
}

export interface CreateBankAccountRequestResponse {
  applicationID: number;
}

// Body for PATCH /employees/{employeeId}/personal-info. Mirrors
// database:UpdateEmployeePersonalInfoPayload — every field is optional and
// nullable. Non-admin callers can only update the contact/address block and
// emergencyContacts (name/dob/gender/nationality etc. are 403 for self-edit).
export interface UpdatePersonalInfoPayload {
  personalEmail?: string | null;
  personalPhone?: string | null;
  residentNumber?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateOrProvince?: string | null;
  postalCode?: string | null;
  country?: string | null;
  // Backend replaces the whole array atomically — always send the full
  // desired end-state, not a diff.
  emergencyContacts?: EmergencyContact[];
}

// Vehicle DTOs. Mirrors people-ops-suite/apps/people-app/backend
// modules/database/types.bal Vehicle + Vehicles + AddVehiclePayload.

export type VehicleType = "CAR" | "MOTORCYCLE";
export type VehicleStatus = "ACTIVE" | "INACTIVE";

export interface Vehicle {
  vehicleId: number;
  owner: string;
  vehicleRegistrationNumber: string;
  vehicleType: VehicleType;
  vehicleStatus: VehicleStatus;
  createdBy: string;
  createdOn: string;
  updatedBy: string;
  updatedOn: string;
}

export interface VehiclesResponse {
  vehicles: Vehicle[];
  totalCount: number;
}

// Body for POST /employees/{email}/vehicles.
export interface NewVehiclePayload {
  vehicleRegistrationNumber: string;
  vehicleType: VehicleType;
}

// --- team search (POST /employees/search) ----------------------------------
//
// Mirrored from people-app's `modules/database/types.bal` (EmployeeFilters /
// Pagination / Sort). Deliberately a SUBSET: only the fields My Team actually
// sends. The backend record carries about thirty, and importing the unused ones
// invites someone to send a filter from a screen that has no business setting
// it.

/** What the team search may filter on. */
export interface EmployeeFilters {
  businessUnitId?: number;
  teamId?: number;
  subTeamId?: number;
  unitId?: number;
  careerFunctionId?: number;
  designationId?: number;
  companyId?: number;
  officeId?: number;
  employmentTypeId?: number;
  managerEmail?: string;
  gender?: string;
  employeeStatuses?: EmployeeStatusFilter[];
  /** false = the whole reporting chain; true = direct reports only. */
  directReports?: boolean;
  /** Hides anyone whose start date is after today, on the server's clock. */
  excludeFutureStartDate?: boolean;
}

export type SortOrder = "ASC" | "DESC";

export interface EmployeeSort {
  sortField: string;
  sortOrder: SortOrder;
}

export interface EmployeePagination {
  /** Server constrains this to 1..100. */
  limit: number;
  offset: number;
}

export interface EmployeeSearchPayload {
  filters: EmployeeFilters;
  pagination: EmployeePagination;
  sort: EmployeeSort;
  /**
   * Always true from this screen. It makes the server resolve the caller from
   * the token and restrict the result to their subtree — so the scope cannot be
   * widened by editing the request, and an admin sending this still sees only
   * their own reports.
   */
  leadOnly: true;
  /** Omitted entirely when empty. */
  searchString?: string;
}

export interface FilteredEmployeesResponse {
  employees: Employee[];
  totalCount: number;
}
