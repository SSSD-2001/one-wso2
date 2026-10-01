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
import {
  PERSPECTIVES,
  PROMOTION_LEAD_PORTAL_ITEM_ID,
  SRI_LANKA_ONLY_ITEM_IDS,
  type PerspectiveSection,
} from "@constants/perspectives";
import {
  claimConflicts,
  claimOf,
  claimsForPerspective,
  foldVisibility,
  sectionIdsIn,
  type AdapterName,
  type VisibilityAdapter,
  type VisibilityShell,
} from "./visibilityFold";

function adapter(overrides: Partial<VisibilityAdapter> & Pick<VisibilityAdapter, "name">): VisibilityAdapter {
  return {
    claim: claimOf(overrides.name),
    canSee: () => true,
    resolving: false,
    retry: () => undefined,
    ...overrides,
  };
}

function shell(overrides: Partial<VisibilityShell> = {}): VisibilityShell {
  return {
    perspectiveKey: "people",
    sectionIds: new Set([PROMOTION_LEAD_PORTAL_ITEM_ID]),
    sriLankaOnlyIds: SRI_LANKA_ONLY_ITEM_IDS,
    isSriLankaEmployee: true,
    employeeRecordResolving: false,
    employeeRecordFailed: false,
    retryEmployeeRecord: () => undefined,
    capabilities: new Set(),
    ...overrides,
  };
}

