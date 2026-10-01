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
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BankAccount } from "@features/my/api/types";

const accounts = vi.hoisted(() => ({ data: [] as BankAccount[] }));
const reportAccountsSpy = vi.hoisted(() => vi.fn());

vi.mock("@features/my/api/useReportAccounts", () => ({
  useReportAccounts: (filters: unknown) => {
    reportAccountsSpy(filters);
    return { data: { bankAccounts: accounts.data, count: accounts.data.length }, isLoading: false, isError: false };
  },
}));

const { default: ReportTab } = await import("./ReportTab");

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

beforeEach(() => {
  accounts.data = [];
  reportAccountsSpy.mockReset();
});

describe("ReportTab", () => {
  it("renders the default-visible columns and rows", () => {
    accounts.data = [bankAccount({ employeeEmail: "jane@wso2.com", branchName: "Colombo" })];
    render(<ReportTab />);
    expect(screen.getByText("Account ID")).toBeInTheDocument();
    expect(screen.getByText("Employee Email")).toBeInTheDocument();
    expect(screen.getByText("Branch Name")).toBeInTheDocument();
    expect(screen.getByText("Effective Month")).toBeInTheDocument();
    expect(screen.getByText("jane@wso2.com")).toBeInTheDocument();
    expect(screen.getByText("Colombo")).toBeInTheDocument();
  });

  it("shows a clear empty state when a filter combination matches nothing", () => {
    render(<ReportTab />);
    expect(screen.getByText("No bank account records found.")).toBeInTheDocument();
  });

  it("builds the expected query when Search is pressed", async () => {
    const user = userEvent.setup();
    render(<ReportTab />);

    fireEvent.change(screen.getByLabelText("Start Date"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("End Date"), { target: { value: "2026-01-31" } });

    await user.click(screen.getByLabelText("Account Type"));
    await user.click(await screen.findByText("SALARY"));
    await user.click(screen.getByLabelText("Account State"));
    await user.click(await screen.findByText("ACTIVE"));

    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(reportAccountsSpy).toHaveBeenLastCalledWith({
      createdFrom: "2026-01-01",
      createdTo: "2026-01-31",
      accountTypesArray: ["SALARY"],
      statusArray: ["ACTIVE"],
    });
  });
});
