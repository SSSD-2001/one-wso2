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

import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import AuthGuard from "@layouts/AuthGuard";
import EngineeringOverviewPage from "./EngineeringOverviewPage";

const auth = vi.hoisted(() => {
  window.config = {
    ...(window.config ?? {}),
    ONE_WSO2_AUTH_BASE_URL: "https://auth.example.com/t/test",
    ONE_WSO2_AUTH_CLIENT_ID: "test-client",
    ONE_WSO2_AUTH_SIGN_IN_REDIRECT_URL: "http://localhost:3000",
    ONE_WSO2_AUTH_SIGN_OUT_REDIRECT_URL: "http://localhost:3000",
    ONE_WSO2_DEV_BYPASS_AUTH: false,
  } as Window["config"];
  return {
    isSignedIn: true,
    isLoading: false,
    signIn: vi.fn(),
  };
});

// jsdom does not lay a percentage-sized chart out, so the responsive container
// would measure 0×0 and draw nothing. Give it a fixed size in tests; the page
// still asks for 100% of its parent.
vi.mock("recharts", async () => {
  const React = await import("react");
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) =>
      React.createElement(actual.ResponsiveContainer, { width: 640, height: 280, children }),
  };
});

vi.mock("@asgardeo/react", () => ({
  useAsgardeo: () => ({
    isSignedIn: auth.isSignedIn,
    isLoading: auth.isLoading,
    getAccessToken: async () => "test-token",
    signIn: auth.signIn,
  }),
}));

const originalConfig = window.config;

afterEach(() => {
  window.config = originalConfig;
  vi.unstubAllGlobals();
});

