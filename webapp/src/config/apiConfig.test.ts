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

import { afterEach, describe, expect, it, vi } from "vitest";
import { parServiceUrls, promotionServiceUrls } from "@config/apiConfig";

// statusArray's comma must stay unencoded, or the backend won't split it.
// These pin the exact query string so a switch back to URLSearchParams
// fails loudly instead of silently.
describe("promotionServiceUrls: statusArray must stay comma-joined, not percent-encoded", () => {
  it("promotionRequests keeps a raw comma between multiple statuses", () => {
    const url = promotionServiceUrls.promotionRequests({ statusArray: ["WITHDRAW", "REMOVED"] });
    expect(url).toContain("statusArray=WITHDRAW,REMOVED");
    expect(url).not.toContain("%2C");
  });

  it("promotionRecommendations keeps a raw comma between multiple statuses", () => {
    const url = promotionServiceUrls.promotionRecommendations({
      statusArray: ["SUBMITTED", "DECLINED", "EXPIRED"],
    });
    expect(url).toContain("statusArray=SUBMITTED,DECLINED,EXPIRED");
    expect(url).not.toContain("%2C");
  });

  it("still percent-encodes other free-text params on both builders", () => {
    expect(promotionServiceUrls.promotionRequests({ employeeEmail: "a b@x.com" })).toContain(
      `employeeEmail=${encodeURIComponent("a b@x.com")}`,
    );
    expect(promotionServiceUrls.promotionRecommendations({ leadEmail: "a b@x.com" })).toContain(
      `leadEmail=${encodeURIComponent("a b@x.com")}`,
    );
  });
});

// A "/" in a cycle name must never reach the URL path as %2F: the production
// gateway answers that with a 307 redirect, so the roster loads empty.
describe("parServiceUrls.legacyParHistoryCyclesParticipants", () => {
  it("sends the cycle name as a query parameter, never in the path", () => {
    const url = parServiceUrls.legacyParHistoryCyclesParticipants("2016 Quarterly Review - Q3/Q4", true);
    expect(url).toMatch(/\/legacy-par-history-cycles\/participants\?cycleName=/);
    expect(new URL(url, "http://x").pathname).not.toContain("%2F");
    expect(new URL(url, "http://x").searchParams.get("cycleName")).toBe("2016 Quarterly Review - Q3/Q4");
    expect(new URL(url, "http://x").searchParams.get("summary")).toBe("true");
  });

  it("keeps the older path form available for the fallback", () => {
    const url = new URL(parServiceUrls.legacyParHistoryCyclesParticipantsByPath("2016 Quarterly Review - Q2", true), "http://x");
    expect(url.pathname).toMatch(/\/legacy-par-history-cycles\/2016%20Quarterly%20Review%20-%20Q2\/participants$/);
    expect(url.searchParams.get("summary")).toBe("true");
  });

  it("round-trips names with spaces, double spaces and symbols, and omits summary when false", () => {
    for (const name of ["2019  Performance Evaluation - Q2", "2015 ANNUAL PERFORMANCE REVIEW for Engineering Employees", "A&B=C #1?"]) {
      const url = new URL(parServiceUrls.legacyParHistoryCyclesParticipants(name), "http://x");
      expect(url.searchParams.get("cycleName")).toBe(name);
      expect(url.searchParams.has("summary")).toBe(false);
    }
  });
});

// githubOAuthConfig is read when apiConfig loads, so each case needs a fresh
// import against its own window.config.
const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const FLAT_AUTHORIZE_URL = "https://github.example/login/oauth/authorize";

async function loadGitHubOAuth(config: Record<string, unknown> | undefined) {
  vi.resetModules();
  (window as unknown as { config?: Record<string, unknown> }).config = config;
  return import("@config/apiConfig");
}

afterEach(() => {
  delete (window as { config?: unknown }).config;
});

