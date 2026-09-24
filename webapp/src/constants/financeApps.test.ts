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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The expense app is behind a preview flag, so the registry is no longer a
 * constant — it depends on `window.config`. Everything here therefore imports
 * it fresh per state rather than at the top of the file.
 */
type FinanceApps = typeof import("./financeApps");

async function load(
  preview: {
    financeOverview?: boolean;
  } = {},
): Promise<FinanceApps> {
  vi.resetModules();
  window.config = {
    ...(window.config ?? {}),
    ONE_WSO2_PREVIEW_FEATURES: preview,
  } as Window["config"];
  return import("./financeApps");
}

const originalConfig = window.config;
beforeEach(() => vi.resetModules());
afterEach(() => {
  window.config = originalConfig;
});

// Which perspective an app belongs to is a decision, and nothing used to record
// it — the apps simply appeared wherever the registry happened to be spread.

const keys = (apps: readonly { key: string }[]) => apps.map((a) => a.key);
const paths = (apps: readonly { items: readonly { path?: string }[] }[]) =>
  apps.flatMap((a) => a.items.map((i) => i.path ?? ""));
const itemIds = (apps: readonly { items: readonly { id: string }[] }[]) =>
  apps.flatMap((a) => a.items.map((i) => i.id));

describe("where each finance app lives", () => {
  // Everyone files claims. Not everyone has a corporate card, which is why the
  // card app is not part of the set every employee needs.
  //
  // Expense Claims used to have its own Finance-perspective entry here, the
  // way "expense" once did — New Claim, Claim History, and both Approvals
  // stages, each on its own screens under expense/submitter, expense/history
  // and expense/approvals. Retired item by item as each moved elsewhere, until
  // nothing was left of the group itself.
  it("keeps claims with the person, and the card with finance", async () => {
    const { ME_FINANCE_APPS, FINANCE_OVERVIEW_APPS, FINANCE_PERSPECTIVE_APPS } = await load({
      financeOverview: true,
    });
    expect(keys(ME_FINANCE_APPS)).toEqual(["claims"]);
    expect(keys(FINANCE_PERSPECTIVE_APPS)).toEqual(["cc"]);
    // Reading how the allowance is spent is a different job from filing or
    // approving a claim, so the dashboards sit in their own section above the
    // apps rather than one inside each of them.
    expect(keys(FINANCE_OVERVIEW_APPS)).toEqual(["finance-overview"]);
  });

  // New Claim and Claim History both moved out from under this app entirely —
  // they live at Me → Claims now, on-behalf filing and all. Lead/Finance
  // Approvals moved to Claim Approval earlier still. Nothing is left of the
  // group, so it no longer appears in the registry at all.
  it("no longer carries the Expense Claims group or any of its items", async () => {
    const { FINANCE_PERSPECTIVE_APPS } = await load();
    expect(keys(FINANCE_PERSPECTIVE_APPS)).not.toContain("expense");
    for (const retired of [
      "expense-new",
      "expense-history",
      "expense-lead-approvals",
      "expense-finance-approvals",
    ]) {
      expect(itemIds(FINANCE_PERSPECTIVE_APPS)).not.toContain(retired);
    }
  });

  it("puts every app KEY in exactly one of the two", async () => {
    const { FINANCE_APPS, ME_FINANCE_APPS, FINANCE_OVERVIEW_APPS, FINANCE_PERSPECTIVE_APPS } =
      await load({ financeOverview: true });
    const financeSide = [...keys(FINANCE_OVERVIEW_APPS), ...keys(FINANCE_PERSPECTIVE_APPS)];
    const overlap = keys(ME_FINANCE_APPS).filter((k) => financeSide.includes(k));
    expect(overlap).toEqual([]);
    expect(keys(FINANCE_APPS).sort()).toEqual([
      "cc",
      "claims",
      "finance-overview",
    ]);
  });

  // A path under the wrong perspective is a rail entry that navigates out of
  // the perspective it was clicked in.
  it("gives each app paths under the perspective it is surfaced in", async () => {
    const { ME_FINANCE_APPS, FINANCE_PERSPECTIVE_APPS } = await load();
    for (const path of paths(ME_FINANCE_APPS)) expect(path.startsWith("/me/")).toBe(true);
    for (const path of paths(FINANCE_PERSPECTIVE_APPS)) {
      expect(path.startsWith("/finance/")).toBe(true);
    }
  });

  it("routes every finance item through the finance gate", async () => {
    const { FINANCE_APPS, FINANCE_ITEM_IDS } = await load();
    for (const app of FINANCE_APPS) {
      for (const item of app.items) {
        expect(FINANCE_ITEM_IDS.has(item.id), `${item.id} bypasses the gate`).toBe(true);
      }
    }
  });

  // Hiding an app must not take the whole registry down. FINANCE_EYEBROW.claims
  // and .cc are built by looking their app up in the registry — an absent app
  // used to throw there before anything rendered. .opd is a literal precisely
  // because it CAN be hidden by a flag while its route stays reachable by URL,
  // so it must keep a real label either way.
  it("still builds every eyebrow when opd is hidden", async () => {
    const { FINANCE_EYEBROW } = await load();
    expect(FINANCE_EYEBROW.claims.label).toBeTruthy();
    expect(FINANCE_EYEBROW.cc.label).toBeTruthy();
    expect(FINANCE_EYEBROW.opd.label).toBeTruthy();
  });
});

// Finance Overview is new ground — a Credit Card Expenses dashboard moved out
// of its own app, and an OPD Claims dashboard — and has not run against a
// real account yet. The whole group is held back, not the items inside it.
describe("the Finance Overview preview flag", () => {
  it("hides the group when the flag is off", async () => {
    const { FINANCE_OVERVIEW_APPS, FINANCE_APPS } = await load();
    expect(keys(FINANCE_OVERVIEW_APPS)).toEqual([]);
    expect(keys(FINANCE_APPS)).not.toContain("finance-overview");
  });

  it("shows it when the flag is on", async () => {
    const { FINANCE_OVERVIEW_APPS } = await load({ financeOverview: true });
    expect(keys(FINANCE_OVERVIEW_APPS)).toEqual(["finance-overview"]);
  });
});
