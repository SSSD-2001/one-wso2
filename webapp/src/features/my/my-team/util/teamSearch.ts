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
// The pure core of the My Team screen: filter state, payload building, and the
// derived keys that keep paging honest.
//
// Nothing here touches React, the network, or the clock. That is the point —
// these are the screen's rules, and they are the part worth testing.

import type {
  EmployeeFilters,
  EmployeeSearchPayload,
  EmployeeSort,
  EmployeeStatusFilter,
} from "../../api/types";

/**
 * Applied filter state.
 *
 * TOTAL by design — every field is present, `null` meaning "not set", and the
 * two switches always real booleans. The source app stored "exclude future
 * joiners: off" as absent, which made it invisible to the filter count and the
 * chip row while still changing the result. With a total type that state cannot
 * be represented. `buildSearchPayload` is the single place `null` becomes
 * "omit the key".
 */
export interface AppliedFilters {
  businessUnitId: number | null;
  teamId: number | null;
  subTeamId: number | null;
  unitId: number | null;
  careerFunctionId: number | null;
  designationId: number | null;
  companyId: number | null;
  officeId: number | null;
  employmentTypeId: number | null;
  managerEmail: string | null;
  gender: string | null;
  /** Empty array is meaningful: it removes the status predicate entirely. */
  employeeStatuses: EmployeeStatusFilter[];
  directReports: boolean;
  excludeFutureStartDate: boolean;
}

/** The state the screen opens in, and what "Clear all" returns to. */
export const DEFAULT_FILTERS: AppliedFilters = {
  businessUnitId: null,
  teamId: null,
  subTeamId: null,
  unitId: null,
  careerFunctionId: null,
  designationId: null,
  companyId: null,
  officeId: null,
  employmentTypeId: null,
  managerEmail: null,
  gender: null,
  // Hides people who have left, matching the source's default.
  employeeStatuses: ["Active", "Marked leaver"],
  directReports: false,
  excludeFutureStartDate: true,
};

export const DEFAULT_SORT: EmployeeSort = { sortField: "employeeId", sortOrder: "ASC" };

/** Fixed, as every table in this app is. */
export const PAGE_SIZE = 25;

/** Server limits, from the backend's Pagination record. */
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;

