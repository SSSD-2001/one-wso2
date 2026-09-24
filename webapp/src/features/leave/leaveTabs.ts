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

// The Leave app's shape: ONE rail entry, tabs named for what you are doing,
// and the kind of leave chosen inside the tab.
//
// This is the source's own nesting — route.ts:47-150 has Apply → General |
// Sabbatical, and so on across its four action routes. The first port
// inverted it, one rail entry per KIND, to keep the everyday path away from
// the rare one. That worked, at the price of two rail rows where three of the
// eight tabs repeated a name (Apply, My history, Report) and a sabbatical that
// an ordinary employee uses twice a career sat level with general leave.
//
// Folding back to the source's order costs nothing in the screens themselves:
// every tab body is already a zero-prop component, and the two history tabs
// already share one `HistoryBody`. The kind is a route segment rather than
// component state because the gate is enforced at the ROUTE — hiding a toggle
// is not access control, and a typed URL has to be refused the same way.

/** Where the single rail entry points. */
export const LEAVE_PATH = "/me/leave";

/**
 * Permissions, resolved by `useLeaveGate().canSee`. These are about what a
 * person may DO, and are independent of how the screens are arranged.
 */
export type LeaveGateId =
  | "leave-apply"
  | "leave-history"
  | "leave-reports"
  | "leave-approve"
  /** May take a sabbatical at all: employee or lead, never an intern. */
  | "leave-sabbatical-own";

/** The rail entry's id. One now, where there were two. */
export type LeaveItemId = "leave-home";

export type LeaveKind = "general" | "sabbatical";

export interface LeaveKindDef {
  kind: LeaveKind;
  /** Toggle label. Absent from the URL of a single-kind tab — see leavePath. */
  label: string;
  /** Checked before the toggle offers it AND before its route renders. */
  gateId: LeaveGateId;
  /**
   * Shown under the page title while this kind is selected.
   *
   * Per kind rather than per tab because the two kinds want different things
   * said: general leave needs its holiday-calendar rule, a sabbatical needs
   * you to talk to your lead first.
   */
  subtitle: string;
}

export interface LeaveTabDef {
  /** URL segment under LEAVE_PATH. */
  segment: string;
  label: string;
  /** Offered kinds, in toggle order. One entry means no toggle is drawn. */
  kinds: readonly LeaveKindDef[];
}

export const LEAVE_TABS: readonly LeaveTabDef[] = [
  {
    segment: "apply",
    label: "Apply",
    kinds: [
      {
        kind: "general",
        label: "General",
        // route.ts:65-70 — everyone, People Ops included.
        gateId: "leave-apply",
        subtitle:
          "Request leave and track what you have taken. Working days are validated against the holiday calendar before you submit.",
      },
      {
        kind: "sabbatical",
        label: "Sabbatical",
        // route.ts:72-78 — EMPLOYEE or LEAD, never an intern.
        gateId: "leave-sabbatical-own",
        subtitle:
          "A sabbatical is a long, planned break. Your lead approves it, so agree the dates with them before applying.",
      },
    ],
  },
  {
    segment: "history",
    label: "My history",
    kinds: [
      {
        kind: "general",
        // route.ts:112-118 — EMPLOYEE, INTERN or LEAD. People Ops is
        // deliberately absent: this is the signed-in user's own leave.
        label: "General",
        gateId: "leave-history",
        subtitle: "Everything you have taken, grouped by the kind of leave.",
      },
      {
        kind: "sabbatical",
        label: "Sabbatical",
        // route.ts:119-126 — same rule as sabbatical apply.
        gateId: "leave-sabbatical-own",
        subtitle: "Your sabbaticals, and how far each one has got.",
      },
    ],
  },
  {
    segment: "approvals",
    label: "Approvals",
    // One kind, so no toggle: general leave has no approval step at all. The
    // backend creates it already approved (service.bal:539), which is a fact
    // about the product rather than about this person's role — so the subtitle
    // says it rather than a disabled half-toggle implying it might unlock.
    kinds: [
      {
        kind: "sabbatical",
        label: "Sabbatical",
        // route.ts:86-102 — LEAD only. People Ops may report on sabbaticals
        // but cannot decide one.
        gateId: "leave-approve",
        subtitle:
          "Only sabbaticals need approving. General leave is approved the moment you submit it.",
      },
    ],
  },
  {
    segment: "approval-history",
    label: "Approval history",
    kinds: [
      {
        kind: "sabbatical",
        label: "Sabbatical",
        gateId: "leave-approve",
        subtitle: "Sabbaticals you have already decided on.",
      },
    ],
  },
  {
    segment: "reports",
    label: "Reports",
    kinds: [
      {
        kind: "general",
        label: "General",
        // route.ts:136-142 — LEAD or People Ops.
        gateId: "leave-reports",
        subtitle: "Leave taken across your team.",
      },
      {
        kind: "sabbatical",
        label: "Sabbatical",
        // route.ts:143-148 — same rule as the general report.
        gateId: "leave-reports",
        subtitle: "Sabbaticals across your team.",
      },
    ],
  },
] as const;

