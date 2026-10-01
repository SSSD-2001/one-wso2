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
import { authedPatch } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { bankingServiceUrls } from "@config/apiConfig";
import type { UpdateThresholdPayload } from "./types";

// PATCH /threshold — updates the Salary or Consultancy monthly cutoff day.
// The backend enforces which admin may touch which key (People Ops:
// SALARY_THRESHOLD, Finance: CONSULTANCY_THRESHOLD); the Admin tab mirrors
// that split by only enabling the matching Update button, but the backend's
// own check is the real authority.
export function useUpdateThreshold() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<{ message: string } | null, Error, UpdateThresholdPayload>({
    // Shared, not tied to one component instance — lets AdminTab tell
    // whether a threshold update is still in flight even after the
    // ConfirmationDialog that started it has already closed.
    mutationKey: ["update-threshold"],
    mutationFn: async (payload) =>
      authedPatch<{ message: string }>(bankingServiceUrls.updateThreshold, await getAccessToken(), payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["banking-app-config"] });
    },
  });
}
