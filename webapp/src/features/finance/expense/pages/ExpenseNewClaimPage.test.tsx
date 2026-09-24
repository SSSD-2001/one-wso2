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
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { localIsoDateOffset } from "@utils/localDate";

// The page leaves for the claims list once a claim is in, so the test needs to
// see where it went.
const navigate = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));

const draftLine = {
  // Derived from the clock, not hardcoded: the form refuses a bill date older
  // than `pastDateRestrictionDays` (30 in this fixture), so a fixed date makes
  // every test that EDITS this line start failing once that many days pass —
  // Save stays disabled, the dialog never closes, and the failure looks like a
  // missing button rather than an expired fixture.
  date: localIsoDateOffset(-5),
  amount: 40,
  currency: "USD",
  currencyConversionRate: 300,
  reimbursementAmount: 12000,
  reimbursementCurrency: "LKR",
  expenseTypeId: 3,
  expenseType: "Taxi",
  comment: "Airport transfer",
  receiptUrl: "r1.pdf",
  travelJobNumber: "JOB-1",
};

const state = {
  // `onBehalfOfEmail` is part of the saved draft on the wire (`types.bal:26-31`)
  // — who it was being filed for, which decides whether this form may offer it.
  draft: null as { transactions: unknown[]; onBehalfOfEmail?: string | null } | null,
  managerEmail: "lead@wso2.com" as string | null,
  employees: [
    { workEmail: "lead@wso2.com", firstName: "Ada", lastName: "Lovelace", employeeThumbnail: null },
  ] as unknown[],
  // Empty for almost everyone — the on-behalf picker is hidden entirely then.
  onBehalfOfEmployees: [] as string[],
  onBehalfOfTravels: [] as { jobNumber: string; customerName: string | null }[],
  rates: [{ currencyCode: "USD", exchangeRate: 300 }] as { currencyCode: string; exchangeRate: number }[],
};

const submitMutate = vi.fn();
const draftRemove = vi.fn();
const draftSave = vi.fn(async () => undefined);

vi.mock("../submitter/useExpenseSubmitter", () => ({
  useSubmitterAppData: () => ({
    data: {
      userInfo: {
        workEmail: "me@wso2.com",
        firstName: "Me",
        lastName: "Myself",
        managerEmail: state.managerEmail,
      },
      enableLeadView: false,
      enableFinanceView: false,
      currencyCode: "LKR",
      countryCode: "LK",
      travels: [{ jobNumber: "JOB-1", customerName: null, engagementCode: null, country: null, productUnit: null, businessUnit: null }],
      draft: state.draft,
      pastDateRestrictionDays: 30,
      onBehalfOfEmployees: state.onBehalfOfEmployees,
    },
    isLoading: false,
    isError: false,
    isSuccess: true,
  }),
  useOnBehalfOfTravels: () => ({ data: state.onBehalfOfTravels, isLoading: false, isError: false }),
  useSubmitterExpenseTypes: () => ({ data: [{ id: 3, type: "Taxi" }], isLoading: false, isError: false }),
  useSubmitClaimForEmployee: () => ({ mutate: submitMutate, isPending: false, isError: false, error: null }),
  useSubmitterDraftSync: () => ({
    save: { mutateAsync: draftSave },
    remove: { mutate: draftRemove, mutateAsync: vi.fn(async () => undefined) },
  }),
}));

vi.mock("../useExpense", () => ({
  useExpenseEmployees: () => ({ data: state.employees, isLoading: false, isError: false }),
  useExchangeRates: () => ({ data: state.rates, isLoading: false, isError: false }),
}));

const uploadMutate = vi.fn(async () => "r.pdf");
vi.mock("../useExpenseMutations", () => ({
  useExpenseReceiptUpload: () => ({ mutateAsync: uploadMutate, isPending: false }),
}));

