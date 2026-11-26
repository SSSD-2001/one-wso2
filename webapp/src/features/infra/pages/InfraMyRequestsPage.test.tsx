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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InfraMyRequestsPage from "@features/infra/pages/InfraMyRequestsPage";
import type { InfraGate } from "@features/infra/api/useInfraGate";

vi.mock("@config/apiConfig", () => ({
  isInfraBackendConfigured: () => true,
  isGitHubOAuthConfigured: () => false,
  infraServiceUrls: {},
  infraBackendUrl: "",
}));

vi.mock("../new-repository/NewRepositoryForm", () => ({
  default: () => null,
}));

vi.mock("../my-requests/CreationRequestDialog", () => ({
  default: () => null,
  formatRequestDateTime: (value: string | null) => value ?? "",
}));

vi.mock("../api/useInfraUserInfo", () => ({
  useInfraUserInfo: () => ({
    data: { workEmail: "a@wso2.com" },
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

const calls = vi.hoisted(() => [] as Array<{ limit: number; offset: number; repoName?: string }>);
vi.mock("../api/useInfraRequests", () => ({
  useMyCreationRequests: (_email: string, query: { limit: number; offset: number; repoName?: string }) => {
    calls.push(query);
    return {
      data: {
        totalCount: 25,
        pendingCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        repositoryRequests: [],
      },
      isError: false,
      isFetching: false,
      error: null,
    };
  },
}));

const gate = vi.hoisted(() => ({ value: {} as InfraGate }));
vi.mock("../api/useInfraGate", () => ({
  useInfraGate: () => gate.value,
}));

const EMPLOYEE: InfraGate = {
  canSee: () => true,
  isAuthorized: true,
  isEmployee: true,
  isApprover: false,
  isAdmin: false,
  isResolving: false,
  isForbidden: false,
  isError: false,
  retry: () => {},
};

function renderPage() {
  gate.value = EMPLOYEE;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <InfraMyRequestsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  calls.length = 0;
  gate.value = EMPLOYEE;
});

describe("InfraMyRequestsPage", () => {
  it("trims a repository search and resets to the first page", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Go to next page" }));
    expect(calls.at(-1)).toEqual({ limit: 10, offset: 10, repoName: "" });

    await user.type(screen.getByLabelText("Search by Repository Name"), "  demo  ");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(calls.at(-1)).toEqual({ limit: 10, offset: 0, repoName: "demo" });
  });
});
