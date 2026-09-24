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

// Guards the wiring between the People Ops rail entries and the report
// routes. A section whose `path` doesn't match the route registered in
// App.tsx fails silently — the rail navigates to a URL that renders nothing
// — so the paths are asserted against the shared constants here.

import { describe, expect, it } from "vitest";
import { PEOPLE_OPS_SECTIONS, SUBSCRIPTION_ITEM_IDS } from "@constants/perspectives";
import {
  ACTIVE_EMPLOYEES_REPORT_PATH,
  ORG_STRUCTURE_PATH,
  RESIGNATIONS_REPORT_PATH,
} from "@features/people-ops/reports/reportRoutes";

function section(id: string) {
  return PEOPLE_OPS_SECTIONS.find((s) => s.id === id);
}

describe("People Ops rail sections", () => {
  it("points the Active employees entry at the report route", () => {
    expect(section("people-active-employee-report")).toMatchObject({
      label: "Active Employees",
      path: ACTIVE_EMPLOYEES_REPORT_PATH,
      requires: ["admin"],
    });
  });

  it("points the Resignations entry at the report route", () => {
    expect(section("people-resignation-report")).toMatchObject({
      label: "Resignations",
      path: RESIGNATIONS_REPORT_PATH,
      requires: ["admin"],
    });
  });

  it("routes Master data through a child, not the group itself", () => {
    // Master data is a GROUP: more of its screens are still to be ported, so
    // the route hangs off a child and the group has no path of its own. The
    // overview card and the rail both key off that distinction.
    const masterData = section("people-master-data");
    expect(masterData?.path).toBeUndefined();
    expect(masterData?.children).toHaveLength(1);
    expect(masterData?.children?.[0]).toMatchObject({
      label: "Org Structure",
      path: ORG_STRUCTURE_PATH,
      requires: ["admin"],
    });
  });

  it("gates every live screen on admin, nested ones included, except the documented exceptions", () => {
    // These screens are org-wide and the backend serves them to admins only.
    // A live section without `requires` would advertise itself to everyone
    // and hand them a 403. Children count: that is where Master data's
    // route lives, so checking only the top level would miss it entirely.
    //
    // Org Chart is one deliberate exception — same people-app backend, a
    // different endpoint with its own access model (any employee in that
    // endpoint's configured group, not a people-app admin privilege). See
    // the comment above PEOPLE_OPS_SECTIONS and docs/ported-apps/org-chart.md §4.
    //
    // The two Subscriptions screens are the others, and for a different
    // reason worth keeping straight from Org Chart's. They do not talk to
    // people-app at all: they gate on the SUBSCRIPTION service's own Asgardeo
    // groups, whose names that service publishes on /subscriptions/meta-info.
    // `requires: ["admin"]` would be actively wrong on them — a People Ops
    // admin is not a commute or LaaS admin, so it would advertise the manage
    // screen to the wrong people AND hide it from the right ones. The rail and
    // the overview card both route these ids through useSubscriptionGate
    // instead; see SUBSCRIPTION_ITEM_IDS and docs/ported-apps/subscription-app.md §5.
    //
    // Note what this leaves unguarded: nothing checks here that those two ids
    // ARE in SUBSCRIPTION_ITEM_IDS, so the next assertion does that — dropping
    // an id from both places would otherwise look like a passing test.
    //
    // The two PAR entries are a third kind of exception: par-app has its own
    // role model (team lead / admin), unrelated to people-app's generic
    // "admin" capability. `requires: ["admin"]` would be wrong here the same
    // way it would on Subscriptions — a People Ops admin isn't necessarily a
    // PAR admin or a team lead, and vice versa. The rail routes these two
    // through ParRequiresTeamLeadRoute/ParRequiresAdminRoute instead (see
    // perspectives.ts's own comment above the PAR group) — that each one
    // actually reaches its gate and redirects a non-lead/non-admin away is
    // asserted in ParLeadTabRouting.test.tsx/ParAdminTabRouting.test.tsx,
    // not here.
    const NOT_ADMIN_GATED = new Set([
      "people-org-chart",
      "people-subscriptions-mine",
      "people-subscriptions-manage",
      "par-lead-portal",
      "par-admin-portal",
    ]);
    const live = PEOPLE_OPS_SECTIONS.flatMap((s) => [s, ...(s.children ?? [])]).filter(
      (s) => s.path,
    );
    expect(live.length).toBeGreaterThan(0);
    for (const s of live) {
      if (NOT_ADMIN_GATED.has(s.id)) {
        expect(s.requires).toBeUndefined();
      } else {
        expect(s.requires).toEqual(["admin"]);
      }
    }
  });

  it("routes the Subscriptions ids through the subscription gate instead", () => {
    // The other half of the exemption above. Those two ids carry no
    // `requires`, so the ONLY thing keeping the manage screen off an ordinary
    // employee's rail is membership of this set — remove an id from it and the
    // rail falls through to `sectionAllowed(undefined, caps)`, which is true
    // for everyone, with no test failing to say so.
    expect(SUBSCRIPTION_ITEM_IDS.has("people-subscriptions-mine")).toBe(true);
    expect(SUBSCRIPTION_ITEM_IDS.has("people-subscriptions-manage")).toBe(true);
  });
});