/**
 * The URL for one tab, optionally at one kind.
 *
 * A single-kind tab carries no kind segment — `/me/leave/approvals` rather
 * than `/me/leave/approvals/sabbatical`, which would name a choice that does
 * not exist. The shape follows the tab's DEFINITION, not the caller's
 * permissions, so two people never see different URLs for the same screen.
 */
export function leavePath(tab: LeaveTabDef, kind?: LeaveKind): string {
  const base = `${LEAVE_PATH}/${tab.segment}`;
  if (tab.kinds.length < 2) return base;
  return kind ? `${base}/${kind}` : base;
}

export function leaveTab(segment: string): LeaveTabDef | undefined {
  return LEAVE_TABS.find((t) => t.segment === segment);
}

/** The kinds of `tab` this person may open, in toggle order. */
export function visibleKinds(
  tab: LeaveTabDef,
  canSee: (id: string) => boolean,
): LeaveKindDef[] {
  return tab.kinds.filter((k) => canSee(k.gateId));
}

/**
 * The tabs worth drawing: a tab appears when this person may open at least one
 * of its kinds.
 *
 * Note what this is NOT gated on — being able to take that kind of leave. A
 * People-Ops-only account can hold no sabbatical but does get the sabbatical
 * Report, so Reports must still appear for them.
 */
export function visibleTabs(canSee: (id: string) => boolean): LeaveTabDef[] {
  return LEAVE_TABS.filter((t) => visibleKinds(t, canSee).length > 0);
}

/** Whether the rail entry should appear at all. */
export function hasAnyLeaveTab(canSee: (id: string) => boolean): boolean {
  return visibleTabs(canSee).length > 0;
}

/**
 * Where `/me/leave` should land: the first tab this person may open, at the
 * first kind of it they may open.
 *
 * Drives the index redirect and the "nothing here for you" case both, so they
 * cannot disagree.
 */
export function firstAllowedPath(canSee: (id: string) => boolean): string | undefined {
  const tab = visibleTabs(canSee)[0];
  if (!tab) return undefined;
  const kind = visibleKinds(tab, canSee)[0];
  return leavePath(tab, kind?.kind);
}

/**
 * Which tab and kind a URL under LEAVE_PATH names.
 *
 * Tolerant on purpose: an unknown segment yields `undefined` rather than
 * throwing, and the caller decides what to do about it — the same contract
 * RoutedTabs works to, where an unrecognised segment simply leaves every tab
 * unlit instead of lighting the wrong one.
 */
export function parseLeavePath(pathname: string): {
  tab?: LeaveTabDef;
  kind?: LeaveKindDef;
} {
  const rest = pathname.startsWith(LEAVE_PATH) ? pathname.slice(LEAVE_PATH.length) : "";
  const [tabSegment, kindSegment] = rest.replace(/^\//, "").split("/");
  const tab = tabSegment ? leaveTab(tabSegment) : undefined;
  if (!tab) return {};
  // A single-kind tab has no kind segment, so its one kind is implied.
  if (tab.kinds.length < 2) return { tab, kind: tab.kinds[0] };
  return { tab, kind: tab.kinds.find((k) => k.kind === kindSegment) };
}

/**
 * Where a just-submitted request should land: its own history, when the
 * person is allowed to see it.
 *
 * `undefined` means stay put. That is not a hypothetical — a People-Ops-only
 * account may APPLY for general leave (route.ts:58 lists them) but may not see
 * My history (route.ts:110 does not), so navigating them there would hand them
 * straight to LeaveKindRoute's refusal and bounce them somewhere arbitrary. The
 * form's own reset and the success message are the whole feedback in that case.
 */
export function historyPathAfterSubmit(
  kind: LeaveKind,
  canSee: (id: string) => boolean,
): string | undefined {
  const history = leaveTab("history");
  const entry = history?.kinds.find((k) => k.kind === kind);
  if (!history || !entry || !canSee(entry.gateId)) return undefined;
  return leavePath(history, kind);
}
