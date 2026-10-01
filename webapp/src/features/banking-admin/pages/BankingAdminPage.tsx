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

import { Navigate, Outlet } from "react-router";
import { Box } from "@wso2/oxygen-ui";
import PerspectiveHeader from "@components/perspective-header/PerspectiveHeader";
import RoutedTabs from "@components/routed-tabs/RoutedTabs";
import {
  BANKING_ADMIN_PATH,
  BANKING_ADMIN_TABS,
  canSeeBankingAdminTab,
  firstAllowedBankingAdminTab,
} from "../bankingAdminTabs";
import { useBankingAdminFlags } from "../useBankingAdminFlags";

// The frame every Banking admin tab shares: the header and the tab bar, with
// an <Outlet /> for whichever tab the URL names — same shape as the
// employee-facing BankingPage. BankingAdminRoute has already confirmed the
// caller is some kind of admin by the time this renders; the filter below is
// the finer question of WHICH tabs this particular admin may see.
export default function BankingAdminPage() {
  const flags = useBankingAdminFlags();
  const visible = BANKING_ADMIN_TABS.filter((t) => canSeeBankingAdminTab(t.gateId, flags));

  return (
    <Box>
      <PerspectiveHeader
        title="Banking"
        subtitle="Review and act on employee bank account changes."
      />
      <RoutedTabs basePath={BANKING_ADMIN_PATH} tabs={visible} ariaLabel="Banking admin sections" />
      <Outlet />
    </Box>
  );
}

/** `/banking/admin` itself has nothing to show — send the caller to the first tab they may open. */
export function BankingAdminIndex() {
  const flags = useBankingAdminFlags();
  const first = firstAllowedBankingAdminTab(flags);
  // BankingAdminRoute already required isPeopleOperationsAdmin ||
  // isFinanceAdmin to reach here, which guarantees at least the
  // either-admin tabs are allowed — `first` is only undefined for the
  // instant before that same privileges fetch (already in flight for the
  // route guard) has resolved here too.
  if (!first) return null;
  return <Navigate to={`${BANKING_ADMIN_PATH}/${first.segment}`} replace />;
}
