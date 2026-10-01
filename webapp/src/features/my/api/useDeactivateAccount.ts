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

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authedPost } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { bankingServiceUrls } from "@config/apiConfig";

export interface DeactivateAccountPayload {
  accountId: number;
  /** Not sent — only used to invalidate that employee's own accounts query. */
  employeeEmail: string;
}

// POST /employee/accounts/{accountId}/deactivate — no body. Used both for a
// single row's Deactivate action and, called once per account, for "Resign
// Employee" (see EmployeeOperationsTab — a loop of individual deactivate
// calls, since there's no dedicated resign endpoint).
export function useDeactivateAccount() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<{ message: string } | null, Error, DeactivateAccountPayload>({
    // Shared, not tied to one component instance — lets EmployeeOperationsTab
    // tell whether a Deactivate (or a Resign loop's own deactivate calls) is
    // still in flight, to keep Deactivate/Resign from being fired again on a
    // different account while one is running.
    mutationKey: ["deactivate-account"],
    mutationFn: async ({ accountId }) =>
      authedPost<{ message: string }>(bankingServiceUrls.deactivateAccount(accountId), await getAccessToken(), null),
    onSuccess: async (_, { employeeEmail }) => {
      // Same query key useBankAccounts keys its self-lookup cache under —
      // this mutation is called against OTHER employees' accounts, but the
      // key shape is the same (["bank-accounts", workEmail]).
      await qc.invalidateQueries({ queryKey: ["bank-accounts", employeeEmail] });
    },
  });
}
