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

// Vitest's 5s default is the wrong one for this file: each test mounts a whole
// MIS screen, and under the full suite's parallelism that runs past five
// seconds while taking a fraction of one on its own. It began timing out when
// more component-heavy files joined the same run — the load changed, not this
// file. Same line as the other screen-mounting suites here.
vi.setConfig({ testTimeout: 20_000 });

// What a person actually sees at a MIS URL they are and are not entitled to.
//
// Two populations: the ARR privilege, and not. (789 arrives beside 987 and
// opens nothing here; the gate suite pins that.) The gate suite proves the
// decision; this proves the decision reaches the screen.
//
// Typing a URL you cannot use gives a locked panel, NOT a redirect. A redirect
// would bounce the reader somewhere without saying why, and a bookmarked link
// that silently lands elsewhere reads as the app being broken.

const state = {
  allow: new Set<string>(),
  isResolving: false,
};

vi.mock("@config/apiConfig", () => ({
  isMisArrConfigured: () => true,
  // The screens under test render their grids, and every grid reads a URL off
  // this. Nothing here is fetched — the hooks are mocked below — so the values
  // only have to exist and be distinct.
  misArrServiceUrls: {
    userInfo: "https://mis.example/user-info",
    appConfigs: "https://mis.example/app-configs",
    arrSummary: "https://mis.example/arr-summary",
    accounts: "https://mis.example/accounts",
    drillDownCustomers: "https://mis.example/arr-summary/customers",
    regionExit: "https://mis.example/arr-summary/region-exit",
    buExit: "https://mis.example/arr-summary/bu-exit",
    regionMetrics: "https://mis.example/arr-summary/region-metrics",
  },
}));

vi.mock("../api/useMisGate", () => ({
  useMisGate: () => ({
    canSee: (id: string) => state.allow.has(id),
    isResolving: state.isResolving,
    isError: false,
    retry: () => {},
  }),
}));

// The ARR page reads /user-info directly for its privilege readout. Mocked at
// the hook rather than at the HTTP layer because what is under test here is
// routing and access, not the wire format.
vi.mock("../api/useMisUserInfo", () => ({
  useMisUserInfo: () => ({ data: { privileges: [987] } }),
}));

// Same reason, one layer along: the ARR Build's figures come through
// useArrSummary, which reaches @asgardeo/react for a token. Routing does not
// care what the Build says, only that it is the thing that rendered.
vi.mock("../api/useArrSummary", () => ({
  useArrSummary: () => ({
    columns: [],
    isLoading: false,
    isError: false,
    errorMessage: "",
    retry: () => {},
  }),
}));

// And once more for the filter bar's menus, which reach the same place. Routing
// cares that the Build rendered, not what its Industry list offers.
vi.mock("../api/useMisAppConfigs", () => ({
  useMisAppConfigs: () => ({
    options: {
      salesRegions: [],
      subRegions: [],
      countries: [],
      industries: [],
      subIndustries: [],
      accountOwners: [],
      technicalOwners: [],
      channelManagers: [],
      businessUnits: [],
      productUnits: [],
    },
    isLoading: false,
    isError: false,
    errorMessage: "",
    retry: () => {},
  }),
}));

const { default: MisArrBuildPage } = await import("./MisArrBuildPage");
const { default: MisSession } = await import("../components/MisSession");
const { MIS_PERIODS } = await import("../util/misViewVocabulary");

// The `MisSession` layout route wraps these exactly as `App.tsx` does. It is
// not scaffolding: the session Years Back lives in it and has to OUTLIVE the
// screen reading it, so a route tree here that skipped it would pass while the
// real one threw. Every MIS route belongs inside it for that reason.
function show(initial: string) {
  // The screens reach for React Query whatever the gate decides, so the
  // provider wraps every case here — including the locked ones, where the
  // point is that no query is ever ISSUED, not that none could be.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route element={<MisSession />}>
            <Route
              path="/finance/mis/arr-build"
              element={<MisArrBuildPage period={MIS_PERIODS.ANNUALLY} />}
            />
            <Route
              path="/finance/mis/qrr-build"
              element={<MisArrBuildPage period={MIS_PERIODS.QUARTERLY} />}
            />
            <Route
              path="/finance/mis/mrr-build"
              element={<MisArrBuildPage period={MIS_PERIODS.MONTHLY} />}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.allow = new Set();
  state.isResolving = false;
});

describe("someone holding the ARR privilege", () => {
  beforeEach(() => {
    state.allow = new Set(["mis-arr-build", "mis-qrr-build", "mis-mrr-build", "mis-analysis"]);
  });

  it("gets ARR Build", () => {
    show("/finance/mis/arr-build");
    expect(screen.getByRole("heading", { name: "ARR Build" })).toBeInTheDocument();
  });
});

// Being signed in is not a MIS privilege — which is precisely what 987
// means everywhere else in this app, and why this is the case that would
// regress silently.
describe("someone without the ARR privilege", () => {
  it("is refused, and told they have no MIS access at all", () => {
    show("/finance/mis/arr-build");
    expect(screen.getByText(/don't have access to finance mis/i)).toBeInTheDocument();
  });
});

describe("while the privilege check is still in flight", () => {
  it("shows neither the screen nor a denial", () => {
    state.isResolving = true;
    show("/finance/mis/arr-build");
    expect(screen.getByText(/checking your mis access/i)).toBeInTheDocument();
    expect(screen.queryByText(/don't have access/i)).not.toBeInTheDocument();
  });
});

describe("the browser tab", () => {
  it("is named after the screen, not just the app", () => {
    state.allow = new Set(["mis-arr-build"]);
    show("/finance/mis/arr-build");
    expect(document.title).toBe("ARR Build · One WSO2");
  });
});
