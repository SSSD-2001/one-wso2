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
import { authedGet, defaultQueryRetry } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { bankingBackendUrl, bankingServiceUrls } from "@config/apiConfig";
import type { BankAccountsResponse, ReportFilters } from "./types";

// GET /employee/accounts with the Report tab's admin filters. `filters` is
// `undefined` until the admin presses Search, so nothing is fetched before
// then. Keyed on the filters object itself (only replaced when Search is
// pressed again, not on every keystroke), so typing in the filter controls
// doesn't refetch until the admin asks for it.
export function useReportAccounts(filters: ReportFilters | undefined) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const backendConfigured = Boolean(bankingBackendUrl);
  return useQuery<BankAccountsResponse>({
    queryKey: ["banking-admin", "report-accounts", filters],
    enabled: Boolean(filters) && isSignedIn && backendConfigured,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<BankAccountsResponse>(bankingServiceUrls.reportAccounts(filters!), accessToken);
    },
    retry: defaultQueryRetry,
  });
}
