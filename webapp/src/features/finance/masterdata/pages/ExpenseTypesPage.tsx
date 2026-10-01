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
import { Box, Collapse, ToggleButton, Typography } from "@wso2/oxygen-ui";
import { FilterIcon, ListFilterIcon } from "@wso2/oxygen-ui-icons-react";
import { useNotifications } from "@context/notifications/NotificationsContext";
import ExpenseTypeFilters from "../ExpenseTypeFilters";
import MasterDataScreen from "../MasterDataScreen";
import { MASTER_DATA_SNACK } from "../masterDataCopy";
import { useExpenseTypeAutoComplete, useExpenseTypes } from "../useMasterData";
import type { ExpenseTypeFilter } from "../masterDataTypes";

/**
 * The expense-type catalogue — `pages/ExpenseTypes.tsx`.
 *
 * The one tab whose rows come from a POST filter rather than a GET, and so
 * the one that shows nothing until a filter has been applied
 * (`CustomTable.tsx:236-254`). That is not an empty table: it is the screen
 * saying it has not asked yet.
 *
 * Two filter objects, not one. `draft` is what the bar is editing; `applied`
 * is what the table is showing. Without the split, every keystroke in the
 * filter bar would be a new query key and a new request — the source avoids
 * that with an explicit Apply, and so does this.
 */
export default function ExpenseTypesPage() {
  const [showFilters, setShowFilters] = useState(true);
  const [draft, setDraft] = useState<ExpenseTypeFilter>({});
  const [applied, setApplied] = useState<ExpenseTypeFilter | null>(null);

  const options = useExpenseTypeAutoComplete();
  // `applied === null` before the first Apply, which is what holds the query
  // back — the hook is mounted but disabled, so nothing is requested.
  const query = useExpenseTypes(applied ?? {}, applied !== null);
  const { showError } = useNotifications();

  // CustomTable.tsx:54-59 — the option lists failing is its own message,
  // separate from the rows failing, because it leaves the filter bar empty
  // while the table may still be fine.
  useEffect(() => {
    if (options.isError) showError(MASTER_DATA_SNACK.error.autoComplete);
  }, [options.isError, showError]);

  const hasApplied = applied !== null;

  return (
    <MasterDataScreen
      tab="expenseTypes"
      rows={hasApplied ? (query.data ?? []) : []}
      loading={hasApplied && query.isLoading}
      error={hasApplied && query.isError ? query.error : undefined}
      onRetry={() => void query.refetch()}
      autoComplete={options.data}
      showTable={hasApplied}
      toolbar={
        <ToggleButton
          value="filters"
          size="small"
          selected={showFilters}
          onChange={() => setShowFilters((v) => !v)}
          sx={{ textTransform: "none", gap: 0.75, px: 1.5 }}
        >
          <FilterIcon size={16} />
          {showFilters ? "Hide Filters" : "Show Filters"}
        </ToggleButton>
      }
    >
      <Collapse in={showFilters} unmountOnExit>
        <ExpenseTypeFilters
          draft={draft}
          options={options.data}
          optionsLoading={options.isLoading}
          busy={query.isFetching}
          onChange={setDraft}
          onApply={() => setApplied(draft)}
          onClear={() => setDraft({})}
        />
      </Collapse>

      {/* Stands in for the table until the first Apply. Rendered here rather
          than by the screen because it is the only tab that has this state. */}
      {!hasApplied && <SelectFiltersFirst />}
    </MasterDataScreen>
  );
}

/**
 * `CustomTable.tsx:243-253` — the empty state before any filter is applied.
 *
 * The source centres an illustration above the line. An icon stands in for
 * it: the drawing is an asset of the old app, and the sentence is what does
 * the work.
 */
function SelectFiltersFirst() {
  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 280,
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1.5,
        p: 3,
        textAlign: "center",
      }}
    >
      <ListFilterIcon size={44} opacity={0.35} />
      <Typography sx={{ fontSize: 18, fontWeight: 500, color: "text.secondary" }}>
        Please select filters
      </Typography>
    </Box>
  );
}
