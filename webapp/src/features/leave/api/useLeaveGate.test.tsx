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

import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { ME_APPS } from "@constants/meApps";

// Both flags, as React Query reports them: a query that is fetching is pending
// AND loading; a DISABLED query is pending but not loading, because it never
// fetches. The gate has to read the second one, or a caller that switched it
// off would be told forever that it is mid-flight.
const userInfo: { data?: unknown; isPending?: boolean; isLoading?: boolean } = {};
vi.mock("./useLeaveData", () => ({ useLeaveUserInfo: () => userInfo }));

const { useLeaveGate } = await import("./useLeaveGate");
const { LEAVE_PRIVILEGE } = await import("./leaveTypes");

function gateFor(data: unknown) {
  userInfo.data = data;
  userInfo.isPending = false;
  userInfo.isLoading = false;
  return renderHook(() => useLeaveGate()).result.current;
}

const P = LEAVE_PRIVILEGE;

describe("who can see Reports", () => {
  it("a leave lead can", () => {
    expect(gateFor({ privileges: [P.EMPLOYEE, P.LEAD] }).canSee("leave-reports")).toBe(true);
  });

  it("People Ops can", () => {
    expect(gateFor({ privileges: [P.EMPLOYEE, P.PEOPLE_OPS_TEAM] }).canSee("leave-reports")).toBe(
      true,
    );
  });

  it("a plain employee cannot", () => {
    expect(gateFor({ privileges: [P.EMPLOYEE] }).canSee("leave-reports")).toBe(false);
  });

  // Two widenings the port had that the running app does not: it checks the
  // privilege number alone (LeadReportTab.tsx:50).
  it("an isLead flag without the privilege does not count", () => {
    expect(gateFor({ isLead: true, privileges: [P.EMPLOYEE] }).canSee("leave-reports")).toBe(false);
  });

  it("having subordinates without the privilege does not count", () => {
    expect(
      gateFor({ subordinateCount: 9, privileges: [P.EMPLOYEE] }).canSee("leave-reports"),
    ).toBe(false);
  });
});

// route.ts:94,101 — LEAD only. People Ops can report on sabbaticals but cannot
// approve one.
describe("who can approve", () => {
  it("a leave lead can", () => {
    expect(gateFor({ privileges: [P.EMPLOYEE, P.LEAD] }).canSee("leave-approve")).toBe(true);
  });

  it("People Ops cannot", () => {
    expect(gateFor({ privileges: [P.EMPLOYEE, P.PEOPLE_OPS_TEAM] }).canSee("leave-approve")).toBe(
      false,
    );
  });
});

describe("the per-user screens", () => {
  it("stay open to any employee", () => {
    const gate = gateFor({ privileges: [P.EMPLOYEE] });
    expect(gate.canSee("leave-apply")).toBe(true);
    expect(gate.canSee("leave-history")).toBe(true);
  });
});

// route.ts:77-78 and :124-125 — allowRoles [EMPLOYEE, LEAD], denyRoles [INTERN],
// on both the apply and the history sabbatical routes. This is the permission
// to TAKE a sabbatical; whether the rail offers the Sabbatical entry is a
// different question, covered further down.
describe("who may take a sabbatical", () => {
  it("an employee can", () => {
    expect(gateFor({ privileges: [P.EMPLOYEE] }).canSee("leave-sabbatical-own")).toBe(true);
  });

  it("a lead can", () => {
    expect(gateFor({ privileges: [P.LEAD] }).canSee("leave-sabbatical-own")).toBe(true);
  });

  it("an intern cannot, even holding the employee privilege", () => {
    expect(gateFor({ privileges: [P.EMPLOYEE, P.INTERN] }).canSee("leave-sabbatical-own")).toBe(false);
  });

  // They still get the Sabbatical entry, for its Report — see below.
  it("a People-Ops-only user cannot — they hold neither allowed role", () => {
    expect(gateFor({ privileges: [P.PEOPLE_OPS_TEAM] }).canSee("leave-sabbatical-own")).toBe(false);
  });
});

describe("an unknown item", () => {
  it("is open when it declares no restriction", () => {
    // Matches useFinanceGate: unrestricted ids are per-user views.
    expect(gateFor({ privileges: [P.EMPLOYEE] }).canSee("leave-something-new")).toBe(true);
  });
});

describe("before /user-info has answered", () => {
  it("reports that it is still resolving, and grants nothing", () => {
    userInfo.data = undefined;
    userInfo.isPending = true;
    userInfo.isLoading = true;
    const gate = renderHook(() => useLeaveGate()).result.current;
    expect(gate.isResolving).toBe(true);
    expect(gate.canSee("leave-reports")).toBe(false);
    expect(gate.isLead).toBe(false);
    expect(gate.isPeopleOps).toBe(false);
  });
});

