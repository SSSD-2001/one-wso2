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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import InfraReviewRequestsPage, {
  InfraReviewAllTab,
  InfraReviewAssignedTab,
  InfraReviewRequestsIndex,
  REVIEW_REQUESTS_BASE,
} from "@features/infra/pages/InfraReviewRequestsPage";
import type { InfraGate } from "@features/infra/api/useInfraGate";
import type { InfraRepositoryRequest } from "@features/infra/api/infraTypes";

vi.mock("@config/apiConfig", () => ({
  isInfraBackendConfigured: () => true,
  isGitHubOAuthConfigured: () => false,
  infraServiceUrls: {},
  infraBackendUrl: "",
}));

vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({
    showSuccess: vi.fn(),
    showWarning: vi.fn(),
    showError: vi.fn(),
  }),
}));

vi.mock("../my-requests/CreationRequestDialog", () => ({
  default: () => null,
  formatRequestDateTime: (value: string | null) => value ?? "",
}));

const pendingRequest: InfraRepositoryRequest = {
  id: 42,
  email: "requester@wso2.com",
  leadEmail: "lead@wso2.com",
  requirement: "Need a repo",
  ccList: "a@wso2.com",
  repoName: "demo-repo",
  organizationId: 1,
  organizationName: "wso2",
  repoType: "Private",
  description: "Demo",
  enableIssues: "No",
  websiteUrl: null,
  topics: "api",
  prProtection: "Default",
  teams: "platform",
  enableTriageWso2All: "Yes",
  enableTriageWso2AllInterns: "Yes",
  disableTriageReason: "N/A",
  state: "Pending",
  timestamp: "2026-01-01T00:00:00Z",
  updatedAt: null,
};

const userInfo = vi.hoisted(() => ({
  data: { workEmail: "lead@wso2.com" } as { workEmail: string } | undefined,
  isLoading: false,
  isError: false,
  error: null as Error | null,
}));

vi.mock("../api/useInfraUserInfo", () => ({
  useInfraUserInfo: () => userInfo,
}));

const reviewCalls = vi.hoisted(
  () =>
    [] as Array<{
      filter: { leadEmail?: string; fetchAll?: boolean };
      query: { limit: number; offset: number; repoName?: string };
    }>,
);
const rejectMutate = vi.hoisted(() => vi.fn());
const approveMutate = vi.hoisted(() => vi.fn());