vi.mock("../../components/FinanceShell", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const { default: ExpenseNewClaimPage } = await import("./ExpenseNewClaimPage");
const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");

beforeEach(() => {
  submitMutate.mockClear();
  navigate.mockClear();
  draftRemove.mockClear();
  draftSave.mockClear();
  uploadMutate.mockClear();
  state.draft = null;
  state.managerEmail = "lead@wso2.com";
  state.employees = [
    { workEmail: "lead@wso2.com", firstName: "Ada", lastName: "Lovelace", employeeThumbnail: null },
  ];
  state.onBehalfOfEmployees = [];
  state.onBehalfOfTravels = [];
  state.rates = [{ currencyCode: "USD", exchangeRate: 300 }];
});

afterEach(() => {
  const cancel = screen.queryByRole("button", { name: "Cancel" });
  if (cancel) fireEvent.click(cancel);
});

function show() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationsProvider>
        <ExpenseNewClaimPage />
      </NotificationsProvider>
    </QueryClientProvider>,
  );
}

// The one thing that used to live only on the Finance-perspective screen: a
// handful of people file a claim FOR someone else. The employee goes on the
// payload; without it the backend files the claim against the submitter,
// which is the wrong person's money.
describe("filing on behalf of someone else", () => {
  it("offers no picker to someone with nobody to file for", async () => {
    show();
    await screen.findByText(/haven't added any expenses yet/);
    expect(screen.queryByLabelText("Submitting for")).not.toBeInTheDocument();
  });

  // The job numbers offered must be the CLAIM OWNER's. Offering the
  // submitter's own would file the line against a job the employee never
  // travelled on.
  it("swaps in the chosen employee's job numbers, not the submitter's", async () => {
    state.onBehalfOfEmployees = ["colleague@wso2.com"];
    state.employees = [
      { workEmail: "lead@wso2.com", firstName: "Ada", lastName: "Lovelace", employeeThumbnail: null },
      { workEmail: "colleague@wso2.com", firstName: "Grace", lastName: "Hopper", employeeThumbnail: null },
    ];
    state.onBehalfOfTravels = [{ jobNumber: "JOB-HERS", customerName: null }];
    show();

    // Pick the employee before any line exists — the only time it is offered.
    fireEvent.change(await screen.findByLabelText("Submitting for"), { target: { value: "Grace" } });
    fireEvent.click(await screen.findByText("Grace Hopper"));

    fireEvent.click(await screen.findByRole("button", { name: "+ Add expense" }));
    // The form says whose claim this line joins...
    expect(await screen.findByText("(for Grace Hopper)")).toBeInTheDocument();
    // ...and offers her job numbers, not the signed-in user's JOB-1.
    fireEvent.mouseDown(screen.getByLabelText("Job number"));
    expect(await screen.findByRole("option", { name: /JOB-HERS/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /JOB-1/ })).not.toBeInTheDocument();
  });

  it("puts the chosen employee on the submitted claim", async () => {
    state.onBehalfOfEmployees = ["colleague@wso2.com"];
    state.employees = [
      { workEmail: "colleague@wso2.com", firstName: "Grace", lastName: "Hopper", employeeThumbnail: null },
    ];
    state.onBehalfOfTravels = [{ jobNumber: "JOB-HERS", customerName: null }];
    show();
    fireEvent.change(await screen.findByLabelText("Submitting for"), { target: { value: "Grace" } });
    fireEvent.click(await screen.findByText("Grace Hopper"));
    await addOneLine();

    fireEvent.click(await screen.findByRole("button", { name: /Submit claim/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Submit" }));
    await waitFor(() =>
      expect(submitMutate).toHaveBeenCalledWith(
        expect.objectContaining({ onBehalfOfEmail: "colleague@wso2.com" }),
        expect.anything(),
      ),
    );
  });

  // Filing for someone else routes to THEIR lead, so the confirmation must not
  // name the submitter's own lead.
  it("does not name your own lead when the claim is for someone else", async () => {
    state.onBehalfOfEmployees = ["colleague@wso2.com"];
    state.employees = [
      { workEmail: "lead@wso2.com", firstName: "Ada", lastName: "Lovelace", employeeThumbnail: null },
      { workEmail: "colleague@wso2.com", firstName: "Grace", lastName: "Hopper", employeeThumbnail: null },
    ];
    state.onBehalfOfTravels = [{ jobNumber: "JOB-HERS", customerName: null }];
    show();
    fireEvent.change(await screen.findByLabelText("Submitting for"), { target: { value: "Grace" } });
    fireEvent.click(await screen.findByText("Grace Hopper"));
    await addOneLine();
    fireEvent.click(await screen.findByRole("button", { name: /Submit claim/ }));

    expect(await screen.findByText(/on behalf of/)).toBeInTheDocument();
    expect(screen.queryByText(/Ada Lovelace/)).not.toBeInTheDocument();
  });

  // A claim filed for yourself must not carry a stale employee from a previous
  // draft — null is what tells the backend "this one is mine".
  it("submits as yourself when nobody is picked", async () => {
    state.draft = { transactions: [draftLine] };
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Restore Draft" }));
    fireEvent.click(await screen.findByRole("button", { name: /Submit claim/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Submit" }));
    await waitFor(() =>
      expect(submitMutate).toHaveBeenCalledWith(
        expect.objectContaining({ onBehalfOfEmail: null }),
        expect.anything(),
      ),
    );
  });
});

// NewClaim.tsx:200-216,263-270. The port restored a saved draft silently, which
// makes a stale draft look like work in progress and leaves no way to start
// fresh without deleting lines you never entered this session.
describe("a saved draft is offered, not assumed", () => {
  it("is not loaded on arrival", async () => {
    state.draft = { transactions: [draftLine] };
    show();
    expect(await screen.findByRole("button", { name: "Restore Draft" })).toBeInTheDocument();
    expect(screen.queryByText("Taxi")).not.toBeInTheDocument();
  });

  it("loads when restored", async () => {
    state.draft = { transactions: [draftLine] };
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Restore Draft" }));
    expect(await screen.findByText("Taxi")).toBeInTheDocument();
    expect(await screen.findByText("Draft restored successfully")).toBeInTheDocument();
  });

  it("keeps the reimbursement total the draft was saved with", async () => {
    state.draft = { transactions: [draftLine] };
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Restore Draft" }));
    // The total now lives in its own "Total Amount" row rather than on the
    // Submit button's label — it also repeats on the single item's own
    // "Reimbursement Amount" figure, so two copies is what a one-line claim
    // looks like.
    await waitFor(() =>
      expect(screen.getAllByText("Rs. 12,000.00").length).toBeGreaterThanOrEqual(2),
    );
  });

  it("offers nothing to restore when there is no draft", async () => {
    show();
    await screen.findByText(/haven't added any expenses yet/);
    expect(screen.queryByRole("button", { name: "Restore Draft" })).not.toBeInTheDocument();
  });

  it("warns before a new line discards the draft", async () => {
    state.draft = { transactions: [draftLine] };
    show();
    fireEvent.click(await screen.findByRole("button", { name: "+ Add expense" }));
    expect(await screen.findByText("Draft Deletion Warning")).toBeInTheDocument();
  });

  // NewClaim.tsx:53 — `canRestoreDraft` also requires the draft to belong to
  // whoever the form is filing for. A draft saved while filing FOR somebody
  // else is not offered under "Myself": its lines carry that person's job
  // numbers and would be filed as the reader's own spend.
  it("does not offer a draft that was being filed for somebody else", async () => {
    state.draft = { transactions: [draftLine], onBehalfOfEmail: "yukthi@wso2.com" };
    show();
    await screen.findByText(/haven't added any expenses yet/);
    expect(screen.queryByRole("button", { name: "Restore Draft" })).not.toBeInTheDocument();
  });

  // One draft slot per person, shared whoever it was filed for: adding a line
  // overwrites it, so the warning still stands.
  it("still warns before discarding somebody else's draft", async () => {
    state.draft = { transactions: [draftLine], onBehalfOfEmail: "yukthi@wso2.com" };
    show();
    fireEvent.click(await screen.findByRole("button", { name: "+ Add expense" }));
    expect(await screen.findByText("Draft Deletion Warning")).toBeInTheDocument();
  });

  it("does not warn once there is no draft to lose", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "+ Add expense" }));
    expect(await screen.findByText("Add an expense")).toBeInTheDocument();
  });

  // A draft saved for Myself belongs to Myself, so picking someone else starts
  // a fresh claim for them rather than carrying your own draft over.
  it("is not offered once an employee is picked", async () => {
    state.onBehalfOfEmployees = ["colleague@wso2.com"];
    state.employees = [
      { workEmail: "lead@wso2.com", firstName: "Ada", lastName: "Lovelace", employeeThumbnail: null },
      { workEmail: "colleague@wso2.com", firstName: "Grace", lastName: "Hopper", employeeThumbnail: null },
    ];
    state.draft = { transactions: [draftLine] };
    show();
    expect(await screen.findByRole("button", { name: "Restore Draft" })).toBeInTheDocument();

    fireEvent.change(await screen.findByLabelText("Submitting for"), { target: { value: "Grace" } });
    fireEvent.click(await screen.findByText("Grace Hopper"));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Restore Draft" })).not.toBeInTheDocument(),
    );
  });

  // A draft belongs to whoever it was being filed FOR. Offering it under
  // "Myself" put a colleague's draft on your own empty claim, and restoring it
  // then switched the picker to them without being asked. Restoring an
  // on-behalf draft is only offered once that same colleague is picked again.
  describe("a draft saved for a colleague", () => {
    beforeEach(() => {
      state.onBehalfOfEmployees = ["colleague@wso2.com"];
      state.employees = [
        { workEmail: "colleague@wso2.com", firstName: "Grace", lastName: "Hopper", employeeThumbnail: null },
      ];
      state.draft = { transactions: [draftLine], onBehalfOfEmail: "colleague@wso2.com" };
    });

    it("is not offered while the picker is on Myself", async () => {
      show();
      await screen.findByText(/haven't added any expenses yet/);
      expect(screen.queryByRole("button", { name: "Restore Draft" })).not.toBeInTheDocument();
    });

    it("warns that adding a line will destroy it", async () => {
      show();
      fireEvent.change(await screen.findByLabelText("Submitting for"), { target: { value: "Grace" } });
      fireEvent.click(await screen.findByText("Grace Hopper"));

      fireEvent.click(await screen.findByRole("button", { name: "+ Add expense" }));
      expect(await screen.findByText("Draft Deletion Warning")).toBeInTheDocument();
      // ...and the line form only opens once the loss is accepted.
      expect(screen.queryByLabelText("Amount")).not.toBeInTheDocument();
    });

    // NewClaim.tsx:200 warns whenever a draft EXISTS, not only when it can be
    // restored — so the warning appears under "Myself" too, where the
    // colleague's draft is not on offer but would still be destroyed.
    it("warns under Myself as well, where it is not on offer", async () => {
      show();
      await screen.findByText(/haven't added any expenses yet/);
      expect(screen.queryByRole("button", { name: "Restore Draft" })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "+ Add expense" }));
      expect(await screen.findByText("Draft Deletion Warning")).toBeInTheDocument();
      // Filing as yourself, so nobody else is named.
      expect(screen.queryByText(/Grace Hopper/)).not.toBeInTheDocument();
    });

    // Filing for someone else, the warning says whose claim it is.
    it("names who the claim is for when one is picked", async () => {
      show();
      fireEvent.change(await screen.findByLabelText("Submitting for"), { target: { value: "Grace" } });
      fireEvent.click(await screen.findByText("Grace Hopper"));

      fireEvent.click(await screen.findByRole("button", { name: "+ Add expense" }));
      expect(await screen.findByText("Draft Deletion Warning")).toBeInTheDocument();
      expect(screen.getByText(/Grace Hopper/)).toBeInTheDocument();
    });

    it("is offered once that colleague is picked", async () => {
      show();
      fireEvent.change(await screen.findByLabelText("Submitting for"), { target: { value: "Grace" } });
      fireEvent.click(await screen.findByText("Grace Hopper"));

      expect(await screen.findByRole("button", { name: "Restore Draft" })).toBeInTheDocument();
    });

    it("restores their lines under their name", async () => {
      show();
      fireEvent.change(await screen.findByLabelText("Submitting for"), { target: { value: "Grace" } });
      fireEvent.click(await screen.findByText("Grace Hopper"));
      fireEvent.click(await screen.findByRole("button", { name: "Restore Draft" }));

      expect(await screen.findByText("(for Grace Hopper)")).toBeInTheDocument();
      expect(screen.getByText("EXPENSE ITEM 1")).toBeInTheDocument();
    });
  });

  it("saves the employee onto the autosaved draft", async () => {
    state.onBehalfOfEmployees = ["colleague@wso2.com"];
    state.employees = [
      { workEmail: "colleague@wso2.com", firstName: "Grace", lastName: "Hopper", employeeThumbnail: null },
    ];
    state.onBehalfOfTravels = [{ jobNumber: "JOB-HERS", customerName: null }];
    show();
    fireEvent.change(await screen.findByLabelText("Submitting for"), { target: { value: "Grace" } });
    fireEvent.click(await screen.findByText("Grace Hopper"));
    await addOneLine();

    await waitFor(() =>
      expect(draftSave).toHaveBeenCalledWith(
        expect.objectContaining({ onBehalfOfEmail: "colleague@wso2.com" }),
      ),
    );
  });
});

// NewClaim.tsx:225-248 — the claim leaves for someone else to review, so it is
// confirmed rather than sent on one click, and the message names the lead.
describe("submitting is confirmed", () => {
  it("asks before sending, and names the lead", async () => {
    state.draft = { transactions: [draftLine] };
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Restore Draft" }));
    fireEvent.click(await screen.findByRole("button", { name: /Submit claim/ }));

    expect(await screen.findByText("Claim Submission Confirmation")).toBeInTheDocument();
    // AppHandler.tsx:28 resolves the name from /employees.
    expect(screen.getByText(/\(Ada Lovelace\)/)).toBeInTheDocument();
    expect(submitMutate).not.toHaveBeenCalled();
  });

  it("falls back to the address when the name is unknown", async () => {
    state.employees = [];
    state.draft = { transactions: [draftLine] };
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Restore Draft" }));
    fireEvent.click(await screen.findByRole("button", { name: /Submit claim/ }));
    expect(await screen.findByText(/\(lead@wso2\.com\)/)).toBeInTheDocument();
    state.employees = [
      { workEmail: "lead@wso2.com", firstName: "Ada", lastName: "Lovelace", employeeThumbnail: null },
    ];
  });

  it("omits the parenthetical entirely when there is no lead", async () => {
    state.managerEmail = null;
    state.draft = { transactions: [draftLine] };
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Restore Draft" }));
    fireEvent.click(await screen.findByRole("button", { name: /Submit claim/ }));
    await screen.findByText("Claim Submission Confirmation");
    // NewClaim.tsx:240-242 renders no empty "()" when neither name nor email is known.
    expect(screen.queryByText(/\(\s*\)/)).not.toBeInTheDocument();
  });

  it("sends once confirmed", async () => {
    state.draft = { transactions: [draftLine] };
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Restore Draft" }));
    fireEvent.click(await screen.findByRole("button", { name: /Submit claim/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Submit" }));
    await waitFor(() => expect(submitMutate).toHaveBeenCalled());
  });
});

// NewClaim.tsx:139 passes AccessMode.EDIT_DELETE — a line can be corrected in
// place. The port could only remove and retype it, which on this form means
// re-picking the job number, expense type, currency and receipt.
describe("correcting a line", () => {
  it("opens the line's values for editing", async () => {
    state.draft = { transactions: [draftLine] };
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Restore Draft" }));
    fireEvent.click(await screen.findByRole("button", { name: "Edit expense" }));

    expect(await screen.findByText("Edit expense")).toBeInTheDocument();
    expect(screen.getByDisplayValue("40")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Airport transfer")).toBeInTheDocument();
  });

  it("replaces the line rather than adding another", async () => {
    state.draft = { transactions: [draftLine] };
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Restore Draft" }));
    fireEvent.click(await screen.findByRole("button", { name: "Edit expense" }));
    fireEvent.change(await screen.findByDisplayValue("40"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Save expense" }));

    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Remove expense" })).toHaveLength(1),
    );
    // 50 USD at the mocked rate of 300 = 15,000 reimbursed — shown on both the
    // item's own figure and the claim's Total Amount row.
    await waitFor(() =>
      expect(screen.getAllByText("Rs. 15,000.00").length).toBeGreaterThanOrEqual(2),
    );
  });

  it("adds a second line when not editing", async () => {
    state.draft = { transactions: [draftLine] };
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Restore Draft" }));
    fireEvent.click(await screen.findByRole("button", { name: "+ Add expense" }));
    expect(await screen.findByText("Add an expense")).toBeInTheDocument();
    // A fresh line starts empty rather than carrying the edited one's values.
    expect(screen.queryByDisplayValue("Airport transfer")).not.toBeInTheDocument();
  });
});

// ExpenseForm.tsx:133-143 compares the bill date against a timestamp
// (`now - N days`) with isAfter, and the date is midnight — so midnight of N
// days ago is never after it. The oldest date accepted is N-1 days ago:
// "within the last N days" counting today as the first. The port's inclusive
// min allowed one day more, and did not check the typed value at all.
// The clock is frozen just after midnight UTC, which is the previous evening
// in the suite's timezone. That is exactly the window where a calendar date
// read from `toISOString()` and one read from local fields name different days,
// and it is the only window in which this class of bug shows itself.
describe("the date bound near midnight UTC", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-31T02:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("bounds the picker by the local calendar day, not the UTC one", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "+ Add expense" }));
    const field = await screen.findByLabelText("Bill date");
    // 30-day restriction, so the oldest accepted date is 29 days back from the
    // local day (30 Aug here), not from the UTC one (31 Aug).
    expect(field).toHaveAttribute("min", localIsoDateOffset(-29));
    expect(field).toHaveAttribute("max", localIsoDateOffset(0));
  });
});

describe("how far back a bill date may go", () => {
  const daysAgo = (n: number) => localIsoDateOffset(-n);

  it("bounds the picker at N-1 days, not N", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "+ Add expense" }));
    // pastDateRestrictionDays is 30 in the fixture.
    expect(await screen.findByLabelText("Bill date")).toHaveAttribute("min", daysAgo(29));
  });

  it("refuses a typed date that is one day too old", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "+ Add expense" }));
    fireEvent.change(await screen.findByLabelText("Bill date"), {
      target: { value: daysAgo(30) },
    });
    expect(await screen.findByText("Date within last 30 days required")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add expense" })).toBeDisabled();
  });

  it("accepts the oldest date the source accepts", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "+ Add expense" }));
    fireEvent.change(await screen.findByLabelText("Bill date"), {
      target: { value: daysAgo(29) },
    });
    await waitFor(() =>
      expect(screen.queryByText("Date within last 30 days required")).not.toBeInTheDocument(),
    );
  });
});