describe("foldVisibility", () => {
  it("treats a still-loading promotion answer as unresolved, so the landing cannot follow it", () => {
    const folded = foldVisibility(
      [
        adapter({
          name: "promotion",
          canSee: () => false,
          resolving: true,
        }),
      ],
      shell(),
    );

    expect(folded.resolving).toBe(true);
    expect(folded.canSee({ id: PROMOTION_LEAD_PORTAL_ITEM_ID })).toBe(false);
    expect(folded.failed).toBe(false);
  });

  it("hides a Sri Lanka section before the adapter is asked", () => {
    const shown = vi.fn(() => true);
    const folded = foldVisibility(
      [adapter({ name: "subscriptions", canSee: shown })],
      shell({
        perspectiveKey: "me",
        sectionIds: new Set(["people-subscriptions-mine"]),
        isSriLankaEmployee: false,
      }),
    );

    expect(folded.canSee({ id: "people-subscriptions-mine" })).toBe(false);
    expect(shown).not.toHaveBeenCalled();
  });

  it("asks the adapter for a Sri Lanka section when the employee is in Sri Lanka", () => {
    const folded = foldVisibility(
      [adapter({ name: "subscriptions", canSee: () => true })],
      shell({
        perspectiveKey: "me",
        sectionIds: new Set(["people-subscriptions-mine"]),
        isSriLankaEmployee: true,
      }),
    );

    expect(folded.canSee({ id: "people-subscriptions-mine" })).toBe(true);
  });

  it("uses people-app capabilities only when no adapter claims the section", () => {
    const folded = foldVisibility([], shell({ capabilities: new Set(["lead"]) }));

    expect(folded.canSee({ id: "me-my-team", requires: ["lead"] })).toBe(true);
    expect(folded.canSee({ id: "me-my-team", requires: ["admin"] })).toBe(false);
    expect(folded.canSee({ id: "open-section" })).toBe(true);
  });

  it("lets the Marketing Ops adapter answer a restricted section instead of people-app capabilities", () => {
    const folded = foldVisibility(
      [adapter({ name: "marketing", canSee: () => true })],
      shell({
        perspectiveKey: "marketing",
        sectionIds: new Set(["mops-email-create"]),
        capabilities: new Set(),
      }),
    );

    expect(folded.canSee({ id: "mops-email-create", requires: ["admin"] })).toBe(true);
  });

  it("asks the Marketing Ops adapter for a group, not only its leaves", () => {
    const group: PerspectiveSection = {
      id: "mops-email",
      label: "Email",
      requires: ["admin"],
      children: [{ id: "mops-email-create", label: "Create", requires: ["admin"] }],
    };
    const shown = vi.fn(() => true);
    const folded = foldVisibility(
      [adapter({ name: "marketing", canSee: shown })],
      shell({
        perspectiveKey: "marketing",
        sectionIds: sectionIdsIn([group]),
        capabilities: new Set(),
      }),
    );

    expect(folded.canSee(group)).toBe(true);
    expect(shown).toHaveBeenCalledWith("mops-email");
  });

  it("hides a Marketing Ops section the adapter does not allow", () => {
    const folded = foldVisibility(
      [adapter({ name: "marketing", canSee: () => false })],
      shell({
        perspectiveKey: "marketing",
        sectionIds: new Set(["mops-email-create"]),
        capabilities: new Set(["admin"]),
      }),
    );

    expect(folded.canSee({ id: "mops-email-create", requires: ["admin"] })).toBe(false);
  });

  it("hides a claimed section when its adapter is not in play", () => {
    const folded = foldVisibility(
      claimsForPerspective("me").map((name) => adapter({ name, canSee: () => true })),
      shell({
        perspectiveKey: "me",
        sectionIds: new Set([PROMOTION_LEAD_PORTAL_ITEM_ID]),
        capabilities: new Set(),
      }),
    );

    expect(folded.canSee({ id: PROMOTION_LEAD_PORTAL_ITEM_ID })).toBe(false);
  });

  it("fails the authoring check when two adapters claim one section", () => {
    const overlapped = [
      adapter({ name: "finance", claim: { kind: "sections", ids: new Set(["shared"]) } }),
      adapter({ name: "due-diligence", claim: { kind: "sections", ids: new Set(["shared"]) } }),
    ];
    const overlappedShell = shell({ sectionIds: new Set(["shared"]) });

    expect(claimConflicts(overlapped, overlappedShell)).toEqual([
      "shared is claimed by finance and due-diligence",
    ]);
  });

  it("waits on the employee record, and names that failure ahead of an adapter failure", () => {
    const retryEmployeeRecord = vi.fn();
    const retryAdapter = vi.fn();
    const folded = foldVisibility(
      [adapter({ name: "sales", error: "sales", retry: retryAdapter })],
      shell({
        employeeRecordResolving: true,
        employeeRecordFailed: true,
        employeeRecordError: "record",
        retryEmployeeRecord,
      }),
    );

    expect(folded.resolving).toBe(true);
    expect(folded.failed).toBe(true);
    expect(folded.error).toBe("record");
    folded.retry();
    expect(retryEmployeeRecord).toHaveBeenCalledOnce();
    expect(retryAdapter).toHaveBeenCalledOnce();
  });

  it("names the first failed adapter, and retries every failed adapter", () => {
    const retrySales = vi.fn();
    const retrySubscriptions = vi.fn();
    const folded = foldVisibility(
      [
        adapter({ name: "sales", error: "sales", retry: retrySales }),
        adapter({ name: "subscriptions", error: "subscriptions", retry: retrySubscriptions }),
      ],
      shell(),
    );

    expect(folded.error).toBe("sales");
    folded.retry();
    expect(retrySales).toHaveBeenCalledOnce();
    expect(retrySubscriptions).toHaveBeenCalledOnce();
  });

  it("does not treat a feature that folds failure into not-allowed as a landing failure", () => {
    const folded = foldVisibility([adapter({ name: "finance", canSee: () => false })], shell());

    expect(folded.failed).toBe(false);
    expect(folded.canSee({ id: "claim-approval" })).toBe(false);
  });
});

