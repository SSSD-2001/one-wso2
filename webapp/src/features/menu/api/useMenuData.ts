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

// Reads from the cafeteria menu backend.
//
// Every key is scoped to the signed-in subject so switching accounts in one tab
// cannot serve the previous user's rows from cache — and here 403-ness is itself
// user-specific, so even the deployment-wide window config is scoped.

import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { isMenuBackendConfigured, menuServiceUrls } from "@config/apiConfig";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { menuRetry } from "../util/menuError";
import { normalizeDinnerResponse, normalizeMenu } from "../util/menuWire";
import type { DailyMenu, DinnerOrder, MenuMetaInfoWire, MenuUserInfo, MenuWire } from "./menuTypes";

export { isMenuBackendConfigured };

/** Everything every query here needs, gathered once. */
function useMenuQueryBasis() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const ready = isSignedIn && isMenuBackendConfigured() && Boolean(userSub);
  return { getAccessToken, subState, retryIdentity, userSub, ready };
}

/**
 * The caller's profile. Supplies the department, team and manager email an order
 * carries — and is the query whose 403 tells us the user is in no authorised
 * group, since the service refuses every endpoint in that case.
 */
export function useMenuUserInfo() {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useMenuQueryBasis();
  const query = useQuery<MenuUserInfo>({
    queryKey: ["menu-user-info", userSub],
    enabled: ready,
    queryFn: async () => authedGet<MenuUserInfo>(menuServiceUrls.userInfo, await getAccessToken()),
    // Matches the service's own five-minute cache on this endpoint.
    staleTime: 5 * 60 * 1000,
    retry: menuRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/**
 * The configured lunch-feedback window.
 *
 * Deliberately allowed to fail quietly: the standalone app never called this
 * endpoint, so it may not be published through the gateway. Callers fall back to
 * the hard-coded window, so nothing here blocks the page.
 */
export function useMenuMetaInfo() {
  const { getAccessToken, userSub, ready } = useMenuQueryBasis();
  return useQuery<MenuMetaInfoWire>({
    queryKey: ["menu-meta-info", userSub],
    enabled: ready,
    queryFn: async () => authedGet<MenuMetaInfoWire>(menuServiceUrls.metaInfo, await getAccessToken()),
    staleTime: 30 * 60 * 1000,
    retry: menuRetry,
  });
}

/** Today's menu, already normalised so cached data is domain-shaped. */
export function useTodayMenu() {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useMenuQueryBasis();
  const query = useQuery<DailyMenu>({
    queryKey: ["menu-menu", userSub],
    enabled: ready,
    queryFn: async () =>
      normalizeMenu(await authedGet<MenuWire>(menuServiceUrls.menu, await getAccessToken())),
    staleTime: 5 * 60 * 1000,
    // The app-wide client sets refetchOnMount: false, which would make the
    // staleTime above decorative — the menu would never refresh on returning to
    // the page. Opted back in here, and on the dinner order below.
    refetchOnMount: true,
    retry: menuRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/**
 * The caller's current dinner order, or null when there is none.
 *
 * The service answers 200 with a message rather than 404 for "no order", so the
 * absence is normalised into data instead of an error — see normalizeDinnerResponse.
 */
export function useDinnerOrder() {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useMenuQueryBasis();
  const query = useQuery<DinnerOrder | null>({
    queryKey: ["menu-dinner", userSub],
    enabled: ready,
    queryFn: async () =>
      normalizeDinnerResponse(await authedGet<unknown>(menuServiceUrls.dinner, await getAccessToken())),
    staleTime: 30 * 1000,
    refetchOnMount: true,
    retry: menuRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}
