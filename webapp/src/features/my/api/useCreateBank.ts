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
import type { Bank } from "./types";

// POST /banks — adds a bank to the list every bank-account form's Bank Name
// autocomplete reads from. The backend itself rejects a duplicate code or
// SWIFT code (409); the Admin tab also checks client-side first, same as the
// source app, so the admin sees the problem before submitting rather than
// after.
export function useCreateBank() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<Bank | null, Error, Bank>({
    // Shared, not tied to one component instance — lets AdminTab tell
    // whether a create-bank request is still in flight even after the
    // ConfirmationDialog that started it has already closed.
    mutationKey: ["create-bank"],
    mutationFn: async (payload) =>
      authedPost<Bank>(bankingServiceUrls.createBank, await getAccessToken(), payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["banks"] });
    },
  });
}
