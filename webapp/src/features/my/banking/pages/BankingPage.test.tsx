// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import type { Bank, BankAccount, BankingAppConfig } from "@features/my/api/types";

// BankingPage uses the real bankingRules.ts (deliberately not mocked — the
// gating decisions are part of what this page test covers), which pulls in
// @hooks/useAsgardeoGroups -> @asgardeo/react. That package fails to
// resolve under this sandbox's Node/pnpm setup (unrelated to this file's
// logic) — same workaround as bankingRules.test.ts and the existing
// useUmtGate.test.tsx.
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));

const { default: BankingPage, BankingIndex } = await import("./BankingPage");
const { default: MyAccountsTab } = await import("./MyAccountsTab");
const { default: SummaryTab } = await import("./SummaryTab");

// BankingPage is now just the tab-bar frame; the panels this file exercises
// render one route deeper, at its "my-accounts" tab. Starting the router
// there directly (rather than at the bare basePath) keeps every existing
// assertion synchronous — going via the index route's <Navigate> would add
// a redirect render pass before the same content appears.
function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/me/banking/my-accounts"]}>
      <Routes>
        <Route path="me/banking" element={<BankingPage />}>
          <Route index element={<BankingIndex />} />
          <Route path="my-accounts" element={<MyAccountsTab />} />
          <Route path="summary" element={<SummaryTab />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function renderSummary() {
  return render(
    <MemoryRouter initialEntries={["/me/banking/summary"]}>
      <Routes>
        <Route path="me/banking" element={<BankingPage />}>
          <Route index element={<BankingIndex />} />
          <Route path="my-accounts" element={<MyAccountsTab />} />
          <Route path="summary" element={<SummaryTab />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

// Hooks mocked at the module boundary, same approach as MyTeamPage.test.tsx
// — no QueryClientProvider needed since nothing here touches react-query
// directly, only these hook modules.

// The signed-in identity comes from the id_token; the employee record
// (location) comes from the banking backend's own /employee-info.
const useAsgardeoUserMock = vi.fn();
vi.mock("@hooks/useAsgardeoUser", () => ({
  useAsgardeoUser: () => useAsgardeoUserMock(),
}));

const useBankingEmployeeMock = vi.fn();
vi.mock("@features/my/api/useBankingEmployee", () => ({
  useBankingEmployee: (email: string | undefined) => useBankingEmployeeMock(email),
}));

const useBankAccountsMock = vi.fn();
vi.mock("@features/my/api/useBankAccounts", () => ({
  isBankingBackendConfigured: () => true,
  useBankAccounts: (email: string | undefined, options?: unknown) => useBankAccountsMock(email, options),
}));

const useBankingConfigMock = vi.fn();
vi.mock("@features/my/api/useBankingConfig", () => ({
  useBankingConfig: () => useBankingConfigMock(),
}));

const useBankingGateMock = vi.fn();
vi.mock("@features/my/api/useBankingGate", () => ({
  useBankingGate: () => useBankingGateMock(),
}));

const useBanksMock = vi.fn();
vi.mock("@features/my/api/useBanks", () => ({
  useBanks: (enabled: boolean) => useBanksMock(enabled),
}));

const mutateAsyncMock = vi.fn();
vi.mock("@features/my/api/useCreateBankAccountRequest", () => ({
  useCreateBankAccountRequest: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

// MyAccountsTab reads this directly (not through useCreateBankAccountRequest,
// which is fully mocked above) to guard against a second submission surviving
// the dialog that started it closing and reopening — see that mutation's own
// mutationKey.
const isMutatingCount = vi.hoisted(() => ({ value: 0 }));
vi.mock("@tanstack/react-query", () => ({
  useIsMutating: () => isMutatingCount.value,
}));

function signedInUser(email: string | null = "person@wso2.com", ready = true) {
  return { ready, email: email ?? undefined, initials: "PP" };
}

function profile(location = "Colombo") {
  return {
    data: { employeeId: "E1", workEmail: "person@wso2.com", location },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
}

function account(overrides: Partial<BankAccount>): BankAccount {
  return {
    accountId: 1,
    employeeEmail: "person@wso2.com",
    accountName: "P Person",
    accountNumber: "1234567890",
    accountStatus: "ACTIVE",
    accountType: "SALARY",
    bankCode: "12",
    bankSwiftCode: "BOCCLKLX",
    bankName: "BOC",
    bankLocation: "Colombo",
    branchCode: "001",
    branchName: "Head Office",
    beneficiaryAddress: "123 Main St",
    bankAddress: "456 Bank Rd",
    paymentMethod: null,
    effectiveFrom: "2026-01-01",
    createdOn: "2026-01-01",
    netSuiteInternalId: null,
    netSuiteVendorId: null,
    netSuitePaymentFileFormat: null,
    ...overrides,
  };
}

function accounts(list: BankAccount[]) {
  return {
    data: { bankAccounts: list, count: list.length },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
}

function config(overrides: Partial<BankingAppConfig> = {}) {
  return {
    data: {
      salaryThreshold: 28,
      consultancyThreshold: 28,
      reimbursementsAllowedCountries: ["Colombo"],
      consultancyRestrictedRoles: [],
      allCountries: ["Sri Lanka"],
      customLocationMap: [],
      ...overrides,
    },
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
}

function gate(overrides: Partial<ReturnType<typeof defaultGate>> = {}) {
  return { ...defaultGate(), ...overrides };
}
function defaultGate() {
  return {
    isConsultancyRestricted: false,
    isResolving: false,
    isError: false,
    errorMessage: undefined as string | undefined,
    retry: vi.fn(),
  };
}

function bank(overrides: Partial<Bank> = {}): Bank {
  return {
    bankCode: "12",
    bankLocation: "Colombo",
    bankName: "BOC",
    swiftCode: "BOCCLKLX",
    ...overrides,
  };
}

function banks(list: Bank[]) {
  return {
    data: { banks: list, count: list.length },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
}

beforeEach(() => {
  useAsgardeoUserMock.mockReturnValue(signedInUser());
  useBankingEmployeeMock.mockReturnValue(profile());
  useBankAccountsMock.mockReturnValue(accounts([]));
  useBankingConfigMock.mockReturnValue(config());
  useBankingGateMock.mockReturnValue(gate());
  useBanksMock.mockReturnValue(banks([bank(), bank({ bankName: "HNB", swiftCode: "HBLILKLX", bankCode: "7" })]));
  mutateAsyncMock.mockReset();
  mutateAsyncMock.mockResolvedValue({ applicationID: 42 });
  isMutatingCount.value = 0;
});

describe("tab frame", () => {
  it("redirects the bare /me/banking route to the My Accounts tab", async () => {
    render(
      <MemoryRouter initialEntries={["/me/banking"]}>
        <Routes>
          <Route path="me/banking" element={<BankingPage />}>
            <Route index element={<BankingIndex />} />
            <Route path="my-accounts" element={<MyAccountsTab />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    // The redirect is a client-side <Navigate>, so the tab's own content
    // (not present on the bare index route) is what confirms it landed.
    expect(await screen.findByText("Salary")).toBeInTheDocument();
  });

  it("shows the My Accounts and Summary tabs in the tab bar", () => {
    renderPage();
    expect(screen.getByRole("tab", { name: "My Accounts" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Summary" })).toBeInTheDocument();
  });
});

function editButton(cardEl: HTMLElement) {
  return within(cardEl).getByRole("button", { name: "Edit Account" });
}

function openDialogFor(user: ReturnType<typeof userEvent.setup>, accountTypeLabel: string) {
  return user.click(editButton(screen.getByText(accountTypeLabel).closest(".MuiCard-root") as HTMLElement));
}

// Fills Account Holder Info (step 1), then Bank Info (step 2, SALARY/
// REIMBURSEMENT field set unless `consultancy` is set), landing on Finish.
async function completeUpToReview(
  user: ReturnType<typeof userEvent.setup>,
  { consultancy = false }: { consultancy?: boolean } = {},
) {
  await user.type(screen.getByLabelText("Account Holder's Name"), "P Person");
  await user.type(screen.getByLabelText("Account Holder's Address"), "No 23, Galle Road, Colombo");
  await user.click(screen.getByRole("combobox", { name: "Account Holder's Country" }));
  await user.click(await screen.findByRole("option", { name: "Sri Lanka" }));
  await user.type(screen.getByLabelText("Account No"), "1234567890");
  await user.click(screen.getByRole("button", { name: "Continue" }));

  await user.click(screen.getByRole("combobox", { name: "Bank Location" }));
  await user.click(await screen.findByRole("option", { name: "Colombo" }));
  await user.click(screen.getByRole("combobox", { name: "Bank Name and Swift Code" }));
  await user.click(await screen.findByRole("option", { name: "BOC (BOCCLKLX)" }));
  await user.type(screen.getByLabelText("Bank Address"), "1 Bank Street, Colombo, Sri Lanka");
  if (!consultancy) {
    await user.type(screen.getByLabelText("Branch Name"), "Head Office");
    await user.type(screen.getByLabelText("Branch Code"), "001");
  }
  await user.click(screen.getByRole("button", { name: "Continue" }));
}

describe("Where the page gets its data", () => {
  it("looks accounts and the employee record up by the email in the sign-in token", () => {
    useAsgardeoUserMock.mockReturnValue(signedInUser("token.person@wso2.com"));
    renderPage();

    expect(useBankAccountsMock).toHaveBeenCalled();
    expect(useBankingEmployeeMock).toHaveBeenCalledWith("token.person@wso2.com");
  });

  it("takes the work location from the banking backend's employee record", async () => {
    useBankingEmployeeMock.mockReturnValue(profile("Maldives"));
    renderPage();
    const user = userEvent.setup();
    await openDialogFor(user, "Consultancy");

    // Consultancy's only allowed location is the employee record's location.
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Account Holder's Name"), "P Person");
    await user.type(screen.getByLabelText("Account Holder's Address"), "No 23, Galle Road, Colombo");
    await user.click(screen.getByRole("combobox", { name: "Account Holder's Country" }));
    await user.click(await screen.findByRole("option", { name: "Sri Lanka" }));
    await user.type(screen.getByLabelText("Account No"), "1234567890");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("combobox", { name: "Bank Location" })).toHaveValue("Maldives");
  });

  it("offers a retry when the employee record fails to load", () => {
    const refetch = vi.fn();
    useBankingEmployeeMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("boom"),
      refetch,
    });
    renderPage();

    expect(screen.getByText(/Couldn't load your employee details/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("says so when the sign-in token carries no email", () => {
    useAsgardeoUserMock.mockReturnValue(signedInUser(null));
    renderPage();

    expect(screen.getByText(/Couldn't determine your work email/)).toBeInTheDocument();
  });

  it("holds a skeleton, not an error, until the sign-in identity has been read", () => {
    useAsgardeoUserMock.mockReturnValue(signedInUser(null, false));
    renderPage();

    expect(screen.queryByText(/Couldn't determine your work email/)).not.toBeInTheDocument();
  });
});

describe("What the panels and tabs ask the data layer for", () => {
  it("has each tab refetch the accounts every time it is opened, as the source's tabs do", () => {
    renderPage();
    expect(useBankAccountsMock).toHaveBeenCalledWith("person@wso2.com", { refetchWhenOpened: true });

    useBankAccountsMock.mockClear();
    renderSummary();
    expect(useBankAccountsMock).toHaveBeenCalledWith("person@wso2.com", { refetchWhenOpened: true });
  });

  it("shows the last ACTIVE row of a type when there are several, like the source's assign-each-row loop", () => {
    useBankAccountsMock.mockReturnValue(
      accounts([
        account({ accountId: 1, accountType: "SALARY", accountStatus: "ACTIVE", accountNumber: "1111111111" }),
        account({ accountId: 2, accountType: "SALARY", accountStatus: "ACTIVE", accountNumber: "2222222222" }),
      ]),
    );
    renderPage();
    const salary = screen.getByText("Salary").closest(".MuiCard-root") as HTMLElement;
    expect(salary).toHaveTextContent("2222222222");
    expect(salary).not.toHaveTextContent("1111111111");
  });

  it("lists Bank Location options in the order the backend returns banks, not alphabetically", async () => {
    useBanksMock.mockReturnValue(
      banks([
        bank({ bankLocation: "Maldives", bankName: "MCB", swiftCode: "MCBLMVMV", bankCode: "9" }),
        bank({ bankLocation: "Bhutan", bankName: "BOB", swiftCode: "BHBBBTBT", bankCode: "5" }),
      ]),
    );
    renderPage();
    const user = userEvent.setup();
    await openDialogFor(user, "Salary");
    await user.type(screen.getByLabelText("Account Holder's Name"), "P Person");
    await user.type(screen.getByLabelText("Account Holder's Address"), "No 23, Galle Road, Colombo");
    await user.click(screen.getByRole("combobox", { name: "Account Holder's Country" }));
    await user.click(await screen.findByRole("option", { name: "Sri Lanka" }));
    await user.type(screen.getByLabelText("Account No"), "1234567890");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("combobox", { name: "Bank Location" }));

    const options = (await screen.findAllByRole("option")).map((o) => o.textContent);
    // Backend order, then the employee's own work location appended.
    expect(options).toEqual(["Maldives", "Bhutan", "Colombo"]);
  });
});

describe("Edit/Add popup", () => {
  it("opens a dialog scoped to the clicked panel's Account Type", async () => {
    renderPage();
    const user = userEvent.setup();

    await openDialogFor(user, "Reimbursement");

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Reimbursement");
    // The Salary panel's own Edit Account action is untouched — queried with
    // `hidden: true` since the open Dialog correctly marks the rest of the
    // page aria-hidden while it's up, which getByRole excludes by default.
    expect(
      within(screen.getByText("Salary").closest(".MuiCard-root") as HTMLElement).getByRole("button", {
        name: "Edit Account",
        hidden: true,
      }),
    ).toBeEnabled();
  });

  it("can be cancelled from the Account Holder Info step without submitting", async () => {
    renderPage();
    const user = userEvent.setup();
    await openDialogFor(user, "Salary");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it("blocks advancing from the Account Holder Info step until required fields are filled", async () => {
    renderPage();
    const user = userEvent.setup();
    await openDialogFor(user, "Salary");

    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByText("Account Holder's Name is required")).toBeInTheDocument();
    expect(screen.getByText("Please select a country from the list")).toBeInTheDocument();
    // Still on the Account Holder Info step, not advanced to Bank Info.
    expect(screen.queryByRole("combobox", { name: "Bank Location" })).not.toBeInTheDocument();
  });

  it("shows a retryable error state if the bank list fails to load", async () => {
    useBanksMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("network down"),
      refetch: vi.fn(),
    });
    renderPage();
    const user = userEvent.setup();
    await openDialogFor(user, "Salary");
    await user.type(screen.getByLabelText("Account Holder's Name"), "P Person");
    await user.type(screen.getByLabelText("Account Holder's Address"), "No 23, Galle Road, Colombo");
    await user.click(screen.getByRole("combobox", { name: "Account Holder's Country" }));
    await user.click(await screen.findByRole("option", { name: "Sri Lanka" }));
    await user.type(screen.getByLabelText("Account No"), "1234567890");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows Consultancy's own field set on the Bank Info step (no branch fields)", async () => {
    useBankingGateMock.mockReturnValue(gate());
    renderPage();
    const user = userEvent.setup();
    await openDialogFor(user, "Consultancy");
    await user.type(screen.getByLabelText("Account Holder's Name"), "P Person");
    await user.type(screen.getByLabelText("Account Holder's Address"), "No 23, Galle Road, Colombo");
    await user.click(screen.getByRole("combobox", { name: "Account Holder's Country" }));
    await user.click(await screen.findByRole("option", { name: "Sri Lanka" }));
    await user.type(screen.getByLabelText("Account No"), "1234567890");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByRole("combobox", { name: "Bank Location" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Branch Name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Branch Code")).not.toBeInTheDocument();
  });

  describe("Consultancy Bank Location narrowing (customLocationMap)", () => {
    async function openBankInfoStep(
      user: ReturnType<typeof userEvent.setup>,
      accountTypeLabel: string,
      { expectInvalidCountry = false }: { expectInvalidCountry?: boolean } = {},
    ) {
      await openDialogFor(user, accountTypeLabel);
      // A map entry that leaves the work location out raises the Invalid
      // Country notice on open (covered in its own tests) — acknowledge it.
      if (expectInvalidCountry) {
        await user.click(await screen.findByRole("button", { name: "OK" }));
        await waitFor(() => expect(screen.queryByText("Invalid Country")).not.toBeInTheDocument());
      }
      await user.type(screen.getByLabelText("Account Holder's Name"), "P Person");
      await user.type(screen.getByLabelText("Account Holder's Address"), "No 23, Galle Road, Colombo");
      await user.click(screen.getByRole("combobox", { name: "Account Holder's Country" }));
      await user.click(await screen.findByRole("option", { name: "Sri Lanka" }));
      await user.type(screen.getByLabelText("Account No"), "1234567890");
      await user.click(screen.getByRole("button", { name: "Continue" }));
    }

    beforeEach(() => {
      useBanksMock.mockReturnValue(
        banks([bank(), bank({ bankName: "MCB", swiftCode: "MCBLMVMV", bankCode: "9", bankLocation: "Maldives" })]),
      );
    });

    it("offers only the work location, pre-selected, when the map has no entry for it", async () => {
      renderPage();
      const user = userEvent.setup();
      await openBankInfoStep(user, "Consultancy");

      const location = screen.getByRole("combobox", { name: "Bank Location" });
      expect(location).toHaveValue("Colombo");
      await user.click(location);
      expect(await screen.findByRole("option", { name: "Colombo" })).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: "Maldives" })).not.toBeInTheDocument();
    });

    it("offers the matching entry's customMap instead, when the map has one for the work location", async () => {
      useBankingConfigMock.mockReturnValue(
        config({ customLocationMap: [{ location: "Colombo", customMap: ["Colombo", "Maldives"] }] }),
      );
      renderPage();
      const user = userEvent.setup();
      await openBankInfoStep(user, "Consultancy");

      expect(screen.getByRole("combobox", { name: "Bank Location" })).toHaveValue("Colombo");
      await user.click(screen.getByRole("combobox", { name: "Bank Location" }));
      expect(await screen.findByRole("option", { name: "Colombo" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Maldives" })).toBeInTheDocument();
    });

    it("pre-selects the first allowed location when the entry leaves the work location out", async () => {
      useBankingConfigMock.mockReturnValue(
        config({ customLocationMap: [{ location: "Colombo", customMap: ["Maldives"] }] }),
      );
      renderPage();
      const user = userEvent.setup();
      await openBankInfoStep(user, "Consultancy", { expectInvalidCountry: true });

      expect(screen.getByRole("combobox", { name: "Bank Location" })).toHaveValue("Maldives");
    });

    it("leaves Salary's Bank Location options as every location on file, ignoring the map", async () => {
      useBankingConfigMock.mockReturnValue(
        config({ customLocationMap: [{ location: "Colombo", customMap: ["Maldives"] }] }),
      );
      renderPage();
      const user = userEvent.setup();
      await openBankInfoStep(user, "Salary");

      const location = screen.getByRole("combobox", { name: "Bank Location" });
      expect(location).toHaveValue("");
      await user.click(location);
      expect(await screen.findByRole("option", { name: "Colombo" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Maldives" })).toBeInTheDocument();
    });
  });

  describe("Confirm Change Request", () => {
    it("asks for confirmation on Save and sends nothing until it is given", async () => {
      renderPage();
      const user = userEvent.setup();
      await openDialogFor(user, "Salary");
      await completeUpToReview(user);
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(await screen.findByText("Confirm Change Request")).toBeInTheDocument();
      expect(
        screen.getByText("Are you sure you want to make this bank account change?"),
      ).toBeInTheDocument();
      expect(mutateAsyncMock).not.toHaveBeenCalled();
    });

    it("sends nothing and stays on the review step when the confirmation is cancelled", async () => {
      renderPage();
      const user = userEvent.setup();
      await openDialogFor(user, "Salary");
      await completeUpToReview(user);
      await user.click(screen.getByRole("button", { name: "Save" }));
      const confirm = (await screen.findByText("Confirm Change Request")).closest('[role="dialog"]') as HTMLElement;
      await user.click(within(confirm).getByRole("button", { name: "Cancel" }));

      expect(mutateAsyncMock).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByText("Confirm Change Request")).not.toBeInTheDocument());
      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    });
  });

  describe("Invalid Country notice", () => {
    it("tells a Consultancy requester whose map entry leaves their work location out", async () => {
      useBankingConfigMock.mockReturnValue(
        config({ customLocationMap: [{ location: "Colombo", customMap: ["Maldives"] }] }),
      );
      renderPage();
      const user = userEvent.setup();
      await openDialogFor(user, "Consultancy");

      expect(await screen.findByText("Invalid Country")).toBeInTheDocument();
      expect(screen.getByText("Your country is not available in the bank locations.")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "OK" }));
      await waitFor(() => expect(screen.queryByText("Invalid Country")).not.toBeInTheDocument());
    });

    it("stays quiet when the work location is among the allowed locations", async () => {
      renderPage();
      const user = userEvent.setup();
      await openDialogFor(user, "Consultancy");

      expect(screen.queryByText("Invalid Country")).not.toBeInTheDocument();
    });

    it("stays quiet for Salary and Reimbursement, whose list always includes the work location", async () => {
      useBankingConfigMock.mockReturnValue(
        config({ customLocationMap: [{ location: "Colombo", customMap: ["Maldives"] }] }),
      );
      renderPage();
      const user = userEvent.setup();
      await openDialogFor(user, "Salary");

      expect(screen.queryByText("Invalid Country")).not.toBeInTheDocument();
    });
  });

  describe("Bank Info step quirks carried over from the source", () => {
    async function toBankInfo(user: ReturnType<typeof userEvent.setup>) {
      await openDialogFor(user, "Salary");
      await user.type(screen.getByLabelText("Account Holder's Name"), "P Person");
      await user.type(screen.getByLabelText("Account Holder's Address"), "No 23, Galle Road, Colombo");
      await user.click(screen.getByRole("combobox", { name: "Account Holder's Country" }));
      await user.click(await screen.findByRole("option", { name: "Sri Lanka" }));
      await user.type(screen.getByLabelText("Account No"), "1234567890");
      await user.click(screen.getByRole("button", { name: "Continue" }));
    }

    it("clears the Bank Address when a different bank is picked", async () => {
      renderPage();
      const user = userEvent.setup();
      await toBankInfo(user);
      await user.click(screen.getByRole("combobox", { name: "Bank Location" }));
      await user.click(await screen.findByRole("option", { name: "Colombo" }));
      await user.click(screen.getByRole("combobox", { name: "Bank Name and Swift Code" }));
      await user.click(await screen.findByRole("option", { name: "BOC (BOCCLKLX)" }));
      await user.type(screen.getByLabelText("Bank Address"), "1 Bank Street, Colombo, Sri Lanka");
      expect(screen.getByLabelText("Bank Address")).toHaveValue("1 Bank Street, Colombo, Sri Lanka");

      await user.click(screen.getByRole("combobox", { name: "Bank Name and Swift Code" }));
      await user.click(await screen.findByRole("option", { name: "HNB (HBLILKLX)" }));

      expect(screen.getByLabelText("Bank Address")).toHaveValue("");
    });

    it("lists banks filed under United States when the Bank Location is US", async () => {
      useBanksMock.mockReturnValue(
        banks([
          bank({ bankLocation: "United States", bankName: "Chase", swiftCode: "CHASUS33", bankCode: "3" }),
          bank(),
        ]),
      );
      useBankingEmployeeMock.mockReturnValue(profile("US"));
      renderPage();
      const user = userEvent.setup();
      await toBankInfo(user);
      await user.click(screen.getByRole("combobox", { name: "Bank Location" }));
      await user.click(await screen.findByRole("option", { name: "US" }));
      await user.click(screen.getByRole("combobox", { name: "Bank Name and Swift Code" }));

      expect(await screen.findByRole("option", { name: "Chase (CHASUS33)" })).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: "BOC (BOCCLKLX)" })).not.toBeInTheDocument();
    });
  });

  it("blocks advancing from the Bank Info step until required fields are filled", async () => {
    renderPage();
    const user = userEvent.setup();
    await openDialogFor(user, "Salary");
    await user.type(screen.getByLabelText("Account Holder's Name"), "P Person");
    await user.type(screen.getByLabelText("Account Holder's Address"), "No 23, Galle Road, Colombo");
    await user.click(screen.getByRole("combobox", { name: "Account Holder's Country" }));
    await user.click(await screen.findByRole("option", { name: "Sri Lanka" }));
    await user.type(screen.getByLabelText("Account No"), "1234567890");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByText("Bank Location is required")).toBeInTheDocument();
    // Still on the Bank Info step, not advanced to Finish.
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  it("can go back from the Bank Info step to Account Holder Info", async () => {
    renderPage();
    const user = userEvent.setup();
    await openDialogFor(user, "Salary");
    await user.type(screen.getByLabelText("Account Holder's Name"), "P Person");
    await user.type(screen.getByLabelText("Account Holder's Address"), "No 23, Galle Road, Colombo");
    await user.click(screen.getByRole("combobox", { name: "Account Holder's Country" }));
    await user.click(await screen.findByRole("option", { name: "Sri Lanka" }));
    await user.type(screen.getByLabelText("Account No"), "1234567890");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByLabelText("Account Holder's Name")).toHaveValue("P Person");
  });

  it("shows a review of the entered values before submitting", async () => {
    renderPage();
    const user = userEvent.setup();
    await openDialogFor(user, "Salary");
    await completeUpToReview(user);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("P Person");
    expect(dialog).toHaveTextContent("1234567890");
    expect(dialog).toHaveTextContent("BOC");
    expect(dialog).toHaveTextContent("Bank Transfer");
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("submits the expected payload, shows success, and closes the dialog", async () => {
    renderPage();
    const user = userEvent.setup();
    await openDialogFor(user, "Salary");
    await completeUpToReview(user);
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(await screen.findByRole("button", { name: "Yes" }));

    expect(mutateAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeEmail: "person@wso2.com",
        accountType: "SALARY",
        accountName: "P Person",
        accountNumber: "1234567890",
        bankName: "BOC",
        bankSwiftCode: "BOCCLKLX",
        bankCode: "12",
        bankLocation: "Colombo",
        beneficiaryAddress: "No 23, Galle Road, Colombo",
        bankAddress: "1 Bank Street, Colombo, Sri Lanka",
        branchName: "Head Office",
        branchCode: "001",
      }),
    );
    // The backend's request record requires the account holder's country.
    expect(mutateAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({ accountHoldersCountry: "Sri Lanka" }),
    );
    // The source's own success text, naming the account type in lower case.
    expect(
      await screen.findByText("Successfully requested the salary bank account change!"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("names the account type in the success text, whichever type was submitted", async () => {
    renderPage();
    const user = userEvent.setup();
    await openDialogFor(user, "Consultancy");
    await completeUpToReview(user, { consultancy: true });
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(await screen.findByRole("button", { name: "Yes" }));

    expect(
      await screen.findByText("Successfully requested the consultancy bank account change!"),
    ).toBeInTheDocument();
  });

  it("sends the request only once when Yes is pressed twice in quick succession", async () => {
    // A request that is still in flight when the second press arrives.
    let finish: (value: { applicationID: number }) => void = () => {};
    mutateAsyncMock.mockReset();
    mutateAsyncMock.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderPage();
    const user = userEvent.setup();
    await openDialogFor(user, "Reimbursement");
    await completeUpToReview(user);
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.dblClick(await screen.findByRole("button", { name: "Yes" }));

    expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
    finish({ applicationID: 1 });
  });

  it("shows a specific error and stays open when the backend rejects the submission", async () => {
    mutateAsyncMock.mockReset();
    mutateAsyncMock.mockRejectedValue(new Error("Changes allowed only until the 5th of each month."));
    renderPage();
    const user = userEvent.setup();
    await openDialogFor(user, "Salary");
    await completeUpToReview(user);
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(await screen.findByRole("button", { name: "Yes" }));

    expect(
      await screen.findByText("Changes allowed only until the 5th of each month."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("starts blank again if reopened after being cancelled", async () => {
    renderPage();
    const user = userEvent.setup();

    await openDialogFor(user, "Salary");
    await user.type(screen.getByLabelText("Account Holder's Name"), "Stale Value");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await openDialogFor(user, "Salary");
    expect(screen.getByLabelText("Account Holder's Name")).toHaveValue("");
  });
});

describe("panel field rendering", () => {
  it("renders each Account Type's own fields, and a full dashed-out field list for one not set up", () => {
    useBankAccountsMock.mockReturnValue(
      accounts([
        account({ accountType: "SALARY", bankName: "BOC", accountNumber: "1111" }),
        account({
          accountType: "REIMBURSEMENT",
          accountId: 2,
          bankName: "HNB",
          accountNumber: "2222",
        }),
        // No CONSULTANCY account — that panel should still show its full field list.
      ]),
    );

    renderPage();

    // Salary: bank-detail fields present.
    expect(screen.getByText("Salary").closest(".MuiCard-root")).toHaveTextContent("BOC");
    expect(screen.getByText("Salary").closest(".MuiCard-root")).toHaveTextContent("Bank Location");

    // Reimbursement: its own fields, same shape as Salary here.
    expect(screen.getByText("Reimbursement").closest(".MuiCard-root")).toHaveTextContent("HNB");

    // Consultancy: no account yet -> the field list still renders, dashed out.
    const consultancyCard = screen.getByText("Consultancy").closest(".MuiCard-root") as HTMLElement;
    expect(consultancyCard).toHaveTextContent("Account Holder's Name");
    expect(consultancyCard).toHaveTextContent("Payment Method");
    expect(within(consultancyCard).getAllByText("—").length).toBeGreaterThan(0);
    expect(editButton(consultancyCard)).toBeInTheDocument();

    // Every panel's action reads "Edit Account", whether or not an account exists yet.
    expect(editButton(screen.getByText("Salary").closest(".MuiCard-root") as HTMLElement)).toBeInTheDocument();
  });

  it("shows Consultancy's own field set (Payment Method), not the bank-location block", () => {
    useBankAccountsMock.mockReturnValue(
      accounts([account({ accountType: "CONSULTANCY", paymentMethod: "Wire transfer" })]),
    );

    renderPage();

    const consultancyCard = screen.getByText("Consultancy").closest(".MuiCard-root") as HTMLElement;
    expect(consultancyCard).toHaveTextContent("Payment Method");
    expect(consultancyCard).toHaveTextContent("Wire transfer");
    expect(consultancyCard).not.toHaveTextContent("Bank Location");
  });
});

describe("Threshold warning banner", () => {
  it("states both Salary's and Consultancy's cutoff dates together, below the panels", () => {
    useBankingConfigMock.mockReturnValue(config({ salaryThreshold: 20, consultancyThreshold: 30 }));

    renderPage();

    const banner = screen.getByRole("alert");
    expect(/salary.*20th.*consultancy.*30th/is.test(banner.textContent ?? "")).toBe(true);
  });
});

describe("Threshold gating", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("disables a panel's Edit action once its own Threshold day has passed, and states why", () => {
    vi.setSystemTime(new Date(2026, 8, 10)); // 10 Sep 2026
    useBankingConfigMock.mockReturnValue(config({ salaryThreshold: 5, consultancyThreshold: 28 }));
    useBankAccountsMock.mockReturnValue(accounts([account({ accountType: "SALARY" })]));

    renderPage();

    const salaryCard = screen.getByText("Salary").closest(".MuiCard-root") as HTMLElement;
    expect(editButton(salaryCard)).toBeDisabled();
    expect(salaryCard).toHaveTextContent("Changes allowed only until the 5th of each month.");

    // Consultancy's own threshold (28) hasn't passed — independent of Salary's.
    const consultancyCard = screen.getByText("Consultancy").closest(".MuiCard-root") as HTMLElement;
    expect(editButton(consultancyCard)).toBeEnabled();
  });
});

describe("Submission guard survives closing and reopening the dialog", () => {
  it("disables every panel's Edit action while a request from this employee is still in flight", () => {
    isMutatingCount.value = 1;
    renderPage();

    const salaryCard = screen.getByText("Salary").closest(".MuiCard-root") as HTMLElement;
    expect(editButton(salaryCard)).toBeDisabled();
    expect(salaryCard).toHaveTextContent("A change request is already being submitted.");
  });

  it("re-enables Edit once no request is in flight", () => {
    isMutatingCount.value = 0;
    renderPage();

    const salaryCard = screen.getByText("Salary").closest(".MuiCard-root") as HTMLElement;
    expect(editButton(salaryCard)).toBeEnabled();
  });
});

describe("Consultancy Restriction", () => {
  it("does not render the Consultancy panel for a restricted-group caller", () => {
    useBankingGateMock.mockReturnValue(gate({ isConsultancyRestricted: true }));

    renderPage();

    expect(screen.queryByText("Consultancy")).not.toBeInTheDocument();
    // The other two panels are unaffected.
    expect(screen.getByText("Salary")).toBeInTheDocument();
    expect(screen.getByText("Reimbursement")).toBeInTheDocument();
  });
});

describe("Reimbursement Eligibility", () => {
  it("disables the Reimbursement panel's Edit action for an ineligible work location", () => {
    useBankingEmployeeMock.mockReturnValue(profile("Nowhereville"));
    useBankingConfigMock.mockReturnValue(config({ reimbursementsAllowedCountries: ["Colombo"] }));

    renderPage();

    const reimbursementCard = screen.getByText("Reimbursement").closest(".MuiCard-root") as HTMLElement;
    expect(editButton(reimbursementCard)).toBeDisabled();
    expect(reimbursementCard).toHaveTextContent("Not available for your work location.");

    // Salary is unaffected by Reimbursement's own gate.
    const salaryCard = screen.getByText("Salary").closest(".MuiCard-root") as HTMLElement;
    expect(editButton(salaryCard)).toBeEnabled();
  });

  it("leaves it enabled for an eligible work location", () => {
    useBankingEmployeeMock.mockReturnValue(profile("Colombo"));
    useBankingConfigMock.mockReturnValue(config({ reimbursementsAllowedCountries: ["Colombo"] }));

    renderPage();

    const reimbursementCard = screen.getByText("Reimbursement").closest(".MuiCard-root") as HTMLElement;
    expect(editButton(reimbursementCard)).toBeEnabled();
  });
});

describe("Summary tab", () => {
  it("lists every account across all types and statuses, not just Active ones", () => {
    useBankAccountsMock.mockReturnValue(
      accounts([
        account({ accountId: 1, accountType: "CONSULTANCY", accountStatus: "ACTIVE", accountNumber: "5566778899", bankName: "Sampath Bank PLC", paymentMethod: "Bank Transfer", effectiveFrom: "2026-09-09" }),
        account({ accountId: 2, accountType: "SALARY", accountStatus: "REQUESTED", accountNumber: "1234567890", bankName: "Bank of Ceylon" }),
        account({ accountId: 3, accountType: "REIMBURSEMENT", accountStatus: "REJECTED", accountNumber: "9999999999", bankName: "HNB" }),
        account({ accountId: 4, accountType: "SALARY", accountStatus: "INACTIVE", accountNumber: "1111111111", bankName: "NDB" }),
      ]),
    );
    renderSummary();

    const table = screen.getByRole("table");
    for (const header of ["Account Types", "Effected From", "Account No", "Name", "Changed Bank", "Payment Method", "Status"]) {
      expect(within(table).getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
    // Header row + one row per account.
    expect(within(table).getAllByRole("row")).toHaveLength(5);
    expect(within(table).getByText("5566778899")).toBeInTheDocument();
    expect(within(table).getByText("Sampath Bank PLC")).toBeInTheDocument();
    expect(within(table).getByText("2026-09-09")).toBeInTheDocument();
    expect(within(table).getByText("CONSULTANCY")).toBeInTheDocument();
    expect(within(table).getByText("REIMBURSEMENT")).toBeInTheDocument();
    for (const status of ["ACTIVE", "REQUESTED", "REJECTED", "INACTIVE"]) {
      expect(within(table).getByText(status)).toBeInTheDocument();
    }
  });

  describe("column sorting", () => {
    function seed() {
      useBankAccountsMock.mockReturnValue(
        accounts([
          account({ accountId: 1, accountName: "Charlie", bankName: "NDB" }),
          account({ accountId: 2, accountName: "alice", bankName: "BOC" }),
          account({ accountId: 3, accountName: "Bob", bankName: "HNB" }),
        ]),
      );
    }
    const namesInOrder = () =>
      within(screen.getByRole("table"))
        .getAllByRole("row")
        .slice(1)
        .map((r) => within(r).getAllByRole("cell")[3].textContent);

    it("keeps the backend's order until a header is clicked", () => {
      seed();
      renderSummary();
      expect(namesInOrder()).toEqual(["Charlie", "alice", "Bob"]);
    });

    it("sorts ascending, then descending, then back to the backend's order on repeated clicks", async () => {
      seed();
      renderSummary();
      const user = userEvent.setup();
      const header = () => screen.getByRole("columnheader", { name: "Name" });

      await user.click(within(header()).getByRole("button"));
      expect(namesInOrder()).toEqual(["alice", "Bob", "Charlie"]);
      expect(header()).toHaveAttribute("aria-sort", "ascending");

      await user.click(within(header()).getByRole("button"));
      expect(namesInOrder()).toEqual(["Charlie", "Bob", "alice"]);
      expect(header()).toHaveAttribute("aria-sort", "descending");

      await user.click(within(header()).getByRole("button"));
      expect(namesInOrder()).toEqual(["Charlie", "alice", "Bob"]);
      expect(header()).not.toHaveAttribute("aria-sort");
    });

    it("sorts by whichever column was clicked last, and sorts across pages", async () => {
      seed();
      renderSummary();
      const user = userEvent.setup();
      await user.click(within(screen.getByRole("columnheader", { name: "Changed Bank" })).getByRole("button"));

      expect(namesInOrder()).toEqual(["alice", "Bob", "Charlie"]); // BOC, HNB, NDB
    });
  });

  it("shows Bank Transfer as the Payment Method when the record has none", () => {
    useBankAccountsMock.mockReturnValue(accounts([account({ paymentMethod: null })]));
    renderSummary();
    expect(within(screen.getByRole("table")).getByText("Bank Transfer")).toBeInTheDocument();
  });

  it("shows a clear empty state instead of an empty table when there are no records", () => {
    useBankAccountsMock.mockReturnValue(accounts([]));
    renderSummary();
    expect(screen.getByText("No account history found")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows a retryable error if the accounts fail to load", () => {
    useBankAccountsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("network down"),
      refetch: vi.fn(),
    });
    renderSummary();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("stays on a valid page when a refetch leaves fewer rows than the page being viewed", async () => {
    const user = userEvent.setup();
    useBankAccountsMock.mockReturnValue(
      accounts(Array.from({ length: 10 }, (_, i) => account({ accountId: i + 1, accountNumber: String(i + 1) }))),
    );
    const { rerender } = renderSummary();

    // rowsPerPage defaults to 7, so page 2 holds rows 8-10.
    await user.click(screen.getByRole("button", { name: "Go to next page" }));
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(4); // header + 3

    // The list is refetched on open and now has only 1 row — page 2 no longer exists.
    useBankAccountsMock.mockReturnValue(accounts([account({ accountId: 1 })]));
    rerender(
      <MemoryRouter initialEntries={["/me/banking/summary"]}>
        <Routes>
          <Route path="me/banking" element={<BankingPage />}>
            <Route index element={<BankingIndex />} />
            <Route path="my-accounts" element={<MyAccountsTab />} />
            <Route path="summary" element={<SummaryTab />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2); // header + 1, not empty
  });
});
