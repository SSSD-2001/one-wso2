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

// Standalone /me/promotion — ports promotion-app's own employee route
// ("Self Promotion History", route.ts, allowRoles: [EMPLOYEE]): view/promotion/
// promotion.tsx + panels/promotionHistory.tsx + component/promotion/timeline.tsx.
//
// Kept visually close to source rather than reshaped into this app's usual
// bare-title page: PromotionPageShell reproduces the outlined card + header
// icon + tab strip from source's own promotion.tsx — right down to the tab
// strip showing only one tab. Source itself defines two more tabs
// (Promotion Status, Applications History) but both are commented out in
// its own render AND routing (promotion.tsx:116-135) — dead code, not
// merely hidden — so this port doesn't resurrect them either.
//
// This is the fuller, dedicated equivalent of promotion-app's own screen.
// It reads the same two endpoints as the My-page profile card's "Last
// promotion" line + history dialog (features/my/components/
// ConnectedServices.tsx, PromotionHistoryDialog.tsx), which stays as its
// own, separately-designed summary widget rather than being replaced by
// this page.
import { Alert, Box, Skeleton, Tab, Tabs } from "@wso2/oxygen-ui";
import { HistoryIcon, UserCircleIcon } from "@wso2/oxygen-ui-icons-react";
import { useUserInfo } from "@api/useUserInfo";
import { useAsgardeoUser } from "@hooks/useAsgardeoUser";
import { humanizeHttpError } from "@api/http";
import { isPromotionBackendConfigured, usePromotionEmployeeInfo } from "../api/usePromotionEmployeeInfo";
import { usePromotionHistory } from "../api/usePromotionHistory";
import PromotionTimeline from "../components/PromotionTimeline";
import PromotionPageShell from "../components/PromotionPageShell";

export default function PromotionHistoryPage() {
  const userInfo = useUserInfo();
  const asgardeoUser = useAsgardeoUser();
  // Same email-resolution order as the profile card: /user-info's workEmail
  // is canonical, falling back to the id_token email claim while it loads.
  const workEmail = userInfo.data?.workEmail ?? asgardeoUser.email;

  const configured = isPromotionBackendConfigured();
  const info = usePromotionEmployeeInfo(workEmail);
  const history = usePromotionHistory(workEmail, true);

  return (
    <PromotionPageShell
      icon={<UserCircleIcon size={34} strokeWidth={1.5} />}
      title="Promotion History"
      tabs={
        // One tab, matching source's own live tab bar exactly — see the
        // file header for why the other two source tabs aren't here. A
        // static Tabs (not PromotionTabs) since there's nowhere else to
        // navigate to.
        <Tabs value={0} aria-label="promotion history tabs">
          <Tab icon={<HistoryIcon size={18} />} iconPosition="start" label="Promotion History" />
        </Tabs>
      }
    >
      {!configured ? (
        <Alert severity="info">
          This app isn&apos;t connected yet. Set <code>ONE_WSO2_PROMOTION_BACKEND_URL</code> in{" "}
          <code>public/config.js</code> and reload.
        </Alert>
      ) : info.isPending || history.isPending ? (
        // isPending, not isLoading: both queries stay `enabled: false` until
        // workEmail resolves, and isLoading (isPending && isFetching) reads
        // false during that window — see OrgChartPage.tsx's own comment on
        // this exact gap. Without this the page would render blank for a
        // beat on load instead of the skeleton below.
        <Box>
          <Skeleton variant="rectangular" height={72} sx={{ borderRadius: 1, mb: 2 }} />
          <Skeleton variant="rectangular" height={72} sx={{ borderRadius: 1 }} />
        </Box>
      ) : info.isError ? (
        <Alert severity="error">Couldn&apos;t load your employee record. {humanizeHttpError(info.error)}</Alert>
      ) : history.isError ? (
        <Alert severity="error">Couldn&apos;t load your promotion history. {humanizeHttpError(history.error)}</Alert>
      ) : info.data ? (
        <PromotionTimeline
          employeeInfo={info.data.employeeInfo}
          requests={history.data?.promotionRequests ?? []}
        />
      ) : null}
    </PromotionPageShell>
  );
}
