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
import { authedDelete, authedPatch, authedPost, HttpError } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { financeMasterDataServiceUrls } from "@config/apiConfig";
import { MASTER_DATA_SNACK } from "./masterDataCopy";
import {
  MASTER_DATA_ENDPOINTS,
  type MasterDataPayload,
  type MasterDataTab,
} from "./masterDataTypes";

// Create / update / delete for one tab. All three write the same collection,
// so they invalidate together — an edit that changes a GL code also changes
// what the expense-type filters should offer.
//
// Every success is a bare 200/201 with no body (the backend returns
// `http:OK` / `http:CREATED` constants), which `authedPost` and `authedPatch`
// already read as null rather than trying to parse.

function useInvalidateTab(tab: MasterDataTab) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["finance-master-data", tab] }),
      // The autocomplete lists are built from the same rows, so a new expense
      // type that is not offered by its own filter bar is a stale cache, not
      // a missing record.
      qc.invalidateQueries({ queryKey: ["finance-master-data", "expense-type-autocomplete"] }),
    ]);
}

/** POST /{collection} — creates a new record on the given tab. */
export function useCreateMasterData(tab: MasterDataTab) {
  const getAccessToken = useAccessToken();
  const invalidate = useInvalidateTab(tab);
  return useMutation<void, Error, MasterDataPayload>({
    mutationFn: async (payload) => {
      await authedPost(
        financeMasterDataServiceUrls.collection(MASTER_DATA_ENDPOINTS[tab]),
        await getAccessToken(),
        payload,
      );
    },
    onSuccess: () => invalidate(),
  });
}

/**
 * PATCH /{collection}/{id}.
 *
 * The body is only the fields that changed; see `changedFields`.
 */
export function useUpdateMasterData(tab: MasterDataTab) {
  const getAccessToken = useAccessToken();
  const invalidate = useInvalidateTab(tab);
  return useMutation<void, Error, { id: number; patch: Partial<MasterDataPayload> }>({
    mutationFn: async ({ id, patch }) => {
      await authedPatch(
        financeMasterDataServiceUrls.item(MASTER_DATA_ENDPOINTS[tab], id),
        await getAccessToken(),
        patch,
      );
    },
    onSuccess: () => invalidate(),
  });
}

/** DELETE /{collection}/{id}. */
export function useDeleteMasterData(tab: MasterDataTab) {
  const getAccessToken = useAccessToken();
  const invalidate = useInvalidateTab(tab);
  return useMutation<void, Error, number>({
    mutationFn: async (id) => {
      await authedDelete(
        financeMasterDataServiceUrls.item(MASTER_DATA_ENDPOINTS[tab], id),
        await getAccessToken(),
      );
    },
    onSuccess: () => invalidate(),
  });
}

/**
 * Which sentence a failed delete should say.
 *
 * The backend answers 409 when the record is still referenced by another
 * table, and that is the one delete failure the reader can actually do
 * something about — so it gets its own wording naming the cause.
 */
export function describeDeleteError(error: unknown): string {
  if (error instanceof HttpError && error.status === 409) {
    return MASTER_DATA_SNACK.error.deleteConflict;
  }
  return MASTER_DATA_SNACK.error.deleting;
}
