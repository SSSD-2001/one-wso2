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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import InfraHomePage from "@features/infra/pages/InfraHomePage";
import { DEFAULT_REPOSITORY_ACCESS_PENDING_KEY } from "@features/infra/github/githubOAuth";
import type { InfraGate } from "@features/infra/api/useInfraGate";

const authConfig = vi.hoisted(() => ({
  baseUrl: "https://auth.example.com/t/test",
  clientId: "client-id",
  wellKnownEndpoint: undefined as string | undefined,
}));

const http = vi.hoisted(() => ({
  authedPost: vi.fn(),
  authedPut: vi.fn(),
}));

const getAccessToken = vi.hoisted(() => vi.fn(async () => "sign-in-token"));

vi.mock("@config/authConfig", () => ({ authConfig }));

vi.mock("@config/apiConfig", () => ({
  isInfraBackendConfigured: () => true,
  isGitHubOAuthConfigured: () => false,
  infraServiceUrls: {
    githubVerifyAndPersistUser: "https://infra.example/github/verify-and-persist-user",
    setDefaultRepositoryAccess: "https://infra.example/set-default-repository-access",
  },
  infraBackendUrl: "",
}));

vi.mock("@api/http", () => ({
  authedPost: http.authedPost,
  authedPut: http.authedPut,
  // describeError checks `instanceof HttpError` on every failure.
  HttpError: class HttpError extends Error {},
}));

vi.mock("@hooks/useAccessToken", () => ({
  useAccessToken: () => getAccessToken,
}));

const gate = vi.hoisted(() => ({ value: {} as InfraGate }));
vi.mock("@features/infra/api/useInfraGate", () => ({
  useInfraGate: () => gate.value,
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

const tokenResponse = {
  access_token: "refreshed-access",
  id_token: "id-token",
  refresh_token: "refresh-2",
  expires_in: 3600,
};

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body };
}

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

function seedVerifiedReturn(): void {
  sessionStorage.setItem("gh_pending_oauth_code", "oauth-code");
  sessionStorage.setItem(
    "asgardeo_session_data",
    JSON.stringify({
      refresh_token: "refresh-1",
      access_token: "old-access",
      expires_in: 3600,
      created_at: 1,
    }),
  );
}

beforeEach(() => {
  gate.value = AUTHORIZED;
  sessionStorage.clear();
  authConfig.wellKnownEndpoint = undefined;
  getAccessToken.mockReset();
  getAccessToken.mockResolvedValue("sign-in-token");
  http.authedPost.mockReset();
  http.authedPut.mockReset();
  http.authedPost.mockResolvedValue({
    status: "verified",
    githubUserId: "123",
    githubUsername: "octocat",
  });
  http.authedPut.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
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
    expect(screen.queryByRole("link", { name: "Open new repository" })).not.toBeInTheDocument();
    expect(screen.queryByText("New Repository")).not.toBeInTheDocument();
    expect(screen.queryByText("Not here yet")).not.toBeInTheDocument();
  });

  it("refreshes the session and grants default repository access", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(tokenResponse));
    vi.stubGlobal("fetch", fetchMock);
    seedVerifiedReturn();

    renderHome();

    await waitFor(() =>
      expect(http.authedPut).toHaveBeenCalledWith(
        "https://infra.example/set-default-repository-access",
        "refreshed-access",
        {},
      ),
    );
    expect(http.authedPost).toHaveBeenCalledWith(
      "https://infra.example/github/verify-and-persist-user",
      "sign-in-token",
      { code: "oauth-code" },
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://auth.example.com/t/test/oauth2/token",
      expect.objectContaining({ method: "POST" }),
    );

    const session = JSON.parse(sessionStorage.getItem("asgardeo_session_data") ?? "{}") as {
      created_at: number;
      expires_in: number;
    };
    expect(session.created_at).toBeGreaterThan(1_000_000_000_000);
    expect(session.created_at + session.expires_in * 1000).toBeGreaterThan(Date.now());
    expect(sessionStorage.getItem(DEFAULT_REPOSITORY_ACCESS_PENDING_KEY)).toBeNull();
  });

  it("posts the refresh to the token endpoint from discovery", async () => {
    authConfig.wellKnownEndpoint = "https://id.example/.well-known/openid-configuration";
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes("openid-configuration")) {
        return jsonResponse({ token_endpoint: "https://id.example/oauth/token" });
      }
      return jsonResponse(tokenResponse);
    });
    vi.stubGlobal("fetch", fetchMock);
    seedVerifiedReturn();

    renderHome();

    await waitFor(() => expect(http.authedPut).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      "https://id.example/.well-known/openid-configuration",
      "https://id.example/oauth/token",
    ]);
  });

  it("retries a failed refresh without sending the GitHub code again", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "invalid_grant" }, false))
      .mockResolvedValueOnce(jsonResponse(tokenResponse));
    vi.stubGlobal("fetch", fetchMock);
    seedVerifiedReturn();

    renderHome();

    expect(await screen.findByText("invalid_grant")).toBeInTheDocument();
    expect(http.authedPut).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("gh_pending_oauth_code")).toBeNull();

    await user.click(await screen.findByRole("button", { name: "Retry" }));

    await waitFor(() =>
      expect(http.authedPut).toHaveBeenCalledWith(
        "https://infra.example/set-default-repository-access",
        "refreshed-access",
        {},
      ),
    );
    expect(http.authedPost).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reuses the refreshed token when default access fails", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => jsonResponse(tokenResponse));
    vi.stubGlobal("fetch", fetchMock);
    http.authedPut.mockRejectedValueOnce(new Error("default access failed")).mockResolvedValueOnce(null);
    seedVerifiedReturn();

    renderHome();

    expect(await screen.findByText("default access failed")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await user.click(await screen.findByRole("button", { name: "Retry" }));

    await waitFor(() => expect(http.authedPut).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(http.authedPut).toHaveBeenNthCalledWith(
      2,
      "https://infra.example/set-default-repository-access",
      "refreshed-access",
      {},
    );
  });

  it("retries after reload without a GitHub code", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    sessionStorage.setItem(
      "asgardeo_session_data",
      JSON.stringify({
        refresh_token: "refresh-1",
        access_token: "retained-access",
        expires_in: 3600,
        created_at: Date.now(),
      }),
    );
    sessionStorage.setItem(
      DEFAULT_REPOSITORY_ACCESS_PENDING_KEY,
      JSON.stringify({
        verified: { status: "verified", githubUserId: "123", githubUsername: "octocat" },
        tokenReady: true,
      }),
    );

    renderHome();

    expect(screen.getByText("Default repository access was not granted.")).toBeInTheDocument();
    expect(screen.getByText("@octocat")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() =>
      expect(http.authedPut).toHaveBeenCalledWith(
        "https://infra.example/set-default-repository-access",
        "retained-access",
        {},
      ),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(http.authedPost).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(DEFAULT_REPOSITORY_ACCESS_PENDING_KEY)).toBeNull();
  });
});
