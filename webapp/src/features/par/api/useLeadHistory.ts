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

import { useQueries, useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, defaultQueryRetry, HttpError } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { parBackendUrl, parServiceUrls } from "@config/apiConfig";
import { digiopsHeaders } from "@features/my/util/digiopsHeaders";
import type { Par360Review, ParCycle, ParEmployee, ParLegacyHistory, ParRating } from "./types";

// GET the lead's own direct reports — EmployeeHistoryView.tsx's own
// fetchEntityEmployees. Org-chart data, not tied to any PAR cycle: this is
// what the employee picker is scoped to before/alongside cycle selection.
export function useParLeadEmployees(leadEmail: string | undefined) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const backendConfigured = Boolean(parBackendUrl);
  return useQuery<ParEmployee[]>({
    queryKey: ["par-lead-employees", leadEmail],
    enabled: isSignedIn && backendConfigured && Boolean(leadEmail),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ParEmployee[]>(parServiceUrls.parLeadEmployees(leadEmail!), accessToken, digiopsHeaders());
    },
    staleTime: 10 * 60 * 1000,
    retry: defaultQueryRetry,
  });
}

// GET every closed cycle org-wide (not scoped to the caller's own
// participation) — EmployeeHistoryView.tsx's own fetchClosedParCycles,
// widening the cycle picker beyond just cycles the lead personally has a
// record in.
export function useAllClosedParCycles() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const backendConfigured = Boolean(parBackendUrl);
  return useQuery<ParCycle[]>({
    queryKey: ["par-all-closed-cycles"],
    enabled: isSignedIn && backendConfigured,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ParCycle[]>(parServiceUrls.parAllClosedCycles(), accessToken, digiopsHeaders());
    },
    staleTime: 10 * 60 * 1000,
    retry: defaultQueryRetry,
  });
}

// GET every review ABOUT one employee for one cycle (reviewer, rating,
// comment, status) — EmployeeHistoryView.tsx's own fetchReviews, read by
// the 360 feedback section.
export function useParEmployeeReviews(parCycleId: number | undefined, employeeEmail: string | undefined) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const backendConfigured = Boolean(parBackendUrl);
  return useQuery<Par360Review[]>({
    queryKey: ["par-employee-reviews", parCycleId, employeeEmail],
    enabled: isSignedIn && backendConfigured && Boolean(parCycleId) && Boolean(employeeEmail),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<Par360Review[]>(
        parServiceUrls.parEmployeeReviews(parCycleId!, employeeEmail!),
        accessToken,
        digiopsHeaders(),
      );
    },
    staleTime: 60 * 1000,
    retry: defaultQueryRetry,
  });
}

// GET one employee's pre-migration legacy history — EmployeeHistoryView.tsx's
// own fetchLegacyParHistoryOfEmployee.
export function useParLegacyHistory(employeeEmail: string | undefined, enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const backendConfigured = Boolean(parBackendUrl);
  return useQuery<ParLegacyHistory[]>({
    queryKey: ["par-legacy-history", employeeEmail],
    enabled: enabled && isSignedIn && backendConfigured && Boolean(employeeEmail),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ParLegacyHistory[]>(
        parServiceUrls.parLegacyHistory(employeeEmail!),
        accessToken,
        digiopsHeaders(),
      );
    },
    staleTime: 10 * 60 * 1000,
    retry: defaultQueryRetry,
  });
}

/** One report's legacy history, keyed by email. */
export interface ParLegacyHistoryByEmail {
  [workEmail: string]: ParLegacyHistory[] | undefined;
}

// Fans useParLegacyHistory out across every one of the lead's reports at
// once — EmployeeHistoryView.tsx's own fan-out effect (see the comment on
// the type above): there's no lead-scoped "every legacy cycle" endpoint (the
// org-wide one is admin-only), so the merged cycle picker instead comes from
// calling the same per-employee, lead-authorized endpoint once per report.
// `useQueries` keeps each fetch independently cached/retried, and results
// merge here into one lookup so the caller doesn't juggle N query objects.
export function useParLegacyHistoryFanOut(emails: string[]): {
  byEmail: ParLegacyHistoryByEmail;
  isLoading: boolean;
  isLoadingByEmail: Record<string, boolean>;
} {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const backendConfigured = Boolean(parBackendUrl);
  const results = useQueries({
    queries: emails.map((email) => ({
      queryKey: ["par-legacy-history", email],
      enabled: isSignedIn && backendConfigured && Boolean(email),
      queryFn: async () => {
        const accessToken = await getAccessToken();
        return authedGet<ParLegacyHistory[]>(parServiceUrls.parLegacyHistory(email), accessToken, digiopsHeaders());
      },
      staleTime: 10 * 60 * 1000,
      retry: defaultQueryRetry,
    })),
  });

  const byEmail: ParLegacyHistoryByEmail = {};
  const isLoadingByEmail: Record<string, boolean> = {};
  results.forEach((result, index) => {
    byEmail[emails[index]] = result.data;
    isLoadingByEmail[emails[index]] = result.isLoading;
  });
  return { byEmail, isLoading: results.some((r) => r.isLoading), isLoadingByEmail };
}

/** One report's rating for one real cycle, keyed by email. `undefined`
 * means still loading; `null` means no record exists for that cycle. */
export interface ParRatingByEmail {
  [workEmail: string]: ParRating | null | undefined;
}

// Same fan-out shape as useParLegacyHistoryFanOut — no bulk "every report's
// rating" endpoint exists, so this calls useParRating's own query once per
// report, sharing its exact key so picking one afterwards hits the cache.
export function useParRatingFanOut(parCycleId: number | undefined, emails: string[]): {
  byEmail: ParRatingByEmail;
  isLoadingByEmail: Record<string, boolean>;
  isErrorByEmail: Record<string, boolean>;
  refetchByEmail: Record<string, () => void>;
} {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const backendConfigured = Boolean(parBackendUrl);
  const results = useQueries({
    queries: emails.map((email) => ({
      queryKey: ["par-rating", parCycleId, email],
      enabled: isSignedIn && backendConfigured && Boolean(parCycleId) && Boolean(email),
      queryFn: async () => {
        const accessToken = await getAccessToken();
        try {
          return await authedGet<ParRating>(parServiceUrls.parRating(parCycleId!, email), accessToken, digiopsHeaders());
        } catch (e) {
          // Backend returns 404 when there's no rating record yet — a
          // valid "no data" case, same as useParRating's own handling.
          if (e instanceof HttpError && e.status === 404) return null;
          throw e;
        }
      },
      staleTime: 5 * 60 * 1000,
      retry: defaultQueryRetry,
    })),
  });

  const byEmail: ParRatingByEmail = {};
  const isLoadingByEmail: Record<string, boolean> = {};
  const isErrorByEmail: Record<string, boolean> = {};
  const refetchByEmail: Record<string, () => void> = {};
  results.forEach((result, index) => {
    byEmail[emails[index]] = result.data;
    isLoadingByEmail[emails[index]] = result.isLoading;
    isErrorByEmail[emails[index]] = result.isError;
    refetchByEmail[emails[index]] = () => void result.refetch();
  });
  return { byEmail, isLoadingByEmail, isErrorByEmail, refetchByEmail };
}
