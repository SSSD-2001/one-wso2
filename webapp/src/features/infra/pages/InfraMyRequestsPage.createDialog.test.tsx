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

import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event";
import InfraMyRequestsPage from "@features/infra/pages/InfraMyRequestsPage";
import type { InfraGate } from "@features/infra/api/useInfraGate";

vi.mock("@config/apiConfig", () => ({
  isInfraBackendConfigured: () => true,
  isGitHubOAuthConfigured: () => false,
  infraServiceUrls: { repositoryRequests: "/repository-requests" },
  infraBackendUrl: "",
}));

vi.mock("../api/useInfraUserInfo", () => ({
  useInfraUserInfo: () => ({
    data: { workEmail: "a@wso2.com" },
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

vi.mock("../api/useInfraRequests", () => ({
  useMyCreationRequests: () => ({
    data: {
      totalCount: 0,
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      repositoryRequests: [],
    },
    isError: false,
    isFetching: false,
    error: null,
  }),
}));

vi.mock("../api/useInfraDirectory", () => ({
  useInfraLeads: () => ({
    data: [{ leadId: 1, leadEmail: "lead@wso2.com", teamName: "Platform" }],
    isLoading: false,
    isError: false,
    error: null,
  }),
  useInfraEmployees: () => ({
    data: [{ firstName: "Sam", lastName: "Lee", workEmail: "cc@wso2.com" }],
    isLoading: false,
    isError: false,
    error: null,
  }),
  useInfraOrganizations: () => ({
    data: [
      {
        organizationId: 7,
        organizationName: "wso2",
        organizationVisibility: "Public",
        organizationPlan: "Team",
        enableIssues: 1,
      },
    ],
    isLoading: false,
    isError: false,
    error: null,
  }),
  useInfraTopics: () => ({
    data: [{ topicName: "api" }],
    isLoading: false,
    isError: false,
    error: null,
  }),
  useInfraTeams: () => ({
    data: ["wso2-all"],
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

const mutate = vi.hoisted(() =>
  vi.fn((_body: unknown, options?: { onSuccess?: () => void }) => {
    options?.onSuccess?.();
  }),
);
vi.mock("../new-repository/useCreateRepositoryRequest", () => ({
  useCreateRepositoryRequest: () => ({
    mutate,
    reset: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
}));

vi.mock("../new-repository/useUpdateRepositoryRequest", () => ({
  useUpdateRepositoryRequest: () => ({
    mutate: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
}));

vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showWarning: vi.fn() }),
}));

const gate: InfraGate = {
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

vi.mock("../api/useInfraGate", () => ({
  useInfraGate: () => gate,
}));

async function choose(user: ReturnType<typeof userEvent.setup>, field: HTMLElement, option: string) {
  await user.click(field);
  await user.click(await screen.findByRole("option", { name: option }));
}

describe("New Repo dialog", () => {
  it("closes after a successful create", async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <InfraMyRequestsPage />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: "New Repo" }));
    const dialog = screen.getByRole("dialog", { name: "New Repository" });
    const [lead, cc] = within(dialog).getAllByRole("combobox");
    await choose(user, lead, "lead@wso2.com - Platform");
    await user.type(within(dialog).getByRole("textbox", { name: /Requirement/ }), "A shared library");
    await choose(user, cc, "cc@wso2.com");
    await user.click(within(dialog).getByRole("button", { name: "Next" }));

    const [organization, topics] = within(dialog).getAllByRole("combobox");
    await choose(user, organization, "wso2 - Public");
    await user.type(within(dialog).getByRole("textbox", { name: /Repository Name/ }), "shared-lib");
    await user.type(within(dialog).getByRole("textbox", { name: /Description/ }), "Shared utilities");
    await choose(user, topics, "api");
    await user.click(within(dialog).getByRole("button", { name: "Next" }));

    const [teams] = within(dialog).getAllByRole("combobox");
    await choose(user, teams, "wso2-all");
    await user.click(within(dialog).getByRole("button", { name: "Submit" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(mutate).toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "New Repository" })).not.toBeInTheDocument();
  });
});
