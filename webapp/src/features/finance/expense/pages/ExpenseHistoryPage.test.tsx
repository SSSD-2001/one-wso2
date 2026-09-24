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
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { HistoryClaim, HistorySearchPayload } from "../history/expenseHistoryTypes";

vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));

// The tab reports its own backend's connectivity, rather than leaving it to a
// shared frame — Claims spans two backends and either may be missing.
vi.mock("@config/apiConfig", async () => {
  const actual = await vi.importActual<typeof import("@config/apiConfig")>("@config/apiConfig");
  return { ...actual, isExpenseBackendConfigured: () => true };
});

function claim(over: Partial<HistoryClaim> = {}): HistoryClaim {
  return {
    id: "EXP-me-001",
    // A late-evening UTC stamp: the shared formatNice would call this the 9th.
    createdDate: "2026-09-09 20:30:00.0",
    totalAmount: 328.41,
    currencyCode: "LKR",
    employeeEmail: "me@wso2.com",
    submittedBy: "me@wso2.com",
    leadEmails: ["lead@wso2.com"],
    statusDetails: {
      status: "PENDING_LEAD",
      leadApprovedDate: null,
      leadRejectedReason: null,
      leadRejectedDate: null,
      financeApproverEmail: null,
      financeApprovedDate: null,
      financeRejectedDate: null,
    },
    transactions: [
      {
        amount: 1,
        currency: "USD",
        currencyConversionRate: 328.411,
        reimbursementAmount: 328.41,
        reimbursementCurrency: "LKR",
        expenseTypeId: 297,
        expenseType: "Sports & Leisure Activities",
        date: "2026-09-09",
        comment: "team outing",
        receiptUrl: "r1.png",
        travelJobNumber: null,
      },
    ],
    ...over,
  };
}

const state = {
  claims: [claim()] as HistoryClaim[],
  onBehalfOfEmployees: [] as string[],
  /** `/app-data`'s past-date rule; null for most tests, set where it matters. */
  pastDateRestrictionDays: null as number | null,
};

/** Every payload that reached the search hook, in order. */
const payloads: HistorySearchPayload[] = [];

vi.mock("../history/useExpenseHistory", () => ({
  useExpenseHistoryClaims: (payload: HistorySearchPayload) => {
    payloads.push(payload);
    return { data: state.claims, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() };
  },
  useExpenseHistoryAppData: () => ({
    data: {
      userInfo: { workEmail: "me@wso2.com", firstName: "Me", lastName: "Myself", managerEmail: "lead@wso2.com" },
      enableLeadView: false,
      enableFinanceView: false,
      currencyCode: "LKR",
      countryCode: "LK",
      travels: [],
      draft: null,
      get pastDateRestrictionDays() {
        return state.pastDateRestrictionDays;
      },
      onBehalfOfEmployees: state.onBehalfOfEmployees,
    },
    isLoading: false,
    isError: false,
  }),
}));

const resubmitMutate = vi.fn();
const uploadReceipt =
  vi.fn<(args: { email: string; file: File }) => Promise<string>>(async () => "r.png");
vi.mock("../useExpenseMutations", () => ({
  useResubmitExpenseClaim: () => ({ mutate: resubmitMutate, isPending: false, isError: false, error: null }),
  useExpenseReceiptUpload: () => ({ mutateAsync: uploadReceipt, isPending: false }),
}));

// Reached only through the resubmit flow, which reuses the submitter's line
// dialog to edit a corrected line.
const onBehalfTravelsFor: string[] = [];
vi.mock("../submitter/useExpenseSubmitter", () => ({
  useSubmitterExpenseTypes: () => ({
    data: [{ id: 297, type: "Sports & Leisure Activities" }],
    isLoading: false,
    isError: false,
  }),
  // Records who the job numbers were asked for: correcting a claim filed FOR
  // somebody else has to offer THEIR travels, not the reader's.
  useOnBehalfOfTravels: (email: string | null) => {
    if (email) onBehalfTravelsFor.push(email);
    return { data: [], isLoading: false, isError: false };
  },
}));
vi.mock("../useExpense", () => ({
  useExchangeRates: () => ({
    data: [{ currencyCode: "USD", exchangeRate: 328.411 }],
    isLoading: false,
    isError: false,
  }),
  // Resolves the addresses on screen to names — the source shows names and
  // keeps the address in a tooltip.
  useExpenseEmployees: () => ({
    data: [
      { workEmail: "me@wso2.com", firstName: "Me", lastName: "Myself", employeeThumbnail: null },
      { workEmail: "lead@wso2.com", firstName: "Ada", lastName: "Lovelace", employeeThumbnail: null },
      { workEmail: "yukthi@wso2.com", firstName: "Yukthi", lastName: "Lochana", employeeThumbnail: null },
    ],
    isLoading: false,
    isError: false,
  }),
}));