// Raised on PR #30. The source's picker sets maxDate={new Date()}
// (CustomDatePicker.tsx:73), so a bill is never dated in the future. The port's
// native input carries `max`, but the attribute takes no part in `valid` — and
// the field is typeable, so a future date reached the claim.
describe("a bill cannot be dated in the future", () => {
  const inDays = (n: number) => localIsoDateOffset(n);

  it("refuses a typed future date", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "+ Add expense" }));
    fireEvent.change(await screen.findByLabelText("Bill date"), {
      target: { value: inDays(3) },
    });
    expect(await screen.findByText("Bill date cannot be in the future")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add expense" })).toBeDisabled();
  });

  it("accepts today", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "+ Add expense" }));
    fireEvent.change(await screen.findByLabelText("Bill date"), {
      target: { value: inDays(0) },
    });
    await waitFor(() =>
      expect(screen.queryByText("Bill date cannot be in the future")).not.toBeInTheDocument(),
    );
  });

  it("refuses an empty date", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "+ Add expense" }));
    fireEvent.change(await screen.findByLabelText("Bill date"), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Add expense" })).toBeDisabled();
  });
});

// FinanceShell has no back affordance of its own, and this form has no other
// way out but the sidebar without one.
describe("leaving without submitting", () => {
  it("offers a way back to the claims list", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Back to claims" }));
    expect(navigate).toHaveBeenCalledWith("/me/claims/expense");
  });
});

