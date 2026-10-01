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

import { deriveLegacyCycleDates, deriveLegacyRatingFromScore } from "./parLegacyHistory";
import type { ParCycle, ParEmployee, ParLegacyHistory } from "../api/types";
import type { ParLegacyHistoryByEmail, ParRatingByEmail } from "../api/useLeadHistory";

export interface MergedCycleOption {
  key: string;
  label: string;
  isLegacy: boolean;
  parCycleId?: number;
  cycleName: string;
  sortDate: string | null;
}

// ParHistoryTab.tsx's own row order — GET /par-cycles?status=CLOSED has no
// ORDER BY on the backend, so "My History" sorts it itself, latest CREATED
// first. Deliberately `parCycleId` (an auto-increment PK, so it only ever
// grows), not `parCycleStartDate`: a cycle's start date is business data an
// admin can set to anything — a test/demo cycle backdated or postdated
// relative to when it was actually set up — so it doesn't reliably track
// creation order. The backend's own `par_cycle_created_on` timestamp isn't
// on the wire at all (par-app's getParCycleFrom in manager.bal strips it
// before building the API response), so the id is the only signal we have.
export function sortClosedCyclesLatestFirst(cycles: ParCycle[]): ParCycle[] {
  return [...cycles].sort((a, b) => b.parCycleId - a.parCycleId);
}

// Ports EmployeeHistoryView.tsx's own mergedCycleOptions useMemo: every real
// closed cycle plus one entry per DISTINCT legacy cycle name across every
// one of the lead's reports (deduplicated — however many reports have a
// record for a given legacy cycle, it's one dropdown row), latest first.
export function buildMergedCycleOptions(
  realCycles: ParCycle[],
  legacyHistoryByEmail: ParLegacyHistoryByEmail,
): MergedCycleOption[] {
  const legacyCycleMap = new Map<string, ParLegacyHistory>();
  Object.values(legacyHistoryByEmail).forEach((records) => {
    (records ?? []).forEach((record) => {
      if (!legacyCycleMap.has(record.cycleName)) legacyCycleMap.set(record.cycleName, record);
    });
  });

  const options: MergedCycleOption[] = [
    ...realCycles.map((cycle) => ({
      key: `cycle-${cycle.parCycleId}`,
      label: cycle.parCycleName,
      isLegacy: false,
      parCycleId: cycle.parCycleId,
      cycleName: cycle.parCycleName,
      sortDate: cycle.parCycleStartDate,
    })),
    ...Array.from(legacyCycleMap.values()).map((record) => ({
      key: `legacy-${record.cycleName}`,
      label: `${record.cycleName} (Legacy)`,
      isLegacy: true,
      cycleName: record.cycleName,
      sortDate: deriveLegacyCycleDates(record.cycleName).startDate,
    })),
  ];

  // Latest cycle at the top, oldest at the bottom; an option with no
  // derivable date sorts to the very end rather than the top.
  return options.sort((a, b) => {
    if (!a.sortDate) return 1;
    if (!b.sortDate) return -1;
    return b.sortDate.localeCompare(a.sortDate);
  });
}

// A synthetic ParEmployee, not a real report — the "show everyone" row
// prepended to the Employee dropdown's options in
// ParLeadEmployeeHistoryTab.tsx. `workEmail` is a sentinel no real
// employee can have.
export const ALL_EMPLOYEES_OPTION: ParEmployee = { employeeName: "All Employees", workEmail: "__all_employees__" };