const { default: ExpenseHistoryPage } = await import("./ExpenseHistoryPage");
const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");

beforeEach(() => {
  payloads.length = 0;
  onBehalfTravelsFor.length = 0;
  resubmitMutate.mockClear();
  uploadReceipt.mockClear();
  state.claims = [claim()];
  state.onBehalfOfEmployees = [];
  state.pastDateRestrictionDays = null;
});

function show() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NotificationsProvider>
        <ExpenseHistoryPage />
      </NotificationsProvider>
    </QueryClientProvider>,
  );
}

/** The payload the most recent render sent to the backend. */
const lastPayload = () => payloads[payloads.length - 1];

describe("what reaches the backend", () => {
  it("asks for the latest 100 with no date window", async () => {
    show();
    await screen.findByText("EXP-me-001");
    expect(lastPayload().limit).toBe(100);
    expect(lastPayload().startDate).toBeUndefined();
    expect(lastPayload().endDate).toBeUndefined();
  });

  // tableSlice.ts:47-51 — omitted, never sent empty. An empty array is a
  // different query to the backend than an absent field.
  it("omits the filters that are not set rather than sending them empty", async () => {
    show();
    await screen.findByText("EXP-me-001");
    expect(lastPayload().status).toBeUndefined();
    expect(lastPayload().ids).toBeUndefined();
  });

  it("scopes the search to the signed-in person", async () => {
    show();
    await screen.findByText("EXP-me-001");
    expect(lastPayload().email).toBe("me@wso2.com");
    expect(lastPayload().submissionScope).toBe("ALL_CLAIMS");
  });

  it("sends the chosen status as a one-element list", async () => {
    show();
    await screen.findByText("EXP-me-001");
    fireEvent.mouseDown(screen.getByLabelText("Status"));
    fireEvent.click(await screen.findByRole("option", { name: "Approved" }));
    await waitFor(() => expect(lastPayload().status).toEqual(["APPROVED"]));
  });
});

// FilterHolder.tsx:186 — `Object.values(ClaimStatus)` behind a synthetic All.
describe("the status filter", () => {
  it("lists every status, in the source's order", async () => {
    show();
    await screen.findByText("EXP-me-001");
    fireEvent.mouseDown(screen.getByLabelText("Status"));
    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "All",
      "Pending Lead",
      "Lead Rejected",
      "Pending Finance",
      "Finance Rejected",
      "Approved",
    ]);
  });
});

