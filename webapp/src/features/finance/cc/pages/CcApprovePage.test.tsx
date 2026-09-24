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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));

vi.mock("../../components/FinanceShell", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const base = {
  ccNumber: "4444",
  txnDate: "2026-08-20",
  txnDescription: "Hotel",
  txnAmount: 500,
  expenseTypeId: 1,
  expenseCategoryLabel: "Travel",
  expenseTypeLabel: "Hotels",
  txnComment: "Client trip",
  receiptFileName: "r.pdf",
  contractFileName: null,
  subRegion: null,
  travelJobNumber: "JOB-1",
  productUnit: "Integration",
  businessUnit: "Platform",
  employeeEmail: "someone@wso2.com",
  leadEmail: "lead@wso2.com, other@wso2.com",
  financeApproverEmail: null,
  empPostedDate: null,
  leadApprovedDate: null,
  financeApprovedDate: null,
  reportSequenceNumber: null,
};

const withLead = { ...base, id: 1, status: "pending_lead" };
/**
 * Non-travel, so its units come from the aligned menu arrays rather than from a
 * job number. With the menus empty — as they are here, and as they are for a
 * moment on every real load — the pair cannot be resolved, which is the case
 * that used to disable Save.
 */
const nonTravelWithLead = {
  ...base,
  id: 4,
  status: "pending_lead",
  expenseCategoryLabel: "Software",
  expenseTypeLabel: "Subscriptions",
  travelJobNumber: null,
};
const withFinance = { ...base, id: 2, status: "pending_finance" };

const state = {
  access: ["finance"] as string[],
  // Mutable so a test can empty the queue and read the empty state.
  txns: [withLead, withFinance] as unknown[],
};

vi.mock("../useCc", () => ({
  useCcMenus: () => ({
    expenseTypes: { data: { categories: [], types: {} }, isLoading: false },
    subRegions: { data: { subRegions: [] }, isLoading: false },
    units: { data: { productUnits: [], businessUnits: [] }, isLoading: false },
    jobNumbers: { data: { jobNumbers: [] }, isLoading: false },
  }),
  useCcJobNumberDetails: () => ({ data: undefined, isLoading: false, isError: false }),
  useCcUserInfo: () => ({
    data: { workEmail: "lead@wso2.com", accessLevels: state.access },
    isLoading: false,
    isError: false,
  }),
  useCcTransactions: () => ({
    data: state.txns,
    isLoading: false,
    isError: false,
  }),
  // Read only for the reassignment list. Two leads across the cards, one of
  // whom has nothing pending — the list must still offer them.
  useCreditCards: (includeInactive?: boolean) => ({
    data: ([
      { id: 1, ccNumber: "4444", leadEmail: "lead@wso2.com, other@wso2.com", employeeEmail: "someone@wso2.com", status: "Active" },
      // Inactive on purpose: a pending row can outlive its card, and whoever
      // leads it is still a valid target for reassignment.
      { id: 2, ccNumber: "5555", leadEmail: "spare@wso2.com", employeeEmail: "nobody@wso2.com", status: "Inactive" },
    ]).filter((c) => includeInactive || c.status === "Active"),
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("../ccTypes", async () => {
  const actual = await vi.importActual<typeof import("../ccTypes")>("../ccTypes");
  return { ...actual, ccHasAccess: (_u: unknown, lvl: string) => state.access.includes(lvl) };
});

const saveEdit = vi.fn();
const mutations = { savePending: false };
// Records which stage was approved, so a test can prove the mode picked the
// endpoint rather than merely that something was called.
const approveCalls: { stage: string; ids: number[] }[] = [];
vi.mock("../useCcMutations", () => ({
  useCcApprove: (stage: string) => ({
    mutateAsync: async (ids: number[]) => {
      approveCalls.push({ stage, ids });
    },
    isPending: false,
  }),
  useCcSaveEdit: () => ({ mutate: saveEdit, isPending: mutations.savePending }),
  useCcAttachment: () => ({
    upload: { mutateAsync: vi.fn(), isPending: false },
    remove: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

const { default: CcApprovePage } = await import("./CcApprovePage");
const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");

beforeEach(() => {
  state.access = ["finance"];
  state.txns = [withLead, withFinance];
  mutations.savePending = false;
  saveEdit.mockClear();
  approveCalls.length = 0;
});

/** The filters live behind one trigger, as ApproveFilterPopover.tsx has them. */
const openFilters = async (u: ReturnType<typeof userEvent.setup>) =>
  u.click(await screen.findByRole("button", { name: /^Filter( \d+)?$/ }));

const rowBoxes = async () =>
  (await screen.findAllByRole("checkbox")).filter(
    (b) => b.getAttribute("name") === "select_row",
  );

const asLead = async (u: ReturnType<typeof userEvent.setup>) =>
  u.click(screen.getByRole("button", { name: "As lead" }));
const asFinance = async (u: ReturnType<typeof userEvent.setup>) =>
  u.click(screen.getByRole("button", { name: "As finance" }));

function show() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationsProvider>
        <CcApprovePage />
      </NotificationsProvider>
    </QueryClientProvider>,
  );
}

// approve-submissions/index.tsx:122-126 — finance's queue spans both stages, so
// they can see what is still waiting on a lead. ApproveTransactionsDataGrid
// .tsx:157-166 then stops them selecting it. The port showed only its own
// stage, so work sitting with a lead was invisible to finance entirely.
describe("what a finance approver sees", () => {
  it("shows rows still with the lead as well as its own", async () => {
    show();
    await waitFor(() => expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0));
    // Two rows: one pending_lead, one pending_finance.
    expect(screen.getAllByRole("row")).toHaveLength(3); // header + 2
  });

  it("cannot select the row still with the lead", async () => {
    show();
    const boxes = await rowBoxes();
    // Row order follows the data: pending_lead first.
    expect(boxes[0]).toBeDisabled();
    expect(boxes[1]).toBeEnabled();
  });
});

describe("what a lead sees", () => {
  beforeEach(() => {
    state.access = ["lead"];
  });

  it("sees only its own stage", async () => {
    show();
    await waitFor(() => expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0));
    expect(screen.getAllByRole("row")).toHaveLength(2); // header + 1
  });

  it("can select it", async () => {
    show();
    const boxes = await rowBoxes();
    expect(boxes[0]).toBeEnabled();
  });
});

// An edit saved from this screen is a separate POST /transactions/save-edit.
// Approving before it lands books the row as it was before the correction —
// so the button waits, even though the source's own isApproveDisabled
// (ApproveTransactionsDataGrid.tsx:189-191) does not check for it.
describe("an edit still in flight", () => {
  it("holds the approve button until the save lands", async () => {
    mutations.savePending = true;
    show();
    await userEvent.click((await rowBoxes())[1]);
    expect(screen.getByRole("button", { name: /^Approve/ })).toBeDisabled();
  });

  it("allows approval once nothing is in flight", async () => {
    show();
    await userEvent.click((await rowBoxes())[1]);
    expect(screen.getByRole("button", { name: /^Approve/ })).toBeEnabled();
  });
});

// index.tsx:83-87 derives one mode with finance winning, :198 offers the
// switcher only to someone holding both roles, and :116-127 makes the mode
// decide the queue.
describe("someone who is both a lead and a finance approver", () => {
  beforeEach(() => {
    state.access = ["lead", "finance"];
  });

  it("starts in finance mode, because finance wins", async () => {
    show();
    await waitFor(() => expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0));
    // Finance's queue spans both stages.
    expect(screen.getAllByRole("row")).toHaveLength(3); // header + 2
    expect(screen.getByRole("button", { name: "As lead" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "As finance" })).toBeInTheDocument();
  });

  it("switching to lead narrows the queue to its own first-stage rows", async () => {
    show();
    const user = userEvent.setup();
    await screen.findByRole("button", { name: "As lead" });
    await asLead(user);

    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(2)); // header + 1
    // And the row it kept is the one it can act on.
    expect((await rowBoxes())[0]).toBeEnabled();
  });

  it("approves as the selected role, not both at once", async () => {
    show();
    const user = userEvent.setup();
    await asLead(user);

    await user.click((await rowBoxes())[0]);
    await user.click(screen.getByRole("button", { name: /Approve/ }));

    await waitFor(() => expect(approveCalls).toHaveLength(1));
    expect(approveCalls[0].stage).toBe("lead");
    expect(approveCalls[0].ids).toEqual([1]);
  });
});

describe("the approve-role toggle", () => {
  it("is not offered to a lead who is not also finance", async () => {
    state.access = ["lead"];
    show();
    await screen.findAllByRole("checkbox");
    expect(screen.queryByRole("button", { name: "As lead" })).not.toBeInTheDocument();
  });

  it("is not offered to finance alone", async () => {
    state.access = ["finance"];
    show();
    await screen.findAllByRole("checkbox");
    expect(screen.queryByRole("button", { name: "As finance" })).not.toBeInTheDocument();
  });
});

// PendingTransactionsDataGrid.tsx / ApproveTransactionsDataGrid.tsx both lead
// with ID and head the amount "Amount($)" over a bare number. The port had
// dropped the column and moved the currency into the cell.
describe("the shared transaction table", () => {
  it("leads with the row id", async () => {
    show();
    await screen.findAllByRole("checkbox");
    expect(screen.getByRole("columnheader", { name: "ID" })).toBeInTheDocument();
    // The grid's own cells carry the field name, which is sturdier than
    // counting columns that the show* flags can add or drop.
    const idCells = document.querySelectorAll('[data-field="id"][role="gridcell"]');
    expect(idCells.length).toBeGreaterThan(0);
    expect(idCells[0]).toHaveTextContent("1");
  });

  it("puts the currency in the header, not the cell", async () => {
    show();
    await screen.findAllByRole("checkbox");
    expect(screen.getByRole("columnheader", { name: "Amount($)" })).toBeInTheDocument();
    // The currency lives in the header, so the CELL carries a bare number. The
    // detail panel beside it does show "$500.00", exactly as the source's pane
    // does, so this is scoped to the grid rather than to the whole screen.
    const cells = document.querySelectorAll('[data-field="txnAmount"][role="gridcell"]');
    expect(cells.length).toBeGreaterThan(0);
    expect(cells[0].textContent).toBe("500.00");
  });
});

// The point of putting these two screens on the grid: the hand-built table had
// none of this, and the source gets all of it from the component.
describe("what the grid brings to the approve queue", () => {
  it("offers search, columns and paging", async () => {
    show();
    await screen.findAllByRole("checkbox");
    for (const name of ["Columns", "Filters", "Search"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("does not offer export, which the source keeps to history", async () => {
    // These screens show other people's spend. The source's approve and
    // pending grids build a toolbar holding only GridToolbarQuickFilter;
    // export appears on history and on the statement screen, not here.
    show();
    await screen.findAllByRole("checkbox");
    expect(screen.queryByRole("button", { name: "Export" })).toBeNull();
  });

  it("still refuses to tick a row the mode cannot action", async () => {
    // The grid's own isRowSelectable is wired to the same predicate the
    // approve button uses, so the two cannot disagree.
    state.access = ["lead"];
    show();
    const boxes = await rowBoxes();
    expect(boxes).toHaveLength(1);
    expect(boxes[0]).toBeEnabled();
  });
});

// ApproveFilterPopover.tsx — the source narrows this queue by user, by card
// and, for finance only, by stage. The port had none of the three, so finance
// read both stages mixed together with no way to see just its own.
describe("narrowing the approve queue", () => {
  const pick = async (label: string, option: string) => {
    const user = userEvent.setup();
    await openFilters(user);
    await user.click(screen.getByLabelText(label));
    await user.click(await screen.findByRole("option", { name: option }));
    // Apply closes the popover. It has to: while it is open the grid behind it
    // is aria-hidden, so nothing in the queue is reachable.
    await user.click(screen.getByRole("button", { name: "Apply" }));
  };

  it("offers user and card to a lead", async () => {
    state.access = ["lead"];
    const u = userEvent.setup();
    show();
    await screen.findAllByRole("checkbox");
    await openFilters(u);
    expect(screen.getByLabelText("Filter by user")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by card")).toBeInTheDocument();
  });

  it("keeps the stage filter to finance, whose queue spans two stages", async () => {
    state.access = ["lead"];
    const u = userEvent.setup();
    show();
    await screen.findAllByRole("checkbox");
    await openFilters(u);
    // index.tsx:91-95 — a lead's queue is one stage by definition.
    expect(screen.queryByLabelText("Filter by status")).toBeNull();
  });

  it("lets finance see just its own stage", async () => {
    state.access = ["finance"];
    show();
    // Both stages to begin with.
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(3));

    await pick("Filter by status", "Pending Finance");
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(2));
  });

  it("uses the source's words for the stages", async () => {
    state.access = ["finance"];
    show();
    const user = userEvent.setup();
    await openFilters(user);
    await user.click(await screen.findByLabelText("Filter by status"));
    // FilterMenu.tsx:79-88 — not the raw pending_lead / pending_finance.
    expect(await screen.findByRole("option", { name: "Pending Lead" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Pending Finance" })).toBeInTheDocument();
  });
});

// The grid's select-all emits {type:"exclude", ids:Set()} — "everything except
// these" — not an include-set. Reading model.ids without checking the type
// inverts it: select-all clears the selection instead of making it.
describe("the header select-all", () => {
  it("selects every row the mode can action", async () => {
    state.access = ["finance"];
    show();
    const all = (await screen.findAllByRole("checkbox")).find(
      (b) => b.getAttribute("name") === "select_all_rows",
    );
    expect(all).toBeDefined();
    await userEvent.setup().click(all as HTMLElement);

    // One of the two rows is pending_finance, so exactly one is actionable.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^Approve 1/ })).toBeInTheDocument(),
    );
  });
});

// EditPane.tsx:1429-1457 — finance may re-point a submission that is still with
// a lead, and may change nothing else about it. The port offered finance no way
// into such a row at all, so a submission parked on the wrong lead was stuck.
describe("re-pointing a submission that is still with its lead", () => {
  /** The panel opens on the first row, so this edits whatever is selected. */
  const openEditor = async (u: ReturnType<typeof userEvent.setup>) =>
    u.click(await screen.findByRole("button", { name: "Edit" }));

  it("is offered to finance whatever stage the row is at", async () => {
    show();
    // Before, Edit appeared per row and only on a pending_finance one, so a row
    // still with its lead could not be opened at all.
    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("is offered to a lead on neither", async () => {
    state.access = ["lead"];
    show();
    await waitFor(() => expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0));
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("offers the lead approver, and locks everything else", async () => {
    const user = userEvent.setup();
    show();
    await openEditor(user);

    expect(await screen.findByRole("combobox", { name: /Lead approver/ })).toBeInTheDocument();
    // :659-670 — the categorisation is still the card holder's and their lead's.
    expect(screen.getByRole("combobox", { name: /Expense category/ })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("textbox", { name: "Comment" })).toBeDisabled();
  });

  it("will not let its attachments be changed", async () => {
    const user = userEvent.setup();
    show();
    await openEditor(user);
    await screen.findByRole("combobox", { name: /Lead approver/ });

    // :1471-1476 — a receipt is attached, so Replace and Remove would normally
    // both be offered here.
    expect(screen.queryByRole("button", { name: "Replace" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  });

  it("saves the chosen lead in place of the whole assigned list", async () => {
    const user = userEvent.setup();
    show();
    await openEditor(user);
    await user.click(await screen.findByRole("combobox", { name: /Lead approver/ }));
    // From every card, so a lead with nothing pending is still offered.
    await user.click(await screen.findByRole("option", { name: "spare@wso2.com" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saveEdit).toHaveBeenCalled());
    const [rows] = saveEdit.mock.calls[0];
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(1);
    // :1448-1453 replaces the comma list with the one chosen.
    expect(rows[0].leadEmail).toBe("spare@wso2.com");
  });

  it("leaves a row that has reached finance fully editable", async () => {
    const user = userEvent.setup();
    show();
    // Select the row that has reached finance, then edit it.
    await screen.findAllByRole("gridcell");
    const idCells = document.querySelectorAll('[data-field="id"][role="gridcell"]');
    await user.click(idCells[1] as HTMLElement);
    await openEditor(user);

    await screen.findByRole("combobox", { name: /Expense category/ });
    expect(screen.queryByRole("combobox", { name: /Lead approver/ })).toBeNull();
    expect(screen.getByRole("combobox", { name: /Expense category/ })).not.toHaveAttribute("aria-disabled", "true");
  });
});

describe("an empty queue", () => {
  it("uses the source's words", async () => {
    state.txns = [];
    show();
    // ApproveTransactionsDataGrid.tsx:216-220.
    expect(await screen.findByText("No submissions to approve.")).toBeInTheDocument();
    expect(screen.getByText("All submissions have been Approved.")).toBeInTheDocument();
  });
});

describe("the approve button", () => {
  it("says which role it would approve as", async () => {
    show();
    await waitFor(() => expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0));
    // :266-273 — the reason a row cannot be ticked is which stage it is at.
    expect(screen.getByLabelText("Select transactions to approve as finance")).toBeInTheDocument();
  });

  it("names the lead role in lead mode", async () => {
    state.access = ["lead"];
    show();
    await waitFor(() => expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0));
    expect(screen.getByLabelText("Select transactions to approve as lead")).toBeInTheDocument();
  });
});

// ApproveFilterPopover.tsx — the wording is the source's, not a paraphrase.
describe("the filter panel", () => {
  it("names its fields and its empty option as the source does", async () => {
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole("button", { name: "Filter" }));

    expect(screen.getByLabelText("Filter by status")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by user")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by card")).toBeInTheDocument();
    // "No Filter", not "All" — inside a Filter panel it reads as the absence of
    // a value rather than as one.
    await user.click(screen.getByLabelText("Filter by status"));
    expect(await screen.findByRole("option", { name: "No Filter" })).toBeInTheDocument();
  });

  it("offers nothing to reset until something is narrowing the queue", async () => {
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole("button", { name: "Filter" }));
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
  });

  it("can be closed without applying anything", async () => {
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole("button", { name: "Filter" }));
    await user.click(screen.getByRole("button", { name: "Close filters" }));
    await waitFor(() => expect(screen.queryByLabelText("Filter by user")).toBeNull());
  });
});

// Review findings, each with the behaviour that was wrong before it.
describe("reassigning is judged on its own terms", () => {
  it("is not blocked by a categorisation the menus cannot resolve", async () => {
    // The mocked menus are empty, so the row's stored unit pair resolves to
    // nothing and `unitIndex` stays blank. Building the patch from the form
    // then carried productUnit: null, `ccTxnComplete` failed, and Save was
    // disabled — finance could not re-point the submission at all.
    state.txns = [nonTravelWithLead];
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await user.click(await screen.findByRole("combobox", { name: /Lead approver/ }));
    await user.click(await screen.findByRole("option", { name: "spare@wso2.com" }));

    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("writes only the lead, leaving the categorisation alone", async () => {
    state.txns = [nonTravelWithLead];
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await user.click(await screen.findByRole("combobox", { name: /Lead approver/ }));
    await user.click(await screen.findByRole("option", { name: "spare@wso2.com" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saveEdit).toHaveBeenCalled());
    const [rows] = saveEdit.mock.calls[0];
    expect(rows[0].leadEmail).toBe("spare@wso2.com");
    // The row's own categorisation goes back untouched — building the patch
    // from the form would have sent null for both units.
    expect(rows[0].productUnit).toBe("Integration");
    expect(rows[0].businessUnit).toBe("Platform");
    expect(rows[0].expenseTypeLabel).toBe("Subscriptions");
  });

  it("asks for a different lead, not the one already set", async () => {
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await screen.findByRole("combobox", { name: /Lead approver/ });
    // Opens on the row's current lead, so there is nothing to write yet.
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("offers a lead whose card is no longer active", async () => {
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await user.click(await screen.findByRole("combobox", { name: /Lead approver/ }));
    // The only source of this one is an inactive card.
    expect(await screen.findByRole("option", { name: "spare@wso2.com" })).toBeInTheDocument();
  });
});

describe("a selection made in one queue", () => {
  it("does not survive a change of mode", async () => {
    state.access = ["lead", "finance"];
    const user = userEvent.setup();
    show();
    await user.click((await rowBoxes())[1]);
    expect(screen.getByRole("button", { name: /^Approve 1/ })).toBeInTheDocument();

    await asLead(user);
    // Back again: the row is visible and selectable once more. Without the
    // clear, the old tick is still there and Approve is live for a selection
    // the reader last saw in a different queue.
    await asFinance(user);
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
  });

  it("does not survive a change of filter", async () => {
    const user = userEvent.setup();
    show();
    await user.click((await rowBoxes())[1]);
    expect(screen.getByRole("button", { name: /^Approve 1/ })).toBeInTheDocument();

    await openFilters(user);
    await user.click(screen.getByLabelText("Filter by status"));
    await user.click(await screen.findByRole("option", { name: "Pending Lead" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));
    // And back, so the ticked row is on screen again.
    await openFilters(user);
    await user.click(screen.getByLabelText("Filter by status"));
    await user.click(await screen.findAllByRole("option", { name: "No Filter" }).then((o) => o[0]));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
  });
});

describe("an empty result", () => {
  it("does not claim everything was approved when a filter emptied it", async () => {
    // One row, still with its lead; then narrow to the other stage.
    state.txns = [withLead];
    const user = userEvent.setup();
    show();
    await openFilters(user);
    await user.click(screen.getByLabelText("Filter by status"));
    await user.click(await screen.findByRole("option", { name: "Pending Finance" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(await screen.findByText("No submissions match these filters.")).toBeInTheDocument();
    // Work is still waiting behind the filter, so this would be a plain lie.
    expect(screen.queryByText("All submissions have been Approved.")).toBeNull();
  });

  it("still says so when the queue itself is empty", async () => {
    state.txns = [];
    show();
    expect(await screen.findByText("No submissions to approve.")).toBeInTheDocument();
    expect(screen.getByText("All submissions have been Approved.")).toBeInTheDocument();
  });
});

describe("the detail panel", () => {
  it("shows the selected transaction's detail alongside the grid", async () => {
    show();
    await screen.findAllByRole("checkbox");
    // "Hotel" is ambiguous — it's the description in both the grid row and
    // the detail panel — so this checks the comment instead, which only the
    // detail panel renders.
    expect(await screen.findByText("Client trip")).toBeInTheDocument();
    expect(screen.getByText("Travel")).toBeInTheDocument();
  });
});
