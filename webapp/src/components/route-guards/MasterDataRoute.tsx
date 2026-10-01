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

import type { JSX, ReactNode } from "react";
import { Box } from "@wso2/oxygen-ui";
import { Navigate } from "react-router";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useUserInfo } from "@api/useUserInfo";
import { capabilitiesFromPrivileges } from "@constants/appMenu";
import { canSeeMasterData } from "@features/finance/api/useFinanceGate";

/**
 * Closes the four Master Data screens to everyone else, at the route.
 *
 * The registry's `requires: ["admin"]` on these items only controls what the
 * RAIL offers — every one of `/finance/master-data/*` was still mounted
 * unconditionally in App.tsx, so a direct URL (typed, bookmarked, or shared)
 * opened it for any signed-in user regardless of role.
 *
 * That gap matters more here than it would for, say, Credit Card Expenses:
 * this backend's own `/user-info` returns just an email and an avatar — no
 * roles at all (unlike cc-expenses/opd-claims, which enforce their own role
 * scheme server-side). The frontend's `admin` + preview-flag check is
 * therefore the ONLY access control in front of this data today, not a
 * convenience layered on top of a real one — so it has to hold at the route,
 * not just at the menu.
 *
 * Deliberately NOT built on the full `useFinanceGate`. That hook's
 * `isResolving` is `cc.isLoading || opd.isLoading || expense.isLoading` —
 * three backends that have nothing to do with this answer (see
 * `canSeeMasterData`'s own comment). A route guard calling it would hold
 * this page on a blank screen until CC, OPD and Expense Claims ALL settled,
 * so a slow or erroring one of those in some environment blocked a page
 * whose access question only ever depended on identity and the preview
 * flag. This waits on exactly those two things and nothing else.
 *
 * Same shape as SriLankaRoute / ParRequiresTeamLeadRoute:
 *
 *  - Wait rather than refuse. Unresolved reads as "not yet known", and
 *    redirecting on that would throw an actual admin off the screen on
 *    every cold load, before their privileges have loaded.
 *  - A failed lookup is not a refusal. Say the check failed and offer a
 *    retry — silently redirecting would send someone away with nothing to
 *    act on and no way back in without reloading.
 */
export default function MasterDataRoute({ children }: { children: ReactNode }): JSX.Element | null {
  const userInfo = useUserInfo();

  if (userInfo.isLoading) return null;

  if (userInfo.isError) {
    return (
      <Box sx={{ p: 2 }}>
        <ErrorNotice error={userInfo.error} onRetry={() => void userInfo.refetch()} retrying={userInfo.isFetching}>
          Couldn&apos;t check your access.
        </ErrorNotice>
      </Box>
    );
  }

  const caps = capabilitiesFromPrivileges(userInfo.data?.privileges);
  if (!canSeeMasterData(caps)) return <Navigate to="/finance" replace />;

  return <>{children}</>;
}
