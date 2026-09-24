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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";

// Both tabs — Needs You and Decided — share one gate id: everything waiting
// on this person, or already decided, across every claim type. What a person
// is let into is all-or-nothing now, not tab by tab; the queues themselves are
// covered by their own suites.

const state = { allow: new Set<string>(), isResolving: false };

vi.mock("../api/useFinanceGate", () => ({
  useFinanceGate: () => ({
    canSee: (id: string) => state.allow.has(id),
    isResolving: state.isResolving,
  }),
}));

const { default: ClaimApprovalPage, ClaimApprovalIndex, ClaimApprovalTabRoute } = await import(
  "./ClaimApprovalPage"
);

function Here({ what }: { what: string }) {
  const { pathname } = useLocation();
  return (
    <div data-testid="tab" data-what={what}>
      {pathname}
    </div>
  );
}

function UrlProbe() {
  const { pathname } = useLocation();
  return <div data-testid="url">{pathname}</div>;
}

const ALL = ["claim-approval"];

beforeEach(() => {
  state.allow = new Set(ALL);
  state.isResolving = false;
});

function show(initial = "/finance/claim-approval") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <UrlProbe />
      <Routes>
        <Route path="/finance/claim-approval" element={<ClaimApprovalPage />}>
          <Route index element={<ClaimApprovalIndex />} />
          <Route
            path="needs-you"
            element={
              <ClaimApprovalTabRoute gateId="claim-approval">
                <Here what="needs-you" />
              </ClaimApprovalTabRoute>
            }
          />
          <Route
            path="decided"
            element={
              <ClaimApprovalTabRoute gateId="claim-approval">
                <Here what="decided" />
              </ClaimApprovalTabRoute>
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("landing on the screen", () => {
  it("opens on Needs you, which is the question people arrive with", async () => {
    show();
    expect(await screen.findByTestId("tab")).toHaveAttribute("data-what", "needs-you");
  });

  it("marks that tab, not merely the first one drawn", async () => {
    show();
    await screen.findByTestId("tab");
    expect(screen.getByRole("tab", { name: "Needs you" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});

describe("who is let in", () => {
  it("offers both tabs to someone who approves anything", async () => {
    show();
    for (const name of ["Needs you", "Decided"]) {
      expect(await screen.findByRole("tab", { name })).toBeInTheDocument();
    }
  });

  // Neither Expense claims nor OPD claims nor CC Expenses has a tab here any
  // more — Needs You and Decided cover every claim type themselves now, and
  // CC's own approving never lived here at all, only under Credit Card
  // Expenses.
  it("offers no per-type tab", async () => {
    show();
    await screen.findByRole("tab", { name: "Needs you" });
    for (const name of ["Expense claims", "OPD claims", "CC Expenses"]) {
      expect(screen.queryByRole("tab", { name })).not.toBeInTheDocument();
    }
  });

  it("says so plainly to someone who approves nothing", async () => {
    state.allow = new Set();
    show();
    expect(await screen.findByText(/don't approve claims/)).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
});

// Hiding a tab is not access control: the URL can be typed, pasted, or
// bookmarked from a time when the person did hold the role.
describe("reaching a tab by its URL", () => {
  it("serves it to someone allowed", async () => {
    show("/finance/claim-approval/decided");
    expect(await screen.findByTestId("tab")).toHaveAttribute("data-what", "decided");
  });

  it("redirects away when nobody's role opens either tab", async () => {
    state.allow = new Set();
    show("/finance/claim-approval/decided");
    expect(screen.queryByTestId("tab")).not.toBeInTheDocument();
    expect(await screen.findByText(/don't approve claims/)).toBeInTheDocument();
  });
});

// An unresolved gate reports no roles. Deciding on it would bounce an approver
// off the URL they asked for, and a redirect is not undone when the three
// backends finally answer.
describe("while the backends are still answering", () => {
  it("leaves a deep link where it is", async () => {
    state.isResolving = true;
    state.allow = new Set();
    show("/finance/claim-approval/decided");
    expect(await screen.findByTestId("url")).toHaveTextContent("/finance/claim-approval/decided");
    expect(screen.queryByText(/don't approve claims/)).not.toBeInTheDocument();
  });

  it("does not redirect from the group URL either", async () => {
    state.isResolving = true;
    state.allow = new Set();
    show();
    expect(await screen.findByTestId("url")).toHaveTextContent("/finance/claim-approval");
    expect(screen.queryByTestId("tab")).not.toBeInTheDocument();
  });
});

describe("moving between tabs", () => {
  it("changes the URL, so a tab can be linked", async () => {
    show();
    await screen.findByRole("tab", { name: "Decided" });
    await userEvent.click(screen.getByRole("tab", { name: "Decided" }));
    await waitFor(() =>
      expect(screen.getByTestId("url")).toHaveTextContent("/finance/claim-approval/decided"),
    );
  });
});