vi.mock("../api/useInfraRequests", () => ({
  useReviewCreationRequests: (
    filter: { leadEmail?: string; fetchAll?: boolean },
    query: { limit: number; offset: number; repoName?: string },
  ) => {
    reviewCalls.push({ filter, query });
    return {
      data: {
        totalCount: 1,
        pendingCount: 1,
        approvedCount: 0,
        rejectedCount: 0,
        repositoryRequests: [pendingRequest],
      },
      isError: false,
      isFetching: false,
      error: null,
    };
  },
  useApproveRepositoryRequest: () => ({
    mutate: approveMutate,
    reset: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
  useRejectRepositoryRequest: () => ({
    mutate: rejectMutate,
    reset: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
}));

const gate = vi.hoisted(() => ({ value: {} as InfraGate }));
vi.mock("../api/useInfraGate", () => ({
  useInfraGate: () => gate.value,
}));

const APPROVER: InfraGate = {
  canSee: () => true,
  isAuthorized: true,
  isEmployee: true,
  isApprover: true,
  isAdmin: false,
  isResolving: false,
  isForbidden: false,
  isError: false,
  retry: () => {},
};

const ADMIN: InfraGate = {
  ...APPROVER,
  isAdmin: true,
};

const EMPLOYEE: InfraGate = {
  ...APPROVER,
  isApprover: false,
  isAdmin: false,
};

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={REVIEW_REQUESTS_BASE} element={<InfraReviewRequestsPage />}>
            <Route index element={<InfraReviewRequestsIndex />} />
            <Route path="assigned" element={<InfraReviewAssignedTab />} />
            <Route path="all" element={<InfraReviewAllTab />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function openRejectDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Take Decision" }));
  const decision = await screen.findByRole("dialog");
  await user.click(within(decision).getByRole("button", { name: "Reject" }));
  return screen.findByRole("heading", { name: "Reject Request" }).then((heading) =>
    heading.closest('[role="dialog"]') as HTMLElement,
  );
}

async function openApproveDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Take Decision" }));
  const decision = await screen.findByRole("dialog");
  await user.click(within(decision).getByRole("button", { name: "Approve" }));
  return screen.findByRole("heading", { name: "Confirm Approval" }).then((heading) =>
    heading.closest('[role="dialog"]') as HTMLElement,
  );
}

function rejectionComment(dialog: HTMLElement) {
  return within(dialog).getByRole("textbox", { name: /Rejection Comment/i });
}

beforeEach(() => {
  rejectMutate.mockReset();
  approveMutate.mockReset();
  reviewCalls.length = 0;
  userInfo.data = { workEmail: "lead@wso2.com" };
  userInfo.isLoading = false;
  userInfo.isError = false;
  userInfo.error = null;
  gate.value = APPROVER;
});

describe("InfraReviewRequestsPage", () => {
  it("warns when the caller cannot review", () => {
    gate.value = EMPLOYEE;
    renderAt(`${REVIEW_REQUESTS_BASE}/assigned`);
    expect(
      screen.getByText("Only approvers and admins can review repository requests."),
    ).toBeInTheDocument();
  });

  it("queries assigned requests with leadEmail", () => {
    renderAt(`${REVIEW_REQUESTS_BASE}/assigned`);
    expect(reviewCalls.at(-1)?.filter).toEqual({ leadEmail: "lead@wso2.com" });
    expect(screen.queryByRole("tab", { name: "All Requests" })).not.toBeInTheDocument();
  });

  it("lets an admin open All Requests without a leadEmail filter", () => {
    gate.value = ADMIN;
    renderAt(`${REVIEW_REQUESTS_BASE}/all`);
    expect(screen.getByRole("tab", { name: "All Requests" })).toBeInTheDocument();
    expect(reviewCalls.at(-1)?.filter).toEqual({ fetchAll: true });
  });

  it("keeps Reject disabled for whitespace-only comments and does not mutate", async () => {
    const user = userEvent.setup();
    renderAt(`${REVIEW_REQUESTS_BASE}/assigned`);

    const dialog = await openRejectDialog(user);
    await user.type(rejectionComment(dialog), "   ");

    const rejectButton = within(dialog).getByRole("button", { name: "Reject" });
    expect(rejectButton).toBeDisabled();
    expect(rejectMutate).not.toHaveBeenCalled();
  });

  it("submits a trimmed rejection comment", async () => {
    const user = userEvent.setup();
    renderAt(`${REVIEW_REQUESTS_BASE}/assigned`);

    const dialog = await openRejectDialog(user);
    await user.type(rejectionComment(dialog), "  not needed  ");
    await user.click(within(dialog).getByRole("button", { name: "Reject" }));

    expect(rejectMutate).toHaveBeenCalledWith(
      { id: 42, commentText: "not needed" },
      expect.any(Object),
    );
  });

  it("approves with the request id", async () => {
    const user = userEvent.setup();
    renderAt(`${REVIEW_REQUESTS_BASE}/assigned`);

    const dialog = await openApproveDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Approve" }));

    expect(approveMutate).toHaveBeenCalledWith(42, expect.any(Object));
  });

  it("shows the shell access error when user-info refetch fails", () => {
    userInfo.isError = true;
    userInfo.error = new Error("refetch failed");
    userInfo.data = { workEmail: "lead@wso2.com" };
    gate.value = {
      ...APPROVER,
      isError: true,
      errorMessage: "refetch failed",
    };
    renderAt(`${REVIEW_REQUESTS_BASE}/assigned`);

    expect(
      screen.getByText(/Couldn't check your Infra Portal access/),
    ).toBeInTheDocument();
    expect(screen.queryByText("demo-repo")).not.toBeInTheDocument();
  });
});