describe("the custom date range", () => {
  async function openRange() {
    show();
    await screen.findByText("EXP-me-001");
    fireEvent.mouseDown(screen.getByLabelText("Claim Range"));
    fireEvent.click(await screen.findByRole("option", { name: "Custom Date" }));
    return screen.findByText("Custom date range");
  }

  it("does not change the query until Apply", async () => {
    await openRange();
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-08-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-08-31" } });
    // Still the opening request — the calendar is a draft until applied.
    expect(lastPayload().limit).toBe(100);
    expect(lastPayload().startDate).toBeUndefined();
  });

  it("swaps the limit for the window once applied", async () => {
    await openRange();
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-08-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-08-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(lastPayload().startDate).toBe("2026-08-01"));
    expect(lastPayload().endDate).toBe("2026-08-31");
    // "Latest 100" and a date window are alternatives, never combined.
    expect(lastPayload().limit).toBeUndefined();
  });

  it("refuses a backwards range", async () => {
    await openRange();
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-08-31" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-08-01" } });
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  // FilterHolder.tsx:141-152 — the source picks the window on a calendar, two
  // clicks to a range, and never past today. Dates are derived from the clock
  // rather than hardcoded so the suite does not expire.
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  it("picks a window from two clicks on the calendar", async () => {
    await openRange();
    const now = new Date();
    const first = iso(new Date(now.getFullYear(), now.getMonth(), 1));
    const today = iso(now);

    fireEvent.click(screen.getByLabelText(first));
    fireEvent.click(screen.getByLabelText(today));
    // The grid fills the same draft the two fields hold.
    expect(screen.getByLabelText("From")).toHaveValue(first);
    expect(screen.getByLabelText("To")).toHaveValue(today);

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(lastPayload().startDate).toBe(first));
    expect(lastPayload().endDate).toBe(today);
  });

  it("reads a backwards pair of clicks as a range, not as an error", async () => {
    await openRange();
    const now = new Date();
    const first = iso(new Date(now.getFullYear(), now.getMonth(), 1));
    const today = iso(now);

    // Clicking the later day first still commits start-before-end.
    fireEvent.click(screen.getByLabelText(today));
    fireEvent.click(screen.getByLabelText(first));
    expect(screen.getByLabelText("From")).toHaveValue(first);
    expect(screen.getByLabelText("To")).toHaveValue(today);
  });

  // Paging the grid must not outrank a date typed afterwards. Holding only the
  // month meant the view stayed where the arrows left it while the selection
  // sat off screen.
  it("follows a typed From date even after paging the grid", async () => {
    await openRange();
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));

    // Two months before the month the grid just moved to, so the typed date is
    // nowhere near where paging left it.
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() - 3, 15);
    fireEvent.change(screen.getByLabelText("From"), { target: { value: iso(target) } });

    const monthName = target.toLocaleDateString("en-US", { month: "long" });
    expect(
      await screen.findByText(`${monthName} ${target.getFullYear()}`),
    ).toBeInTheDocument();
  });

  it("offers no day past today", async () => {
    await openRange();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(screen.getByLabelText(iso(tomorrow))).toBeDisabled();
  });

  it("clears the window when the range goes back to Latest 100", async () => {
    await openRange();
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-08-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-08-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(lastPayload().startDate).toBe("2026-08-01"));

    fireEvent.mouseDown(screen.getByLabelText("Claim Range"));
    fireEvent.click(await screen.findByRole("option", { name: "Latest 100" }));
    await waitFor(() => expect(lastPayload().limit).toBe(100));
    expect(lastPayload().startDate).toBeUndefined();
  });
});

