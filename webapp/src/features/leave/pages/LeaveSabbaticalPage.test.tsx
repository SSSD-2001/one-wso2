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
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import type { ReactNode } from "react";

// The eligibility boundaries below were computed, not tuned until green: with
// the default 1095-day rule and ApplyTab.tsx:168's `- 1`, an anchor of
// 2024-01-01 becomes eligible on 2027-01-01 and is one day short on 2026-12-31.
// The 2024→2027 span crosses a leap year, so counting by eye gets it wrong.

const profile = {
  workEmail: "me@wso2.com" as string | undefined,
  leadEmail: "lead@wso2.com" as string | null,
  employmentStartDate: "2024-01-01",
  location: "Sri Lanka",
};

const config = {
  isSabbaticalLeaveEnabled: true,
  sabbaticalLeavePolicyUrl: "https://policy.test/sabbatical",
  sabbaticalLeaveUserGuideUrl: "https://guide.test/sabbatical",
  sabbaticalLeaveEligibilityDuration: 1095,
  sabbaticalLeaveMaxApplicationDuration: 42,
  cachedEmails: { mandatoryMails: [], optionalMails: [] },
};

const state = {
  leaves: [] as Record<string, unknown>[],
  canSee: true,
  featureEnabled: true,
  isLead: false,
  isPeopleOps: false,
  subordinateCount: 0 as number | null,
  // Query outcomes, so a test can say "this fetch failed" rather than only
  // "this fetch returned nothing" — the two must not behave the same.
  leavesFailed: false,
  configFailed: false,
  userInfoLoading: false,
  userInfoFailed: false,
};

// Every filter useLeaves is called with, so a test can assert what the screen
// actually asked the backend for rather than what it rendered.
const leaveFilters: Record<string, unknown>[] = [];

vi.mock("../api/useLeaveData", () => ({
  useLeaveUserInfo: () => ({
    data: state.userInfoLoading ? undefined : { ...profile, subordinateCount: state.subordinateCount },
    isPending: state.userInfoLoading,
    isLoading: state.userInfoLoading,
    isError: state.userInfoFailed,
    error: state.userInfoFailed ? new Error("no profile") : null,
  }),
  useLeaveAppConfig: () => ({
    data: state.configFailed
      ? undefined
      : { ...config, isSabbaticalLeaveEnabled: state.featureEnabled },
    isPending: false,
    isError: state.configFailed,
    isSuccess: !state.configFailed,
  }),
  useLeaveEmployees: () => ({ data: [], isLoading: false, isError: false }),
  useLeaves: (filter: Record<string, unknown>, enabled = true) => {
    if (enabled) leaveFilters.push(filter);
    return {
      data: state.leavesFailed || !enabled ? undefined : { leaves: state.leaves },
      // As React Query reports a DISABLED query: never fetched, so `pending`
      // forever, while `isLoading` — pending AND fetching — stays false. The
      // mock used to report `isPending: false` regardless, which hid a screen
      // that waits on the wrong flag.
      isPending: !enabled,
      isLoading: false,
      isError: state.leavesFailed && enabled,
      isSuccess: !state.leavesFailed && enabled,
      error: state.leavesFailed ? new Error("boom") : null,
    };
  },
}));

vi.mock("../api/useLeaveGate", () => ({
  useLeaveGate: () => ({
    canSee: () => state.canSee,
    isResolving: false,
    isPeopleOps: state.isPeopleOps,
    isLead: state.isLead,
  }),
}));

const submitMutate = vi.fn();
const approveMutate = vi.fn();
vi.mock("../api/useLeaveMutations", () => ({
  useSubmitLeave: () => ({ mutate: submitMutate, isPending: false, isError: false, error: null }),
  useCancelLeave: () => ({ mutate: vi.fn(), isPending: false }),
  useApproveLeave: () => ({ mutate: approveMutate, isPending: false }),
}));

