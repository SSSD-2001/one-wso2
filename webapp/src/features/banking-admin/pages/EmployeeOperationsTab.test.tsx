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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BankAccount, BankingEmployee } from "@features/my/api/types";

// EmployeeOperationsTab imports isReimbursementEligible from bankingRules.ts,
// which pulls in @hooks/useAsgardeoGroups's module-level `useAsgardeo` import
// — that fails to resolve under this sandbox's Node/pnpm setup (a directory
// import of @asgardeo/browser's `buffer` dependency), unrelated to this
// file's own logic. Same workaround already used elsewhere in this codebase
// (bankingRules.test.ts, useUmtGate.test.tsx): stub the package so the
// import chain never touches the broken resolution.
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));

const employees = vi.hoisted(() => ({ data: [] as BankingEmployee[] }));
const accounts = vi.hoisted(() => ({ data: [] as BankAccount[] }));
const bankAccountsSpy = vi.hoisted(() => vi.fn());
const deactivateAccount = vi.hoisted(() => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending: false,
}));
// EmployeeOperationsTab reads this directly (not through useDeactivateAccount,
// which is fully mocked below) to tell whether a Deactivate/Resign is still
// in flight — see that mutation's own mutationKey, same pattern as
// AdminTab's own isMutatingCount.
const isMutatingCount = vi.hoisted(() => ({ value: 0 }));
vi.mock("@tanstack/react-query", () => ({
  useIsMutating: () => isMutatingCount.value,
}));

