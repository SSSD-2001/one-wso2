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

import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, authedPost } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import {
  financeMasterDataServiceUrls,
  isFinanceMasterDataBackendConfigured,
} from "@config/apiConfig";
import { financeRetry } from "../util/financeError";
import {
  MASTER_DATA_ENDPOINTS,
  type EmployeeEmail,
  type ExpenseType,
  type ExpenseTypeAutoComplete,
  type ExpenseTypeFilter,
  type GlCode,
  type MasterDataRowFor,
  type MasterDataTab,
} from "./masterDataTypes";

export { isFinanceMasterDataBackendConfigured };

/**
 * Reference data, not personal data.
 *
 * Unlike the CC and OPD queries these are not scoped to the signed-in user —
 * every reader of this app sees the same subsidiaries and the same GL codes,
 * so there is nothing per-user to key the cache on and no cross-account
 * leak to guard against. The backend still authorises the request; it just
 * does not vary the answer.
 */
const REFERENCE_STALE_TIME = 5 * 60 * 1000;

/**
 * One tab's rows.
 *
 * Three of the four are a plain GET. Expense types go through a POST filter
 * instead, because the table is large enough that the screen asks the reader
 * to narrow it before showing anything — see `useExpenseTypes` below, which
 * is the hook that screen actually uses.
 */
export function useMasterDataList<T extends Exclude<MasterDataTab, "expenseTypes">>(tab: T) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const configured = isFinanceMasterDataBackendConfigured();

  return useQuery<MasterDataRowFor[T][]>({
    queryKey: ["finance-master-data", tab],
    enabled: isSignedIn && configured,
    queryFn: async () =>
      authedGet<MasterDataRowFor[T][]>(
        financeMasterDataServiceUrls.collection(MASTER_DATA_ENDPOINTS[tab]),
        await getAccessToken(),
      ),
    staleTime: REFERENCE_STALE_TIME,
    retry: financeRetry,
  });
}

/**
 * Expense types matching a filter — POST `search-expense-types`.
 *
 * `enabled` is the caller's, not derived: the page shows an empty
 * "Please select filters" state until Apply Filters is pressed for the
 * first time, and fires nothing before that. Passing `false` is how the
 * page holds that state without this hook needing to know about it.
 */
export function useExpenseTypes(filters: ExpenseTypeFilter, enabled: boolean) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const configured = isFinanceMasterDataBackendConfigured();

  return useQuery<ExpenseType[]>({
    // The filter object is part of the key, so going back to a previous set
    // of filters is served from cache instead of re-queried.
    queryKey: ["finance-master-data", "expenseTypes", filters],
    enabled: enabled && isSignedIn && configured,
    queryFn: async () => {
      // `authedPost` widens to `T | null` for the endpoints that answer 201
      // with no body. This one always returns rows, and an absent body here
      // means no matches — an empty table, not a failed query.
      const rows = await authedPost<ExpenseType[]>(
        financeMasterDataServiceUrls.searchExpenseTypes,
        await getAccessToken(),
        filters,
      );
      return rows ?? [];
    },
    staleTime: REFERENCE_STALE_TIME,
    retry: financeRetry,
  });
}

/**
 * The GL codes the department form's dropdown offers.
 *
 * Fetched by the page rather than by the dialog. The source loads it inside
 * `DepartmentFormContent` on mount and shows a spinner over the whole dialog
 * until it lands, so opening the form is a wait every single time; React
 * Query caches it across opens, which is the same request made once.
 */
export function useGlCodes(enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const configured = isFinanceMasterDataBackendConfigured();

  return useQuery<GlCode[]>({
    queryKey: ["finance-master-data", "gl-codes"],
    enabled: enabled && isSignedIn && configured,
    queryFn: async () =>
      authedGet<GlCode[]>(financeMasterDataServiceUrls.glCodes, await getAccessToken()),
    staleTime: 30 * 60 * 1000,
    retry: financeRetry,
  });
}

/** Work emails, for the card form's Employee and Lead pickers. */
export function useEmployeeEmails(enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const configured = isFinanceMasterDataBackendConfigured();

  return useQuery<string[]>({
    queryKey: ["finance-master-data", "employee-emails"],
    enabled: enabled && isSignedIn && configured,
    queryFn: async () => {
      const rows = await authedGet<EmployeeEmail[]>(
        financeMasterDataServiceUrls.employeeEmails,
        await getAccessToken(),
      );
      return (rows ?? []).map((r) => r.workEmail);
    },
    staleTime: 30 * 60 * 1000,
    retry: financeRetry,
  });
}

/**
 * The option lists behind the expense-type filters AND that tab's form.
 *
 * One request serves both, so the category and GL-code pickers inside the
 * dialog are populated from the same payload that fills the filter bar.
 */
export function useExpenseTypeAutoComplete(enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const configured = isFinanceMasterDataBackendConfigured();

  return useQuery<ExpenseTypeAutoComplete>({
    queryKey: ["finance-master-data", "expense-type-autocomplete"],
    enabled: enabled && isSignedIn && configured,
    queryFn: async () =>
      authedGet<ExpenseTypeAutoComplete>(
        financeMasterDataServiceUrls.expenseTypeAutocomplete,
        await getAccessToken(),
      ),
    staleTime: 30 * 60 * 1000,
    retry: financeRetry,
  });
}
