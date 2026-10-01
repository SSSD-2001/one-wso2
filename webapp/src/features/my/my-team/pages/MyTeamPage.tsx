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
import { useEffect, useState } from "react";
import { Alert, Box, Skeleton } from "@wso2/oxygen-ui";
import PerspectiveHeader from "@components/perspective-header/PerspectiveHeader";
import { useUserInfo } from "@api/useUserInfo";
import { capabilitiesFromPrivileges } from "@constants/appMenu";
import { useOrgReference, type OrgSelection } from "../../api/useOrgReference";
import { useTeamSearch } from "../api/useTeamSearch";
import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  PAGE_SIZE,
  buildSearchPayload,
  clearDependentFilters,
  filterKeyOf,
  hasAnyFilter,
  validateSearchInput,
  type AppliedFilters,
  type SortableField,
} from "../util/teamSearch";
import MyTeamTable from "../components/MyTeamTable";
import TeamFilterBar from "../components/TeamFilterBar";
import TeamFilterDialog from "../components/TeamFilterDialog";
import type { EmployeeSort } from "../../api/types";
import ErrorNotice from "@components/error-notice/ErrorNotice";

// My Team — a lead's reporting chain.
//
// Ported from people-app.
//
// Two things worth knowing at this level:
//
//  - The page is never told who the user is. `leadOnly: true` in the payload
//    makes the server resolve the caller from the token and restrict to their
//    subtree, so the scope cannot be widened from the client.
//  - The current page is DERIVED from a key over everything else. When filters,
//    search, sort or page size change, the key changes and the page falls back
//    to 1 on its own — no reset effects, and no way to forget one.
export default function MyTeamPage() {
  const { data, isLoading, isError, error, isFetching, refetch } = useUserInfo();

  if (isLoading) {
    return <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1.5 }} />;
  }

  // A failed user-info fetch must not silently read as "not a lead" — that
  // hides a real, retryable error behind a message implying it's permanent.
  if (isError) {
    return (
      <ErrorNotice error={error} onRetry={() => refetch()} retrying={isFetching}>
        Couldn&apos;t check your access to My Team.
      </ErrorNotice>
    );
  }

  const caps = capabilitiesFromPrivileges(data?.privileges);
  if (!caps.has("lead")) {
    return <Alert severity="info">My Team is available to leads.</Alert>;
  }

  return <TeamRoster />;
}

