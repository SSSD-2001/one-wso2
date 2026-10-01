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

// Banking's admin/lead screens — Change Requests, Report, Employee
// Operations, and Admin views. Reachable
// from both the People Ops and Finance perspectives (see BANKING_ADMIN_PATH
// in perspectives.ts), because the four tabs split across both admin types:
// Change Requests is People-Ops-only (the backend's own approve/reject
// action refuses anything but a Salary request); the rest are open to
// either. Same shape of problem Claim Approval's own tabs/gateId already
// solve for Finance, just with two different gate ids instead of one.

/** Permissions, resolved from GET /employee-privileges. */
export type BankingAdminGateId = "people-ops-admin" | "either-admin";

export interface BankingAdminTabDef {
  segment: string;
  label: string;
  gateId: BankingAdminGateId;
}

export const BANKING_ADMIN_PATH = "/banking/admin";

export const BANKING_ADMIN_TABS: readonly BankingAdminTabDef[] = [
  { segment: "change-requests", label: "Change Requests", gateId: "people-ops-admin" },
  { segment: "report", label: "Report", gateId: "either-admin" },
  { segment: "employee-operations", label: "Employee Operations", gateId: "either-admin" },
  { segment: "admin", label: "Admin", gateId: "either-admin" },
] as const;

export interface BankingAdminPrivilegeFlags {
  isPeopleOperationsAdmin: boolean;
  isFinanceAdmin: boolean;
}

export function canSeeBankingAdminTab(
  gateId: BankingAdminGateId,
  flags: BankingAdminPrivilegeFlags,
): boolean {
  if (gateId === "people-ops-admin") return flags.isPeopleOperationsAdmin;
  return flags.isPeopleOperationsAdmin || flags.isFinanceAdmin;
}

/**
 * The first tab this person may open, or undefined when they may open none.
 * Drives the index redirect, and a direct link to a tab they can't see.
 */
export function firstAllowedBankingAdminTab(
  flags: BankingAdminPrivilegeFlags,
): BankingAdminTabDef | undefined {
  return BANKING_ADMIN_TABS.find((t) => canSeeBankingAdminTab(t.gateId, flags));
}