vi.mock("../components/LeaveShell", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const { default: SabbaticalApplyTab } = await import("./LeaveSabbaticalPage");
const { SabbaticalHistoryTab } = await import("./LeaveHistoryPage");
const { default: SabbaticalApproveTab } = await import("../components/SabbaticalApproveTab");
const { default: SabbaticalApprovalHistoryTab } = await import(
  "../components/SabbaticalApprovalHistoryTab"
);
const { default: SabbaticalReportTab } = await import("../components/SabbaticalReportTab");
const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");

beforeEach(() => {
  submitMutate.mockClear();
  approveMutate.mockClear();
  leaveFilters.length = 0;
  state.isLead = false;
  state.isPeopleOps = false;
  state.subordinateCount = 0;
  state.leavesFailed = false;
  state.configFailed = false;
  state.userInfoLoading = false;
  state.userInfoFailed = false;
  profile.workEmail = "me@wso2.com";
  profile.leadEmail = "lead@wso2.com";
  state.leaves = [];
  state.canSee = true;
  state.featureEnabled = true;
});

// Each sabbatical screen is its own route under an action group now
// (leaveTabs.ts), so a test renders the body it is about. Which tabs appear,
// and who may reach them, is covered in LeaveTabRouting.test.tsx.
function show(body: ReactNode = <SabbaticalApplyTab />) {
  return render(
    // Real routes, not just a Router: a successful submit navigates to the
    // sabbatical half of My history, and without a target to land on the
    // navigation is unobservable and the test cannot fail.
    <MemoryRouter initialEntries={["/me/leave/apply/sabbatical"]}>
      <QueryClientProvider client={new QueryClient()}>
        <NotificationsProvider>
          <Routes>
            <Route path="/me/leave/apply/sabbatical" element={<>{body}</>} />
            <Route path="/me/leave/history/sabbatical" element={<div>my sabbaticals</div>} />
          </Routes>
        </NotificationsProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function setDate(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function fillValidRequest() {
  setDate(/Leave request start date/, "2027-03-01");
  setDate(/Leave request end date/, "2027-03-10");
  for (const box of screen.getAllByRole("checkbox")) fireEvent.click(box);
}

// ApplyTab.tsx:328-334. Without a lead there is nobody to route the request to,
// so the source replaces the whole form with an explanation rather than letting
// someone fill it in and fail on submit.
describe("when no reporting lead is set", () => {
  it("explains instead of showing the form", async () => {
    profile.leadEmail = null;
    show();
    expect(await screen.findByText("Reporting lead not set")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Leave request start date/)).not.toBeInTheDocument();
  });

  it("still shows the heading and the user guide", async () => {
    profile.leadEmail = null;
    show();
    expect(await screen.findByText("Sabbatical Leave Application")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "User Guide" })).toBeInTheDocument();
  });
});

// ApplyTab.tsx:146-148. Someone with an approved sabbatical on record cannot
// retype the date the eligibility clock runs from; someone with none must.
describe("the last-sabbatical anchor", () => {
  it("is read-only and pre-filled when there is an approved sabbatical", async () => {
    state.leaves = [{ id: 1, endDate: "2024-06-30T00:00:00Z" }];
    show();
    const field = await screen.findByLabelText(/Last sabbatical leave end date/);
    expect(field).toBeDisabled();
    expect(field).toHaveValue("2024-06-30");
  });

  it("is editable and empty when there is none", async () => {
    show();
    const field = await screen.findByLabelText(/Last sabbatical leave end date/);
    expect(field).toBeEnabled();
    expect(field).toHaveValue("");
  });
});

// ApplyTab.tsx:158-184. The `- 1` in eligibilityGapDays makes the boundary a day
// stricter than a plain difference, and the sentence names which anchor it used.
describe("the eligibility warning", () => {
  it("does not appear on the first eligible day", async () => {
    show();
    setDate(/Leave request start date/, "2027-01-01");
    await waitFor(() =>
      expect(screen.queryByText(/must be at least/)).not.toBeInTheDocument(),
    );
  });

  it("appears one day earlier", async () => {
    show();
    setDate(/Leave request start date/, "2026-12-31");
    expect(
      await screen.findByText(
        "The leave start date must be at least 3 years after the employment start date.",
      ),
    ).toBeInTheDocument();
  });

  it("names the last sabbatical when there is one", async () => {
    state.leaves = [{ id: 1, endDate: "2025-01-01T00:00:00Z" }];
    show();
    setDate(/Leave request start date/, "2027-01-01");
    expect(
      await screen.findByText(
        "The leave start date must be at least 3 years after the last sabbatical leave end date.",
      ),
    ).toBeInTheDocument();
  });

  it("blocks the submit, not just decorates the form", async () => {
    show();
    setDate(/Leave request start date/, "2026-12-31");
    setDate(/Leave request end date/, "2027-01-05");
    for (const box of screen.getAllByRole("checkbox")) fireEvent.click(box);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(submitMutate).not.toHaveBeenCalled());
  });
});

