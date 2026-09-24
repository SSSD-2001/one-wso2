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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// UMT is behind a preview flag, so the registry depends on `window.config`
// and has to be imported fresh per state rather than once at the top of the
// file.
type Perspectives = typeof import("./perspectives");

async function load(preview: { umt?: boolean; infra?: boolean } = {}): Promise<Perspectives> {
  vi.resetModules();
  window.config = {
    ...(window.config ?? {}),
    ONE_WSO2_PREVIEW_FEATURES: preview,
  } as Window["config"];
  return import("./perspectives");
}

const originalConfig = window.config;
beforeEach(() => vi.resetModules());
afterEach(() => {
  window.config = originalConfig;
});

const keys = (perspectives: readonly { key: string }[]) => perspectives.map((p) => p.key);

// PAR shipped out of preview once the Lead Portal, Admin Portal, Report
// Chain and F2F all followed the Employee Portal over — see
// docs/ported-apps/par-app.md. Its rail entry is unconditional now, so
// there's nothing left to gate-test here.
describe("PAR's People Ops rail entry", () => {
  it("is always present", async () => {
    const { PEOPLE_OPS_SECTIONS } = await load();
    expect(PEOPLE_OPS_SECTIONS.map((s) => s.id)).toContain("people-par");
  });

  it("leaves the sections that are not gated alone", async () => {
    const { PEOPLE_OPS_SECTIONS } = await load();
    expect(PEOPLE_OPS_SECTIONS.map((s) => s.id)).toContain("people-org-chart");
  });
});

describe("the UMT perspective", () => {
  it("is absent from the registry when the preview flag is off", async () => {
    const { PERSPECTIVES, FUNCTIONAL_PERSPECTIVES, reachablePerspectives } = await load({
      umt: false,
    });
    expect(keys(PERSPECTIVES)).not.toContain("umt");
    expect(keys(FUNCTIONAL_PERSPECTIVES)).not.toContain("umt");
    expect(keys(reachablePerspectives())).not.toContain("umt");
  });

  it("is absent on an absent flag, not only on an explicit false", async () => {
    // Production ships no entry at all; safety must not depend on remembering
    // to write `false`.
    const { PERSPECTIVES } = await load();
    expect(keys(PERSPECTIVES)).not.toContain("umt");
  });

  it("is present, built and routable, when the preview flag is on", async () => {
    const { PERSPECTIVES, reachablePerspectives, findPerspectiveByKey, findPerspectiveByPath } =
      await load({ umt: true });
    expect(keys(PERSPECTIVES)).toContain("umt");
    expect(keys(reachablePerspectives())).toContain("umt");
    expect(findPerspectiveByKey("umt")?.path).toBe("/umt");
    expect(findPerspectiveByPath("/umt")?.key).toBe("umt");
  });

  it("does not disturb the other perspectives whatever the flag says", async () => {
    for (const preview of [{}, { umt: true }]) {
      const { PERSPECTIVES } = await load(preview);
      expect(keys(PERSPECTIVES)).toEqual(
        expect.arrayContaining(["people", "finance", "legal", "csm", "marketing", "me"]),
      );
    }
  });

  // usePerspectiveVisibility falls through to sectionAllowed(s.requires, caps)
  // for any id not in a gate's own set — and umt-products deliberately sets no
  // `requires`, so that fallback answers "visible to everyone". Dropping this
  // id from the set would open the admin-only rail entry to every UMT user
  // with a green suite and no compile error; this fails loudly instead. See
  // useFinanceGate.test.tsx's "no longer carries the retired approval ids" for
  // the same shape of guard.
  it("keeps Product Management in the UMT admin gate set", async () => {
    const { UMT_ADMIN_ITEM_IDS } = await load({ umt: true });
    expect(UMT_ADMIN_ITEM_IDS.has("umt-products")).toBe(true);
  });
});

describe("perspectives whose landing forwards to the first rail item", () => {
  // The flag is only meaningful on a perspective that HAS a landing route and
  // HAS rows to forward to. Set on one without sections it would mean everyone
  // sees "Nothing here for you yet", permanently, with no way to tell that
  // from a privilege problem.
  it("only ever sits on a perspective with a route and sections", async () => {
    const { PERSPECTIVES } = await load({ umt: true });
    const forwarding = PERSPECTIVES.filter((p) => p.forwardsToFirstItem);
    expect(forwarding.length).toBeGreaterThan(0);
    for (const p of forwarding) {
      expect(p.path, `${p.key} forwards but has no route`).toBeTruthy();
      expect(p.sections?.length, `${p.key} forwards but has no sections`).toBeTruthy();
    }
  });

  // Me's landing is the person's own profile — a page someone stops and reads,
  // so it keeps its Overview row. This fails if a later pass sweeps it up with
  // the rest.
  it("leaves Me alone", async () => {
    const { PERSPECTIVES } = await load({ umt: true });
    expect(PERSPECTIVES.find((p) => p.key === "me")?.forwardsToFirstItem).toBeUndefined();
  });

  // Infra Portal is behind a preview flag, so the registry depends on
  // `window.config` and has to be imported fresh per state rather than once at
  // the top of the file.
  describe("the Infra Portal perspective", () => {
    it("is absent from the registry when the preview flag is off", async () => {
      const { PERSPECTIVES, reachablePerspectives } = await load({ infra: false });
      expect(keys(PERSPECTIVES)).not.toContain("infra");
      expect(keys(reachablePerspectives())).not.toContain("infra");
    });
  
    it("is absent on an absent flag, not only on an explicit false", async () => {
      const { PERSPECTIVES } = await load();
      expect(keys(PERSPECTIVES)).not.toContain("infra");
    });
  
    it("is present, built and routable, when the preview flag is on", async () => {
      const { PERSPECTIVES, reachablePerspectives, findPerspectiveByPath } = await load({
        infra: true,
      });
      expect(keys(PERSPECTIVES)).toContain("infra");
      expect(keys(reachablePerspectives())).toContain("infra");
      expect(findPerspectiveByPath("/infra")?.key).toBe("infra");
    });
  });
});
