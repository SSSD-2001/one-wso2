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

// This tab's list, filters and activity trail used to have their own separate
// test suite against the standalone Finance -> OPD Claims -> Claim History
// screen (OpdClaimHistoryScreen.test.tsx). That screen read the same claims —
// there is no lead/finance split for OPD, so there was nothing left for it to
// cover once this tab shared its filters, table and search payload — so that
// coverage lives here now, alongside what only this tab has: the allowance
// strip and the resubmit flow.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type { OpdClaim } from "../opdTypes";

const navigate = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return { ...actual, useNavigate: () => navigate };
});

// The details dialog reaches @hooks/useAccessToken for receipt fetches, which
// pulls in the Asgardeo SDK; stubbed so the suite doesn't need a real session.
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));

vi.mock("@config/apiConfig", async () => {
  const actual = await vi.importActual<typeof import("@config/apiConfig")>("@config/apiConfig");
  return { ...actual, isOpdBackendConfigured: () => true };
});

vi.mock("../useOpdMutations", () => ({
  useOpdClaimStatus: () => ({ mutate: vi.fn(), isPending: false }),
}));

function claim(over: Partial<OpdClaim> = {}): OpdClaim {
  return {
    id: "OPD-2001",
    employeeEmail: "me@wso2.com",
    // A bare date, so the row renders the same day in every timezone. Noon
    // UTC is already the 18th in UTC+12 and beyond.
    createdDate: "2026-09-17",
    totalAmount: 7400,
    transactions: [
      { date: "2026-09-16", amount: 7400, comment: "Consultation", receiptUrl: "r.pdf" },
    ],
    statusDetails: {
      status: "PENDING",
      financeApproverEmail: null,
      financeApprovedDate: null,
      financeRejectedDate: null,
      financeRejectedReason: null,
    },
    ...over,
  };
}

const rejectedClaim = claim({
  id: "C-9",
  createdDate: "2026-03-02",
  totalAmount: 1500,
  statusDetails: {
    status: "REJECTED",
    financeApproverEmail: null,
    financeApprovedDate: null,
    financeRejectedDate: "2026-03-05",
    financeRejectedReason: "Receipt unreadable",
  },
  transactions: [{ date: "2026-03-01", amount: 1500, comment: "GP visit", receiptUrl: "r1.pdf" }],
});

const DEFAULT_SUMMARY = {
  totalClaimLimit: 75000,
  totalClaimedAmount: 21300,
  totalRemaining: 53700,
};

const state: {
  roles: number[];
  summary: typeof DEFAULT_SUMMARY | undefined;
  claims: OpdClaim[];
  claimsError: Error | null;
  userInfoError: Error | null;
} = {
  roles: [444],
  summary: DEFAULT_SUMMARY,
  claims: [rejectedClaim],
  claimsError: null,
  userInfoError: null,
};

/** Every search payload the screen asks for, so filter assertions are about
 * what reaches the backend rather than what renders. */
const payloads: Record<string, unknown>[] = [];

vi.mock("../useOpd", () => ({
  useOpdUserInfo: () => ({
    data: state.userInfoError
      ? undefined
      : { workEmail: "me@wso2.com", userRoles: state.roles },
    isLoading: false,
    isError: Boolean(state.userInfoError),
    isFetching: false,
    error: state.userInfoError,
    refetch: vi.fn(),
  }),
  useOpdClaims: (payload: Record<string, unknown>) => {
    payloads.push(payload);
    return {
      data: state.claimsError ? undefined : state.claims,
      isLoading: false,
      isError: Boolean(state.claimsError),
      isFetching: false,
      error: state.claimsError,
      refetch: vi.fn(),
      isSuccess: !state.claimsError,
    };
  },
  // The tab shows this year's allowance above the list — the figures used to
  // appear only inside the new-claim form, after the decision to file one had
  // already been made.
  useOpdAppData: () => ({
    data: state.summary
      ? { claimSummary: state.summary, lastYearClaimSummary: null, draft: null }
      : undefined,
    isLoading: false,
    isError: false,
  }),
}));

const { default: OpdHistoryPage } = await import("./OpdHistoryPage");
const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");

beforeEach(() => {
  navigate.mockClear();
  payloads.length = 0;
  state.roles = [444];
  state.summary = DEFAULT_SUMMARY;
  state.claims = [rejectedClaim];
  state.claimsError = null;
  state.userInfoError = null;
});

function show() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationsProvider>
        <MemoryRouter>
          <OpdHistoryPage />
        </MemoryRouter>
      </NotificationsProvider>
    </QueryClientProvider>,
  );
}

/** Claim ID lives behind the Filters control, drawn as a field rather than a
 * button, so it opens on mouseDown; its edits are held until Apply. */
