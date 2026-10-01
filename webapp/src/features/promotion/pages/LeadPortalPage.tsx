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

// The Lead Portal — ports promotion-app's own lead.tsx ("Time Based
// Promotions", route.ts: allowRoles: [Role.LEAD]). Two tabs, matching
// source's own tab bar exactly: Pending Requests (panels/recommendationList.tsx)
// and History (panels/recommendationHistory.tsx). Lives under People Ops —
// reviewing/deciding on other people's promotions is People-Ops-team work,
// the same split PAR's own Lead Portal already applies.
import { Navigate, Outlet } from "react-router";
import { ClipboardCheckIcon, ClipboardListIcon, UsersRoundIcon } from "@wso2/oxygen-ui-icons-react";
import PromotionPageShell from "../components/PromotionPageShell";
import PromotionTabs, { type PromotionTabDef } from "../components/PromotionTabs";

const BASE_PATH = "/people-ops/promotion/lead";

const TABS: PromotionTabDef[] = [
  { segment: "pending", label: "Pending Requests", icon: <ClipboardListIcon size={18} /> },
  { segment: "history", label: "History", icon: <ClipboardCheckIcon size={18} /> },
];

export default function LeadPortalPage() {
  return (
    <PromotionPageShell
      icon={<UsersRoundIcon size={34} strokeWidth={1.5} />}
      title="Time Based Promotions"
      tabs={<PromotionTabs basePath={BASE_PATH} tabs={TABS} ariaLabel="Time based promotions" />}
    >
      <Outlet />
    </PromotionPageShell>
  );
}

/** The group's index route — sends straight to Pending Requests, source's
 * own first/default tab. */
export function LeadPortalIndex() {
  return <Navigate to={`${BASE_PATH}/pending`} replace />;
}
