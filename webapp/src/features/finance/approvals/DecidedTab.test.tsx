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
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// The decided list. Same three queues as Needs you, so the same disabled-query
// trap applies: a role this person lacks leaves its query pending for good.

const iso = (y: number, m: number, d: number, h = 9) => new Date(y, m, d, h).toISOString();

const flags = { lead: true, finance: true, opd: true };
const searches: { expense: Record<string, unknown>[]; opd: Record<string, unknown>[] } = {
  expense: [],
  opd: [],
};
const data = {
  lead: [] as unknown[],
  finance: [] as unknown[],
  opd: [] as unknown[],
  expenseFails: false,
  opdFails: false,
  appDataFails: false,
};

vi.mock("../expense/useExpense", () => ({
  useExpenseAppData: () => ({
    data: {
      userInfo: { workEmail: "me@wso2.com" },
      get enableLeadView() {
        return flags.lead;
      },
      get enableFinanceView() {
        return flags.finance;
      },
    },
    isPending: false,
    isLoading: false,
    isError: data.appDataFails,
    error: new Error("expense app-data down"),
  }),
  useExpenseClaims: (payload: Record<string, unknown>, enabled = true) => {
    if (enabled) searches.expense.push(payload);
    // The lead query is the scoped one — it is the only search that carries a
    // leadEmail. Keying on the first status broke the moment the lead query's
    // statuses changed, which is a fragile thing for a mock to depend on.
    const isLead = Boolean(payload.leadEmail);
    return {
      data: !enabled ? [] : isLead ? data.lead : data.finance,
      // As React Query reports a DISABLED query: it never fetches, so it stays
      // `pending` forever while `isLoading` — pending AND fetching — is false.
      // Hardcoding `isPending: false` here is what let a screen that waits on
      // the wrong flag pass its tests and spin in the browser.
      isPending: !enabled,
      isLoading: false,
      isError: data.expenseFails && enabled,
      error: new Error("expense backend down"),
    };
  },
  // Only feeds the review screen's name resolver, which falls back to the
  // bare email with nothing here — nothing under test cares which name shows.
  useExpenseEmployees: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock("../opd/useOpd", () => ({
  useOpdUserInfo: () => ({
    data: { userRoles: flags.opd ? [555] : [444] },
    isPending: false,
    isLoading: false,
  }),
  useOpdClaims: (payload: Record<string, unknown>, enabled = true) => {
    if (enabled) searches.opd.push(payload);
    return {
      data: enabled ? data.opd : [],
      isPending: !enabled,
      isLoading: false,
      isError: data.opdFails && enabled,
      error: new Error("opd backend down"),
    };
  },
  // Only feeds the "Filter by email" dropdown's options — nothing under test
  // cares which addresses it offers.
  useOpdEmployees: () => ({ data: [], isLoading: false, isError: false }),
}));

// A decided expense claim now takes over the whole tab — the app's own
// Lead/Finance Approvals review screen, read-only here — rather than opening
// in a dialog. Stubbed the same way OPD's dialog is: this file cares about
// WHICH claim opened it, not the review screen's own internals.
vi.mock("../expense/approvals/ExpenseApprovalReview", () => ({
  ExpenseApprovalReview: ({
    claim,
    stage,
    pending,
  }: {
    claim: { id: string };
    stage: string;
    pending: boolean;
  }) => (
    <div data-testid="expense-review" data-stage={stage} data-pending={String(pending)}>
      {claim.id}
    </div>
  ),
}));
// OPD now takes over the tab the same way expense does — its own review
// screen, tested in its own file — rather than opening in a dialog.
vi.mock("../opd/approvals/OpdApprovalReview", () => ({
  OpdApprovalReview: ({ claim, pending }: { claim: { id: string }; pending: boolean }) => (
    <div data-testid="opd-review" data-pending={String(pending)}>
      {claim.id}
    </div>
  ),
}));

const { default: DecidedTab } = await import("./DecidedTab");

const expenseClaim = (over: Record<string, unknown>) => ({
  id: "EXP-1",
  transactions: [],
  totalAmount: 100,
  currencyCode: "USD",
  employeeEmail: "kasun@wso2.com",
  leadEmails: [],
  createdDate: iso(2026, 7, 20),
  statusDetails: {
    status: "APPROVED",
    leadApprovedDate: iso(2026, 7, 22),
    financeApprovedDate: iso(2026, 7, 24),
    financeApproverEmail: "fin@wso2.com",
    financeRejectedDate: null,
    leadRejectedDate: null,
  },
  ...over,
});

const opdClaim = (over: Record<string, unknown>) => ({
  id: "OPD-1",
  transactions: [{}],
  employeeEmail: "dilani@wso2.com",
  totalAmount: 8750,
  createdDate: iso(2026, 7, 15),
  statusDetails: {
    status: "APPROVED",
    financeApprovedDate: iso(2026, 7, 18),
    financeApproverEmail: "fin@wso2.com",
    financeRejectedDate: null,
  },
  ...over,
});

beforeEach(() => {
  flags.lead = true;
  flags.finance = true;
  flags.opd = true;
  searches.expense.length = 0;
  searches.opd.length = 0;
  data.lead = [];
  data.finance = [];
  data.opd = [];
  data.expenseFails = false;
  data.opdFails = false;
  data.appDataFails = false;
});

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DecidedTab />
    </QueryClientProvider>,
  );

// The bug this file exists for: a queue disabled because the person lacks that
// role stays `pending` in React Query, so a screen waiting on `isPending` never
// leaves its skeleton.
describe("when a role is missing", () => {
  it("renders for someone who only approves OPD", async () => {
    flags.lead = false;
    flags.finance = false;
    data.opd = [opdClaim({})];
    show();
    expect(await screen.findByText("OPD-1")).toBeInTheDocument();
  });

  it("renders for someone who only approves expense claims", async () => {
    flags.opd = false;
    data.finance = [expenseClaim({})];
    show();
    expect(await screen.findByText("EXP-1")).toBeInTheDocument();
  });

  it("reaches the empty state rather than spinning", async () => {
    flags.lead = false;
    flags.finance = false;
    show();
    // Opens on the Approved tab.
    expect(await screen.findByText("Nothing approved yet.")).toBeInTheDocument();
  });
});

// FilterHolder.tsx-style narrowing: a claim of one employee or one id, applied
// to every queue this tab runs — otherwise the only way to find a claim is to
// scroll the whole company's, across two apps at once.
describe("narrowing by employee or claim id", () => {
  it("sends no email or id by default", async () => {
    data.finance = [expenseClaim({})];
    show();
    await waitFor(() => expect(searches.expense.length).toBeGreaterThan(0));
    for (const p of [...searches.expense, ...searches.opd]) {
      expect(p.email).toBeUndefined();
      expect(p.ids).toBeUndefined();
    }
  });

  it("narrows every queue to one claim id", async () => {
    data.finance = [expenseClaim({})];
    show();
    fireEvent.change(await screen.findByLabelText("Filter by claim ID"), {
      target: { value: "C-42" },
    });
    await waitFor(() => expect(searches.expense.at(-1)?.ids).toEqual(["C-42"]));
    expect(searches.opd.at(-1)?.ids).toEqual(["C-42"]);
  });
});

describe("what it asks for", () => {
  it("asks finance for the claims it settled", () => {
    flags.lead = false;
    flags.opd = false;
    show();
    expect(searches.expense.at(-1)?.status).toEqual(["APPROVED", "FINANCE_REJECTED"]);
  });

  // A lead who is not also finance sees what they passed on or turned down,
  // scoped to their own reports the way their pending queue is.
  it("asks a lead for their own reports, including what finance did next", () => {
    flags.finance = false;
    flags.opd = false;
    show();
    expect(searches.expense.at(-1)).toMatchObject({ leadEmail: "me@wso2.com" });
    expect(searches.expense.at(-1)?.status).toContain("PENDING_FINANCE");
  });

  // Holding both, the finance queue covers what they settled AS FINANCE and
  // nothing else — so a claim they only forwarded, or turned down as lead, was
  // in neither query and vanished from Decided. The lead queue still runs for
  // them, narrowed to the statuses finance does not already cover.
  it("asks a dual-role approver for both, without overlapping", () => {
    show();
    const asked = searches.expense.map((p) => p.status as string[]);
    expect(asked).toHaveLength(2);
    const finance = asked.find((st) => st.includes("APPROVED"))!;
    const lead = asked.find((st) => st.includes("LEAD_REJECTED"))!;
    expect(finance).toEqual(["APPROVED", "FINANCE_REJECTED"]);
    // What finance's own list cannot show them.
    expect(lead).toEqual(["PENDING_FINANCE", "LEAD_REJECTED"]);
    // No status asked for twice, or the same claim lands in the list twice.
    expect(finance.filter((st) => lead.includes(st))).toEqual([]);
  });

  it("keeps a dual-role approver's forwarded claim in the list", () => {
    data.lead = [
      expenseClaim({
        id: "EXP-FORWARDED",
        statusDetails: {
          status: "PENDING_FINANCE",
          leadApprovedDate: iso(2026, 7, 22),
          financeApproverEmail: null,
          financeApprovedDate: null,
          financeRejectedDate: null,
          leadRejectedDate: null,
        },
      }),
    ];
    show();
    expect(screen.getByText("EXP-FORWARDED")).toBeInTheDocument();
  });

  it("asks OPD for settled claims only", () => {
    show();
    expect(searches.opd.at(-1)?.status).toEqual(["APPROVED", "REJECTED"]);
  });
});

// Pending / Approved / Rejected is what Claim Approval's OPD tab offers;
// Decided has nothing pending by definition, so it is just the two.
describe("the Approved / Rejected tabs", () => {
  it("opens on Approved", async () => {
    data.opd = [opdClaim({})];
    show();
    expect(await screen.findByRole("tab", { name: "Approved" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("hides a rejected claim until the Rejected tab is picked", async () => {
    data.opd = [
      opdClaim({
        id: "OPD-NO",
        statusDetails: { status: "REJECTED", financeRejectedDate: iso(2026, 7, 18), financeApproverEmail: "fin@wso2.com", financeApprovedDate: null },
      }),
    ];
    const user = userEvent.setup();
    show();
    expect(await screen.findByText("Nothing approved yet.")).toBeInTheDocument();
    expect(screen.queryByText("OPD-NO")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Rejected" }));
    expect(await screen.findByText("OPD-NO")).toBeInTheDocument();
  });

  // A claim a lead forwarded on is not rejected, so it stays under Approved
  // alongside the Outcome chip's own "Sent to finance" label rather than
  // disappearing from both tabs.
  it("keeps a forwarded claim under Approved", async () => {
    data.lead = [
      expenseClaim({
        id: "EXP-FORWARDED",
        statusDetails: {
          status: "PENDING_FINANCE",
          leadApprovedDate: iso(2026, 7, 22),
          financeApproverEmail: null,
          financeApprovedDate: null,
          financeRejectedDate: null,
          leadRejectedDate: null,
        },
      }),
    ];
    show();
    expect(await screen.findByText("EXP-FORWARDED")).toBeInTheDocument();
  });
});

describe("what it shows", () => {
  it("names who decided, where the backend records it", async () => {
    data.opd = [opdClaim({})];
    show();
    const row = (await screen.findByText("OPD-1")).closest("tr")!;
    expect(within(row).getByText("fin@wso2.com")).toBeInTheDocument();
  });

  // The lead side records dates but no approver, so naming one would be a
  // guess. A dash says "not recorded" rather than inventing a name.
  it("shows a dash where no approver was recorded", async () => {
    data.finance = [
      expenseClaim({
        id: "EXP-LEADONLY",
        statusDetails: {
          status: "PENDING_FINANCE",
          leadApprovedDate: iso(2026, 7, 22),
          financeApproverEmail: null,
          financeApprovedDate: null,
          financeRejectedDate: null,
          leadRejectedDate: null,
        },
      }),
    ];
    show();
    const row = (await screen.findByText("EXP-LEADONLY")).closest("tr")!;
    expect(within(row).getByText("—")).toBeInTheDocument();
    expect(within(row).getByText("Sent to finance")).toBeInTheDocument();
  });

  it("distinguishes an approval from a rejection", async () => {
    data.opd = [
      opdClaim({ id: "OPD-NO", statusDetails: { status: "REJECTED", financeRejectedDate: iso(2026, 7, 18), financeApproverEmail: "fin@wso2.com", financeApprovedDate: null } }),
    ];
    const user = userEvent.setup();
    show();
    // Rejected, so it sorts under the Rejected tab, not the default Approved one.
    await user.click(await screen.findByRole("tab", { name: "Rejected" }));
    const row = (await screen.findByText("OPD-NO")).closest("tr")!;
    expect(within(row).getByText("Rejected")).toBeInTheDocument();
  });

  it("keeps the queue that loaded when the other backend is down", async () => {
    data.opdFails = true;
    data.finance = [expenseClaim({ id: "EXP-OK" })];
    show();
    expect(await screen.findByText("EXP-OK")).toBeInTheDocument();
    expect(screen.getByText(/couldn't be loaded/)).toBeInTheDocument();
  });
});


// Same trap as Needs you: the call that decides which queues run. When it fails
// the flags read false, the queues are disabled rather than failing, and a
// disabled query reports no error — so the screen would say nothing had been
// decided when nothing had loaded.
describe("when the call that decides the queues fails", () => {
  it("says something failed rather than reporting an empty list", async () => {
    data.appDataFails = true;
    show();
    expect(await screen.findByText(/couldn't be loaded/)).toBeInTheDocument();
    expect(screen.queryByText(/^Nothing (approved|rejected) yet\.$/)).not.toBeInTheDocument();
  });
});


// A <tr> takes no focus and answers no key, so a click handler on the row put
// the record behind a mouse. Needs you has always used a button; this tab had
// drifted from it.
describe("opening a record without a mouse", () => {
  it("offers a real button on each row", async () => {
    data.opd = [opdClaim({})];
    data.finance = [expenseClaim({})];
    show();
    const opdRow = (await screen.findByText("OPD-1")).closest("tr")!;
    const expenseRow = screen.getByText("EXP-1").closest("tr")!;
    expect(within(opdRow).getByRole("button", { name: "View" })).toBeInTheDocument();
    expect(within(expenseRow).getByRole("button", { name: "View" })).toBeInTheDocument();
  });

  it("opens the record from the keyboard", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    data.opd = [opdClaim({})];
    show();
    const row = (await screen.findByText("OPD-1")).closest("tr")!;
    within(row).getByRole("button", { name: "View" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("opd-review")).toBeInTheDocument();
  });
});

// A decided OPD claim replaces the whole tab with the app's own review
// screen, `pending={false}` — the record of what was decided.
describe("opening an OPD claim", () => {
  it("replaces the queue with the review screen, read-only", async () => {
    data.opd = [opdClaim({ id: "OPD-DONE" })];
    show();
    const row = (await screen.findByText("OPD-DONE")).closest("tr")!;
    within(row).getByRole("button", { name: "View" }).click();
    const review = await screen.findByTestId("opd-review");
    expect(review).toHaveTextContent("OPD-DONE");
    expect(review).toHaveAttribute("data-pending", "false");
    expect(screen.queryByRole("button", { name: "View" })).not.toBeInTheDocument();
  });
});

// An expense claim replaces the whole tab with the app's own Lead/Finance
// Approvals review screen, `pending={false}` — the record of what was
// decided, not the decision offered again.
describe("opening an expense claim", () => {
  it("replaces the queue with the review screen, read-only", async () => {
    data.finance = [expenseClaim({ id: "EXP-DONE" })];
    show();
    const row = (await screen.findByText("EXP-DONE")).closest("tr")!;
    within(row).getByRole("button", { name: "View" }).click();
    const review = await screen.findByTestId("expense-review");
    expect(review).toHaveTextContent("EXP-DONE");
    expect(review).toHaveAttribute("data-pending", "false");
    // Gone, not merely covered: the review screen took the tab's place.
    expect(screen.queryByRole("button", { name: "View" })).not.toBeInTheDocument();
  });

  // Only the stage decides whether Print shows, even read-only — so it has
  // to be right on a decided claim too, not just a pending one.
  it("reads the stage off a lead decision, not finance", async () => {
    data.lead = [expenseClaim({ id: "EXP-LEAD-REJ", statusDetails: { status: "LEAD_REJECTED" } })];
    const user = userEvent.setup();
    show();
    // Rejected, so it sorts under the Rejected tab, not the default Approved one.
    await user.click(await screen.findByRole("tab", { name: "Rejected" }));
    const row = (await screen.findByText("EXP-LEAD-REJ")).closest("tr")!;
    within(row).getByRole("button", { name: "View" }).click();
    const review = await screen.findByTestId("expense-review");
    expect(review).toHaveAttribute("data-stage", "LEAD");
  });

  it("reads the stage off a finance decision", async () => {
    data.finance = [expenseClaim({ id: "EXP-FIN-APP", statusDetails: { status: "APPROVED" } })];
    show();
    const row = (await screen.findByText("EXP-FIN-APP")).closest("tr")!;
    within(row).getByRole("button", { name: "View" }).click();
    const review = await screen.findByTestId("expense-review");
    expect(review).toHaveAttribute("data-stage", "FINANCE");
  });
});
