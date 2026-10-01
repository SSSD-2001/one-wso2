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
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";

const access = vi.hoisted(() => ({
  value: {} as {
    canSee: boolean;
    isResolving: boolean;
    isError: boolean;
    errorMessage?: string;
    retry: () => void;
  },
}));
vi.mock("@features/my/api/useBankingAdminAccess", () => ({ useBankingAdminAccess: () => access.value }));

import BankingAdminRoute from "./BankingAdminRoute";

function UrlProbe() {
  return <div data-testid="url">{useLocation().pathname}</div>;
}

function renderGuarded() {
  return render(
    <MemoryRouter initialEntries={["/banking/admin"]}>
      <UrlProbe />
      <Routes>
        <Route
          path="/banking/admin"
          element={
            <BankingAdminRoute>
              <div>the banking admin page</div>
            </BankingAdminRoute>
          }
        />
        <Route path="/me" element={<div>home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  access.value = { canSee: true, isResolving: false, isError: false, retry: vi.fn() };
});

describe("BankingAdminRoute", () => {
  it("renders the page for a People Ops or Finance admin", () => {
    renderGuarded();
    expect(screen.getByText("the banking admin page")).toBeInTheDocument();
    expect(screen.getByTestId("url")).toHaveTextContent("/banking/admin");
  });

  // The rail entry is hidden for them, but a hidden entry alone leaves the URL working.
  it("sends everyone else home", () => {
    access.value = { ...access.value, canSee: false };
    renderGuarded();
    expect(screen.queryByText("the banking admin page")).not.toBeInTheDocument();
    expect(screen.getByTestId("url")).toHaveTextContent("/me");
  });

  it("waits, rather than redirecting, while the backend has not answered yet", () => {
    access.value = { ...access.value, canSee: false, isResolving: true };
    renderGuarded();
    expect(screen.queryByText("the banking admin page")).not.toBeInTheDocument();
    expect(screen.getByTestId("url")).toHaveTextContent("/banking/admin");
  });

  it("says the check failed, with a retry, instead of silently redirecting", () => {
    access.value = { ...access.value, canSee: false, isError: true, errorMessage: "boom" };
    renderGuarded();
    expect(screen.getByText(/Couldn't check your access to Banking/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByTestId("url")).toHaveTextContent("/banking/admin");
  });
});
