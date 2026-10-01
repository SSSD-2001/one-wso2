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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedDelete, authedGet, authedPatch, authedPost, defaultQueryRetry } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { promotionServiceUrls } from "@config/apiConfig";
import { digiopsHeaders } from "@features/my/util/digiopsHeaders";
import { isPromotionBackendConfigured } from "./usePromotionEmployeeInfo";
import type {
  PromotionBusinessUnitsResponse,
  PromotionEmployeeDirectoryResponse,
  PromotionUserInsertPayload,
  PromotionUsersResponse,
  PromotionUserUpdatePayload,
} from "./types";

const USERS_KEY = "promotion-admin-users";

// GET /users + GET /business-units, in parallel — source's own getAllUsers
// thunk fetches both together (the BU tree only feeds the Functional Lead
// ACL selector inside the user form, but source refetches it alongside the
// user list every time regardless, so this does the same rather than
// inventing a separate cache lifetime for it).
export function useAdminUsers() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const backendConfigured = isPromotionBackendConfigured();
  return useQuery<{ users: PromotionUsersResponse; businessUnits: PromotionBusinessUnitsResponse }>({
    queryKey: [USERS_KEY],
    enabled: isSignedIn && backendConfigured,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      const [users, businessUnits] = await Promise.all([
        authedGet<PromotionUsersResponse>(promotionServiceUrls.users(), accessToken, digiopsHeaders()),
        authedGet<PromotionBusinessUnitsResponse>(promotionServiceUrls.businessUnits(), accessToken, digiopsHeaders()),
      ]);
      return { users, businessUnits };
    },
    staleTime: 30 * 1000,
    retry: defaultQueryRetry,
  });
}

function useInvalidateAdminUsers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
}

export function useInsertUser() {
  const getAccessToken = useAccessToken();
  const invalidate = useInvalidateAdminUsers();
  return useMutation({
    mutationFn: async (payload: PromotionUserInsertPayload) => {
      const accessToken = await getAccessToken();
      return authedPost(promotionServiceUrls.users(), accessToken, payload, digiopsHeaders());
    },
    onSuccess: () => invalidate(),
  });
}

// Shared by role/ACL edits, the active/inactive toggle, and Transfer
// Access (which just PATCHes `email` on the existing row, leaving
// roles/functionalLeadAccessLevels as they were) — source's own three call
// sites all funnel into the one updateUser thunk this mirrors.
export function useUpdateUser() {
  const getAccessToken = useAccessToken();
  const invalidate = useInvalidateAdminUsers();
  return useMutation({
    mutationFn: async (payload: PromotionUserUpdatePayload) => {
      const accessToken = await getAccessToken();
      return authedPatch(promotionServiceUrls.users(), accessToken, payload, digiopsHeaders());
    },
    onSuccess: () => invalidate(),
  });
}

export function useDeleteUser() {
  const getAccessToken = useAccessToken();
  const invalidate = useInvalidateAdminUsers();
  return useMutation({
    mutationFn: async (id: number) => {
      const accessToken = await getAccessToken();
      await authedDelete(promotionServiceUrls.userDelete(id), accessToken, digiopsHeaders());
    },
    onSuccess: () => invalidate(),
  });
}

// GET /business-units/sync?googleSheet=<url> — bulk user import. A GET
// despite writing (source's own endpoint); kicks off async server-side work
// tracked separately via usePromotionSyncState("SYNC_STATE"), not by this
// call's own response.
export function useSyncUsers() {
  const getAccessToken = useAccessToken();
  return useMutation({
    mutationFn: async (googleSheetUrl: string) => {
      const accessToken = await getAccessToken();
      return authedGet(promotionServiceUrls.businessUnitsSync(googleSheetUrl), accessToken, digiopsHeaders());
    },
  });
}

// GET /employees?filterLeads=true|false — the employee-picker behind both
// "Add a new user" and Transfer Access. Both pickers list leads only,
// because a promotion system user is always a lead first.
// Enabled lazily (only once a picker is actually opened), matching source's
// own Autocomplete-on-open loading.
export function useAdminEmployeeDirectory(filterLeads: boolean, enabled: boolean) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const backendConfigured = isPromotionBackendConfigured();
  return useQuery<PromotionEmployeeDirectoryResponse>({
    queryKey: ["promotion-admin-employee-directory", filterLeads],
    enabled: enabled && isSignedIn && backendConfigured,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<PromotionEmployeeDirectoryResponse>(
        promotionServiceUrls.employeesFilterLeads(filterLeads),
        accessToken,
        digiopsHeaders(),
      );
    },
    staleTime: 5 * 60 * 1000,
    retry: defaultQueryRetry,
  });
}
