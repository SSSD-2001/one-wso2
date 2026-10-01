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

// Reads the people-app backend's employee directory (GET
// /employees/basic-info) — every Active and Marked
// leaver employee, each row carrying its own managerEmail. This is now Org
// Chart's only data source: the standalone org-chart backend this feature
// originally targeted isn't available, and this endpoint's flat, complete
// shape is a better fit anyway — the whole tree builds client-side
// from one response (see util/buildOrgTree.ts) instead of a fetch per
// manager.

import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, defaultQueryRetry, HttpError } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { peopleBackendUrl, peopleServiceUrls } from "@config/apiConfig";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import type { EmployeeDirectoryRecord } from "./orgChartTypes";

export function isOrgChartConfigured(): boolean {
  return Boolean(peopleBackendUrl);
}

// A 403 is a settled "you're not in the authorised group", not a transient
// failure — matches the backend's all-or-nothing access model.
function directoryRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof HttpError && error.status === 403) return false;
  return defaultQueryRetry(failureCount, error);
}

/** The full employee directory — Org Chart's only fetch. */
export function useEmployeeDirectory() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;

  const query = useQuery<EmployeeDirectoryRecord[]>({
    queryKey: ["org-chart", "employee-directory", userSub],
    enabled: isSignedIn && Boolean(peopleBackendUrl) && Boolean(userSub),
    queryFn: async () =>
      authedGet<EmployeeDirectoryRecord[]>(peopleServiceUrls.employeesBasicInfo, await getAccessToken()),
    staleTime: 5 * 60 * 1000,
    retry: directoryRetry,
  });

  return foldIdentityError(query, subState, retryIdentity);
}