describe("the Filters popover", () => {
  it("holds the claim ID back until Apply", async () => {
    show();
    await screen.findByText("EXP-me-001");
    fireEvent.mouseDown(screen.getByLabelText("Filters"));
    fireEvent.change(await screen.findByLabelText("Filter by claim ID"), {
      target: { value: "EXP-me-001" },
    });
    expect(lastPayload().ids).toBeUndefined();

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(lastPayload().ids).toEqual(["EXP-me-001"]));
  });

  it("drops the edit on Cancel", async () => {
    show();
    await screen.findByText("EXP-me-001");
    fireEvent.mouseDown(screen.getByLabelText("Filters"));
    fireEvent.change(await screen.findByLabelText("Filter by claim ID"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByLabelText("Filter by claim ID")).not.toBeInTheDocument());
    expect(lastPayload().ids).toBeUndefined();
  });

  it("empties the claim ID in one go", async () => {
    show();
    await screen.findByText("EXP-me-001");
    fireEvent.mouseDown(screen.getByLabelText("Filters"));
    const field = await screen.findByLabelText("Filter by claim ID");
    fireEvent.change(field, { target: { value: "EXP-me-001" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear claim ID" }));
    expect(field).toHaveValue("");
  });

  // FilterHolder.tsx:285 — offered only to someone who can file for others.
  it("hides the submission filter when there is nobody to file for", async () => {
    show();
    await screen.findByText("EXP-me-001");
    fireEvent.mouseDown(screen.getByLabelText("Filters"));
    await screen.findByLabelText("Filter by claim ID");
    expect(screen.queryByLabelText("Filter by submission")).not.toBeInTheDocument();
  });

  it("sends the submission scope when it is offered and chosen", async () => {
    state.onBehalfOfEmployees = ["yukthi@wso2.com"];
    show();
    await screen.findByText("EXP-me-001");
    fireEvent.mouseDown(screen.getByLabelText("Filters"));
    fireEvent.mouseDown(await screen.findByLabelText("Filter by submission"));
    fireEvent.click(await screen.findByRole("option", { name: "Submitted on Behalf" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(lastPayload().submissionScope).toBe("SUBMITTED_ON_BEHALF"));
  });
});

describe("the claim list", () => {
  // The shared formatNice reads only the YYYY-MM-DD head and calls a 20:30 UTC
  // stamp the 9th. This screen parses the whole timestamp as UTC and renders it
  // in the viewer's zone, which east of UTC+3:30 is already the 10th. Expected
  // value is derived from the instant rather than hardcoded, so the suite does
  // not depend on the machine's timezone; in a zone far enough east it also
  // catches a regression back to head-truncation.
  it("dates a claim by the viewer's day, not the raw UTC one", async () => {
    const asLocalDay = new Date(Date.UTC(2026, 8, 9, 20, 30, 0)).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    show();
    expect(await screen.findByText(asLocalDay)).toBeInTheDocument();
  });

  it("marks a claim somebody else filed", async () => {
    state.claims = [claim({ submittedBy: "yukthi@wso2.com" })];
    show();
    expect(await screen.findByText("On behalf")).toBeInTheDocument();
  });

  it("leaves an own claim unmarked", async () => {
    show();
    await screen.findByText("EXP-me-001");
    expect(screen.queryByText("On behalf")).not.toBeInTheDocument();
  });

  it("offers a rejected claim a way to correct and resend it", async () => {
    state.claims = [
      claim({
        statusDetails: { ...claim().statusDetails, status: "LEAD_REJECTED", leadRejectedReason: "No receipt" },
      }),
    ];
    show();
    expect(await screen.findByRole("button", { name: "View / Resubmit" })).toBeInTheDocument();
  });

  it("offers a pending claim only a read", async () => {
    show();
    expect(await screen.findByRole("button", { name: "View" })).toBeInTheDocument();
  });
});

// Only PENDING_LEAD exists in local data, so without this the other four
// statuses are never exercised anywhere. Each row's chip, the action it offers
// (`ClaimTable.tsx#getButtonLabel`) and the stage the trail marks
// (`CustomTimelineItem.tsx:56-99`), for every status the backend can return.
describe("every status the backend can return", () => {
  const cases = [
    { status: "PENDING_LEAD", chip: "Pending Lead", action: "View", stage: "Lead Review", mark: "(Pending)" },
    { status: "LEAD_REJECTED", chip: "Lead Rejected", action: "View / Resubmit", stage: "Lead Review", mark: "(Rejected)" },
    { status: "PENDING_FINANCE", chip: "Pending Finance", action: "View", stage: "Finance Review", mark: "(Pending)" },
    { status: "APPROVED", chip: "Approved", action: "View", stage: "Finance Review", mark: "(Approved)" },
    { status: "FINANCE_REJECTED", chip: "Finance Rejected", action: "View / Resubmit", stage: "Finance Review", mark: "(Rejected)" },
  ] as const;

  it.each(cases)("$status shows $chip and offers $action", async ({ status, chip, action }) => {
    state.claims = [claim({ statusDetails: { ...claim().statusDetails, status } })];
    show();
    expect(await screen.findByText(chip)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: action })).toBeInTheDocument();
  });

  it.each(cases)("$status marks $stage $mark in the trail", async ({ status, stage, mark }) => {
    state.claims = [claim({ statusDetails: { ...claim().statusDetails, status } })];
    show();
    fireEvent.click(await screen.findByRole("button", { name: /Claim activity for EXP-me-001/ }));
    await screen.findByText("Claim Activity");
    // The marked stage carries the parenthetical; the stage itself is always
    // drawn, so both have to line up on the same one.
    const marked = screen.getByText(mark).closest("p")!;
    expect(marked.textContent).toContain(stage);
  });
});

describe("the claim activity trail", () => {
  async function openActivity() {
    show();
    fireEvent.click(await screen.findByRole("button", { name: /Claim activity for EXP-me-001/ }));
    return screen.findByText("Claim Activity");
  }

  it("opens from the status chip", async () => {
    await openActivity();
    expect(screen.getByText("Claim Submission")).toBeInTheDocument();
  });

  it("marks the stage the claim is waiting on", async () => {
    await openActivity();
    expect(screen.getByText("(Pending)")).toBeInTheDocument();
    // Finance has not been reached, so it carries no date.
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThan(0);
  });

  // The lead's reason lives here and nowhere else — the list has no room for it.
  it("gives the lead's rejection reason", async () => {
    state.claims = [
      claim({
        statusDetails: {
          ...claim().statusDetails,
          status: "LEAD_REJECTED",
          leadRejectedDate: "2026-09-11 04:00:00.0",
          leadRejectedReason: "Receipt unreadable",
        },
      }),
    ];
    await openActivity();
    expect(screen.getByText("(Rejected)")).toBeInTheDocument();
    expect(screen.getByText("Receipt unreadable")).toBeInTheDocument();
  });

  // CustomTimelineItem.tsx:43 — `leadApprovedDate || leadRejectedDate`. A claim
  // that was rejected, corrected and then passed can carry the rejection date
  // only, and the stage still has to say when the lead acted.
  it("dates a passed lead stage from the rejection when there is no approval date", async () => {
    state.claims = [
      claim({
        statusDetails: {
          ...claim().statusDetails,
          status: "APPROVED",
          leadApprovedDate: null,
          leadRejectedDate: "2026-09-10 05:00:00.0",
          financeApprovedDate: "2026-09-11 05:00:00.0",
        },
      }),
    ];
    await openActivity();
    // Derived from the instant, not hardcoded: the stage renders in the
    // viewer's zone, so a fixed string would only pass east of the machine.
    const expected = new Date(Date.UTC(2026, 8, 10, 5, 0, 0)).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const trail = screen.getByText("Lead Review").closest("div")!.parentElement!;
    expect(trail.textContent).toContain(expected);
  });

  // utils.ts#getOnBehalfOfParty — the stage names the OTHER party, and reads
  // "by" or "for" depending on which side of the claim the reader is on.
  it("says who filed a claim that was filed for the reader", async () => {
    state.claims = [claim({ submittedBy: "yukthi@wso2.com" })];
    await openActivity();
    expect(screen.getByText("Submitted by Yukthi Lochana")).toBeInTheDocument();
  });

  it("says who a claim the reader filed was for", async () => {
    state.claims = [claim({ employeeEmail: "yukthi@wso2.com", submittedBy: "me@wso2.com" })];
    await openActivity();
    expect(screen.getByText("Submitted for Yukthi Lochana")).toBeInTheDocument();
  });
});

describe("reading one claim", () => {
  it("replaces the list with the claim's items", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "View" }));
    expect(await screen.findByText("EXPENSE ITEM 1")).toBeInTheDocument();
    expect(screen.getByText("Sports & Leisure Activities")).toBeInTheDocument();
    // A non-travel line reads N/A rather than blank.
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("goes back to the list untouched", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "View" }));
    fireEvent.click(await screen.findByRole("button", { name: "Back to claim history" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument());
  });

  it("does not offer to edit a claim that is still under review", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "View" }));
    await screen.findByText("EXPENSE ITEM 1");
    expect(screen.queryByRole("button", { name: "Resubmit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit expense item/ })).not.toBeInTheDocument();
  });
});