function renderOverview({ signedIn = true }: { signedIn?: boolean } = {}) {
  auth.isSignedIn = signedIn;
  auth.isLoading = false;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/engineering"]}>
        <Routes>
          <Route element={<AuthGuard />}>
            <Route path="engineering" element={<EngineeringOverviewPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Engineering Overview", () => {
  it("says Engineering is not available when the preview switch is off", () => {
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_PREVIEW_FEATURES: {},
    } as Window["config"];

    renderOverview();

    expect(screen.getByText(/engineering isn't available yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Overview" })).not.toBeInTheDocument();
  });

  it("shows the API's release-download figures, the 30-day chart, and the top products", async () => {
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_PREVIEW_FEATURES: { engineering: true },
      ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL: "https://stats.example",
    } as Window["config"];

    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("https://stats.example/api/v1/stats/summary")) {
        return jsonResponse({
          trackedRepositories: 10,
          totalDownloads: 900,
          totalStars: 1,
          totalForks: 2,
          totalClonesLast30d: 3,
          totalClonesLast14d: 88,
          todayDownloads: 205,
          todayDeltaPct: 3,
          asOfDate: "2026-09-28",
          monthDownloads: 42,
          lastSyncDate: null,
          lastSyncStatus: null,
          topProducts: [
            {
              repoId: 1,
              repoName: "product-apim",
              productName: "API Manager",
              todayDownloads: 100,
              totalDownloads: 50,
              stars: 4,
            },
          ],
        });
      }
      if (url.startsWith("https://stats.example/api/v1/stats/daily")) {
        return jsonResponse({
          from: "2026-08-30",
          to: "2026-09-29",
          interval: "day",
          series: [
            {
              repoId: 1,
              repoName: "product-apim",
              points: [{ date: "2026-09-28", value: 40 }],
            },
          ],
        });
      }
      if (url.startsWith("https://stats.example/api/v1/repositories")) {
        return jsonResponse({
          count: 1,
          repositories: [
            {
              id: 1,
              orgName: "wso2",
              repoName: "product-apim",
              productName: "API Manager",
              assetPrefixes: [],
              isActive: true,
              trackPackages: false,
              createdAt: "2026-01-01T00:00:00Z",
              updatedAt: "2026-01-01T00:00:00Z",
              latestSnapshot: null,
            },
          ],
        });
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderOverview();

    expect(await screen.findByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByText("Yesterday's Downloads")).toBeInTheDocument();
    expect(screen.getByText("205")).toBeInTheDocument();
    expect(screen.getByText("3.0%")).toBeInTheDocument();
    expect(screen.getByText("This Month's Downloads")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Total Downloads")).toBeInTheDocument();
    expect(screen.getByText("900")).toBeInTheDocument();
    const productsTracked = screen.getByText("Products Tracked").parentElement;
    expect(productsTracked).not.toBeNull();
    expect(within(productsTracked as HTMLElement).getByText("10")).toBeInTheDocument();
    expect(screen.getByText("Clones (14d)")).toBeInTheDocument();
    expect(screen.getByText("88")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Daily Downloads (last 30 days)" })).toBeInTheDocument();
    expect(screen.getAllByText("API Manager").length).toBeGreaterThan(0);
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Top Products (Downloads)" })).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();

    const summaryCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).startsWith("https://stats.example/api/v1/stats/summary"),
    ) as [string, RequestInit] | undefined;
    expect(summaryCall?.[1]).toMatchObject({
      headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
    });
    const dailyCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes("/api/v1/stats/daily"),
    );
    expect(String(dailyCall?.[0])).toContain("interval=day");
  });

  it("keeps the minus sign when yesterday's downloads fell", async () => {
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_PREVIEW_FEATURES: { engineering: true },
      ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL: "https://stats.example",
    } as Window["config"];
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.includes("/stats/summary")) {
        return jsonResponse({
          trackedRepositories: 1,
          totalDownloads: 1,
          totalClonesLast14d: 1,
          todayDownloads: 10,
          todayDeltaPct: -3,
          monthDownloads: 1,
          topProducts: [],
        });
      }
      if (url.includes("/stats/daily")) return jsonResponse({ series: [] });
      return jsonResponse({ repositories: [] });
    });

    renderOverview();

    expect(await screen.findByText("-3.0%")).toBeInTheDocument();
  });

  it("draws the daily chart before repository labels arrive", async () => {
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_PREVIEW_FEATURES: { engineering: true },
      ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL: "https://stats.example",
    } as Window["config"];
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.includes("/stats/summary")) {
        return jsonResponse({
          trackedRepositories: 1,
          totalDownloads: 1,
          totalClonesLast14d: 1,
          todayDownloads: 10,
          todayDeltaPct: null,
          monthDownloads: 1,
          topProducts: [],
        });
      }
      if (url.includes("/stats/daily")) {
        return jsonResponse({
          series: [{ repoId: 1, repoName: "product-apim", points: [{ date: "2026-09-28", value: 40 }] }],
        });
      }
      return new Promise(() => {});
    });

    renderOverview();

    expect(await screen.findByText("40")).toBeInTheDocument();
    expect(screen.queryByText(/loading the daily chart/i)).not.toBeInTheDocument();
  });

  it("does not send the access token to an http address", () => {
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_PREVIEW_FEATURES: { engineering: true },
      ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL: "http://stats.example",
    } as Window["config"];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderOverview();

    expect(screen.getByText(/needs an https address/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Overview" })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows an http address on localhost", async () => {
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_PREVIEW_FEATURES: { engineering: true },
      ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL: "http://localhost:8080",
    } as Window["config"];
    const fetchMock = vi.fn<(url: string) => Promise<Response>>();
    fetchMock.mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);

    renderOverview();

    expect(await screen.findByText(/loading release downloads/i)).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/^http:\/\/localhost:8080\//);
  });

  it("allows an http address on IPv6 loopback", async () => {
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_PREVIEW_FEATURES: { engineering: true },
      ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL: "http://[::1]:8080",
    } as Window["config"];
    const fetchMock = vi.fn<(url: string) => Promise<Response>>();
    fetchMock.mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);

    renderOverview();

    expect(await screen.findByText(/loading release downloads/i)).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/^http:\/\/\[::1\]:8080\//);
  });

  it("says Product Download Stats is not connected when the API address is missing", () => {
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_PREVIEW_FEATURES: { engineering: true },
      ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL: "",
    } as Window["config"];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderOverview();

    expect(screen.getByText(/isn't connected yet/i)).toBeInTheDocument();
    expect(screen.getByText("ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Overview" })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stays on a loading state until the summary answers", async () => {
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_PREVIEW_FEATURES: { engineering: true },
      ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL: "https://stats.example",
    } as Window["config"];
    vi.stubGlobal("fetch", () => new Promise(() => {}));

    renderOverview();

    expect(await screen.findByText(/loading release downloads/i)).toBeInTheDocument();
    expect(screen.queryByText("205")).not.toBeInTheDocument();
  });

  it("shows an error the person can retry when the summary fails", async () => {
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_PREVIEW_FEATURES: { engineering: true },
      ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL: "https://stats.example",
    } as Window["config"];
    const fetchMock = vi.fn(async () => jsonResponse({ message: "no" }, 500));
    vi.stubGlobal("fetch", fetchMock);

    renderOverview();

    expect(await screen.findByText(/couldn't load release downloads/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(fetchMock.mock.calls.length).toBeGreaterThan(3);
  });

  it("sends someone who is not signed in to sign in before Overview loads", () => {
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_PREVIEW_FEATURES: { engineering: true },
      ONE_WSO2_DEV_BYPASS_AUTH: false,
    } as Window["config"];
    auth.signIn.mockClear();

    renderOverview({ signedIn: false });

    expect(auth.signIn).toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Overview" })).not.toBeInTheDocument();
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