// A submitted claim should have a visible result. Leaving an emptied form on
// screen makes it look like nothing happened, and the claim it produced is the
// one thing worth seeing.
describe("after a claim goes in", () => {
  /** A claim with one line in it, sent and confirmed. */
  async function submitClaim() {
    state.draft = { transactions: [draftLine] };
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Restore Draft" }));
    fireEvent.click(await screen.findByRole("button", { name: /Submit claim/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Submit" }));
    await waitFor(() => expect(submitMutate).toHaveBeenCalled());
  }

  it("goes to the expense list, not the OPD one", async () => {
    await submitClaim();
    submitMutate.mock.calls[0][1].onSuccess();
    expect(navigate).toHaveBeenCalledWith("/me/claims/expense", { replace: true });
  });

  // Back should not return to a form that has already been sent.
  it("replaces the form in history rather than stacking on it", async () => {
    await submitClaim();
    submitMutate.mock.calls[0][1].onSuccess();
    expect(navigate.mock.calls.at(-1)?.[1]).toMatchObject({ replace: true });
  });

  it("stays put when the submit fails", async () => {
    await submitClaim();
    submitMutate.mock.calls[0][1].onError(new Error("nope"));
    expect(navigate).not.toHaveBeenCalled();
  });
});

/**
 * Fill the line dialog and add it to the claim. The receipt is required, so it
 * is dropped on the upload area rather than picked through a file dialog.
 */
async function addOneLine({ amount = "40" }: { amount?: string } = {}) {
  fireEvent.click(await screen.findByRole("button", { name: "+ Add expense" }));
  fireEvent.change(await screen.findByLabelText("Amount"), { target: { value: amount } });

  fireEvent.mouseDown(screen.getByLabelText("Expense type"));
  fireEvent.click(await screen.findByRole("option", { name: "Taxi" }));

  fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Airport transfer" } });

  const zone = await screen.findByText(/Drop a receipt here/);
  const file = new File(["x"], "taxi.pdf", { type: "application/pdf" });
  fireEvent.drop(zone, { dataTransfer: { files: [file] } });
  await waitFor(() => expect(uploadMutate).toHaveBeenCalled());

  const add = await screen.findByRole("button", { name: "Add expense" });
  await waitFor(() => expect(add).not.toBeDisabled());
  fireEvent.click(add);
}

// Creating a claim from nothing — the path a submitter actually takes, as
// opposed to restoring a draft someone already built.
describe("creating a claim from scratch", () => {
  it("adds a filled-in line to the claim", async () => {
    show();
    await addOneLine();

    expect(await screen.findByText("EXPENSE ITEM 1")).toBeInTheDocument();
    expect(screen.getByText("Taxi")).toBeInTheDocument();
    expect(screen.getByText("Airport transfer")).toBeInTheDocument();
  });

  it("submits the line it was given", async () => {
    show();
    await addOneLine();

    fireEvent.click(await screen.findByRole("button", { name: /Submit claim/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Submit" }));
    await waitFor(() =>
      expect(submitMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          transactions: [expect.objectContaining({ amount: 40, expenseTypeId: 3, receiptUrl: "r.pdf" })],
        }),
        expect.anything(),
      ),
    );
  });

  it("adds a second line rather than replacing the first", async () => {
    show();
    await addOneLine();
    await addOneLine({ amount: "10" });

    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Remove expense" })).toHaveLength(2),
    );
  });
});

// A foreign-currency line is converted at the fetched rate. A missing rate must
// NOT collapse to 1 — that would submit the raw foreign amount as if it were
// already in the reimbursement currency.
describe("converting a foreign-currency amount", () => {
  it("prices the line at the fetched rate", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "+ Add expense" }));
    fireEvent.mouseDown(screen.getByLabelText("Currency"));
    fireEvent.click(await screen.findByRole("option", { name: "USD" }));
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "50" } });

    // 50 USD at the mocked rate of 300.
    expect(await screen.findByText("Rs. 15,000.00")).toBeInTheDocument();
    expect(screen.getByText("(1 USD = 300 LKR)")).toBeInTheDocument();
  });

  it("carries the converted figure onto the claim total", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "+ Add expense" }));
    fireEvent.mouseDown(screen.getByLabelText("Currency"));
    fireEvent.click(await screen.findByRole("option", { name: "USD" }));
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "50" } });
    fireEvent.mouseDown(screen.getByLabelText("Expense type"));
    fireEvent.click(await screen.findByRole("option", { name: "Taxi" }));
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Airport transfer" } });
    const zone = await screen.findByText(/Drop a receipt here/);
    fireEvent.drop(zone, {
      dataTransfer: { files: [new File(["x"], "t.pdf", { type: "application/pdf" })] },
    });
    await waitFor(() => expect(uploadMutate).toHaveBeenCalled());
    const add = await screen.findByRole("button", { name: "Add expense" });
    await waitFor(() => expect(add).not.toBeDisabled());
    fireEvent.click(add);

    // The line, and the card's Total Amount footer, both in LKR.
    await waitFor(() =>
      expect(screen.getAllByText("Rs. 15,000.00").length).toBeGreaterThanOrEqual(2),
    );
    expect(screen.getByText("Total Amount:").parentElement).toHaveTextContent("Rs. 15,000.00");
  });

  // A missing rate must NOT collapse to 1: that would price 50 USD as Rs. 50
  // and let the raw foreign amount through as if it were already converted.
  it("refuses to price a line when no rate covers the currency", async () => {
    state.rates = [{ currencyCode: "USD", exchangeRate: 300 }, { currencyCode: "EUR", exchangeRate: 0 }];
    show();
    fireEvent.click(await screen.findByRole("button", { name: "+ Add expense" }));
    fireEvent.mouseDown(screen.getByLabelText("Currency"));
    fireEvent.click(await screen.findByRole("option", { name: "USD" }));
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "50" } });
    expect(await screen.findByText("Rs. 15,000.00")).toBeInTheDocument();

    // Now drop the rate list, as a date with no published rates would.
    state.rates = [];
    fireEvent.change(screen.getByLabelText("Bill date"), {
      target: { value: localIsoDateOffset(-1) },
    });

    expect(await screen.findByText(/No exchange rate available for USD/)).toBeInTheDocument();
    // Neither converted nor passed through raw.
    expect(screen.queryByText("Rs. 15,000.00")).not.toBeInTheDocument();
    expect(screen.queryByText("Rs. 50.00")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add expense" })).toBeDisabled();
  });
});