// ApplyTab.tsx:187-202 and :229-240 — 42 days is allowed, 43 is not, and the
// check runs as you type rather than only on submit.
describe("the maximum duration", () => {
  it("accepts a range of exactly the limit", async () => {
    show();
    setDate(/Leave request start date/, "2027-03-01");
    setDate(/Leave request end date/, "2027-04-11");
    await waitFor(() =>
      expect(screen.queryByText(/must not exceed/)).not.toBeInTheDocument(),
    );
  });

  it("flags one day over, before the user presses Apply", async () => {
    show();
    setDate(/Leave request start date/, "2027-03-01");
    setDate(/Leave request end date/, "2027-04-12");
    expect(await screen.findByText("Leave duration must not exceed 6 weeks")).toBeInTheDocument();
  });
});

// ApplyTab.tsx:204-273. Each rule raises one message and returns, so the user is
// told the first thing wrong. The port had replaced all of this with a disabled
// button, which says nothing at all.
describe("what the form says when you press Apply", () => {
  it("asks for the dates when both are empty", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Apply" }));
    expect(await screen.findByText("Please select both start and end dates")).toBeInTheDocument();
    expect(submitMutate).not.toHaveBeenCalled();
  });

  it("asks for the acknowledgements when the dates are fine", async () => {
    show();
    setDate(/Leave request start date/, "2027-03-01");
    setDate(/Leave request end date/, "2027-03-10");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(
      await screen.findByText("Please acknowledge all the required checkboxes"),
    ).toBeInTheDocument();
    expect(submitMutate).not.toHaveBeenCalled();
  });

  it("confirms before sending anything", async () => {
    show();
    await fillValidRequest();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(
      await screen.findByText("Do you want to submit this sabbatical leave?"),
    ).toBeInTheDocument();
    expect(submitMutate).not.toHaveBeenCalled();
  });

  it("names the lead the request goes to", async () => {
    show();
    await fillValidRequest();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(
      await screen.findByText(
        /This will submit your sabbatical leave request for .* and send it to lead@wso2\.com for approval\./,
      ),
    ).toBeInTheDocument();
  });
});

// ApplyTab.tsx:275-298. SabbaticalApplicationRequest declares a
// lastSabbaticalLeaveEndDate field, but the submit is the ordinary POST /leaves
// and nothing sends it — the date travels inside the free-text comment, which is
// where the approver reads it.
describe("what actually gets submitted", () => {
  it("appends the last-sabbatical date to the comment", async () => {
    state.leaves = [{ id: 1, endDate: "2024-01-01T00:00:00Z" }];
    show();
    await fillValidRequest();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes" }));

    await waitFor(() => expect(submitMutate).toHaveBeenCalled());
    expect(submitMutate.mock.calls[0][0]).toMatchObject({
      leaveType: "sabbatical",
      startDate: "2027-03-01",
      endDate: "2027-03-10",
      comment: " **** Last Sabbatical Leave End Date: 2024-01-01 ****",
    });
  });

  it("leaves the comment alone when there is no prior sabbatical", async () => {
    show();
    await fillValidRequest();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes" }));

    await waitFor(() => expect(submitMutate).toHaveBeenCalled());
    expect(submitMutate.mock.calls[0][0].comment).toBe("");
  });
});