describe("claimsForPerspective", () => {
  it("includes promotion on People Ops only while the preview flag is on", () => {
    const previous = window.config;
    window.config = { ...(previous ?? {}), ONE_WSO2_PREVIEW_FEATURES: {} } as Window["config"];
    expect(claimsForPerspective("people")).not.toContain("promotion");

    window.config = {
      ...(previous ?? {}),
      ONE_WSO2_PREVIEW_FEATURES: { promotion: true },
    } as Window["config"];
    expect(claimsForPerspective("people")).toContain("promotion");
    expect(claimsForPerspective("me")).not.toContain("promotion");
    window.config = previous;
  });

  it("puts the claiming adapter in play for every section of each real perspective", () => {
    const names = [
      "par",
      "marketing",
      "due-diligence",
      "finance",
      "leave",
      "banking",
      "banking-admin",
      "infra",
      "sales",
      "promotion",
      "security",
      "umt",
      "subscriptions",
    ] as const;
    for (const perspective of PERSPECTIVES) {
      const sectionIds = sectionIdsIn(perspective.sections ?? []);
      const inPlay = new Set(claimsForPerspective(perspective.key));
      for (const id of sectionIds) {
        for (const name of names) {
          const claim = claimOf(name);
          const covers =
            claim.kind === "sections"
              ? claim.ids.has(id)
              : claim.key === perspective.key && sectionIds.has(id);
          if (covers) expect(inPlay.has(name), `${perspective.key} ${id} claimed by ${name}`).toBe(true);
        }
      }
    }
  });

  it("covers infra, umt, and promotion when those preview flags are on", async () => {
    const previous = window.config;
    vi.resetModules();
    window.config = {
      ...(previous ?? {}),
      ONE_WSO2_PREVIEW_FEATURES: { infra: true, umt: true, promotion: true },
    } as Window["config"];
    const { PERSPECTIVES: flagged } = await import("@constants/perspectives");
    const fold = await import("./visibilityFold");
    const keys = flagged.map((perspective) => perspective.key);
    expect(keys).toEqual(expect.arrayContaining(["infra", "umt"]));
    const people = flagged.find((perspective) => perspective.key === "people");
    expect(fold.sectionIdsIn(people?.sections ?? []).has("promotion-lead-portal")).toBe(true);
    expect(fold.claimsForPerspective("people")).toContain("promotion");

    const names = [
      "par",
      "marketing",
      "due-diligence",
      "finance",
      "leave",
      "banking",
      "banking-admin",
      "infra",
      "sales",
      "promotion",
      "security",
      "umt",
      "subscriptions",
    ] as const;
    for (const perspective of flagged) {
      const sectionIds = fold.sectionIdsIn(perspective.sections ?? []);
      const inPlay = new Set(fold.claimsForPerspective(perspective.key));
      for (const id of sectionIds) {
        for (const name of names) {
          const claim = fold.claimOf(name);
          const covers =
            claim.kind === "sections"
              ? claim.ids.has(id)
              : claim.key === perspective.key && sectionIds.has(id);
          if (covers) expect(inPlay.has(name), `${perspective.key} ${id} claimed by ${name}`).toBe(true);
        }
      }
      const adapters = fold.claimsForPerspective(perspective.key).map((name) => adapter({ name }));
      expect(fold.claimConflicts(adapters, shell({ perspectiveKey: perspective.key, sectionIds })), perspective.key).toEqual(
        [],
      );
    }
    window.config = previous;
  });

  it("gives every real perspective a single owner per section", () => {
    const keys = new Set<string>([
      ...PERSPECTIVES.map((perspective) => perspective.key),
      "people",
      "me",
      "finance",
      "legal",
      "marketing",
      "sales",
      "security",
      "infra",
      "umt",
      "engineering",
    ]);

    for (const key of keys) {
      const perspective = PERSPECTIVES.find((candidate) => candidate.key === key);
      const sectionIds = sectionIdsIn(perspective?.sections ?? []);
      const adapters = claimsForPerspective(key).map((name) => adapter({ name }));
      expect(claimConflicts(adapters, shell({ perspectiveKey: key, sectionIds })), key).toEqual([]);
    }
  });

  it("claims Marketing Ops as a whole perspective", () => {
    expect(claimOf("marketing")).toEqual({ kind: "perspective", key: "marketing" });
  });
});

describe("claimOf", () => {
  it("is exhaustive", () => {
    const names: AdapterName[] = [
      "par",
      "marketing",
      "due-diligence",
      "finance",
      "mis",
      "leave",
      "banking",
      "banking-admin",
      "infra",
      "sales",
      "promotion",
      "security",
      "umt",
      "subscriptions",
    ];
    for (const name of names) {
      expect(claimOf(name)).toBeTruthy();
    }
  });
});
