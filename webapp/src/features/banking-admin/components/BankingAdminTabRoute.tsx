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

import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { Alert } from "@wso2/oxygen-ui";
import {
  BANKING_ADMIN_PATH,
  canSeeBankingAdminTab,
  firstAllowedBankingAdminTab,
  type BankingAdminGateId,
} from "../bankingAdminTabs";
import { useBankingAdminFlags } from "../useBankingAdminFlags";

/**
 * Guards one tab's route. BankingAdminRoute already keeps out anyone who is
 * neither a People Ops nor a Finance admin; this is the finer split within
 * that — Change Requests is People-Ops-only. A tab the caller can't see is
 * not merely absent from the bar — reaching its URL directly redirects to
 * whichever tab they may see instead. Same pattern Claim Approval's own
 * ClaimApprovalTabRoute already uses for its gateId.
 */
export default function BankingAdminTabRoute({
  gateId,
  children,
}: {
  gateId: BankingAdminGateId;
  children: ReactNode;
}) {
  const flags = useBankingAdminFlags();

  if (!canSeeBankingAdminTab(gateId, flags)) {
    const first = firstAllowedBankingAdminTab(flags);
    if (first) return <Navigate to={`${BANKING_ADMIN_PATH}/${first.segment}`} replace />;
    return <Alert severity="info">This isn&apos;t available for your role.</Alert>;
  }
  return <>{children}</>;
}
