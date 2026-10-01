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

import type { VisibilityAnswer } from "@components/side-rail/visibilityFold";
import {
  PROMOTION_ADMIN_PORTAL_ITEM_ID,
  PROMOTION_BOARD_PORTAL_ITEM_ID,
  PROMOTION_CYCLE_HISTORY_ITEM_ID,
  PROMOTION_FUNCTIONAL_LEAD_PORTAL_ITEM_ID,
  PROMOTION_LEAD_PORTAL_ITEM_ID,
  PROMOTION_TEAM_HISTORY_ITEM_ID,
} from "@constants/perspectives";
import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, defaultQueryRetry } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { promotionBackendUrl, promotionServiceUrls } from "@config/apiConfig";
import { digiopsHeaders } from "@features/my/util/digiopsHeaders";
import type { PromotionPrivilegesResponse } from "./types";

// Numeric privilege codes from backend/constants.bal — see
// PromotionPrivilegesResponse's own comment for the gate/boundary split.
const LEAD_PRIVILEGE = 862;
const HR_ADMIN_PRIVILEGE = 762;
const FUNCTIONAL_LEAD_PRIVILEGE = 662;
const PROMOTION_BOARD_MEMBER_PRIVILEGE = 562;

// `enabled` lets a caller that only sometimes needs this (the side rail's
// usePerspectiveVisibility, which fetches only while People Ops is the
// active perspective) skip the request the rest of the time — the same
// convention usePromotionHistory's own `enabled` param follows.
export function usePromotionPrivileges(workEmail: string | undefined, enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const backendConfigured = Boolean(promotionBackendUrl);
  const queryEnabled = enabled && isSignedIn && backendConfigured && Boolean(workEmail);
  const query = useQuery<PromotionPrivilegesResponse>({
    queryKey: ["promotion-employee-privileges", workEmail],
    enabled: queryEnabled,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<PromotionPrivilegesResponse>(
        promotionServiceUrls.employeePrivileges(),
        accessToken,
        digiopsHeaders(),
      );
    },
    staleTime: 5 * 60 * 1000,
    retry: defaultQueryRetry,
  });

  const codes = query.data?.privileges ?? [];
  return {
    isLead: codes.includes(LEAD_PRIVILEGE),
    isFunctionalLead: codes.includes(FUNCTIONAL_LEAD_PRIVILEGE),
    isHrAdmin: codes.includes(HR_ADMIN_PRIVILEGE),
    isPromotionBoardMember: codes.includes(PROMOTION_BOARD_MEMBER_PRIVILEGE),
    // A disabled query (`queryEnabled` false — no backend configured, or no
    // workEmail to ask about) reports `isPending: true` forever in TanStack
    // Query v5, since it never gets a chance to fetch. Gating on
    // `queryEnabled` too means a caller that will genuinely never get an
    // answer sees `isLoading: false` instead of spinning — every
    // PromotionRequires*Route guard then falls through to its own
    // fail-closed redirect rather than rendering nothing indefinitely.
    isLoading: queryEnabled && query.isPending,
    isError: query.isError,
    error: query.error,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}

/** Which promotion section a caller may see. A failed read leaves every role false and hides the sections. */
export function promotionVisibility(privileges: {
  isLead: boolean;
  isFunctionalLead: boolean;
  isPromotionBoardMember: boolean;
  isHrAdmin: boolean;
  isLoading: boolean;
}): VisibilityAnswer {
  return {
    canSee: (id) => {
      if (id === PROMOTION_LEAD_PORTAL_ITEM_ID || id === PROMOTION_TEAM_HISTORY_ITEM_ID) return privileges.isLead;
      if (id === PROMOTION_FUNCTIONAL_LEAD_PORTAL_ITEM_ID) return privileges.isFunctionalLead;
      if (id === PROMOTION_BOARD_PORTAL_ITEM_ID) return privileges.isPromotionBoardMember;
      if (id === PROMOTION_ADMIN_PORTAL_ITEM_ID) return privileges.isHrAdmin;
      if (id === PROMOTION_CYCLE_HISTORY_ITEM_ID) return privileges.isHrAdmin || privileges.isFunctionalLead;
      return false;
    },
    resolving: privileges.isLoading,
    retry: () => undefined,
  };
}
