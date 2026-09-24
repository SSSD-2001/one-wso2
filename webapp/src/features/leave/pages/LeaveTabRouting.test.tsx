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
import type { ReactNode } from "react";

// Which tab is open lives in the URL. These cover the three things that buys —
// a linkable tab, a landing redirect, and gating that a typed URL cannot walk
// past — none of which the previous `useState` tabs could do.

const state = {
  isResolving: false,
  isLead: false,
  isPeopleOps: false,
  allow: new Set<string>(["leave-apply", "leave-history", "leave-reports"]),
};

vi.mock("../api/useLeaveGate", () => ({
  useLeaveGate: () => ({
    canSee: (id: string) => state.allow.has(id),
    isResolving: state.isResolving,
    isPeopleOps: state.isPeopleOps,
    isLead: state.isLead,
  }),
}));

vi.mock("../components/LeaveShell", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const { default: LeavePage, LeaveIndex, LeaveKindRoute, LeaveTabIndex } = await import(
  "./LeavePage"
);

function Here() {
  const { pathname } = useLocation();
  return <div data-testid="path">{pathname}</div>;
}

/** Always mounted, so a redirect is visible even when the route renders nothing. */
function UrlProbe() {
  const { pathname } = useLocation();
  return <div data-testid="url">{pathname}</div>;
}

beforeEach(() => {
  state.isResolving = false;
  state.isLead = false;
  state.isPeopleOps = false;
  state.allow = new Set(["leave-apply", "leave-history", "leave-reports"]);
});

/** Leave, wired the way App.tsx wires it. */
function show(initial = "/me/leave") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <UrlProbe />
      <Routes>
        <Route path="/me/leave" element={<LeavePage />}>
          <Route index element={<LeaveIndex />} />
          <Route path="apply">
            <Route index element={<LeaveTabIndex segment="apply" />} />
            <Route
              path="general"
              element={
                <LeaveKindRoute gateId="leave-apply">
                  <Here />
                </LeaveKindRoute>
              }
            />
            <Route
              path="sabbatical"
              element={
                <LeaveKindRoute gateId="leave-sabbatical-own">
                  <Here />
                </LeaveKindRoute>
              }
            />
          </Route>
          <Route path="history">
            <Route index element={<LeaveTabIndex segment="history" />} />
            <Route
              path="general"
              element={
                <LeaveKindRoute gateId="leave-history">
                  <Here />
                </LeaveKindRoute>
              }
            />
            <Route
              path="sabbatical"
              element={
                <LeaveKindRoute gateId="leave-sabbatical-own">
                  <Here />
                </LeaveKindRoute>
              }
            />
          </Route>
          <Route
            path="approvals"
            element={
              <LeaveKindRoute gateId="leave-approve">
                <Here />
              </LeaveKindRoute>
            }
          />
          <Route path="reports">
            <Route index element={<LeaveTabIndex segment="reports" />} />
            <Route
              path="general"
              element={
                <LeaveKindRoute gateId="leave-reports">
                  <Here />
                </LeaveKindRoute>
              }
            />
            <Route
              path="sabbatical"
              element={
                <LeaveKindRoute gateId="leave-reports">
                  <Here />
                </LeaveKindRoute>
              }
            />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("landing on /me/leave", () => {
  it("redirects to the first tab at its first kind, so the URL is never blank", async () => {
    show();
    expect(await screen.findByTestId("path")).toHaveTextContent("/me/leave/apply/general");
  });

  // A People-Ops-only account cannot apply for a sabbatical, and a hardcoded
  // redirect would drop them on a screen they are refused.
  it("lands on the first tab the visitor is actually allowed", async () => {
    state.allow = new Set(["leave-reports"]);
    show();
    expect(await screen.findByTestId("path")).toHaveTextContent("/me/leave/reports/general");
  });

  // An intern may apply, but never for a sabbatical. The kind is in the URL,
  // so landing has to pick one they can open.
  it("lands on a kind the visitor may open, not just a tab", async () => {
    state.allow = new Set(["leave-sabbatical-own"]);
    show();
    expect(await screen.findByTestId("path")).toHaveTextContent("/me/leave/apply/sabbatical");
  });

  it("sends someone to the first kind when they open a tab without one", async () => {
    show("/me/leave/history");
    expect(await screen.findByTestId("path")).toHaveTextContent("/me/leave/history/general");
  });
});

// Approvals is lead-only, and an unresolved gate reports no privileges.
// Deciding before /user-info lands would redirect a lead away from the URL they
// asked for — and a redirect is not undone when the answer arrives.
describe("while the gate is still resolving", () => {
  it("leaves a deep-linked lead on the URL they asked for", async () => {
    state.isResolving = true;
    state.allow = new Set();
    show("/me/leave/approvals");

    // Still there: not redirected, and not told they are not allowed.
    expect(await screen.findByTestId("url")).toHaveTextContent("/me/leave/approvals");
    expect(screen.queryByText(/isn't available for your role/)).not.toBeInTheDocument();
  });

  it("does not send anyone anywhere from the bare Leave URL either", async () => {
    state.isResolving = true;
    state.allow = new Set();
    show("/me/leave");
    expect(await screen.findByTestId("url")).toHaveTextContent("/me/leave");
  });

  it("resolves into the tab once the privileges arrive", async () => {
    state.allow = new Set(["leave-approve"]);
    show("/me/leave/approvals");
    expect(await screen.findByTestId("path")).toHaveTextContent("/me/leave/approvals");
  });
});

describe("the tab bar", () => {
  it("offers only the tabs the visitor may see", async () => {
    show();
    expect(await screen.findByRole("tab", { name: "Apply" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "My history" })).toBeInTheDocument();
  });

  it("leaves out a tab the gate refuses", async () => {
    state.allow = new Set(["leave-apply"]);
    show();
    expect(await screen.findByRole("tab", { name: "Apply" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Reports" })).not.toBeInTheDocument();
  });

  it("says so plainly when the visitor may see none of it", async () => {
    state.allow = new Set();
    show();
    expect(await screen.findByText(/isn't available for your role/)).toBeInTheDocument();
  });

  it("marks the tab the URL names, not the first one", async () => {
    show("/me/leave/reports/general");
    expect(await screen.findByRole("tab", { name: "Reports" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("keeps the tab lit at the deeper kind URL", async () => {
    show("/me/leave/apply/sabbatical");
    expect(await screen.findByRole("tab", { name: "Apply" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("changes the URL when a tab is clicked", async () => {
    show();
    await screen.findByRole("tab", { name: "My history" });
    await userEvent.click(screen.getByRole("tab", { name: "My history" }));
    await waitFor(() =>
      expect(screen.getByTestId("url")).toHaveTextContent("/me/leave/history"),
    );
  });
});

// THE bug this file missed. Changing tab moves the route branch, so
// LeaveKindRoute unmounts and remounts — and a fresh mount gets a fresh
// useAsgardeoSub that starts at "loading", leaving ITS OWN gate unresolved and
// every canSee false for that first render. Deciding there sent every tab
// click straight back to Apply.
//
// Rendered on its own rather than under LeavePage on purpose: LeavePage holds
// its <Outlet /> behind its own isResolving, so mounted that way the guard is
// never reached in this state and the test cannot fail.
describe("a route guard whose own gate has not answered yet", () => {
  function showGuard() {
    return render(
      <MemoryRouter initialEntries={["/me/leave/history/general"]}>
        <UrlProbe />
        <Routes>
          <Route
            path="/me/leave/history/general"
            element={
              <LeaveKindRoute gateId="leave-history">
                <Here />
              </LeaveKindRoute>
            }
          />
          <Route path="/me/leave/apply/general" element={<div>bounced to apply</div>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("waits instead of refusing", async () => {
    state.isResolving = true;
    state.allow = new Set();
    showGuard();

    expect(await screen.findByTestId("url")).toHaveTextContent("/me/leave/history/general");
    expect(screen.queryByText("bounced to apply")).not.toBeInTheDocument();
    expect(screen.queryByText(/isn't available for your role/)).not.toBeInTheDocument();
  });

  it("still refuses once the gate has answered no", async () => {
    state.isResolving = false;
    state.allow = new Set(["leave-apply"]);
    showGuard();
    expect(await screen.findByText("bounced to apply")).toBeInTheDocument();
  });
});

describe("the kind toggle", () => {
  // Links, not buttons: the kind lives in the URL, so it survives a refresh,
  // is shareable, and comes back with the Back button.
  it("offers both kinds as links where the visitor may open both", async () => {
    state.allow = new Set(["leave-apply", "leave-sabbatical-own"]);
    show("/me/leave/apply/general");
    expect(await screen.findByRole("link", { name: "General" })).toHaveAttribute(
      "href",
      "/me/leave/apply/general",
    );
    expect(screen.getByRole("link", { name: "Sabbatical" })).toHaveAttribute(
      "href",
      "/me/leave/apply/sabbatical",
    );
  });

  // An intern may apply for general leave only. A toggle with one live option
  // is not a choice, and showing the other half greyed would imply it unlocks.
  it("is not drawn when only one kind is open to them", async () => {
    state.allow = new Set(["leave-apply", "leave-history", "leave-reports"]);
    show("/me/leave/apply/general");
    await screen.findByRole("tab", { name: "Apply" });
    // The whole control, not just the option they lack — a one-option toggle
    // is a control that cannot do anything.
    expect(screen.queryByRole("group", { name: "Kind of leave" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sabbatical" })).not.toBeInTheDocument();
  });

  // General leave has no approval step for anybody, so Approvals never offers
  // a choice — the subtitle carries that instead.
  it("is never drawn on Approvals", async () => {
    state.allow = new Set(["leave-apply", "leave-sabbatical-own", "leave-approve"]);
    show("/me/leave/approvals");
    await screen.findByRole("tab", { name: "Approvals" });
    expect(screen.queryByRole("group", { name: "Kind of leave" })).not.toBeInTheDocument();
  });

  it("marks the kind the URL names", async () => {
    state.allow = new Set(["leave-apply", "leave-sabbatical-own"]);
    show("/me/leave/apply/sabbatical");
    expect(await screen.findByRole("link", { name: "Sabbatical" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

describe("reaching a screen by its URL", () => {
  it("serves it to someone allowed", async () => {
    show("/me/leave/reports/general");
    expect(await screen.findByTestId("path")).toHaveTextContent("/me/leave/reports/general");
  });

  // THE thing the route guard exists for: the toggle hides a kind, but hiding
  // is not enforcement, and the URL can be typed.
  it("redirects away from a kind they are not allowed", async () => {
    state.allow = new Set(["leave-apply", "leave-history"]);
    show("/me/leave/apply/sabbatical");
    expect(await screen.findByTestId("path")).toHaveTextContent("/me/leave/apply/general");
  });

  it("redirects away from a tab they are not allowed", async () => {
    state.allow = new Set(["leave-apply"]);
    show("/me/leave/approvals");
    expect(await screen.findByTestId("path")).toHaveTextContent("/me/leave/apply/general");
  });

  it("explains when there is nowhere to send them", async () => {
    state.allow = new Set();
    show("/me/leave/approvals");
    expect(await screen.findByText(/isn't available for your role/)).toBeInTheDocument();
  });
});
