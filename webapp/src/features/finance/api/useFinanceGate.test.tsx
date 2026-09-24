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
import { renderHook } from "@testing-library/react";

// Three backends, three vocabularies, none of them the people-app roles the
// rail normally reads. These are the rules the standalone apps enforce, so they
// are asserted against what those apps actually do:
//
//   OPD      userSlice.ts:38-40   role 555 approves, 444 is submit-only
//   Expense  appDataSlice.ts:99-103   two independent booleans
//   CC       privilege names on /user-info

const roles = {
  /** OPD `userRoles`. 444 = submitter, 555 = finance approver. */
  opd: [] as number[],
  expenseLead: false,
  expenseFinance: false,
  cc: [] as string[],
  loading: false,
};

vi.mock("../cc/useCc", () => ({
  useCcUserInfo: () => ({ data: { privileges: roles.cc }, isLoading: roles.loading }),
}));
vi.mock("../opd/useOpd", () => ({
  useOpdUserInfo: () => ({ data: { userRoles: roles.opd }, isLoading: roles.loading }),
}));
vi.mock("../expense/useExpense", () => ({
  useExpenseAppData: () => ({
    data: { enableLeadView: roles.expenseLead, enableFinanceView: roles.expenseFinance },
    isLoading: roles.loading,
  }),
}));

const { useFinanceGate } = await import("./useFinanceGate");
const { FINANCE_ITEM_IDS } = await import("@constants/financeApps");

const gate = () => renderHook(() => useFinanceGate()).result.current;

beforeEach(() => {
  roles.opd = [];
  roles.expenseLead = false;
  roles.expenseFinance = false;
  roles.cc = [];
  roles.loading = false;
});

// The entry appears when ANY claim is approvable. Requiring all three would
// hide the screen from almost everyone: holding every role on three separate
// backends is the rare case, not the common one.
describe("the Claim approval entry", () => {
  it("is offered to someone who only approves OPD", () => {
    roles.opd = [555];
    expect(gate().canSee("claim-approval")).toBe(true);
  });

  it("is offered to someone who only leads expense claims", () => {
    roles.expenseLead = true;
    expect(gate().canSee("claim-approval")).toBe(true);
  });

  it("is offered to someone who only signs off expense claims", () => {
    roles.expenseFinance = true;
    expect(gate().canSee("claim-approval")).toBe(true);
  });

  // CC approving does not live here at all — it is decided entirely under
  // Credit Card Expenses — so holding only a CC role does not open this entry.
  it("is withheld from someone who only approves credit card submissions", () => {
    roles.cc = ["lead"];
    expect(gate().canSee("claim-approval")).toBe(false);
  });

  it("is withheld from someone who approves no claims", () => {
    roles.opd = [444]; // can submit, cannot approve
    expect(gate().canSee("claim-approval")).toBe(false);
  });
});

// The entries that stayed under Me keep the rules they had.
describe("what stayed behind", () => {
  it("leaves the per-user views open", () => {
    expect(gate().canSee("claims")).toBe(true);
    expect(gate().canSee("cc-history")).toBe(true);
  });

  // The approval ids are gone from the registry — Lead/Finance Approvals were
  // retired once Claim Approval's own Expense tab covered the same queues —
  // so their cases were dead code answering a question nothing asks. They
  // fall through to the open default now, which is safe precisely because no
  // rail entry names them — asserted so that a future entry reusing the name
  // cannot quietly go open. cc-approve is NOT one of these: it is a live item
  // again, restored under Credit Card Expenses.
  it("no longer carries the retired approval ids", () => {
    for (const retired of [
      "opd-approvals",
      "expense-lead",
      "expense-finance",
      "expense-lead-approvals",
      "expense-finance-approvals",
      "expense-new",
      "expense-history",
    ]) {
      expect(FINANCE_ITEM_IDS.has(retired), `${retired} is still a rail item`).toBe(false);
    }
  });

  // Claim approval is not an item of any single app, so it is named into the
  // set by hand — without that the rail would fall back to people-app
  // capabilities, which cannot express "expense finance approver".
  it("routes the claim-approval entry through this gate", () => {
    expect(FINANCE_ITEM_IDS.has("claim-approval")).toBe(true);
  });
});

// Approve Submissions — the only place a CC submission is decided on, now
// that it no longer has a tab in Claim Approval.
describe("the cc-approve item", () => {
  it("opens on either privilege alone", () => {
    roles.cc = ["lead"];
    expect(gate().canSee("cc-approve")).toBe(true);
    roles.cc = ["finance"];
    expect(gate().canSee("cc-approve")).toBe(true);
  });

  it("is not opened by the OPD or expense roles", () => {
    roles.opd = [555];
    roles.expenseLead = true;
    roles.expenseFinance = true;
    expect(gate().canSee("cc-approve")).toBe(false);
  });
});

// The Overview group has two dashboard tiles now, gated differently: Credit
// Card Expenses has no backend role of its own — it is everyone's own
// numbers — so its group's preview flag is the only gate. OPD Claims has its
// own backend role too, but the group's preview flag comes first: holding
// the role means nothing while Overview itself is hidden.
describe("the Finance Overview dashboards", () => {
  const originalConfig = window.config;
  afterEach(() => {
    window.config = originalConfig;
  });

  it("refuses the credit card dashboard when the group's flag is absent", () => {
    window.config = { ...(window.config ?? {}) } as Window["config"];
    delete (window.config as { ONE_WSO2_PREVIEW_FEATURES?: unknown }).ONE_WSO2_PREVIEW_FEATURES;
    expect(gate().canSee("cc-dashboard")).toBe(false);
  });

  it("allows the credit card dashboard when the group's flag is on", () => {
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_PREVIEW_FEATURES: { financeOverview: true },
    } as Window["config"];
    expect(gate().canSee("cc-dashboard")).toBe(true);
  });

  it("refuses the OPD dashboard when the group's flag is absent, role or not", () => {
    window.config = { ...(window.config ?? {}) } as Window["config"];
    delete (window.config as { ONE_WSO2_PREVIEW_FEATURES?: unknown }).ONE_WSO2_PREVIEW_FEATURES;
    roles.opd = [555];
    expect(gate().canSee("opd-dashboard")).toBe(false);
  });

  it("allows the OPD dashboard when the group's flag is on and the role is held", () => {
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_PREVIEW_FEATURES: { financeOverview: true },
    } as Window["config"];
    roles.opd = [555];
    expect(gate().canSee("opd-dashboard")).toBe(true);
  });
});
