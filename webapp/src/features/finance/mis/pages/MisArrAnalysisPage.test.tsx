/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Vitest's 5s default is the wrong one for this file: every test mounts the
// whole screen, which is a real DataGrid under a panel of real Autocompletes,
// and in jsdom under the full suite's parallelism that legitimately runs past
// five seconds while taking well under one on its own. Nothing here waits on a
// timer or a network, so a timeout is always machine load rather than a hang.
vi.setConfig({ testTimeout: 20_000 });

// ARR Analysis's front door: a server-side flag on top of a privilege.
//
// The two refusals are deliberately DIFFERENT, and the difference is the whole
// design here:
//
//   the flag is off   the screen does not exist for anyone → REDIRECT to ARR
//                     Build, and no rail entry (misRail.test.tsx)
//   no privilege      the screen exists and this reader may not open it →
//                     a locked panel, like every other MIS URL
//
// A redirect asserts a fact about the app; a locked panel asserts one about the
// reader. Which means the two states where the flag is simply UNKNOWN — still
// in flight, or the call failed — can be neither. On a cold load a bookmarked
// link must not bounce before the answer arrives, and a gateway blip must not
// silently relocate someone with no explanation.

const state = {
  privileges: [] as number[],
  analysisEnabled: true,
  configsLoading: false,
  configsError: false,
};
const retryConfigs = vi.fn();

vi.mock("@config/apiConfig", () => ({
  isMisArrConfigured: () => true,
  misArrServiceUrls: {
    userInfo: "https://mis.example/user-info",
    appConfigs: "https://mis.example/app-configs",
    accounts: "https://mis.example/accounts",
    exitArrSearch: "https://mis.example/exit-arr/search",
  },
}));

// Mocked at the query hooks, not at the gate: what is under test is the
// screen's reading of both answers, so the gate itself stays real.
vi.mock("../api/useMisUserInfo", () => ({
  useMisUserInfo: () => ({
    data: { privileges: state.privileges },
    isPending: false,
    isError: false,
    error: null,
    refetch: () => {},
  }),
}));
vi.mock("../api/useMisAppConfigs", () => ({
  useMisAppConfigs: () => ({
    options: {
      salesRegions: [],
      subRegions: [],
      countries: [],
      billingCountries: [],
      industries: [],
      subIndustries: [],
      accountOwners: [],
      technicalOwners: [],
      channelManagers: [],
      businessUnits: [],
      productUnits: [],
    },
    // NOT `state.analysisEnabled` on its own. The real hook cannot report a
    // true flag while the call is in flight or after it failed — `analysisEnabled`
    // is false until the backend has actually said true — so a mock that let the
    // two disagree would describe a state production cannot reach, and the two
    // "unknown" cases below would pass for the wrong reason. (Found by deleting
    // the route's loading guard and watching this file stay green.)
    analysisEnabled: !state.configsLoading && !state.configsError && state.analysisEnabled,
    isLoading: state.configsLoading,
    isError: state.configsError,
    errorMessage: state.configsError ? "Gateway timed out." : "",
    retry: retryConfigs,
  }),
}));
// The table's own reads. Routing does not care what the book says, only that
// the table is the thing that rendered.
vi.mock("../api/useAnalysisAccounts", () => ({
  useAnalysisAccounts: () => ({
    rows: [],
    isLoading: false,
    isError: false,
    errorMessage: "",
    retry: () => {},
  }),
  useAnalysisHeadlineArr: () => ({
    arr: 0,
    isLoading: false,
    isError: false,
    errorMessage: "",
    retry: () => {},
  }),
}));
// The two breakdowns. Same reason as the table's reads: what is under
// test is the flag and the gate, not what the charts say.
vi.mock("../api/useAnalysisBreakdowns", () => ({
  useAnalysisPartnerModels: () => ({
    channel: 0,
    direct: 0,
    // Both models asked about — the shape the real hook always returns. A
    // `vi.mock` factory is untyped, so nothing but a test run catches a mock
    // that has fallen behind the interface it stands in for; this one did,
    // and threw inside `partnerModelSlices` rather than failing an assertion.
    asked: new Set(["Channel", "Direct"]),
    isLoading: false,
    isError: false,
    errorMessage: "",
    retry: () => {},
  }),
  useAnalysisIndustries: () => ({
    byIndustry: {},
    asked: new Set<string>(),
    isLoading: false,
    isError: false,
    errorMessage: "",
    retry: () => {},
  }),
}));

const { default: MisArrAnalysisPage } = await import("./MisArrAnalysisPage");
const { misPaths } = await import("@constants/misApps");

const ARR = 987;
// 789 arrives beside 987 from the ARR service and opens nothing here.
const NOT_ARR = 789;

/** The route under its real path, with somewhere for a redirect to land. */
function show() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[misPaths.analysis]}>
        <Routes>
          <Route path={misPaths.analysis} element={<MisArrAnalysisPage />} />
          <Route path={misPaths.arrBuild} element={<p>the ARR Build</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.privileges = [ARR];
  state.analysisEnabled = true;
  state.configsLoading = false;
  state.configsError = false;
  retryConfigs.mockClear();
});

describe("with the flag on", () => {
  it("opens for someone holding the ARR privilege", () => {
    show();
    expect(screen.getByRole("heading", { level: 1, name: "ARR Analysis" })).toBeInTheDocument();
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });

  // A locked panel, NOT a redirect. Typing a URL you may not use should say so;
  // a bookmarked link that silently lands somewhere else reads as the app being
  // broken.
  it("refuses someone without the ARR privilege, and says so where they are", () => {
    state.privileges = [NOT_ARR];
    show();
    expect(screen.queryByText("the ARR Build")).not.toBeInTheDocument();
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });
});

describe("with the flag off", () => {
  it("sends the reader to the ARR Build", () => {
    state.analysisEnabled = false;
    show();
    expect(screen.getByText("the ARR Build")).toBeInTheDocument();
  });

  // The flag is about the APP, not the reader — so it decides first. Someone
  // without the privilege gets the same redirect rather than a locked panel for
  // a screen that does not exist.
  it("sends someone without the privilege there too", () => {
    state.analysisEnabled = false;
    state.privileges = [];
    show();
    expect(screen.getByText("the ARR Build")).toBeInTheDocument();
  });
});

// The two states that are neither "on" nor "off".
describe("while the flag is unknown", () => {
  it("holds rather than redirecting, so a cold load does not bounce", () => {
    state.configsLoading = true;
    show();
    expect(screen.queryByText("the ARR Build")).not.toBeInTheDocument();
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "ARR Analysis" })).toBeInTheDocument();
  });

  it("says so with a retry when the call failed, rather than relocating anyone", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    state.configsError = true;
    show();
    expect(screen.queryByText("the ARR Build")).not.toBeInTheDocument();
    expect(screen.getByText(/Gateway timed out/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /retry/i }));
    expect(retryConfigs).toHaveBeenCalled();
  });
});
