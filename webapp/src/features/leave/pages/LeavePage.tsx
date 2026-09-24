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
import { Link as RouterLink, Navigate, Outlet, useLocation } from "react-router";
import { Alert, Skeleton, ToggleButton, ToggleButtonGroup } from "@wso2/oxygen-ui";
import RoutedTabs from "@components/routed-tabs/RoutedTabs";
import LeaveShell from "../components/LeaveShell";
import { useLeaveGate } from "../api/useLeaveGate";
import {
  LEAVE_PATH,
  firstAllowedPath,
  leavePath,
  leaveTab,
  parseLeavePath,
  visibleKinds,
  visibleTabs,
  type LeaveGateId,
  type LeaveKind,
} from "../leaveTabs";

// The one page frame for Leave: the shell, a tab bar of ACTIONS, a kind toggle
// where the action offers more than one, and an <Outlet /> for whichever
// screen the URL names.
//
// Both the tab bar and the toggle are filtered by the same gate that guards the
// routes, so neither can offer something the route would refuse — but the route
// is the thing that enforces it. Hiding a control is not access control; the
// URL can be typed.

export default function LeavePage() {
  const gate = useLeaveGate();
  const { pathname } = useLocation();
  const tabs = visibleTabs(gate.canSee);
  const { tab, kind } = parseLeavePath(pathname);

  return (
    // No title of its own: LeaveShell's eyebrow already says "Leave", and the
    // tab bar below names the screen. A title here repeated the word twice
    // above a tab called Apply.
    <LeaveShell title={tab?.label ?? "Leave"} subtitle={kind?.subtitle}>
      {gate.isResolving ? (
        <Skeleton variant="rectangular" height={420} sx={{ borderRadius: 1.5 }} />
      ) : tabs.length === 0 ? (
        <Alert severity="info">This isn&apos;t available for your role.</Alert>
      ) : (
        <>
          <RoutedTabs basePath={LEAVE_PATH} tabs={tabs} ariaLabel="Leave sections" />
          {tab && <LeaveKindToggle segment={tab.segment} selected={kind?.kind} />}
          <Outlet />
        </>
      )}
    </LeaveShell>
  );
}

/**
 * General | Sabbatical, for the tabs that offer both.
 *
 * Links rather than buttons, for the same reason RoutedTabs uses them: the
 * choice lives in the URL, so it survives a refresh, is shareable, and comes
 * back with the browser's Back button. Middle-click works too.
 *
 * Drawn only when the person may open more than one kind — a tab with a single
 * live option is not a choice, and an intern should not see a Sabbatical half
 * they can never select. `approvals` never draws one at all: general leave has
 * no approval step for anybody, and the tab's subtitle says so.
 */
function LeaveKindToggle({ segment, selected }: { segment: string; selected?: LeaveKind }) {
  const gate = useLeaveGate();
  const tab = leaveTab(segment);
  const kinds = tab ? visibleKinds(tab, gate.canSee) : [];
  if (!tab || kinds.length < 2) return null;

  return (
    <ToggleButtonGroup
      value={selected ?? false}
      exclusive
      size="small"
      aria-label="Kind of leave"
      sx={{ mb: 2, "& .MuiToggleButton-root": { textTransform: "none", fontSize: 13, px: 1.5, py: 0.4 } }}
    >
      {kinds.map((k) => (
        <ToggleButton
          key={k.kind}
          value={k.kind}
          component={RouterLink}
          to={leavePath(tab, k.kind)}
          replace
          // These render as anchors, so the current one is marked with
          // aria-current rather than relying on ToggleButtonGroup's
          // aria-pressed, which only means anything on a real button.
          aria-current={selected === k.kind ? "page" : undefined}
        >
          {k.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

/**
 * `/me/leave` itself: sends the visitor to the first screen they are allowed.
 *
 * Waits for the gate rather than guessing. Redirecting while /user-info is
 * still in flight would bounce a lead out of Approvals on every cold load.
 */
export function LeaveIndex() {
  const gate = useLeaveGate();
  // No `isResolving` branch here on purpose: LeavePage holds the <Outlet />
  // behind its own, so nothing below it renders until the privileges are
  // known. One guard, in the one place it can be reached.
  const first = firstAllowedPath(gate.canSee);
  if (!first) return null; // the page above already explains this case
  return <Navigate to={first} replace />;
}

/**
 * A multi-kind tab reached without a kind — `/me/leave/apply`. Sends the
 * visitor to the first kind they may open rather than leaving the tab blank.
 */
export function LeaveTabIndex({ segment }: { segment: string }) {
  const gate = useLeaveGate();
  const tab = leaveTab(segment);
  const first = tab ? visibleKinds(tab, gate.canSee)[0] : undefined;
  if (!tab || !first) return null;
  return <Navigate to={leavePath(tab, first.kind)} replace />;
}

/**
 * Guards one screen's route. A kind the gate refuses is not merely absent from
 * the toggle — reaching its URL directly redirects to whatever the visitor may
 * see, or says so plainly when that is nothing.
 */
export function LeaveKindRoute({
  gateId,
  children,
}: {
  gateId: LeaveGateId;
  children: ReactNode;
}) {
  const gate = useLeaveGate();

  // Decide nothing until the gate has answered. Changing tab moves the route
  // branch, so this component UNMOUNTS and remounts — and each mount gets a
  // fresh useAsgardeoSub that starts at "loading", which leaves
  // useLeaveUserInfo disabled and every `canSee` false for the first render.
  // Without this the refusal below fires on a gate that was never asked, and
  // a redirect cannot be taken back once the answer arrives.
  //
  // The page above holds its <Outlet /> behind the same flag, which is why
  // the previous shape got away without this: its tab routes were the same
  // component at the same tree position, so React reused the instance and the
  // sub never restarted. That is not a property to rely on.
  if (gate.isResolving) return null;

  if (!gate.canSee(gateId)) {
    const first = firstAllowedPath(gate.canSee);
    if (first) return <Navigate to={first} replace />;
    return <Alert severity="info">This isn&apos;t available for your role.</Alert>;
  }
  return <>{children}</>;
}