/** The screen itself, once we know the caller is a lead. */
function TeamRoster() {
  const [applied, setApplied] = useState<AppliedFilters>(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<EmployeeSort>(DEFAULT_SORT);
  const [dialogOpen, setDialogOpen] = useState(false);
  // Nothing is fetched for the filter lists until the dialog has been opened
  // once. Someone who never filters makes zero reference requests.
  const [referenceWanted, setReferenceWanted] = useState(false);
  // Follows the dialog's draft so the dependent lists narrow while editing.
  const [selection, setSelection] = useState<OrgSelection>(toSelection(DEFAULT_FILTERS));

  const searchProblem = validateSearchInput(searchInput);

  // Debounced, and only ever committing input the server would accept.
  useEffect(() => {
    if (searchProblem !== null) return;
    const id = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput, searchProblem]);

  // The page is derived, not reset. Changing anything in the key drops to 1.
  const filterKey = filterKeyOf({ filters: applied, searchQuery, sort, pageSize: PAGE_SIZE });
  const [paging, setPaging] = useState({ key: filterKey, page: 1 });
  const page = paging.key === filterKey ? paging.page : 1;
  const setPage = (next: number) => setPaging({ key: filterKey, page: next });

  const reference = useOrgReference(selection, referenceWanted);

  const payload = buildSearchPayload({ filters: applied, searchQuery, sort, page });
  const list = useTeamSearch(payload);

  // A second, unfiltered count so "Total" means the size of the team rather
  // than whatever was on screen when a filter was first applied — which is what
  // the source app's frozen chip actually showed. Only asked for when something
  // is filtering, and only one row deep since only the count is wanted.
  const filtering = hasAnyFilter(applied, searchQuery);
  const baseline = useTeamSearch(
    buildSearchPayload({ filters: DEFAULT_FILTERS, searchQuery: "", sort: DEFAULT_SORT, page: 1, pageSize: 1 }),
    filtering,
  );

  const total = filtering ? baseline.data?.totalCount : list.data?.totalCount;

  const applyFilters = (next: AppliedFilters) => {
    setApplied(next);
    setSelection(toSelection(next));
    setDialogOpen(false);
  };

  // Cancel has to undo the narrowing the abandoned draft caused. The dialog
  // reports every edit upward so the dependent lists narrow while you type, and
  // `selection` is what `useOrgReference` above is keyed on — so closing without
  // applying used to leave those lists filtered by choices that were thrown
  // away. Reopening then showed an empty Business Unit beside a Team list still
  // restricted to it, reading as "Nothing under the selected Business Unit"
  // with nothing selected and no way to widen it again.
  const closeFilters = () => {
    setSelection(toSelection(applied));
    setDialogOpen(false);
  };

  const removeChip = (key: keyof AppliedFilters) => {
    // Reverting one chip means restoring that field's default, which for a
    // parent also clears the children that no longer apply.
    applyFilters(clearDependentFilters(applied, key, DEFAULT_FILTERS[key]));
  };

  const clearFilters = () => {
    setApplied(DEFAULT_FILTERS);
    setSelection(toSelection(DEFAULT_FILTERS));
    // Deliberately keeps the search text, matching the source.
  };

  const onSort = (field: SortableField) => {
    setSort((prev) =>
      prev.sortField === field
        ? { sortField: field, sortOrder: prev.sortOrder === "ASC" ? "DESC" : "ASC" }
        : // A different column always starts ascending rather than inheriting.
          { sortField: field, sortOrder: "ASC" },
    );
  };

  return (
    <Box>
      <PerspectiveHeader
        eyebrow="My Team"
        title="My Team"
        subtitle="Your direct and indirect reports."
      />

      <TeamFilterBar
        filters={applied}
        reference={reference}
        search={searchInput}
        searchProblem={searchProblem}
        total={total}
        filtered={filtering ? list.data?.totalCount : undefined}
        isTotalLoading={filtering ? baseline.isLoading : list.isLoading}
        onSearchChange={setSearchInput}
        onToggleDirectReports={(value) => applyFilters({ ...applied, directReports: value })}
        onOpenFilters={() => {
          setReferenceWanted(true);
          setDialogOpen(true);
        }}
        onRemoveChip={removeChip}
        onClearFilters={clearFilters}
      />

      {list.isError ? (
        <ErrorNotice error={list.error} onRetry={() => list.refetch()}>
          Couldn&apos;t load your team.
        </ErrorNotice>
      ) : list.isLoading ? (
        <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 1.5 }} />
      ) : (
        <MyTeamTable
          employees={list.data?.employees ?? []}
          total={list.data?.totalCount ?? 0}
          page={page}
          pageSize={PAGE_SIZE}
          sort={sort}
          isFetching={list.isFetching}
          hasFilters={filtering}
          onSort={onSort}
          onPageChange={setPage}
          onClearFilters={clearFilters}
        />
      )}

      {/* Mounted only while open, which is what seeds the draft exactly once per
          open — the conditional mount alone, with no `key`. A `key={filterKey}`
          here did the opposite of what it claimed: `filterKey` carries the
          300ms-debounced search text, so typing and then opening the dialog
          inside that window let the timer fire while it was open, changing the
          key, remounting the dialog and resetting the draft to `applied` — and
          any selection already made was lost. */}
      {dialogOpen && (
        <TeamFilterDialog
          initial={applied}
          reference={reference}
          onSelectionChange={(draft) => setSelection(toSelection(draft))}
          onApply={applyFilters}
          onClose={closeFilters}
        />
      )}
    </Box>
  );
}

function toSelection(filters: AppliedFilters): OrgSelection {
  return {
    businessUnitId: filters.businessUnitId,
    teamId: filters.teamId,
    subTeamId: filters.subTeamId,
    careerFunctionId: filters.careerFunctionId,
    companyId: filters.companyId,
  };
}