// route.ts:110 — `/history` allows [EMPLOYEE, INTERN, LEAD] and deliberately
// omits PEOPLE_OPS_TEAM. My History is the signed-in user's own leave, so an
// account that only holds the People Ops privilege has nothing to show there.
// Apply (route.ts:58) does list them, so only history is narrowed.
describe("who can see My History", () => {
  it("an employee can", () => {
    expect(gateFor({ privileges: [P.EMPLOYEE] }).canSee("leave-history")).toBe(true);
  });

  it("an intern can", () => {
    expect(gateFor({ privileges: [P.INTERN] }).canSee("leave-history")).toBe(true);
  });

  it("a lead can", () => {
    expect(gateFor({ privileges: [P.LEAD] }).canSee("leave-history")).toBe(true);
  });

  it("a People-Ops-only account cannot", () => {
    expect(gateFor({ privileges: [P.PEOPLE_OPS_TEAM] }).canSee("leave-history")).toBe(false);
  });

  it("but People Ops who are also an employee can", () => {
    expect(
      gateFor({ privileges: [P.EMPLOYEE, P.PEOPLE_OPS_TEAM] }).canSee("leave-history"),
    ).toBe(true);
  });

  it("Apply stays open to a People-Ops-only account", () => {
    expect(gateFor({ privileges: [P.PEOPLE_OPS_TEAM] }).canSee("leave-apply")).toBe(true);
  });
});

// A rail entry is offered when the person may open any tab inside it — not when
// they may open a tab, NOT whether they may take some kind of leave. People Ops
// cannot hold a sabbatical, but the sabbatical Report is theirs
// (route.ts:143-148). Gating the entry on the sabbatical permission alone hid a
// screen they are entitled to and left it reachable only by typing the URL.
describe("whether the rail offers Leave at all", () => {
  it("offers it to People Ops, who get both reports but can hold no leave", () => {
    const gate = gateFor({ privileges: [P.PEOPLE_OPS_TEAM] });
    expect(gate.canSee("leave-home")).toBe(true);
    expect(gate.canSee("leave-sabbatical-own")).toBe(false);
    expect(gate.canSee("leave-reports")).toBe(true);
  });

  // Applying is open to everyone, so there is no role that sees nothing —
  // which is exactly why one entry works where two did not: the second entry
  // could go empty, this one never does.
  it("offers it to every role, since applying is open to all of them", () => {
    for (const p of [P.EMPLOYEE, P.INTERN, P.LEAD, P.PEOPLE_OPS_TEAM]) {
      expect(gateFor({ privileges: [p] }).canSee("leave-home")).toBe(true);
    }
  });

  // An intern may take general leave but never a sabbatical. The entry stays;
  // what disappears is the toggle inside the tabs.
  it("still offers it to an intern, who simply gets no sabbatical", () => {
    const gate = gateFor({ privileges: [P.EMPLOYEE, P.INTERN] });
    expect(gate.canSee("leave-home")).toBe(true);
    expect(gate.canSee("leave-sabbatical-own")).toBe(false);
  });

  // The retired ids. Re-adding one to a registry without a case here would
  // fall through to RESTRICTED_IDS, which only fails closed for items that
  // declare `requires` — these declare none, so it would read as OPEN.
  it("keeps the two retired rail ids absent", () => {
    const gate = gateFor({ privileges: [P.EMPLOYEE, P.LEAD] });
    const items = ME_APPS.find((app) => app.key === "leave")?.items ?? [];
    const ids = items.map((i) => i.id);
    expect(ids).not.toContain("leave-general");
    expect(ids).not.toContain("leave-sabbatical");
    expect(gate.canSee("leave-home")).toBe(true);
  });
});

// A gate switched off by its caller is not "still resolving" — it was never
// asked. The rail does this while another perspective is active, and a screen
// that waited on it would show a skeleton that never resolves.
describe("when the caller switches the gate off", () => {
  it("is not reported as resolving", () => {
    userInfo.data = undefined;
    userInfo.isPending = true; // disabled queries stay pending for good
    userInfo.isLoading = false;
    const gate = renderHook(() => useLeaveGate(false)).result.current;
    expect(gate.isResolving).toBe(false);
  });
});


// The state that made this gate wrong once already. useLeaveUserInfo is held
// back until the Asgardeo sub resolves, so on a cold load the query is DISABLED
// and merely not-fetching: pending true, loading false. Read as "loading", that
// is a finished check holding no privileges — and the rail hides entries from
// the people who have them.
//
// Distinct from a query disabled because the person lacks a role, where nothing
// is coming and not-loading is the truth. Why it is off is what decides.
describe("while identity is still resolving", () => {
  it("reports itself as still resolving, not as a finished denial", () => {
    userInfo.data = undefined;
    userInfo.isPending = true;
    userInfo.isLoading = false; // disabled: never started, so never "loading"
    const gate = renderHook(() => useLeaveGate()).result.current;
    expect(gate.isResolving).toBe(true);
    expect(gate.canSee("leave-reports")).toBe(false);
  });
});
