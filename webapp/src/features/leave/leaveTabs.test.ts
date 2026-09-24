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

import { describe, expect, it } from "vitest";
import {
  LEAVE_PATH,
  LEAVE_TABS,
  firstAllowedPath,
  hasAnyLeaveTab,
  leavePath,
  leaveTab,
  parseLeavePath,
  visibleKinds,
  visibleTabs,
} from "./leaveTabs";
import { ME_APPS } from "@constants/meApps";

/** A gate that allows exactly the ids given. */
const allowing = (...ids: string[]) => (id: string) => ids.includes(id);

const EVERYTHING = allowing(
  "leave-apply",
  "leave-history",
  "leave-reports",
  "leave-approve",
  "leave-sabbatical-own",
);

describe("the shape of the Leave app", () => {
  it("is one rail entry, not one per kind of leave", () => {
    const items = ME_APPS.find((app) => app.key === "leave")?.items ?? [];
    expect(items.map((i) => i.id)).toEqual(["leave-home"]);
    expect(items[0].path).toBe(LEAVE_PATH);
  });

  it("names its tabs for what you do, not for the kind of leave", () => {
    expect(LEAVE_TABS.map((t) => t.label)).toEqual([
      "Apply",
      "My history",
      "Approvals",
      "Approval history",
      "Reports",
    ]);
  });

  it("keeps every segment unique, so no two tabs claim one URL", () => {
    const segments = LEAVE_TABS.map((t) => t.segment);
    expect(new Set(segments).size).toBe(segments.length);
  });

  // Every tab body is reached through a gate. A kind added without one would
  // fall through to whatever the default happens to be.
  it("gives every kind of every tab a gate", () => {
    for (const tab of LEAVE_TABS) {
      expect(tab.kinds.length, `${tab.segment} has no kinds`).toBeGreaterThan(0);
      for (const kind of tab.kinds) {
        expect(kind.gateId, `${tab.segment}/${kind.kind}`).toBeTruthy();
        expect(kind.subtitle.length, `${tab.segment}/${kind.kind}`).toBeGreaterThan(0);
      }
    }
  });

  // THE asymmetry this refactor had to decide. General leave is created
  // already approved, so there is no general approve step for anyone — the
  // tab offers one kind and says why in its subtitle, rather than showing a
  // disabled half-toggle that implies it might unlock.
  it("offers Approvals for sabbaticals only, and says why", () => {
    const approvals = leaveTab("approvals")!;
    expect(approvals.kinds.map((k) => k.kind)).toEqual(["sabbatical"]);
    expect(approvals.kinds[0].subtitle).toContain("approved the moment you submit it");
  });
});

describe("paths", () => {
  it("names the kind for a tab that offers two", () => {
    expect(leavePath(leaveTab("apply")!, "sabbatical")).toBe("/me/leave/apply/sabbatical");
  });

  // A single-kind tab has no choice to name, so naming one would invent a
  // second option in the URL that the page does not have.
  it("leaves the kind out of a tab that offers one", () => {
    expect(leavePath(leaveTab("approvals")!, "sabbatical")).toBe("/me/leave/approvals");
  });

  it("round-trips through parseLeavePath", () => {
    for (const tab of LEAVE_TABS) {
      for (const kind of tab.kinds) {
        const parsed = parseLeavePath(leavePath(tab, kind.kind));
        expect(parsed.tab?.segment).toBe(tab.segment);
        expect(parsed.kind?.kind).toBe(kind.kind);
      }
    }
  });

  it("implies the only kind of a single-kind tab", () => {
    expect(parseLeavePath("/me/leave/approvals").kind?.kind).toBe("sabbatical");
  });

  it("returns nothing for a segment it does not know", () => {
    expect(parseLeavePath("/me/leave/nonsense")).toEqual({});
    expect(parseLeavePath("/somewhere/else")).toEqual({});
  });
});

describe("what each role is offered", () => {
  it("gives a lead everything", () => {
    expect(visibleTabs(EVERYTHING).map((t) => t.segment)).toEqual([
      "apply",
      "history",
      "approvals",
      "approval-history",
      "reports",
    ]);
  });

  it("gives a plain employee the two screens about their own leave", () => {
    const employee = allowing("leave-apply", "leave-history", "leave-sabbatical-own");
    expect(visibleTabs(employee).map((t) => t.segment)).toEqual(["apply", "history"]);
  });

  // An intern may apply for general leave but never for a sabbatical, so the
  // tabs stay while the toggle inside them collapses to one option.
  it("withholds the sabbatical toggle from an intern", () => {
    const intern = allowing("leave-apply", "leave-history");
    expect(visibleTabs(intern).map((t) => t.segment)).toEqual(["apply", "history"]);
    expect(visibleKinds(leaveTab("apply")!, intern).map((k) => k.kind)).toEqual(["general"]);
    expect(visibleKinds(leaveTab("history")!, intern).map((k) => k.kind)).toEqual(["general"]);
  });

  // The reason the tab gate asks "may you open a kind of this" rather than
  // "may you take this kind of leave": a People-Ops-only account holds no
  // leave of its own but does get both reports.
  it("gives a People-Ops-only account Apply and both reports", () => {
    const peopleOps = allowing("leave-apply", "leave-reports");
    expect(visibleTabs(peopleOps).map((t) => t.segment)).toEqual(["apply", "reports"]);
    expect(visibleKinds(leaveTab("reports")!, peopleOps).map((k) => k.kind)).toEqual([
      "general",
      "sabbatical",
    ]);
  });

  it("offers the rail entry to anyone with a single tab, and to nobody with none", () => {
    expect(hasAnyLeaveTab(allowing("leave-apply"))).toBe(true);
    expect(hasAnyLeaveTab(allowing())).toBe(false);
  });
});

describe("where /me/leave lands", () => {
  it("sends a lead to the first tab at its first kind", () => {
    expect(firstAllowedPath(EVERYTHING)).toBe("/me/leave/apply/general");
  });

  // THE bug this guards: landing on a kind the visitor cannot open. An intern
  // must reach Apply at general, never at sabbatical.
  it("never lands on a kind the visitor cannot open", () => {
    const cases = [
      allowing("leave-apply"),
      allowing("leave-history"),
      allowing("leave-reports"),
      allowing("leave-approve"),
      allowing("leave-apply", "leave-sabbatical-own"),
      // The discriminating one: the first tab is visible, but its FIRST
      // DEFINED kind is not the one this gate allows. No role hits this today
      // — applying for general leave is open to everybody — but the next kind
      // added could, and landing must follow what is allowed rather than what
      // is listed first.
      allowing("leave-sabbatical-own"),
      allowing("leave-history", "leave-sabbatical-own"),
    ];
    for (const canSee of cases) {
      const landed = parseLeavePath(firstAllowedPath(canSee)!);
      expect(landed.kind).toBeDefined();
      expect(canSee(landed.kind!.gateId)).toBe(true);
    }
  });

  it("sends someone who may see nothing nowhere at all", () => {
    expect(firstAllowedPath(allowing())).toBeUndefined();
  });
});