// The receipt can be dropped on the form, not only picked through a file
// dialog. A dropped file skips the input's `accept` filter, so the type check
// has to be the form's own.
describe("attaching a receipt", () => {
  const openForm = async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "+ Add expense" }));
    return await screen.findByText(/Drop a receipt here/);
  };

  it("uploads a file dropped on the receipt area", async () => {
    const zone = await openForm();
    const file = new File(["x"], "taxi.pdf", { type: "application/pdf" });
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    await waitFor(() => expect(uploadMutate).toHaveBeenCalled());
    expect(await screen.findByText("taxi.pdf")).toBeInTheDocument();
  });

  it("refuses a file type the backend would reject", async () => {
    const zone = await openForm();
    const file = new File(["x"], "notes.txt", { type: "text/plain" });
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(await screen.findByText(/Invalid file type/)).toBeInTheDocument();
    expect(uploadMutate).not.toHaveBeenCalled();
  });

  // A receipt is required for the line to validate, so a pointer-only control
  // makes the whole form impossible to complete from the keyboard.
  it("opens the file picker from the keyboard", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "+ Add expense" }));
    const zone = await screen.findByRole("button", { name: /Add a receipt/ });
    expect(zone).toHaveAttribute("tabindex", "0");

    const picker = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clicked = vi.spyOn(picker, "click");
    fireEvent.keyDown(zone, { key: "Enter" });
    expect(clicked).toHaveBeenCalled();

    fireEvent.keyDown(zone, { key: " " });
    expect(clicked).toHaveBeenCalledTimes(2);
    clicked.mockRestore();
  });

  it("names the attached receipt on the control once one is on", async () => {
    const zone = await openForm();
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["x"], "taxi.pdf", { type: "application/pdf" })] } });
    await waitFor(() => expect(uploadMutate).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: /Receipt taxi\.pdf/ })).toBeInTheDocument();
  });

  it("refuses a multi-file drop rather than silently taking the first", async () => {
    const zone = await openForm();
    const files = [
      new File(["x"], "a.pdf", { type: "application/pdf" }),
      new File(["y"], "b.pdf", { type: "application/pdf" }),
    ];
    fireEvent.drop(zone, { dataTransfer: { files } });
    expect(await screen.findByText(/more than one file/)).toBeInTheDocument();
    expect(uploadMutate).not.toHaveBeenCalled();
  });

  it("will not add a line with no receipt attached", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "+ Add expense" }));
    fireEvent.change(await screen.findByLabelText("Amount"), { target: { value: "40" } });
    fireEvent.mouseDown(screen.getByLabelText("Expense type"));
    fireEvent.click(await screen.findByRole("option", { name: "Taxi" }));
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Airport transfer" } });

    expect(screen.getByRole("button", { name: "Add expense" })).toBeDisabled();
  });
});
