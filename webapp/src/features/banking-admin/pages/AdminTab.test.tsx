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
import type { Bank } from "@features/my/api/types";

const banks = vi.hoisted(() => ({
  data: [] as Bank[],
}));
const privileges = vi.hoisted(() => ({
  value: { isPeopleOperationsAdmin: false, isFinanceAdmin: false },
}));
const config = vi.hoisted(() => ({
  value: { salaryThreshold: 18, consultancyThreshold: 20, allCountries: ["Sri Lanka", "United States"] },
}));
const createBank = vi.hoisted(() => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending: false,
}));
const updateThreshold = vi.hoisted(() => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending: false,
}));
// AdminTab reads this directly (not through useCreateBank/useUpdateThreshold,
// which are fully mocked below) to tell whether either action is still in
// flight — see those mutations' own mutationKey, same pattern as
// MyAccountsTab's own isMutatingCount in BankingPage.test.tsx.
const isMutatingCount = vi.hoisted(() => ({ value: 0 }));
vi.mock("@tanstack/react-query", () => ({
  useIsMutating: () => isMutatingCount.value,
}));

vi.mock("@features/my/api/useBanks", () => ({
  useBanks: () => ({ data: { banks: banks.data, count: banks.data.length }, isLoading: false, isError: false }),
}));
vi.mock("@features/my/api/useBankingConfig", () => ({
  useBankingConfig: () => ({ data: config.value, isLoading: false, isError: false }),
}));
vi.mock("@features/my/api/useBankingPrivileges", () => ({
  useBankingPrivileges: () => ({ data: privileges.value, isLoading: false, isError: false }),
}));
vi.mock("@features/my/api/useCreateBank", () => ({ useCreateBank: () => createBank }));
vi.mock("@features/my/api/useUpdateThreshold", () => ({ useUpdateThreshold: () => updateThreshold }));

const { default: AdminTab } = await import("./AdminTab");

function bank(overrides: Partial<Bank> = {}): Bank {
  return { bankCode: "COM001", swiftCode: "COMBLK", bankName: "Commercial Bank", bankLocation: "Sri Lanka", ...overrides };
}

beforeEach(() => {
  banks.data = [];
  privileges.value = { isPeopleOperationsAdmin: false, isFinanceAdmin: false };
  config.value = { salaryThreshold: 18, consultancyThreshold: 20, allCountries: ["Sri Lanka", "United States"] };
  createBank.mutate.mockReset();
  createBank.mutateAsync.mockReset().mockResolvedValue(undefined);
  updateThreshold.mutate.mockReset();
  updateThreshold.mutateAsync.mockReset().mockResolvedValue(undefined);
  isMutatingCount.value = 0;
});