function openFilters() {
  fireEvent.mouseDown(screen.getByLabelText("Filters"));
  return screen.getByLabelText("Claim ID");
}

function applyFilters() {
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
}

const viewButton = (id: string) => screen.getByRole("button", { name: `View claim ${id}` });

describe("who may see this tab's claims", () => {
  it("asks only for the signed-in person's claims", async () => {
    show();
    await waitFor(() => expect(payloads.length).toBeGreaterThan(0));
    expect(payloads.at(-1)).toMatchObject({ email: "me@wso2.com" });
  });

  // A failed lookup leaves `data` undefined, which reads as "no role" — so
  // without the isError guard this screen would tell someone their account
  // is ineligible when all that happened is a request failed.
  it("offers a retry rather than calling the account ineligible, when the role lookup fails", async () => {
    state.userInfoError = new Error("boom");
    show();
    expect(await screen.findByText(/Couldn't load your claims/)).toBeInTheDocument();
    expect(screen.queryByText(/aren't available for your account/)).not.toBeInTheDocument();
  });

  it("tells an account without the submitter role, rather than showing an empty list it can never fill", async () => {
    state.roles = [999];
    show();
    expect(await screen.findByText(/OPD claims aren't available for your account/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("the list", () => {
  it("shows a claim as a row", async () => {
    state.claims = [claim()];
    show();
    expect(await screen.findByText("OPD-2001")).toBeInTheDocument();
    expect(screen.getByText("17-Sep-2026")).toBeInTheDocument();
  });

  // Two different emptinesses: nothing filed yet, versus filters that match
  // nothing. Saying "no claims" to someone who has claims is a bug report.
  it("distinguishes a first-time claimant from filters that match nothing", async () => {
    state.claims = [];
    const { unmount } = show();
    expect(await screen.findByText(/haven't submitted an OPD claim yet/)).toBeInTheDocument();
    unmount();

    show();
    fireEvent.change(openFilters(), { target: { value: "OPD-9" } });
    applyFilters();
    expect(await screen.findByText("No claims match these filters.")).toBeInTheDocument();
  });

  it("offers a retry when the search fails", async () => {
    state.claimsError = new Error("boom");
    show();
    expect(await screen.findByText(/Couldn't load your claims/)).toBeInTheDocument();
  });
});

describe("filtering", () => {
  it("sends a typed claim id, trimmed", async () => {
    show();
    fireEvent.change(openFilters(), { target: { value: " OPD-7 " } });
    applyFilters();
    await waitFor(() => expect(payloads.at(-1)).toMatchObject({ ids: ["OPD-7"] }));
  });

  // The popover edits a copy: typing an id and walking away must not change
  // the list, or a half-finished thought would re-run the search.
  it("holds a typed id until Apply", async () => {
    show();
    fireEvent.change(openFilters(), { target: { value: "OPD-7" } });
    expect(payloads.at(-1)).toMatchObject({ ids: null });
    applyFilters();
    await waitFor(() => expect(payloads.at(-1)).toMatchObject({ ids: ["OPD-7"] }));
  });

  it("puts everything back on Clear", async () => {
    show();
    fireEvent.change(openFilters(), { target: { value: "OPD-7" } });
    applyFilters();
    await waitFor(() => expect(payloads.at(-1)).toMatchObject({ ids: ["OPD-7"] }));

    openFilters();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    await waitFor(() => expect(payloads.at(-1)).toMatchObject({ ids: null }));
  });

  it("defaults to this year", async () => {
    show();
    await waitFor(() => expect(payloads.length).toBeGreaterThan(0));
    const year = new Date().getFullYear();
    expect(payloads.at(-1)).toMatchObject({ startYear: year, endYear: year });
  });

  it("sends no status until one is chosen", async () => {
    show();
    await waitFor(() => expect(payloads.length).toBeGreaterThan(0));
    expect(payloads.at(-1)!.status).toBeNull();
  });
});

// FilterHolder.tsx — Year Range and Status stay on the page; everything else
// is behind Filters. A regression here is a filter nobody can find.
describe("the always-visible filters", () => {
  it("keeps Year Range and Status out of the menu", async () => {
    show();
    expect(await screen.findByLabelText("Year Range")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.queryByLabelText("Claim ID")).not.toBeInTheDocument();
  });
});

describe("the activity trail", () => {
  it("opens from the row's status", async () => {
    state.claims = [claim()];
    show();
    fireEvent.click(await screen.findByRole("button", { name: /Claim activity for OPD-2001/ }));
    expect(screen.getByText("Claim Activity")).toBeInTheDocument();
    expect(screen.getByText("Claim Submission")).toBeInTheDocument();
    expect(screen.getByText(/Finance Review/)).toBeInTheDocument();
  });

  it("gives finance's reason on a rejected claim", async () => {
    state.claims = [
      claim({
        statusDetails: {
          status: "REJECTED",
          financeApproverEmail: "f@wso2.com",
          financeApprovedDate: null,
          financeRejectedDate: "2026-09-18",
          financeRejectedReason: "Receipt unreadable.",
        },
      }),
    ];
    show();
    fireEvent.click(await screen.findByRole("button", { name: /Claim activity for OPD-2001/ }));
    expect(screen.getByText(/Receipt unreadable\./)).toBeInTheDocument();
  });
});

describe("opening a claim", () => {
  it("shows its bills, and the way back", async () => {
    state.claims = [claim()];
    show();
    fireEvent.click(await screen.findByRole("button", { name: "View claim OPD-2001" }));
    expect(await screen.findByText("OPD ITEM 1")).toBeInTheDocument();
    expect(screen.getByText("Consultation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to claim history" })).toBeInTheDocument();
  });

  it("offers the receipt, as one button", async () => {
    state.claims = [claim()];
    show();
    fireEvent.click(await screen.findByRole("button", { name: "View claim OPD-2001" }));
    expect(
      await screen.findByRole("button", { name: /View or download receipt for OPD ITEM 1/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Download receipt/ })).not.toBeInTheDocument();
  });

  it("goes back to the list", async () => {
    state.claims = [claim()];
    show();
    fireEvent.click(await screen.findByRole("button", { name: "View claim OPD-2001" }));
    fireEvent.click(await screen.findByRole("button", { name: "Back to claim history" }));
    expect(await screen.findByRole("button", { name: "View claim OPD-2001" })).toBeInTheDocument();
  });
});

// ClaimDetails.tsx:101-114,187-196,307,395-407. A rejected OPD claim can be
// taken up again: its bills seed a fresh claim.
describe("resubmitting a rejected claim", () => {
  it("offers the action on a rejected claim", async () => {
    show();
    fireEvent.click(viewButton("C-9"));
    expect(
      await screen.findByRole("button", { name: "Resubmit as New Claim" }),
    ).toBeInTheDocument();
  });

  it("does not offer it on an approved claim", async () => {
    state.claims = [
      { ...rejectedClaim, statusDetails: { ...rejectedClaim.statusDetails, status: "APPROVED" } },
    ];
    show();
    fireEvent.click(viewButton("C-9"));
    await screen.findByRole("button", { name: "Back to claim history" });
    expect(screen.queryByRole("button", { name: "Resubmit as New Claim" })).not.toBeInTheDocument();
  });

  it("warns that the existing draft will be replaced", async () => {
    show();
    fireEvent.click(viewButton("C-9"));
    fireEvent.click(await screen.findByRole("button", { name: "Resubmit as New Claim" }));
    expect(await screen.findByText("Claim Resubmission Confirmation")).toBeInTheDocument();
    expect(screen.getByText(/your existing draft will be cleared/)).toBeInTheDocument();
    // Nothing has happened yet.
    expect(navigate).not.toHaveBeenCalled();
  });

  it("carries the bills to the new-claim screen once confirmed", async () => {
    show();
    fireEvent.click(viewButton("C-9"));
    fireEvent.click(await screen.findByRole("button", { name: "Resubmit as New Claim" }));
    fireEvent.click(await screen.findByRole("button", { name: "Resubmit" }));

    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(navigate).toHaveBeenCalledWith("/me/claims/opd/new", {
      state: { resubmitTransactions: rejectedClaim.transactions },
    });
  });

  it("does nothing when the confirmation is dismissed", async () => {
    show();
    fireEvent.click(viewButton("C-9"));
    fireEvent.click(await screen.findByRole("button", { name: "Resubmit as New Claim" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByText("Claim Resubmission Confirmation")).not.toBeInTheDocument(),
    );
    expect(navigate).not.toHaveBeenCalled();
  });
});

// Whether a claim is worth filing is a question you answer BEFORE opening the
// form, so the allowance sits on the tab rather than inside the form where it
// used to live.
describe("this year's allowance", () => {
  it("shows the three figures the summary carries", async () => {
    show();
    expect(await screen.findByText("Annual limit")).toBeInTheDocument();
    expect(screen.getByText("Already claimed")).toBeInTheDocument();
    expect(screen.getByText("Remaining")).toBeInTheDocument();
  });

  it("shows what is left, which is the figure the decision turns on", async () => {
    show();
    expect(await screen.findByText("Rs. 53,700.00")).toBeInTheDocument();
  });

  // A strip of dashes above the claims would read as something broken, and
  // the claims are the point of the screen.
  it("says nothing at all rather than showing blanks when there is no summary", async () => {
    state.summary = undefined;
    show();
    await screen.findByText("C-9");
    expect(screen.queryByText("Annual limit")).not.toBeInTheDocument();
  });
});
