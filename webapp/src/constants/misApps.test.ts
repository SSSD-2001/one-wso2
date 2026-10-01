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
import { MIS_APPS, MIS_ITEM_IDS } from "./misApps";
import { FINANCE_ITEM_IDS } from "./financeApps";
import { LEAVE_ITEM_IDS } from "./meApps";
import { PERSPECTIVES } from "./perspectives";

// The MIS rail entries are behind the `mis` preview flag (previewFeatures.ts),
// and the registry is read once, at import — so the flag has to be on before it
// is. Its OFF half is pinned in perspectives.test.ts.
vi.hoisted(() => {
  window.config = {
    ...(window.config ?? {}),
    ONE_WSO2_PREVIEW_FEATURES: { mis: true },
  } as Window["config"];
});

const items = MIS_APPS.flatMap((app) => app.items);

describe("the Finance MIS registry", () => {
  // Not /finance-mis/*. `findPerspectiveByPath` matches with a bare
  // `pathname.startsWith`, so "/finance-mis" resolves to the `finance`
  // perspective and renders its rail around a MIS screen. The prefix has to
  // nest, not merely resemble.
  it("puts every routed screen under the Finance perspective's path", () => {
    const routed = items.filter((item) => item.path !== undefined);
    expect(routed.length, "no MIS screen is routed at all").toBeGreaterThan(0);
    for (const item of routed) {
      expect(item.path, `${item.id} is not under /finance/mis/`).toMatch(/^\/finance\/mis\//);
    }
  });

  // A rail entry that navigates nowhere is worse than one that isn't there. A
  // screen carries no `path` until the change that adds its route — so this
  // asserts the two are never out of step.
  // Every screen in the registry is now routed; a future one joins this list
  // and `App.tsx` in the same change, never the registry alone.
  it("gives a path only to screens that have a route", () => {
    const routed = items.filter((item) => item.path !== undefined).map((item) => item.id);
    expect(routed.sort()).toEqual([
      "mis-analysis",
      "mis-arr-build",
      "mis-mrr-build",
      "mis-qrr-build",
    ]);
  });

  // These four are the registry. An extra id, with or without a path, fails here.
  it("lists exactly the four screens", () => {
    expect(items.map((item) => item.id).sort()).toEqual([
      "mis-analysis",
      "mis-arr-build",
      "mis-mrr-build",
      "mis-qrr-build",
    ]);
  });

  // ARR Analysis is in the registry unconditionally, and has to be: the
  // `productsUsageEnabled` flag that decides whether it exists is a per-reader
  // runtime answer from GET /app-configs, where this list is a module constant
  // evaluated once at import. The rail hides the row by asking `useMisGate`,
  // which folds the flag in — see the gate's ARR Analysis case.
  it("lists ARR Analysis, and leaves the flag to the gate", () => {
    const analysis = items.find((item) => item.id === "mis-analysis");
    expect(analysis?.path).toBe("/finance/mis/analysis");
  });

  // The load-bearing one. SideRail dispatches by id-set: an id in no set falls
  // through to `sectionAllowed(s.requires, caps)`, which reads One WSO2's
  // capabilities — where 987 means "every authenticated user". A MIS screen
  // that misses this set is not merely ungated, it is published to the company.
  it("routes every screen through the MIS gate, not the shared capabilities", () => {
    for (const item of items) {
      expect(MIS_ITEM_IDS.has(item.id), `${item.id} bypasses useMisGate`).toBe(true);
    }
  });

  // The dispatch is a first-match if-ladder, so a shared id would be claimed by
  // whichever set is tested first and gated by the wrong backend entirely.
  it("shares no id with the finance or leave registries", () => {
    for (const id of MIS_ITEM_IDS) {
      expect(FINANCE_ITEM_IDS.has(id), `${id} collides with a finance item`).toBe(false);
      expect(LEAVE_ITEM_IDS.has(id), `${id} collides with a leave item`).toBe(false);
    }
  });

  // Every MIS screen is restricted — there is no MIS view a signed-in stranger
  // may see. `requires` is only a coarse hint (the gate decides), but an item
  // without it reads as public to anyone scanning the registry, and would fall
  // open if it ever dropped out of MIS_ITEM_IDS.
  it("marks every screen restricted", () => {
    for (const item of items) {
      expect(item.requires ?? [], `${item.id} reads as public`).not.toEqual([]);
    }
  });

  it("reaches the rail as a group under Finance", () => {
    const finance = PERSPECTIVES.find((p) => p.key === "finance");
    const sectionIds = (finance?.sections ?? []).map((s) => s.id);
    for (const app of MIS_APPS) {
      expect(sectionIds, `${app.key} is not in the Finance rail`).toContain(`sec-app-${app.key}`);
    }
  });
});
