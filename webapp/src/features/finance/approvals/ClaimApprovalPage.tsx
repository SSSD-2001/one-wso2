/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router";
import { Alert, Box, Skeleton, Typography } from "@wso2/oxygen-ui";
import RoutedTabs from "@components/routed-tabs/RoutedTabs";
import { useFinanceGate } from "../api/useFinanceGate";
import {
  CLAIM_APPROVAL_PATH,
  CLAIM_APPROVAL_TABS,
  firstAllowedClaimTab,
  type ClaimApprovalGateId,
} from "./claimApprovalTabs";

// FinanceShell's own fillColumn, verbatim.
const fillColumn = { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } as const;

// `useFillHeight` (the OPD and Expense review screens, and this tab's own
// Needs You review) measures against the nearest scrolling ANCESTOR. Without
// one of its own, that search climbs past this page entirely and lands on
// whatever AppLayout happens to scroll — which grows with the page instead of
// staying inside it, an external scrollbar on the whole screen instead of an
// internal one on the panel. `overflowY: "auto"` here is what gives it one to
// find, the same way the Me-side claims tabs scroll their own list instead of
// the page. Every tab needs this, not only the one that happens to hold a
// DataGrid.
const scrollBoundary = { ...fillColumn, overflowY: "auto" } as const;

// One frame for every claim-approval view: the header, the tab bar, and an
// <Outlet /> for whichever tab the URL names.
//
// Not FinanceShell: that frame belongs to one app and names one backend in its
// "not connected" message. This screen spans two, and either may be missing, so
// each tab reports its own connectivity where it knows about it.
export default function ClaimApprovalPage() {
  const gate = useFinanceGate();
  const visible = CLAIM_APPROVAL_TABS.filter((t) => gate.canSee(t.gateId));

  return (
    <Box sx={fillColumn}>
      {/* No chip. This is a bare section under the Finance perspective, not a
          screen inside an app, so there is no app name to put above the title —
          the chip said "Finance", which is the perspective the rail already
          shows. "Claim approval" identifies itself. */}
      <Typography variant="h5" sx={{ mb: 0.5, flexShrink: 0 }}>
        Claim Approval
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.25, maxWidth: "70ch", flexShrink: 0 }}>
        Claims waiting on your decision, and the ones already decided. Submitting a claim and looking
        up your own stay under Me.
      </Typography>

      {gate.isResolving ? (
        <Skeleton variant="rectangular" height={420} sx={{ borderRadius: 1.5 }} />
      ) : visible.length === 0 ? (
        <Alert severity="info">You don&apos;t approve claims, so there is nothing here.</Alert>
      ) : (
        <Box sx={fillColumn}>
          <Box sx={{ flexShrink: 0 }}>
            <RoutedTabs
              basePath={CLAIM_APPROVAL_PATH}
              tabs={visible}
              ariaLabel="Claim approval sections"
            />
          </Box>
          <Box sx={scrollBoundary}>
            <Outlet />
          </Box>
        </Box>
      )}
    </Box>
  );
}

/**
 * The index route: sends the visitor to the first tab they may open.
 *
 * No `isResolving` branch — the page above holds the <Outlet /> behind its own,
 * so nothing here renders until the three backends have answered.
 */
export function ClaimApprovalIndex() {
  const gate = useFinanceGate();
  const first = firstAllowedClaimTab(gate.canSee);
  if (!first) return null; // the page already explains this case
  return <Navigate to={`${CLAIM_APPROVAL_PATH}/${first.segment}`} replace />;
}

/**
 * Guards one tab's route. A tab the gate refuses is not merely absent from the
 * bar — reaching its URL directly redirects to whatever this person may see, or
 * says so plainly when that is nothing. Hiding a tab is not access control.
 */
export function ClaimApprovalTabRoute({
  gateId,
  children,
}: {
  gateId: ClaimApprovalGateId;
  children: ReactNode;
}) {
  const gate = useFinanceGate();

  if (!gate.canSee(gateId)) {
    const first = firstAllowedClaimTab(gate.canSee);
    if (first) return <Navigate to={`${CLAIM_APPROVAL_PATH}/${first.segment}`} replace />;
    return <Alert severity="info">This isn&apos;t available for your role.</Alert>;
  }
  return <>{children}</>;
}
