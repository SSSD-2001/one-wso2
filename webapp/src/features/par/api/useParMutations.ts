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
import { authedPatch, authedPost, authedPut } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { parServiceUrls } from "@config/apiConfig";
import { digiopsHeaders } from "@features/my/util/digiopsHeaders";
import type {
  ParCycle,
  ParCycleConfigurations,
  ParCycleCreate,
  ParCycleModify,
  ParCycleStatus,
  ParRatingModify,
  ParSpecialRatingGroupQuota,
} from "./types";

// PATCH the caller's own par-rating record — saving a draft
// (parEmployeeStatus: "DRAFT") or submitting (parEmployeeStatus: "SHARED")
// both go through this one endpoint; the backend rejects (403) any field
// outside ParRatingModify's self-editable set.
//
// Invalidates ["par-rating"] so the stepper and the form both refetch the
// record they just wrote rather than showing stale status.
export function useSaveParRating(parCycleId: number | undefined, workEmail: string | undefined) {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<void, Error, ParRatingModify & { parRatingId: number }>({
    mutationFn: async ({ parRatingId, ...payload }) => {
      if (!parCycleId || !workEmail) throw new Error("Missing cycle or employee email");
      const accessToken = await getAccessToken();
      await authedPatch<void>(
        parServiceUrls.parRatingUpdate(parCycleId, workEmail, parRatingId),
        accessToken,
        payload,
        digiopsHeaders(),
      );
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["par-rating", parCycleId, workEmail] });
    },
  });
}

// ---- Admin Portal ----------------------------------------------------------

export function useCreateParCycle() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<ParCycle | null, Error, ParCycleCreate>({
    mutationFn: async (payload) => {
      const accessToken = await getAccessToken();
      return authedPost<ParCycle>(parServiceUrls.parCycleCreate(), accessToken, payload, digiopsHeaders());
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["par-admin-cycles"] });
    },
  });
}

// Settings edits and the OPEN/CLOSED status transitions share this one
// PATCH mutation.
export function useUpdateParCycle(parCycleId: number | undefined) {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<ParCycle | null, Error, ParCycleModify>({
    mutationFn: async (payload) => {
      if (!parCycleId) throw new Error("Missing cycle id");
      const accessToken = await getAccessToken();
      return authedPatch<ParCycle>(parServiceUrls.parCycleModify(parCycleId), accessToken, payload, digiopsHeaders());
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["par-admin-cycles"] });
    },
  });
}

// Status-only wrapper, kept separate from the settings-edit form so a
// status flip never accidentally carries stale form field values.
export function useSetParCycleStatus(parCycleId: number | undefined) {
  const update = useUpdateParCycle(parCycleId);
  return {
    ...update,
    mutate: (parCycleStatus: ParCycleStatus, options?: Parameters<typeof update.mutate>[1]) =>
      update.mutate({ parCycleStatus }, options),
    mutateAsync: (parCycleStatus: ParCycleStatus) => update.mutateAsync({ parCycleStatus }),
  };
}

export function usePostAdminQuotaGroups(parCycleId: number | undefined) {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<void, Error, ParSpecialRatingGroupQuota>({
    mutationFn: async (payload) => {
      if (!parCycleId) throw new Error("Missing cycle id");
      const accessToken = await getAccessToken();
      await authedPost<void>(parServiceUrls.parAdminQuotaGroups(parCycleId), accessToken, payload, digiopsHeaders());
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["par-admin-special-rating-groups", parCycleId] });
      await qc.invalidateQueries({ queryKey: ["par-admin-quota-groups", parCycleId] });
    },
  });
}

// Reuses par360Review's own PATCH resource, called here on the reviewee's
// behalf.
export function useRestoreRejectedReview(parCycleId: number | undefined) {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<void, Error, { employeeEmail: string; reviewerEmail: string }>({
    mutationFn: async ({ employeeEmail, reviewerEmail }) => {
      if (!parCycleId) throw new Error("Missing cycle id");
      const accessToken = await getAccessToken();
      await authedPatch<void>(
        parServiceUrls.par360Review(parCycleId, employeeEmail),
        accessToken,
        { reviewerEmail, par360ReviewStatus: "PENDING" },
        digiopsHeaders(),
      );
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["par-admin-rejected-reviews", parCycleId] });
    },
  });
}

export function useSendBulkReminder() {
  const getAccessToken = useAccessToken();
  return useMutation<void, Error, "employee" | "lead" | "special-rating">({
    mutationFn: async (kind) => {
      const accessToken = await getAccessToken();
      await authedPatch<void>(parServiceUrls.parBulkReminder(kind), accessToken, {}, digiopsHeaders());
    },
  });
}

export function useSyncEmployee(parCycleId: number | undefined) {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (workEmail) => {
      if (!parCycleId) throw new Error("Missing cycle id");
      const accessToken = await getAccessToken();
      await authedPost<void>(parServiceUrls.parSyncEmployee(parCycleId, workEmail), accessToken, {}, digiopsHeaders());
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["par-admin-teams", parCycleId] });
      await qc.invalidateQueries({ queryKey: ["par-admin-participants", parCycleId] });
    },
  });
}

// Org-wide defaults (question text, rating scales) new cycles are prefilled
// from — ParCycleCreationDialog.tsx's own useParGlobalConfig() call.
// Invalidating that same query key means it picks up the change immediately
// on next open, with nothing else to wire.
export function useUpdateParGlobalConfig() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<void, Error, ParCycleConfigurations>({
    mutationFn: async (payload) => {
      const accessToken = await getAccessToken();
      await authedPut<void>(parServiceUrls.parGlobalConfig(), accessToken, payload, digiopsHeaders());
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["par-admin-global-config"] });
    },
  });
}