vi.mock("@features/my/api/useBankingEmployees", () => ({
  useBankingEmployees: () => ({ data: employees.data, isLoading: false, isError: false }),
}));
vi.mock("@features/my/api/useBankAccounts", () => ({
  useBankAccounts: (workEmail: string | undefined) => {
    bankAccountsSpy(workEmail);
    return {
      data: { bankAccounts: accounts.data, count: accounts.data.length },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };
  },
}));
vi.mock("@features/my/api/useBankingConfig", () => ({
  useBankingConfig: () => ({
    data: {
      salaryThreshold: 18,
      consultancyThreshold: 20,
      reimbursementsAllowedCountries: ["Sri Lanka"],
      consultancyRestrictedRoles: [],
      allCountries: ["Sri Lanka", "United States"],
      customLocationMap: [],
    },
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@features/my/api/useDeactivateAccount", () => ({ useDeactivateAccount: () => deactivateAccount }));
vi.mock("@features/my/banking/components/BankAccountRequestDialog", () => ({
  default: (props: { accountType: string; employeeEmail: string; employeeWorkLocation?: string }) => (
    <div data-testid="bank-account-request-dialog">
      {props.accountType} / {props.employeeEmail} / {props.employeeWorkLocation}
    </div>
  ),
}));

const { default: EmployeeOperationsTab } = await import("./EmployeeOperationsTab");

function employee(overrides: Partial<BankingEmployee> = {}): BankingEmployee {
  return {
    employeeId: "E1",
    firstName: "Jane",
    lastName: "Doe",
    workEmail: "jane@wso2.com",
    department: "Engineering",
    team: "Platform",
    employeeThumbnail: null,
    jobRole: "Engineer",
    epf: "123",
    location: "Sri Lanka",
    ...overrides,
  };
}

function bankAccount(overrides: Partial<BankAccount> = {}): BankAccount {
  return {
    accountId: 1,
    employeeEmail: "jane@wso2.com",
    accountName: "Jane Doe",
    accountNumber: "123456789",
    accountStatus: "ACTIVE",
    accountType: "SALARY",
    bankCode: "COM001",
    bankSwiftCode: "COMBLK",
    bankName: "Commercial Bank",
    bankLocation: "Sri Lanka",
    branchCode: "001",
    branchName: "Colombo",
    beneficiaryAddress: "123 Main St",
    bankAddress: "456 Bank Rd",
    paymentMethod: null,
    effectiveFrom: "2026-10-01",
    createdOn: "2026-09-01",
    netSuiteInternalId: null,
    netSuiteVendorId: null,
    netSuitePaymentFileFormat: null,
    ...overrides,
  };
}

async function selectEmployee(user: ReturnType<typeof userEvent.setup>, label = "Jane Doe (jane@wso2.com)") {
  await user.click(screen.getByLabelText("Search Employee by Name or Email"));
  await user.click(await screen.findByText(label));
}

beforeEach(() => {
  employees.data = [employee()];
  accounts.data = [];
  bankAccountsSpy.mockReset();
  deactivateAccount.mutate.mockReset();
  deactivateAccount.mutateAsync.mockReset().mockResolvedValue(undefined);
  isMutatingCount.value = 0;
});

describe("EmployeeOperationsTab", () => {
  it("shows a placeholder before any employee is selected", () => {
    render(<EmployeeOperationsTab />);
    expect(screen.getByText("Please select an employee!")).toBeInTheDocument();
  });

  it("loads the selected employee's accounts", async () => {
    const user = userEvent.setup();
    accounts.data = [bankAccount({ accountNumber: "999888777" })];
    render(<EmployeeOperationsTab />);
    await selectEmployee(user);
    expect(bankAccountsSpy).toHaveBeenLastCalledWith("jane@wso2.com");
    expect(screen.getByText("999888777")).toBeInTheDocument();
  });

  it("disables Deactivate once an account is already Inactive", async () => {
    const user = userEvent.setup();
    accounts.data = [
      bankAccount({ accountId: 1, accountStatus: "ACTIVE" }),
      bankAccount({ accountId: 2, accountStatus: "INACTIVE" }),
    ];
    render(<EmployeeOperationsTab />);
    await selectEmployee(user);
    const buttons = screen.getAllByRole("button", { name: "Deactivate" });
    expect(buttons[0]).toBeEnabled();
    expect(buttons[1]).toBeDisabled();
  });

  it("deactivates every Active account when Resign Employee is confirmed", async () => {
    const user = userEvent.setup();
    accounts.data = [
      bankAccount({ accountId: 1, accountStatus: "ACTIVE" }),
      bankAccount({ accountId: 2, accountStatus: "ACTIVE" }),
      bankAccount({ accountId: 3, accountStatus: "INACTIVE" }),
    ];
    render(<EmployeeOperationsTab />);
    await selectEmployee(user);
    await user.click(screen.getByRole("button", { name: "Resign Employee" }));
    await user.click(await screen.findByRole("button", { name: "Confirm" }));
    expect(deactivateAccount.mutateAsync).toHaveBeenCalledTimes(2);
    expect(deactivateAccount.mutateAsync).toHaveBeenCalledWith({ accountId: 1, employeeEmail: "jane@wso2.com" });
    expect(deactivateAccount.mutateAsync).toHaveBeenCalledWith({ accountId: 2, employeeEmail: "jane@wso2.com" });
  });

  it("keeps deactivating the remaining Active accounts when one of them fails", async () => {
    const user = userEvent.setup();
    accounts.data = [
      bankAccount({ accountId: 1, accountStatus: "ACTIVE" }),
      bankAccount({ accountId: 2, accountStatus: "ACTIVE" }),
    ];
    deactivateAccount.mutateAsync
      .mockReset()
      .mockRejectedValueOnce(new Error("HTTP 500"))
      .mockResolvedValueOnce(undefined);
    render(<EmployeeOperationsTab />);
    await selectEmployee(user);
    await user.click(screen.getByRole("button", { name: "Resign Employee" }));
    await user.click(await screen.findByRole("button", { name: "Confirm" }));
    expect(deactivateAccount.mutateAsync).toHaveBeenCalledTimes(2);
    expect(deactivateAccount.mutateAsync).toHaveBeenCalledWith({ accountId: 1, employeeEmail: "jane@wso2.com" });
    expect(deactivateAccount.mutateAsync).toHaveBeenCalledWith({ accountId: 2, employeeEmail: "jane@wso2.com" });
  });

  it("disables Deactivate and Resign Employee while a deactivate mutation is already in flight", async () => {
    const user = userEvent.setup();
    accounts.data = [bankAccount({ accountId: 1, accountStatus: "ACTIVE" })];
    isMutatingCount.value = 1;
    render(<EmployeeOperationsTab />);
    await selectEmployee(user);
    expect(screen.getByRole("button", { name: "Deactivate" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Resign Employee" })).toBeDisabled();
  });

  it("shows an error instead of swallowing a failed single-account Deactivate", async () => {
    const user = userEvent.setup();
    deactivateAccount.mutateAsync.mockReset().mockRejectedValue(new Error("HTTP 500"));
    accounts.data = [bankAccount({ accountId: 1, accountStatus: "ACTIVE" })];
    render(<EmployeeOperationsTab />);
    await selectEmployee(user);
    await user.click(screen.getByRole("button", { name: "Deactivate" }));
    await user.click(await screen.findByRole("button", { name: "Confirm" }));
    expect(await screen.findByText(/failed to deactivate.*http 500/i)).toBeInTheDocument();
  });

  it("disables the Reimbursement option for an ineligible location", async () => {
    const user = userEvent.setup();
    employees.data = [employee({ workEmail: "john@wso2.com", location: "Germany" })];
    render(<EmployeeOperationsTab />);
    await selectEmployee(user, "Jane Doe (john@wso2.com)");
    await user.click(screen.getByRole("button", { name: "Add Bank Account" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Reimbursement" })).toHaveAttribute("aria-disabled", "true");
  });

  it("reaches BankAccountRequestDialog with the selected employee's details", async () => {
    const user = userEvent.setup();
    render(<EmployeeOperationsTab />);
    await selectEmployee(user);
    await user.click(screen.getByRole("button", { name: "Add Bank Account" }));
    await user.click(screen.getByRole("menuitem", { name: "Salary" }));
    expect(screen.getByTestId("bank-account-request-dialog")).toHaveTextContent(
      "SALARY / jane@wso2.com / Sri Lanka",
    );
  });
});