// SabbaticalLeave.tsx:36-43 and route.ts:77-78.
// Who may reach this screen is decided by its route now; see
// LeaveTabRouting.test.tsx. What remains here is the feature flag, which the
// screen itself honours.
describe("when the sabbatical feature is switched off", () => {
  // The history query is enabled on `Boolean(workEmail)`. When /user-info fails
  // there is no email, so that query is never fetched — and a loading check
  // waiting on its `isPending` would spin forever instead of reaching the error
  // below it.
  it("shows the error rather than spinning when the profile fails to load", async () => {
    profile.workEmail = undefined;
    state.userInfoFailed = true;
    show();
    expect(await screen.findByText(/Couldn't load your leave profile/)).toBeInTheDocument();
  });

  it("is replaced wholesale when the feature flag is off", async () => {
    state.featureEnabled = false;
    show();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "Sabbatical  Leave Feature is currently not available. Please check again later.",
    );
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
  });
});

// SabbaticalLeaveHistory.tsx:21-28 — the general history screen with the
// category swapped. What matters is that the swap actually reaches the request:
// a tab that rendered the same rows as the general page would look right and be
// wrong.
describe("the my-history tab", () => {
  it("asks only for sabbatical leave", async () => {
    show(<SabbaticalHistoryTab />);
    await waitFor(() => expect(leaveFilters.length).toBeGreaterThan(0));
    const historyFilter = leaveFilters.at(-1)!;
    expect(historyFilter.leaveCategory).toEqual(["sabbatical"]);
  });

  it("keeps the source's statuses and ordering", async () => {
    show(<SabbaticalHistoryTab />);
    await waitFor(() => expect(leaveFilters.length).toBeGreaterThan(0));
    const historyFilter = leaveFilters.at(-1)!;
    expect(historyFilter.statuses).toEqual(["APPROVED", "PENDING"]);
    expect(historyFilter.orderBy).toBe("DESC");
  });

  it("brings the year selector with it", async () => {
    show(<SabbaticalHistoryTab />);
    expect(await screen.findByText("Year")).toBeInTheDocument();
  });

  it("says so when there is no sabbatical on record", async () => {
    show(<SabbaticalHistoryTab />);
    expect(await screen.findByText(/No leave history available for/)).toBeInTheDocument();
  });
});

describe("the approve tab", () => {
  it("asks for its own reports' pending sabbaticals", async () => {
    state.isLead = true;
    show(<SabbaticalApproveTab />);
    await waitFor(() => expect(leaveFilters.length).toBeGreaterThan(0));
    expect(leaveFilters.at(-1)).toMatchObject({
      subordinatesLeaves: true,
      leaveCategory: ["sabbatical"],
      statuses: ["PENDING"],
      orderBy: "DESC",
    });
  });

  it("asks only for decided requests on the history tab", async () => {
    state.isLead = true;
    show(<SabbaticalApprovalHistoryTab />);
    await waitFor(() => expect(leaveFilters.length).toBeGreaterThan(0));
    expect(leaveFilters.at(-1)).toMatchObject({
      subordinatesLeaves: true,
      leaveCategory: ["sabbatical"],
      statuses: ["APPROVED", "REJECTED"],
    });
  });
});

// ApproveLeaveTable.tsx:51-65,69-88. The team-share sentence is the whole point
// of the pre-dialog query: it tells the lead how much of their team is already
// booked to be away over the same dates. It is appended to the approve message
// and never to the reject one.
describe("deciding on a request", () => {
  const pendingRow = {
    id: 7,
    email: "report@wso2.com",
    startDate: "2027-03-01T00:00:00Z",
    endDate: "2027-03-20T00:00:00Z",
    numberOfDays: 20,
    approverEmail: "lead@wso2.com",
    status: "PENDING",
  };

  it("tells the lead what share of the team will be away", async () => {
    state.isLead = true;
    state.subordinateCount = 4;
    state.leaves = [pendingRow];
    show(<SabbaticalApproveTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    // One approved sabbatical returned for four reports = 25%.
    expect(
      await screen.findByText(
        "This will approve the sabbatical leave for report@wso2.com (2027-03-01 – 2027-03-20). 25% of your team will be on sabbatical during this period.",
      ),
    ).toBeInTheDocument();
  });

  it("leaves the share out of the reject message", async () => {
    state.isLead = true;
    state.subordinateCount = 4;
    state.leaves = [pendingRow];
    show(<SabbaticalApproveTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    expect(
      await screen.findByText(
        "This will reject the sabbatical leave request for report@wso2.com (2027-03-01 – 2027-03-20).",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/of your team will be on sabbatical/)).not.toBeInTheDocument();
  });

  it("sends the decision only after it is confirmed", async () => {
    state.isLead = true;
    state.subordinateCount = 4;
    state.leaves = [pendingRow];
    show(<SabbaticalApproveTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    expect(approveMutate).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole("button", { name: "Yes, Approve" }));
    await waitFor(() => expect(approveMutate).toHaveBeenCalled());
    expect(approveMutate.mock.calls[0][0]).toEqual({ id: 7, action: "approve" });
  });
});

// AdminSabbaticalTab.tsx. Two things separate this from the general report:
// every status rather than approved only, and no employee-status filter — the
// source never passes that handler, so Toolbar.tsx:265 hides the control.
describe("the sabbatical report tab", () => {
  it("asks for every status, unlike the general report", async () => {
    state.isLead = true;
    show(<SabbaticalReportTab />);
    await waitFor(() => expect(leaveFilters.length).toBeGreaterThan(0));
    expect(leaveFilters.at(-1)).toMatchObject({
      leaveCategory: ["sabbatical"],
      statuses: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
    });
  });

  it("scopes a plain lead to their own reports", async () => {
    state.isLead = true;
    show(<SabbaticalReportTab />);
    await waitFor(() => expect(leaveFilters.length).toBeGreaterThan(0));
    expect(leaveFilters.at(-1)!.approverEmail).toBe("me@wso2.com");
  });

  it("starts People Ops across everyone", async () => {
    state.isLead = true;
    state.isPeopleOps = true;
    show(<SabbaticalReportTab />);
    await waitFor(() => expect(leaveFilters.length).toBeGreaterThan(0));
    expect(leaveFilters.at(-1)!.approverEmail).toBeUndefined();
  });

  it("offers no employee-status filter", async () => {
    state.isLead = true;
    state.isPeopleOps = true;
    show(<SabbaticalReportTab />);
    await screen.findByRole("button", { name: /Fetch report/ });
    expect(screen.queryByLabelText(/Employee status/i)).not.toBeInTheDocument();
  });

  it("refuses a range that ends before it starts", async () => {
    state.isLead = true;
    show(<SabbaticalReportTab />);
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2027-05-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2027-04-01" } });
    fireEvent.click(screen.getByRole("button", { name: /Fetch report/ }));
    expect(await screen.findByText("End date must be after start date")).toBeInTheDocument();
  });
});

// A failed fetch is not the same as a fetch that returned nothing, and the
// difference decides whether policy numbers and the eligibility anchor can be
// trusted. Raised on PR #28.
describe("when the data the form depends on fails to load", () => {
  it("does not render the form on a policy-config failure", async () => {
    state.configFailed = true;
    show();
    // SabbaticalLeave.tsx holds config: null on failure, so the feature flag
    // never turns on. Without this the policy values default to 0 and a 0-day
    // maximum rejects every range the user can pick.
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "Sabbatical  Leave Feature is currently not available. Please check again later.",
    );
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
  });

  it("never shows a zero-week duration limit", async () => {
    state.configFailed = true;
    show();
    await screen.findByRole("alert");
    expect(screen.queryByText(/must not exceed 0 weeks/)).not.toBeInTheDocument();
  });

  it("keeps the anchor locked when the sabbatical history failed", async () => {
    state.leavesFailed = true;
    show();
    // ApplyTab.tsx:87,134-148 — the field only unlocks inside a success-guarded
    // effect. Unlocking it here would let someone whose history we failed to
    // read type their own eligibility anchor.
    expect(await screen.findByLabelText(/Last sabbatical leave end date/)).toBeDisabled();
  });

  it("still unlocks the anchor when the history loaded and was empty", async () => {
    show();
    expect(await screen.findByLabelText(/Last sabbatical leave end date/)).toBeEnabled();
  });
});

// ApproveLeaveTable.tsx:51-65 fetches the team share BEFORE opening the dialog,
// so the lead cannot decide without seeing it. We open immediately and hold the
// confirm button instead — which only holds if it accounts for /user-info still
// being in flight, since subordinateCount reads 0 until then. Raised on PR #28.
describe("holding the approve button until the team share is known", () => {
  const pendingRow = {
    id: 7,
    email: "report@wso2.com",
    startDate: "2027-03-01T00:00:00Z",
    endDate: "2027-03-20T00:00:00Z",
    numberOfDays: 20,
    approverEmail: "lead@wso2.com",
    status: "PENDING",
  };

  it("is held while the profile is still loading", async () => {
    state.isLead = true;
    state.userInfoLoading = true;
    state.leaves = [pendingRow];
    show(<SabbaticalApproveTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    expect(await screen.findByRole("button", { name: "Yes, Approve" })).toBeDisabled();
  });

  it("is live once the profile has loaded", async () => {
    state.isLead = true;
    state.subordinateCount = 4;
    state.leaves = [pendingRow];
    show(<SabbaticalApproveTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    expect(await screen.findByRole("button", { name: "Yes, Approve" })).toBeEnabled();
  });

  it("is live for rejection, which never carries a share", async () => {
    state.isLead = true;
    state.userInfoLoading = true;
    state.leaves = [pendingRow];
    show(<SabbaticalApproveTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    expect(await screen.findByRole("button", { name: "Yes, Reject" })).toBeEnabled();
  });
});

// leave.ts:150-156 — the source raises this from inside the submitLeave thunk,
// so a sabbatical is confirmed exactly as general leave is. Asserted on both
// call sites, because a message that lives at the call site is a message the
// next call site can forget.
describe("what the screen says after a successful submit", () => {
  async function submitAndSucceed() {
    show();
    await fillValidRequest();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes" }));
    await waitFor(() => expect(submitMutate).toHaveBeenCalled());
    // Drive the mutation's own success path, the way React Query would.
    submitMutate.mock.calls[0][1].onSuccess();
  }

  // Requested behaviour: show them the request they just made. Untested until
  // now — the harness rendered the component with no routes, so there was
  // nowhere for a navigation to land and removing it changed nothing.
  it("lands on the sabbatical half of My history", async () => {
    await submitAndSucceed();
    expect(await screen.findByText("my sabbaticals")).toBeInTheDocument();
  });

  // The thunk's wording, without the exclamation mark the Apply form hardcodes
  // (leave.ts:150-156 vs GeneralLeave.tsx:147). Same event, two strings, and
  // that difference is the source's — asserted exactly so it stays that way.
  it("confirms the request was submitted, as a success and not an error", async () => {
    await submitAndSucceed();
    expect(screen.queryByText("Leave request submitted successfully!")).not.toBeInTheDocument();
    const message = await screen.findByText("Leave request submitted successfully");
    // MUI stamps the severity into the Alert's class; a success reported
    // through showError would read as a failure that somehow worked.
    const alert = message.closest(".MuiAlert-root");
    expect(alert?.className).toMatch(/AlertSuccess|standardSuccess|filledSuccess/);
  });

  // Doubles as the stay-put guard: with the gate refusing, the form must still
  // be here to clear. Remove the gate check in historyPathAfterSubmit and this
  // fails, because the form navigates away instead.
  //
  // Asserted with the navigation refused, which is the only case where the form
  // survives to be looked at — a visitor who lands on My history has unmounted
  // it. The clearing still matters there: it is the same form they stay on.
  it("clears the form so a second request cannot be sent by accident", async () => {
    state.canSee = false;
    await submitAndSucceed();
    await waitFor(() =>
      expect(screen.getByLabelText(/Leave request start date/)).toHaveValue(""),
    );
    expect(screen.getByLabelText(/Leave request end date/)).toHaveValue("");
    state.canSee = true;
  });
})