// Ports EmployeeHistoryView.tsx's own employeesWithCycleData +
// filteredEmployees: which of the lead's reports show up in the employee
// picker for the currently selected cycle, narrowed further by a search
// term against name or email. `null` selection scope (no cycle picked yet)
// leaves the full report list unfiltered — same as source.
export function filterEmployeesForCycle(
  employees: ParEmployee[],
  searchTerm: string,
  selfEmail: string | undefined,
  scope: { legacyCycleName: string; legacyHistoryByEmail: ParLegacyHistoryByEmail } | { participantEmails: Set<string> } | null,
  selectedEmployee?: ParEmployee | null,
): ParEmployee[] {
  const inScope = (email: string): boolean => {
    if (!scope) return true;
    if ("legacyCycleName" in scope) {
      return (scope.legacyHistoryByEmail[email] ?? []).some((record) => record.cycleName === scope.legacyCycleName);
    }
    return scope.participantEmails.has(email);
  };

  const inScopeEmployees = employees.filter((employee) => employee.workEmail !== selfEmail && inScope(employee.workEmail));

  // "All Employees" was picked from the dropdown itself, not typed —
  // filtering against that literal label would return nothing.
  if (searchTerm === ALL_EMPLOYEES_OPTION.employeeName) {
    return inScopeEmployees;
  }

  // MUI Autocomplete resets inputValue to the selected option's own label on
  // selection — filtering literally against that string would then match
  // nothing. EmployeeHistoryView.tsx's own filteredEmployees special-cases
  // this exact string back to the unfiltered (in-scope) list.
  if (selectedEmployee && searchTerm === `${selectedEmployee.employeeName} (${selectedEmployee.workEmail})`) {
    return inScopeEmployees;
  }

  const term = searchTerm.toLowerCase();
  return inScopeEmployees.filter(
    (employee) => employee.employeeName.toLowerCase().includes(term) || employee.workEmail.toLowerCase().includes(term),
  );
}

export interface EmployeeCycleRating {
  rating: string | null;
  special: string | null;
  hasRecord: boolean;
  isLoading: boolean;
  // A fetch failure (403/500/...), distinct from "no record" (404) — the
  // row can't tell those apart from hasRecord alone, so callers need to
  // show this as its own state rather than a silent "No record".
  isError: boolean;
}

// One row's rating in ParLeadEmployeeHistoryTab.tsx's "all employees" table.
// "NOT_ASSIGNED" reads as no rating everywhere else it's shown, so it's
// normalized to null here too.
export function resolveEmployeeCycleRating(
  employee: ParEmployee,
  isRealCycle: boolean,
  legacyCycleName: string | undefined,
  legacyByEmail: ParLegacyHistoryByEmail,
  ratingByEmail: ParRatingByEmail,
  isRatingLoadingByEmail: Record<string, boolean>,
  isRatingErrorByEmail: Record<string, boolean>,
): EmployeeCycleRating {
  if (isRealCycle) {
    const record = ratingByEmail[employee.workEmail];
    return {
      rating: record?.parRating && record.parRating !== "NOT_ASSIGNED" ? record.parRating : null,
      special: record?.parSpecialRating && record.parSpecialRating !== "NOT_ASSIGNED" ? record.parSpecialRating : null,
      hasRecord: Boolean(record),
      isLoading: isRatingLoadingByEmail[employee.workEmail] ?? false,
      isError: isRatingErrorByEmail[employee.workEmail] ?? false,
    };
  }
  const record = legacyCycleName
    ? legacyByEmail[employee.workEmail]?.find((r) => r.cycleName === legacyCycleName)
    : undefined;
  if (!record) return { rating: null, special: null, hasRecord: false, isLoading: false, isError: false };
  const derived = deriveLegacyRatingFromScore(record.managerScoreCode);
  const rating = record.overallRating ?? derived.rating;
  const special = record.overallSpecialRating ?? derived.special;
  return {
    rating: rating && rating !== "NOT_ASSIGNED" ? rating : null,
    special: special && special !== "NOT_ASSIGNED" ? special : null,
    hasRecord: true,
    isLoading: false,
    isError: false,
  };
}

// A current report may have moved teams since a past cycle — restores the
// scoping the old participants?leadEmail= fetch enforced, checked against
// data already fetched for the table. A still-loading or absent record
// stays visible.
export function filterOwnedByLead(
  employees: ParEmployee[],
  ratingByEmail: ParRatingByEmail,
  callerEmail: string | undefined,
): ParEmployee[] {
  return employees.filter((employee) => {
    const record = ratingByEmail[employee.workEmail];
    return !record || record.parLeadEmail === callerEmail;
  });
}