describe("resubmitting a rejected claim", () => {
  beforeEach(() => {
    state.claims = [
      claim({
        statusDetails: {
          ...claim().statusDetails,
          status: "LEAD_REJECTED",
          leadRejectedDate: "2026-09-11 04:00:00.0",
          leadRejectedReason: "No receipt",
        },
      }),
    ];
  });

  async function openRejected() {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "View / Resubmit" }));
    return screen.findByText("EXPENSE ITEM 1");
  }

  it("opens the claim editable", async () => {
    await openRejected();
    expect(screen.getByRole("button", { name: "Resubmit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Edit expense item 1/ })).toBeInTheDocument();
  });

  // ClaimDetails.tsx:128-146 — a claim filed FOR somebody else is corrected
  // against THAT person's job numbers, since the travel is theirs.
  it("asks for the claim owner's job numbers when the claim was filed for someone else", async () => {
    state.claims = [
      claim({
        employeeEmail: "yukthi@wso2.com",
        submittedBy: "me@wso2.com",
        statusDetails: { ...claim().statusDetails, status: "LEAD_REJECTED" },
      }),
    ];
    await openRejected();
    expect(onBehalfTravelsFor).toContain("yukthi@wso2.com");
  });

  it("uses the reader's own job numbers on their own claim", async () => {
    await openRejected();
    expect(onBehalfTravelsFor).toHaveLength(0);
  });

  // claimDetailsSlice.ts:52-80 — the claim keeps its id and goes back through
  // review; it does not become a new claim.
  it("sends the lines back under the same claim id", async () => {
    await openRejected();
    fireEvent.click(screen.getByRole("button", { name: "Resubmit" }));
    fireEvent.click(await screen.findByRole("button", { name: "Resubmit" }));

    await waitFor(() => expect(resubmitMutate).toHaveBeenCalled());
    const [body] = resubmitMutate.mock.calls[0];
    expect(body.id).toBe("EXP-me-001");
    expect(body.transactions).toHaveLength(1);
    // The wire payload carries no derived display fields.
    expect(body.transactions[0]).not.toHaveProperty("reimbursementAmount");
    expect(body.transactions[0]).not.toHaveProperty("expenseType");
    expect(body.transactions[0].expenseTypeId).toBe(297);
  });

  // ExpenseForm.tsx:137-139 — the floor counts back from the day the claim was
  // FILED. `createdDate` is UTC with no zone marker, so handed over raw the
  // dialog's `new Date` reads it as LOCAL and the floor lands a day out.
  //
  // The two readings only disagree when the offset carries the instant across
  // midnight, so the fixture is built to straddle it in whatever zone the suite
  // runs in: late in the day east of UTC, early west of it. A fixed timestamp
  // would pass everywhere the offset happens to be small and hide the bug.
  it("counts the correction window from the claim's own UTC day", async () => {
    const offsetMinutes = -new Date().getTimezoneOffset();
    // Exactly at UTC there is no disagreement to catch; the assertion still
    // holds, it just proves less.
    const hourUtc = offsetMinutes > 0 ? 23 : 0;
    const minuteUtc = offsetMinutes > 0 ? 0 : 30;
    const filedUtc = new Date(Date.UTC(2026, 8, 9, hourUtc, minuteUtc, 0));
    const stamp = `2026-09-09 ${String(hourUtc).padStart(2, "0")}:${String(minuteUtc).padStart(2, "0")}:00.0`;

    state.pastDateRestrictionDays = 30;
    state.claims = [
      claim({
        createdDate: stamp,
        statusDetails: { ...claim().statusDetails, status: "LEAD_REJECTED" },
      }),
    ];
    show();
    fireEvent.click(await screen.findByRole("button", { name: "View / Resubmit" }));
    await screen.findByText("EXPENSE ITEM 1");
    fireEvent.click(screen.getByRole("button", { name: /Edit expense item 1/ }));

    // 29 days back from the filing instant, read through local calendar fields
    // — the arithmetic the dialog itself does.
    const floor = new Date(filedUtc);
    floor.setDate(floor.getDate() - 29);
    const expected = `${floor.getFullYear()}-${String(floor.getMonth() + 1).padStart(2, "0")}-${String(floor.getDate()).padStart(2, "0")}`;

    expect(await screen.findByLabelText("Bill date")).toHaveAttribute("min", expected);
  });

  // The line the claim was actually filed with must not itself trip the
  // restriction it is being measured against.
  it("still accepts the line the claim was filed with", async () => {
    state.pastDateRestrictionDays = 30;
    await openRejected();
    fireEvent.click(screen.getByRole("button", { name: /Edit expense item 1/ }));
    await waitFor(() =>
      expect(screen.queryByText(/Date within last 30 days required/)).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Save expense" })).toBeEnabled();
  });

  it("says so when nothing was actually changed", async () => {
    await openRejected();
    fireEvent.click(screen.getByRole("button", { name: "Resubmit" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/haven't changed any claim items/)).toBeInTheDocument();
  });

  it("does not lose edits silently when leaving", async () => {
    await openRejected();
    fireEvent.click(screen.getByRole("button", { name: /Edit expense item 1/ }));
    fireEvent.change(await screen.findByLabelText("Amount"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save expense" }));

    await waitFor(() => expect(screen.queryByLabelText("Amount")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Back to claim history" }));
    expect(await screen.findByText("Discard Changes")).toBeInTheDocument();
  });
});

// ClaimDetails.tsx:174,399-400 — corrections are held locally until the claim
// is resubmitted, so closing with unsaved ones is confirmed rather than silent.
describe("correcting a line before resubmitting", () => {
  beforeEach(() => {
    state.claims = [
      claim({ statusDetails: { ...claim().statusDetails, status: "LEAD_REJECTED" } }),
    ];
  });

  it("offers an edit control only while resubmission is possible", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "View / Resubmit" }));
    expect(await screen.findByRole("button", { name: /Edit expense item 1/ })).toBeInTheDocument();
  });

  it("offers none on a claim that cannot be resubmitted", async () => {
    state.claims = [claim()];
    show();
    fireEvent.click(await screen.findByRole("button", { name: "View" }));
    await screen.findByText("EXPENSE ITEM 1");
    expect(screen.queryByRole("button", { name: /Edit expense item/ })).not.toBeInTheDocument();
  });

  it("sends the corrected amount, not the original", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "View / Resubmit" }));
    fireEvent.click(await screen.findByRole("button", { name: /Edit expense item 1/ }));
    fireEvent.change(await screen.findByLabelText("Amount"), { target: { value: "55" } });
    fireEvent.click(screen.getByRole("button", { name: "Save expense" }));

    fireEvent.click(await screen.findByRole("button", { name: "Resubmit" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Resubmit" }).at(-1)!);

    await waitFor(() => expect(resubmitMutate).toHaveBeenCalled());
    expect(resubmitMutate.mock.calls[0][0].transactions[0].amount).toBe(55);
  });

  it("confirms before discarding unsaved corrections", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "View / Resubmit" }));
    fireEvent.click(await screen.findByRole("button", { name: /Edit expense item 1/ }));
    fireEvent.change(await screen.findByLabelText("Amount"), { target: { value: "55" } });
    fireEvent.click(screen.getByRole("button", { name: "Save expense" }));

    fireEvent.click(await screen.findByRole("button", { name: "Back to claim history" }));
    expect(await screen.findByText("Discard Changes")).toBeInTheDocument();
  });

  it("closes straight away when nothing was changed", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "View / Resubmit" }));
    fireEvent.click(await screen.findByRole("button", { name: "Back to claim history" }));
    await waitFor(() =>
      expect(screen.queryByText("Discard Changes")).not.toBeInTheDocument(),
    );
  });
});

