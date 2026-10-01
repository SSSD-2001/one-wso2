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
import { authedGet, authedPatch, defaultQueryRetry } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { promotionServiceUrls } from "@config/apiConfig";
import { digiopsHeaders } from "@features/my/util/digiopsHeaders";
import { isPromotionBackendConfigured } from "./usePromotionEmployeeInfo";
import type { PromotionRecommendationsResponse } from "./types";

const RECOMMENDATIONS_KEY = "promotion-recommendations";

// GET /promotion/recommendations, scoped to one lead. Shared by the Lead
// Portal's Pending Requests tab (statusArray: ["REQUESTED"], scoped to the
// open cycle) and History tab (statusArray: ["SUBMITTED","DECLINED","EXPIRED"],
// every cycle — source's own getRecommendationsHistory never passes a
// promotionCycleId).
export function useLeadRecommendations(
  leadEmail: string | undefined,
  statusArray: ("REQUESTED" | "SUBMITTED" | "DECLINED" | "EXPIRED")[],
  promotionCycleId?: number,
  // The Pending Requests tab needs this scoped to the open cycle, but the
  // cycle itself is a separate, slower-resolving query — pass false while
  // it's still loading so this doesn't fire once unscoped (every REQUESTED
  // recommendation ever, not just this cycle's) and then again once scoped.
  // Defaults true for the History tab, which never scopes by cycle at all.
  enabled = true,
) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const backendConfigured = isPromotionBackendConfigured();
  return useQuery<PromotionRecommendationsResponse>({
    queryKey: [RECOMMENDATIONS_KEY, leadEmail, statusArray, promotionCycleId ?? null],
    enabled: enabled && isSignedIn && backendConfigured && Boolean(leadEmail),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<PromotionRecommendationsResponse>(
        promotionServiceUrls.promotionRecommendations({ leadEmail, statusArray, promotionCycleId }),
        accessToken,
        digiopsHeaders(),
      );
    },
    staleTime: 30 * 1000,
    retry: defaultQueryRetry,
  });
}

// Every mutation below invalidates every `promotion-recommendations` query
// regardless of its specific args (leadEmail/statusArray/cycle) — broader
// than source's own re-fetch (which re-runs only the pending-list call, with
// slightly inconsistent params across the three thunks), but a moved
// recommendation can affect both the Pending and History tab's own lists, and
// letting React Query re-run each with ITS OWN params is simpler and more
// correct than hand-copying source's fetch calls into each mutation here.
function useInvalidateRecommendations() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [RECOMMENDATIONS_KEY] });
}

// PATCH /promotion/recommendations — saves a draft statement/comment
// without changing recommendationStatus. statement/comment must already be
// base64 (the backend rejects anything else); callers pass already-encoded
// strings the same way source's own saveRecommendation/submitRecommendation
// thunks do.
export function useSaveRecommendation() {
  const getAccessToken = useAccessToken();
  const invalidate = useInvalidateRecommendations();
  return useMutation({
    mutationFn: async (payload: { id: number; statement: string; comment: string; leadEmail: string }) => {
      const accessToken = await getAccessToken();
      return authedPatch(promotionServiceUrls.promotionRecommendationSave(), accessToken, payload, digiopsHeaders());
    },
    onSuccess: () => invalidate(),
  });
}

// Saves the draft, then submits it — the same two-call sequence source's
// own submitRecommendation thunk uses (PATCH then GET .../submit), because
// the backend has no single "save and submit" endpoint.
export function useSubmitRecommendation() {
  const getAccessToken = useAccessToken();
  const invalidate = useInvalidateRecommendations();
  return useMutation({
    mutationFn: async (payload: { id: number; statement: string; comment: string; leadEmail: string }) => {
      const accessToken = await getAccessToken();
      await authedPatch(promotionServiceUrls.promotionRecommendationSave(), accessToken, payload, digiopsHeaders());
      return authedGet(promotionServiceUrls.promotionRecommendationSubmit(payload.id), accessToken, digiopsHeaders());
    },
    onSuccess: () => invalidate(),
  });
}

export function useDeclineRecommendation() {
  const getAccessToken = useAccessToken();
  const invalidate = useInvalidateRecommendations();
  return useMutation({
    mutationFn: async (payload: { id: number; comment: string }) => {
      const accessToken = await getAccessToken();
      return authedGet(
        promotionServiceUrls.promotionRecommendationDecline(payload.id, payload.comment),
        accessToken,
        digiopsHeaders(),
      );
    },
    onSuccess: () => invalidate(),
  });
}