/** Mirrors the backend's own constraints on the search string. */
const SEARCH_MAX_LENGTH = 100;
const SEARCH_PATTERN = /^[\p{L}\p{M}0-9\s@._'+-]*$/u;

/**
 * The only sort fields the server accepts. Anything else is a 400.
 *
 * Taken from people-app's `EmployeeSortField` map. The source app renders a
 * column (External Designation) that is absent here and leaves its header
 * clickable, so clicking it fails — which is why this list exists and why
 * buildSearchPayload validates against it.
 */
export const SORTABLE_FIELDS = [
  "employeeId",
  "firstName",
  "lastName",
  "fullName",
  "workEmail",
  "startDate",
  "employeeStatus",
  "employmentType",
  "designation",
  "businessUnit",
  "team",
  "company",
] as const;

export type SortableField = (typeof SORTABLE_FIELDS)[number];

export function isSortableField(value: string): value is SortableField {
  return (SORTABLE_FIELDS as readonly string[]).includes(value);
}

/** Which filters a given parent invalidates when it changes. */
const DEPENDENTS: Partial<Record<keyof AppliedFilters, (keyof AppliedFilters)[]>> = {
  businessUnitId: ["teamId", "subTeamId", "unitId"],
  teamId: ["subTeamId", "unitId"],
  subTeamId: ["unitId"],
  careerFunctionId: ["designationId"],
  companyId: ["officeId"],
};

/**
 * Set one filter, clearing anything below it that no longer applies.
 *
 * Setting the same value again is a no-op, so re-picking your current Business
 * Unit does not silently wipe the Team you just chose.
 */
export function clearDependentFilters<K extends keyof AppliedFilters>(
  filters: AppliedFilters,
  key: K,
  value: AppliedFilters[K],
): AppliedFilters {
  if (filters[key] === value) return filters;
  const next: AppliedFilters = { ...filters, [key]: value };
  for (const dependent of DEPENDENTS[key] ?? []) {
    (next[dependent] as number | null) = null;
  }
  return next;
}

/** How many filters differ from the default — drives the badge and the chip row. */
export function activeFilterCount(filters: AppliedFilters): number {
  let count = 0;
  for (const key of Object.keys(DEFAULT_FILTERS) as (keyof AppliedFilters)[]) {
    if (key === "employeeStatuses") {
      if (!sameStatuses(filters.employeeStatuses, DEFAULT_FILTERS.employeeStatuses)) count += 1;
      continue;
    }
    if (filters[key] !== DEFAULT_FILTERS[key]) count += 1;
  }
  return count;
}

function sameStatuses(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((v, i) => v === right[i]);
}

/**
 * A stable identity for "everything except which page you are on".
 *
 * The page is DERIVED from this rather than reset by an effect: when the key
 * changes, the page falls back to 1 on its own. Sort and page size are included
 * on purpose — the source app reset the page for filters but not for page size,
 * which is how a high page plus a larger size could request rows past the end.
 *
 * Canonicalised so equivalent states produce equal keys: object keys sorted, and
 * statuses sorted so reordering chips does not throw you back to page 1.
 */
export function filterKeyOf(args: {
  filters: AppliedFilters;
  searchQuery: string;
  sort: EmployeeSort;
  pageSize: number;
}): string {
  const { filters, searchQuery, sort, pageSize } = args;
  const canonical = Object.keys(filters)
    .sort()
    .map((key) => {
      const value = filters[key as keyof AppliedFilters];
      return [key, key === "employeeStatuses" ? [...(value as string[])].sort() : value];
    });
  return JSON.stringify([canonical, searchQuery.trim(), sort.sortField, sort.sortOrder, pageSize]);
}

/** Whether anything at all is narrowing the list. */
export function hasAnyFilter(filters: AppliedFilters, searchQuery: string): boolean {
  return activeFilterCount(filters) > 0 || searchQuery.trim().length > 0;
}

export type SearchInputProblem = "length" | "format" | null;

/**
 * Validate against the server's own constraints, so an invalid search never
 * becomes a request. The source app silently swallowed the offending keystroke,
 * leaving no way to tell why the field would not accept it.
 */
export function validateSearchInput(value: string): SearchInputProblem {
  if (value.length > SEARCH_MAX_LENGTH) return "length";
  if (!SEARCH_PATTERN.test(value)) return "format";
  return null;
}

/** Build the request body. The only place `null` becomes an absent key. */
export function buildSearchPayload(args: {
  filters: AppliedFilters;
  searchQuery: string;
  sort: EmployeeSort;
  page: number;
  pageSize?: number;
}): EmployeeSearchPayload {
  const { filters, searchQuery, sort } = args;
  const pageSize = clamp(args.pageSize ?? PAGE_SIZE, MIN_LIMIT, MAX_LIMIT);
  const page = Math.max(1, Math.trunc(args.page) || 1);

  const wire: EmployeeFilters = {
    // Always sent, always real booleans — see the note on AppliedFilters.
    directReports: filters.directReports,
    excludeFutureStartDate: filters.excludeFutureStartDate,
  };
  if (filters.businessUnitId !== null) wire.businessUnitId = filters.businessUnitId;
  if (filters.teamId !== null) wire.teamId = filters.teamId;
  if (filters.subTeamId !== null) wire.subTeamId = filters.subTeamId;
  if (filters.unitId !== null) wire.unitId = filters.unitId;
  if (filters.careerFunctionId !== null) wire.careerFunctionId = filters.careerFunctionId;
  if (filters.designationId !== null) wire.designationId = filters.designationId;
  if (filters.companyId !== null) wire.companyId = filters.companyId;
  if (filters.officeId !== null) wire.officeId = filters.officeId;
  if (filters.employmentTypeId !== null) wire.employmentTypeId = filters.employmentTypeId;
  if (filters.managerEmail !== null) wire.managerEmail = filters.managerEmail;
  if (filters.gender !== null) wire.gender = filters.gender;
  // An empty array is a deliberate "no status predicate", so it is sent as-is.
  wire.employeeStatuses = [...filters.employeeStatuses];

  const trimmed = searchQuery.trim();

  return {
    filters: wire,
    pagination: { limit: pageSize, offset: (page - 1) * pageSize },
    // Defence in depth: even if a column spec is edited badly, or a sort is
    // restored from a URL later, a field the server would reject cannot leave
    // here.
    sort: {
      sortField: isSortableField(sort.sortField) ? sort.sortField : DEFAULT_SORT.sortField,
      sortOrder: sort.sortOrder === "DESC" ? "DESC" : "ASC",
    },
    leadOnly: true,
    ...(trimmed ? { searchString: trimmed } : {}),
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.trunc(value), min), max);
}

/**
 * "7 Mar 2021", or "-".
 *
 * Parsed by components rather than by `new Date("YYYY-MM-DD")`, which is read as
 * UTC midnight and renders as the previous day in any negative offset.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatStartDate(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "-";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (!m) return "-";
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const name = MONTHS[month - 1];
  if (!name) return "-";
  // The day was previously unchecked, so "2021-02-31" rendered as "31 Feb 2021"
  // and "…-00" as "0 Feb 2021" — a date presented as fact that cannot exist.
  // Round-tripping through Date is what catches it: Date rolls overflow forward
  // instead of rejecting it, so comparing the parts back is the actual test.
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return "-";
  }
  return `${day} ${name} ${year}`;
}