// Raised on PR #30. The correction form is the same dialog as New Claim, so it
// offers "Replace file" either way — and a claim is often rejected *because* of
// the receipt. The handler used to throw, so the control was live and broken.
describe("replacing a receipt while correcting a claim", () => {
  it("uploads against the claim's owner and keeps the new file", async () => {
    uploadReceipt.mockResolvedValueOnce("replacement.pdf");
    state.claims = [
      claim({ statusDetails: { ...claim().statusDetails, status: "LEAD_REJECTED" } }),
    ];
    show();
    fireEvent.click(await screen.findByRole("button", { name: "View / Resubmit" }));
    fireEvent.click(await screen.findByRole("button", { name: /Edit expense item 1/ }));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x"], "new-receipt.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(uploadReceipt).toHaveBeenCalled());
    expect(uploadReceipt.mock.calls[0][0]).toMatchObject({ email: "me@wso2.com" });

    fireEvent.click(await screen.findByRole("button", { name: "Save expense" }));
    fireEvent.click(await screen.findByRole("button", { name: "Resubmit" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Resubmit" }).at(-1)!);

    await waitFor(() => expect(resubmitMutate).toHaveBeenCalled());
    expect(resubmitMutate.mock.calls[0][0].transactions[0].receiptUrl).toBe("replacement.pdf");
  });
});
