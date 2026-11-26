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
import { MemoryRouter } from "react-router";
import { authedPost } from "@api/http";
import InfraHomePage from "@features/infra/pages/InfraHomePage";
import type { InfraGate } from "@features/infra/api/useInfraGate";

vi.mock("@config/apiConfig", () => ({
  isInfraBackendConfigured: () => true,
  isGitHubOAuthConfigured: () => false,
  infraServiceUrls: {},
  infraBackendUrl: "",
}));

const gate = vi.hoisted(() => ({ value: {} as InfraGate }));
vi.mock("@features/infra/api/useInfraGate", () => ({
  useInfraGate: () => gate.value,
}));

const userInfo = vi.hoisted(() => ({
  current: {
    data: undefined as { githubUserId?: string; githubUsername?: string } | undefined,
    isLoading: false,
    isError: false,
    error: null,
  },
}));
vi.mock("../api/useInfraUserInfo", () => ({
  useInfraUserInfo: () => userInfo.current,
}));

vi.mock("@hooks/useAccessToken", () => ({
  useAccessToken: () => async () => "token",
}));

vi.mock("@api/http", () => ({
  authedGet: vi.fn(async () => ({
    status: "granted",
    organizations: [
      {
        orgName: "wso2",
        avatarUrl: "",
        repositories: [{ name: "shared-lib", htmlUrl: "https://github.com/wso2/shared-lib" }],
      },
    ],
  })),
  authedPost: vi.fn(),
  authedPut: vi.fn(),
}));

const AUTHORIZED: InfraGate = {
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

function renderHome(g: Partial<InfraGate> = {}) {
  gate.value = { ...AUTHORIZED, ...g };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <InfraHomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  gate.value = AUTHORIZED;
  userInfo.current = { data: undefined, isLoading: false, isError: false, error: null };
  sessionStorage.clear();
  vi.mocked(authedPost).mockReset();
});

describe("InfraHomePage", () => {
  it("offers GitHub connect and does not repeat the menu", () => {
    renderHome();

    expect(screen.getByText("Not Connected")).toBeInTheDocument();
    expect(screen.getByText("GitHub OAuth is not configured.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Connect your GitHub account" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Adding an email address to your GitHub account" })).toHaveAttribute(
      "href",
      "https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-email-preferences/adding-an-email-address-to-your-github-account",
    );
    expect(screen.queryByText("wso2")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open new repository" })).not.toBeInTheDocument();
    expect(screen.queryByText("New Repository")).not.toBeInTheDocument();
    expect(screen.queryByText("Not here yet")).not.toBeInTheDocument();
  });

  it("replaces the connection guide with repository access once GitHub is connected", async () => {
    userInfo.current = {
      data: { githubUserId: "1", githubUsername: "SSSD-2001" },
      isLoading: false,
      isError: false,
      error: null,
    };
    renderHome();

    expect(screen.getByText("@SSSD-2001")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Connect your GitHub account" })).not.toBeInTheDocument();
    expect(await screen.findByText("wso2")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /wso2/ }));
    expect(screen.getByRole("link", { name: "shared-lib" })).toHaveAttribute(
      "href",
      "https://github.com/wso2/shared-lib",
    );
  });

  it("hides the connect prompt as soon as the chip shows the connected account", async () => {
    sessionStorage.setItem("gh_pending_oauth_code", "oauth-code");
    vi.mocked(authedPost).mockResolvedValue({
      status: "verified",
      githubUserId: "1",
      githubUsername: "SSSD-2001",
    });

    renderHome();

    expect(await screen.findByText("@SSSD-2001")).toBeInTheDocument();
    expect(
      screen.queryByText("Connect with GitHub from GitHub Connection to see default repository access."),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Connect your GitHub account" })).not.toBeInTheDocument();
    expect(await screen.findByText("wso2")).toBeInTheDocument();
  });
});
