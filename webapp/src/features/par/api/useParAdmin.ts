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
import { parBackendUrl, parServiceUrls } from "@config/apiConfig";
import { digiopsHeaders } from "@features/my/util/digiopsHeaders";
import type {
  ParCycle,
  ParCycleConfigurations,
  ParLegacyCycleSummary,
  ParLegacyHistory,
  ParParticipant,
  ParRating,
  ParRejectedReview,
  ParSpecialRatingAllocation,
  ParSpecialRatingGroupWithHeadCount,
  ParTeamSummary,
} from "./types";

function useParBaseline() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  return { isSignedIn, getAccessToken, backendConfigured: Boolean(parBackendUrl) };
}

// `refetchInterval` backs the one place this needs to poll instead of
// waiting for a normal invalidation: right after creating a cycle, the
// backend seeds its special-rating groups asynchronously, so PENDING
// doesn't become PENDING_QUOTA immediately.
export function useParCyclesByStatus(
  status: "PENDING_QUOTA" | "OPEN" | "PENDING" | "CLOSED",
  options: { enabled?: boolean; refetchInterval?: number | false } = {},
) {
  const { enabled = true, refetchInterval = false } = options;
  const { isSignedIn, getAccessToken, backendConfigured } = useParBaseline();
  return useQuery<ParCycle[]>({
    queryKey: ["par-admin-cycles", status],
    enabled: enabled && isSignedIn && backendConfigured,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ParCycle[]>(parServiceUrls.parCyclesByStatus(status), accessToken, digiopsHeaders());
    },
    staleTime: 60 * 1000,
    refetchInterval,
    retry: defaultQueryRetry,
  });
}

export function useParGlobalConfig(enabled = true) {
  const { isSignedIn, getAccessToken, backendConfigured } = useParBaseline();
  return useQuery<ParCycleConfigurations>({
    queryKey: ["par-admin-global-config"],
    enabled: enabled && isSignedIn && backendConfigured,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ParCycleConfigurations>(parServiceUrls.parGlobalConfig(), accessToken, digiopsHeaders());
    },
    staleTime: 5 * 60 * 1000,
    retry: defaultQueryRetry,
  });
}

export function useParAdminTeams(parCycleId: number | undefined, enabled = true) {
  const { isSignedIn, getAccessToken, backendConfigured } = useParBaseline();
  return useQuery<ParTeamSummary[]>({
    queryKey: ["par-admin-teams", parCycleId],
    enabled: enabled && isSignedIn && backendConfigured && Boolean(parCycleId),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ParTeamSummary[]>(parServiceUrls.parAdminTeams(parCycleId!), accessToken, digiopsHeaders());
    },
    staleTime: 60 * 1000,
    retry: defaultQueryRetry,
  });
}

// Same resource par360Participants already hits.
export function useParAdminParticipants(parCycleId: number | undefined, enabled = true) {
  const { isSignedIn, getAccessToken, backendConfigured } = useParBaseline();
  return useQuery<ParParticipant[]>({
    queryKey: ["par-admin-participants", parCycleId],
    enabled: enabled && isSignedIn && backendConfigured && Boolean(parCycleId),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ParParticipant[]>(parServiceUrls.par360Participants(parCycleId!), accessToken, digiopsHeaders());
    },
    staleTime: 60 * 1000,
    retry: defaultQueryRetry,
  });
}

export function useParRejectedReviews(parCycleId: number | undefined, enabled = true) {
  const { isSignedIn, getAccessToken, backendConfigured } = useParBaseline();
  return useQuery<ParRejectedReview[]>({
    queryKey: ["par-admin-rejected-reviews", parCycleId],
    enabled: enabled && isSignedIn && backendConfigured && Boolean(parCycleId),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ParRejectedReview[]>(
        parServiceUrls.parRejectedReviews(parCycleId!),
        accessToken,
        digiopsHeaders(),
      );
    },
    staleTime: 60 * 1000,
    retry: defaultQueryRetry,
  });
}

export function useParAdminSpecialRatingGroups(parCycleId: number | undefined, enabled = true) {
  const { isSignedIn, getAccessToken, backendConfigured } = useParBaseline();
  return useQuery<ParSpecialRatingGroupWithHeadCount[]>({
    queryKey: ["par-admin-special-rating-groups", parCycleId],
    enabled: enabled && isSignedIn && backendConfigured && Boolean(parCycleId),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ParSpecialRatingGroupWithHeadCount[]>(
        parServiceUrls.parAdminSpecialRatingGroups(parCycleId!),
        accessToken,
        digiopsHeaders(),
      );
    },
    staleTime: 30 * 1000,
    retry: defaultQueryRetry,
  });
}

// Same wire shape as the lead-scoped useSpecialRatingAllocation.ts call.
export function useParAdminQuotaGroups(parCycleId: number | undefined, enabled = true) {
  const { isSignedIn, getAccessToken, backendConfigured } = useParBaseline();
  return useQuery<ParSpecialRatingAllocation[]>({
    queryKey: ["par-admin-quota-groups", parCycleId],
    enabled: enabled && isSignedIn && backendConfigured && Boolean(parCycleId),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ParSpecialRatingAllocation[]>(
        parServiceUrls.parAdminQuotaGroups(parCycleId!),
        accessToken,
        digiopsHeaders(),
      );
    },
    staleTime: 60 * 1000,
    retry: defaultQueryRetry,
  });
}

export function useParAllRatings(parCycleId: number | undefined, enabled = true) {
  const { isSignedIn, getAccessToken, backendConfigured } = useParBaseline();
  return useQuery<ParRating[]>({
    queryKey: ["par-admin-all-ratings", parCycleId],
    enabled: enabled && isSignedIn && backendConfigured && Boolean(parCycleId),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ParRating[]>(parServiceUrls.parAllRatings(parCycleId!), accessToken, digiopsHeaders());
    },
    staleTime: 60 * 1000,
    retry: defaultQueryRetry,
  });
}

// GET every distinct legacy cycle org-wide — HistoryPanel.tsx's own
// fetchDistinctLegacyParCycles, for the History tab's merged cycle list.
export function useDistinctLegacyParCycles(enabled = true) {
  const { isSignedIn, getAccessToken, backendConfigured } = useParBaseline();
  return useQuery<ParLegacyCycleSummary[]>({
    queryKey: ["par-admin-legacy-cycles"],
    enabled: enabled && isSignedIn && backendConfigured,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ParLegacyCycleSummary[]>(parServiceUrls.legacyParHistoryCycles(), accessToken, digiopsHeaders());
    },
    staleTime: 10 * 60 * 1000,
    retry: defaultQueryRetry,
  });
}

// GET every employee's legacy row for one cycle name — HistoryPanel.tsx's own
// fetchLegacyParHistoryByCycle, for the History tab's legacy drill-down.
export function useLegacyParHistoryByCycle(cycleName: string | undefined, enabled = true) {
  const { isSignedIn, getAccessToken, backendConfigured } = useParBaseline();
  return useQuery<ParLegacyHistory[]>({
    queryKey: ["par-admin-legacy-cycle-participants", cycleName],
    enabled: enabled && isSignedIn && backendConfigured && Boolean(cycleName),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ParLegacyHistory[]>(
        parServiceUrls.legacyParHistoryCyclesParticipants(cycleName!),
        accessToken,
        digiopsHeaders(),
      );
    },
    staleTime: 60 * 1000,
    retry: defaultQueryRetry,
  });
}