describe("AdminTab thresholds", () => {
  it("enables only the Salary Update button for a People Ops admin, once the value has changed", async () => {
    const user = userEvent.setup();
    privileges.value = { isPeopleOperationsAdmin: true, isFinanceAdmin: false };
    render(<AdminTab />);
    await user.clear(screen.getByLabelText("Salary Threshold Day (1-31)"));
    await user.type(screen.getByLabelText("Salary Threshold Day (1-31)"), "25");
    await user.clear(screen.getByLabelText("Consultancy Threshold Day (1-31)"));
    await user.type(screen.getByLabelText("Consultancy Threshold Day (1-31)"), "10");
    expect(screen.getByRole("button", { name: "Update Salary Threshold" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Update Consultancy Threshold" })).toBeDisabled();
  });

  it("enables only the Consultancy Update button for a Finance admin, once the value has changed", async () => {
    const user = userEvent.setup();
    privileges.value = { isPeopleOperationsAdmin: false, isFinanceAdmin: true };
    render(<AdminTab />);
    await user.clear(screen.getByLabelText("Salary Threshold Day (1-31)"));
    await user.type(screen.getByLabelText("Salary Threshold Day (1-31)"), "25");
    await user.clear(screen.getByLabelText("Consultancy Threshold Day (1-31)"));
    await user.type(screen.getByLabelText("Consultancy Threshold Day (1-31)"), "10");
    expect(screen.getByRole("button", { name: "Update Salary Threshold" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Update Consultancy Threshold" })).toBeEnabled();
  });

  it("disables Update even for the right admin when the value hasn't changed", () => {
    privileges.value = { isPeopleOperationsAdmin: true, isFinanceAdmin: true };
    render(<AdminTab />);
    expect(screen.getByRole("button", { name: "Update Salary Threshold" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Update Consultancy Threshold" })).toBeDisabled();
  });

  it("updates the Salary threshold with the right key and value", async () => {
    const user = userEvent.setup();
    privileges.value = { isPeopleOperationsAdmin: true, isFinanceAdmin: false };
    render(<AdminTab />);
    const input = screen.getByLabelText("Salary Threshold Day (1-31)");
    await user.clear(input);
    await user.type(input, "25");
    await user.click(screen.getByRole("button", { name: "Update Salary Threshold" }));
    await user.click(await screen.findByRole("button", { name: "Confirm" }));
    expect(updateThreshold.mutateAsync).toHaveBeenCalledWith({ key: "SALARY_THRESHOLD", value: 25 });
  });

  it("keeps tracking the server value again once a refetch catches up with the typed draft", async () => {
    const user = userEvent.setup();
    privileges.value = { isPeopleOperationsAdmin: true, isFinanceAdmin: false };
    const { rerender } = render(<AdminTab />);
    const input = screen.getByLabelText("Salary Threshold Day (1-31)");
    await user.clear(input);
    await user.type(input, "25");

    // A refetch (this admin's own successful update, or someone else's)
    // brings the server value in line with what was typed.
    config.value = { ...config.value, salaryThreshold: 25 };
    rerender(<AdminTab />);

    // A later refetch moves the server value again. If the draft never
    // reset when it first matched, it would still be pinned at 25 here
    // instead of following the new server value.
    config.value = { ...config.value, salaryThreshold: 30 };
    rerender(<AdminTab />);

    expect(screen.getByLabelText("Salary Threshold Day (1-31)")).toHaveValue(30);
  });
});

describe("AdminTab bank list", () => {
  it("filters the bank list by search term", async () => {
    const user = userEvent.setup();
    banks.data = [bank({ bankName: "Commercial Bank" }), bank({ bankCode: "SAM001", swiftCode: "SAMPLK", bankName: "Sampath Bank" })];
    render(<AdminTab />);
    expect(screen.getByText("Commercial Bank")).toBeInTheDocument();
    expect(screen.getByText("Sampath Bank")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Search..."), "Sampath");
    expect(screen.queryByText("Commercial Bank")).not.toBeInTheDocument();
    expect(screen.getByText("Sampath Bank")).toBeInTheDocument();
  });

  it("blocks submitting Add Bank when the entered code already exists", async () => {
    const user = userEvent.setup();
    banks.data = [bank({ bankCode: "COM001", swiftCode: "COMBLK" })];
    render(<AdminTab />);
    await user.click(screen.getByRole("button", { name: "Add Bank" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Bank Name"), "Commercial Bank Two");
    await user.type(within(dialog).getByLabelText("Bank Code"), "COM001");
    await user.type(within(dialog).getByLabelText("SWIFT Code"), "DIFFSWFT");
    expect(within(dialog).getByText("Bank code already exists")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Submit" })).toBeDisabled();
    expect(createBank.mutateAsync).not.toHaveBeenCalled();
  });

  it("blocks submitting Add Bank when the entered SWIFT code already exists", async () => {
    const user = userEvent.setup();
    banks.data = [bank({ bankCode: "COM001", swiftCode: "COMBLK" })];
    render(<AdminTab />);
    await user.click(screen.getByRole("button", { name: "Add Bank" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Bank Name"), "Commercial Bank Two");
    await user.type(within(dialog).getByLabelText("Bank Code"), "DIFFCODE");
    await user.type(within(dialog).getByLabelText("SWIFT Code"), "COMBLK");
    expect(within(dialog).getByText("SWIFT code already exists")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("creates a bank once the form is valid and confirmed", async () => {
    const user = userEvent.setup();
    banks.data = [bank({ bankCode: "COM001", swiftCode: "COMBLK" })];
    render(<AdminTab />);
    await user.click(screen.getByRole("button", { name: "Add Bank" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Bank Name"), "Sampath Bank");
    await user.type(within(dialog).getByLabelText("Bank Code"), "SAM001");
    await user.type(within(dialog).getByLabelText("SWIFT Code"), "SAMPLK");
    await user.click(within(dialog).getByLabelText("Location"));
    await user.click(await screen.findByText("Sri Lanka"));
    const submit = within(dialog).getByRole("button", { name: "Submit" });
    expect(submit).toBeEnabled();
    await user.click(submit);
    await user.click(await screen.findByRole("button", { name: "Confirm" }));
    expect(createBank.mutateAsync).toHaveBeenCalledWith({
      bankName: "Sampath Bank",
      bankCode: "SAM001",
      swiftCode: "SAMPLK",
      bankLocation: "Sri Lanka",
    });
  });

  it("sends only one create request when Confirm is pressed twice in quick succession", async () => {
    const user = userEvent.setup();
    // A request that is still in flight when the second press arrives.
    let finish: () => void = () => {};
    createBank.mutateAsync.mockReset().mockReturnValue(new Promise<undefined>((resolve) => (finish = () => resolve(undefined))));
    banks.data = [bank({ bankCode: "COM001", swiftCode: "COMBLK" })];
    render(<AdminTab />);
    await user.click(screen.getByRole("button", { name: "Add Bank" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Bank Name"), "Sampath Bank");
    await user.type(within(dialog).getByLabelText("Bank Code"), "SAM001");
    await user.type(within(dialog).getByLabelText("SWIFT Code"), "SAMPLK");
    await user.click(within(dialog).getByLabelText("Location"));
    await user.click(await screen.findByText("Sri Lanka"));
    await user.click(within(dialog).getByRole("button", { name: "Submit" }));
    await user.dblClick(await screen.findByRole("button", { name: "Confirm" }));

    expect(createBank.mutateAsync).toHaveBeenCalledTimes(1);
    finish();
  });
});

describe("AdminTab one submission at a time", () => {
  it("disables Add Bank and both Update buttons while another banking-admin mutation is in flight", () => {
    privileges.value = { isPeopleOperationsAdmin: true, isFinanceAdmin: true };
    isMutatingCount.value = 1;
    render(<AdminTab />);
    expect(screen.getByRole("button", { name: "Add Bank" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Update Salary Threshold" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Update Consultancy Threshold" })).toBeDisabled();
  });

  it("shows an error instead of swallowing a failed threshold update", async () => {
    const user = userEvent.setup();
    updateThreshold.mutateAsync.mockReset().mockRejectedValue(new Error("Backend rejected the update"));
    privileges.value = { isPeopleOperationsAdmin: true, isFinanceAdmin: false };
    render(<AdminTab />);
    const input = screen.getByLabelText("Salary Threshold Day (1-31)");
    await user.clear(input);
    await user.type(input, "25");
    await user.click(screen.getByRole("button", { name: "Update Salary Threshold" }));
    await user.click(await screen.findByRole("button", { name: "Confirm" }));
    expect(await screen.findByText(/failed to update.*backend rejected the update/i)).toBeInTheDocument();
  });

  it("shows an error instead of swallowing a failed create-bank request", async () => {
    const user = userEvent.setup();
    createBank.mutateAsync.mockReset().mockRejectedValue(new Error("Duplicate SWIFT code"));
    banks.data = [bank({ bankCode: "COM001", swiftCode: "COMBLK" })];
    render(<AdminTab />);
    await user.click(screen.getByRole("button", { name: "Add Bank" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Bank Name"), "Sampath Bank");
    await user.type(within(dialog).getByLabelText("Bank Code"), "SAM001");
    await user.type(within(dialog).getByLabelText("SWIFT Code"), "SAMPLK");
    await user.click(within(dialog).getByLabelText("Location"));
    await user.click(await screen.findByText("Sri Lanka"));
    await user.click(within(dialog).getByRole("button", { name: "Submit" }));
    await user.click(await screen.findByRole("button", { name: "Confirm" }));
    expect(await screen.findByText(/failed to add the bank.*duplicate swift code/i)).toBeInTheDocument();
  });
});