describe("githubOAuthConfig.authorizeUrl", () => {
  it("uses the nested authorize URL when it is set", async () => {
    const cfg = await loadGitHubOAuth({
      ONE_WSO2_GITHUB_OAUTH: { AUTHORIZE_URL: "https://nested.example/authorize" },
      ONE_WSO2_GITHUB_OAUTH_AUTHORIZE_URL: FLAT_AUTHORIZE_URL,
    });
    expect(cfg.githubOAuthConfig.authorizeUrl).toBe("https://nested.example/authorize");
  });

  it("uses the GitHub default when the nested URL is empty, even if the flat URL is set", async () => {
    const cfg = await loadGitHubOAuth({
      ONE_WSO2_GITHUB_OAUTH: { AUTHORIZE_URL: "" },
      ONE_WSO2_GITHUB_OAUTH_AUTHORIZE_URL: FLAT_AUTHORIZE_URL,
    });
    expect(cfg.githubOAuthConfig.authorizeUrl).toBe(GITHUB_AUTHORIZE_URL);
  });

  it("uses the flat URL when the nested value is absent", async () => {
    const cfg = await loadGitHubOAuth({
      ONE_WSO2_GITHUB_OAUTH: {},
      ONE_WSO2_GITHUB_OAUTH_AUTHORIZE_URL: FLAT_AUTHORIZE_URL,
    });
    expect(cfg.githubOAuthConfig.authorizeUrl).toBe(FLAT_AUTHORIZE_URL);
  });

  it("uses the GitHub default when neither URL is set", async () => {
    const cfg = await loadGitHubOAuth({});
    expect(cfg.githubOAuthConfig.authorizeUrl).toBe(GITHUB_AUTHORIZE_URL);
  });
});

const NESTED_CLIENT_ID = "nested-client";
const FLAT_CLIENT_ID = "flat-client";
const NESTED_REDIRECT_URL = "https://nested.example/callback";
const FLAT_REDIRECT_URL = "https://flat.example/callback";

describe("githubOAuthConfig.clientId", () => {
  it("uses the nested client ID when it is set", async () => {
    const cfg = await loadGitHubOAuth({
      ONE_WSO2_GITHUB_OAUTH: { CLIENT_ID: NESTED_CLIENT_ID },
      ONE_WSO2_GITHUB_OAUTH_CLIENT_ID: FLAT_CLIENT_ID,
    });
    expect(cfg.githubOAuthConfig.clientId).toBe(NESTED_CLIENT_ID);
  });

  it("uses the flat client ID when the nested value is absent", async () => {
    const cfg = await loadGitHubOAuth({
      ONE_WSO2_GITHUB_OAUTH: {},
      ONE_WSO2_GITHUB_OAUTH_CLIENT_ID: FLAT_CLIENT_ID,
    });
    expect(cfg.githubOAuthConfig.clientId).toBe(FLAT_CLIENT_ID);
  });

  it("keeps an empty nested client ID, so Connect stays hidden", async () => {
    const cfg = await loadGitHubOAuth({
      ONE_WSO2_GITHUB_OAUTH: { CLIENT_ID: "", REDIRECT_URL: NESTED_REDIRECT_URL },
      ONE_WSO2_GITHUB_OAUTH_CLIENT_ID: FLAT_CLIENT_ID,
    });
    expect(cfg.githubOAuthConfig.clientId).toBe("");
    expect(cfg.isGitHubOAuthConfigured()).toBe(false);
  });

  it("is empty when neither client ID is set", async () => {
    const cfg = await loadGitHubOAuth({});
    expect(cfg.githubOAuthConfig.clientId).toBe("");
  });
});

describe("githubOAuthConfig.redirectUrl", () => {
  it("uses the nested redirect URL when it is set", async () => {
    const cfg = await loadGitHubOAuth({
      ONE_WSO2_GITHUB_OAUTH: { REDIRECT_URL: NESTED_REDIRECT_URL },
      ONE_WSO2_GITHUB_OAUTH_REDIRECT_URL: FLAT_REDIRECT_URL,
    });
    expect(cfg.githubOAuthConfig.redirectUrl).toBe(NESTED_REDIRECT_URL);
  });

  it("uses the flat redirect URL when the nested value is absent", async () => {
    const cfg = await loadGitHubOAuth({
      ONE_WSO2_GITHUB_OAUTH: {},
      ONE_WSO2_GITHUB_OAUTH_REDIRECT_URL: FLAT_REDIRECT_URL,
    });
    expect(cfg.githubOAuthConfig.redirectUrl).toBe(FLAT_REDIRECT_URL);
  });

  it("keeps an empty nested redirect URL, so Connect stays hidden", async () => {
    const cfg = await loadGitHubOAuth({
      ONE_WSO2_GITHUB_OAUTH: { CLIENT_ID: NESTED_CLIENT_ID, REDIRECT_URL: "" },
      ONE_WSO2_GITHUB_OAUTH_REDIRECT_URL: FLAT_REDIRECT_URL,
    });
    expect(cfg.githubOAuthConfig.redirectUrl).toBe("");
    expect(cfg.isGitHubOAuthConfigured()).toBe(false);
  });

  it("is empty when neither redirect URL is set", async () => {
    const cfg = await loadGitHubOAuth({});
    expect(cfg.githubOAuthConfig.redirectUrl).toBe("");
  });
});
