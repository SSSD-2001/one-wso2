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

// POST /employee/accounts/{accountId}/approve — no body; the backend's own
// ActionReason payload is only meaningful for reject. Activates the account
// and deactivates whatever Salary account the employee had before it.
export function useApproveAccount() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<{ message: string } | null, Error, number>({
    // Shared, not tied to one component instance — lets ChangeRequestsTab
    // tell whether an approval is still in flight even after the
    // ConfirmationDialog that started it has already closed.
    mutationKey: ["approve-account"],
    mutationFn: async (accountId) =>
      authedPost<{ message: string }>(
        bankingServiceUrls.accountAction(accountId, "approve"),
        await getAccessToken(),
        null,
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["banking-admin", "pending-salary-accounts"] });
    },
  });
}
