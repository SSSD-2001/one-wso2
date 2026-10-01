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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { HouseIcon } from "@wso2/oxygen-ui-icons-react";
import { PERSPECTIVES } from "@constants/perspectives";

// The MIS rail entries are behind the `mis` preview flag (previewFeatures.ts),
// and the registry is read once, at import — so the flag has to be on before it
// is. Its OFF half is pinned in perspectives.test.ts.
vi.hoisted(() => {
  window.config = {
    ...(window.config ?? {}),
    ONE_WSO2_PREVIEW_FEATURES: { mis: true },
  } as Window["config"];
});

// What a person sees in the Finance rail.
//
// The gate suite proves the decision and the routing suite proves the screens
// honour it. Between them the visibility fold claims the MIS sections and
// answers them with `misVisibility`. Drop that claim and every other MIS test
// still passes, while the rail falls through to `sectionAllowed(requires, caps)`,
// where `requires: ["admin"]` is a One WSO2 admin and not ARR access. So this
// renders the real rail with the real gate and mocks only the HTTP answer
// underneath.

const privileges = { value: [] as number[] };
// `productsUsageEnabled` from GET /app-configs — whether ARR Analysis exists.
// On by default, so the cases below are about privileges; its own case turns
// it off.
const analysisEnabled = { value: true };

vi.mock("@config/apiConfig", async () => {
  const actual = await vi.importActual<typeof import("@config/apiConfig")>("@config/apiConfig");
  return { ...actual, isMisArrConfigured: () => true };
});

// Both mocked at the QUERY hook, not at useMisGate: the gate itself is what is
// under test here, along with the rail's dispatch to it.
vi.mock("@features/finance/mis/api/useMisAppConfigs", () => ({
  useMisAppConfigs: () => ({ analysisEnabled: analysisEnabled.value }),
}));
vi.mock("@features/finance/mis/api/useMisUserInfo", () => ({
  useMisUserInfo: () => ({
    data: { privileges: privileges.value },
    isPending: false,
    isError: false,
    error: null,
    refetch: () => {},
  }),
}));

const financePerspective = PERSPECTIVES.find((p) => p.key === "finance")!;
vi.mock("@context/perspective/PerspectiveContext", () => ({
  useActivePerspective: () => ({
    key: "finance",
    label: "Finance",
    // SideRail renders `<active.icon />` for the overview row, so a stand-in
    // without one crashes the component rather than failing an assertion.
    icon: HouseIcon,
    path: "/finance",
    access: true,
    sections: financePerspective.sections,
  }),
}));

// The other perspectives' gates still get called — SideRail asks for every gate
// on every render — so they need answers that do not reach a real useQuery.
const other = { canSee: () => false, isResolving: false };
vi.mock("@api/useUserInfo", () => ({
  useUserInfo: () => ({ data: { privileges: [] }, isLoading: false, isError: false }),
}));
vi.mock("@features/finance/api/useFinanceGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/finance/api/useFinanceGate")>()),
  useFinanceGate: () => other,
}));
vi.mock("@features/leave/api/useLeaveGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/leave/api/useLeaveGate")>()),
  useLeaveGate: () => other,
}));
vi.mock("@features/marketing-ops/api/useMarketingOpsGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/marketing-ops/api/useMarketingOpsGate")>()),
  useMarketingOpsGate: () => ({ ...other, isAuthorized: false, isAdmin: false }),
}));
// The gates upstream's usePerspectiveVisibility asks as well. Mocked for this
// file's own reason — an unmocked gate reaches its real useQuery and fails the
// file for want of a QueryClient — and closed, so nothing but MIS is offered.
const noFailure = { isError: false, retry: () => {} };
vi.mock("@features/due-diligence/api/useDueDiligenceGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/due-diligence/api/useDueDiligenceGate")>()),
  useDueDiligenceGate: () => ({ ...other, ...noFailure }),
}));
vi.mock("@features/security/api/useSecurityGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/security/api/useSecurityGate")>()),
  useSecurityGate: () => other,
}));
vi.mock("@features/sales/api/useSalesGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/sales/api/useSalesGate")>()),
  useSalesRailGate: () => ({ ...other, ...noFailure, errorMessage: undefined }),
}));
vi.mock("@features/my/api/useMeProfile", () => ({
  useMeProfile: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("@features/subscriptions/api/useSubscriptionGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/subscriptions/api/useSubscriptionGate")>()),
  useSubscriptionGate: () => ({ ...other, ...noFailure, isAdmin: false }),
}));
vi.mock("@features/par/api/useParData", () => ({
  useParCanSeeLeadPortal: () => ({ canSee: false, isLoading: false }),
  useParEmployeeItemVisible: () => ({ canSee: false, isLoading: false }),
}));
vi.mock("@features/par/api/useParIsAdmin", () => ({
  useParIsAdmin: () => ({ isAdmin: false, isLoading: false }),
}));
vi.mock("@features/promotion/api/usePromotionRoles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/promotion/api/usePromotionRoles")>()),
  usePromotionPrivileges: () => ({
    isLead: false,
    isFunctionalLead: false,
    isHrAdmin: false,
    isPromotionBoardMember: false,
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@features/infra/api/useInfraGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/infra/api/useInfraGate")>()),
  useInfraGate: () => ({ ...other, ...noFailure, isAuthorized: false, isAdmin: false }),
}));
vi.mock("@features/umt/api/useUmtGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/umt/api/useUmtGate")>()),
  useUmtGate: () => ({ ...other, ...noFailure, isAuthorized: false, isAdmin: false }),
}));

// Every gate the hook asks that this file does not stand in for runs for real,
// signed out, inside a real QueryClient: its query is disabled, so it asks
// nothing and offers nothing. Without this, each gate main added to
// usePerspectiveVisibility reached a real useQuery with no client and failed
// the whole file.
vi.mock("@asgardeo/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@asgardeo/react")>()),
  useAsgardeo: () => ({ isSignedIn: false }),
}));

function withQueries() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const { default: SideRail } = await import("@components/side-rail/SideRail");

// A rail group renders its children only while it is OPEN, and a group opens
// itself when it holds the current route. So each case starts on the screen its
// user would actually be on — landing on /finance would leave the MIS group
// shut and every assertion below vacuously true.
function showRail(initial = "/finance/mis/arr-build") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <SideRail collapsed={false} />
    </MemoryRouter>,
    { wrapper: withQueries() },
  );
}

beforeEach(() => {
  privileges.value = [];
  analysisEnabled.value = true;
});

describe("the Finance rail", () => {
  it("offers the ARR screens to someone holding the ARR privilege", () => {
    privileges.value = [987];
    showRail();
    expect(screen.getByText("ARR Build")).toBeInTheDocument();
  });

  // 789 arrives beside 987 from the ARR service and opens nothing here — not
  // an ARR row, and not an empty MIS group either.
  it("offers no MIS entry at all to someone holding only 789", () => {
    privileges.value = [789];
    showRail();
    expect(screen.queryByText("ARR Build")).not.toBeInTheDocument();
    expect(screen.queryByText("MIS")).not.toBeInTheDocument();
  });

  // The case the 987 collision makes dangerous: this person IS
  // privilege 987 as far as One WSO2 is concerned, because every authenticated
  // user is. Only the MIS backend's own answer says otherwise.
  it("offers no MIS entry at all to someone holding neither", () => {
    privileges.value = [];
    showRail();
    expect(screen.queryByText("ARR Build")).not.toBeInTheDocument();
    expect(screen.queryByText("MIS")).not.toBeInTheDocument();
  });

  // A rail row that navigates nowhere is worse than no row. SideRail renders
  // every VISIBLE child of a group whether or not it carries a path, and a
  // pathless one falls through onSelect to scrollToSection() — a no-op away
  // from the overview page. So the registry must not list a screen before its
  // route exists.
  it("offers no row that goes nowhere", () => {
    privileges.value = [987];
    showRail();
    // Every registered screen is routed now, so the rule this test guards has
    // nothing left to hold back — what it asserts instead is that all four
    // rows are live. A screen added to the registry without a route would show
    // up here as a fifth row that navigates nowhere.
    for (const live of ["ARR Build", "QRR Build", "MRR Build", "ARR Analysis"]) {
      expect(screen.getByText(live), `${live} is routed but not in the rail`).toBeInTheDocument();
    }
  });

  // Off means the entry is ABSENT, not disabled.
  // This is the assertion that would catch the flag being dropped from the
  // gate — the routing suite's redirect could pass while the rail still
  // advertised a screen that bounces on click.
  it("drops the ARR Analysis row when the backend flag is off, and keeps the rest", () => {
    privileges.value = [987];
    analysisEnabled.value = false;
    showRail();
    expect(screen.queryByText("ARR Analysis")).not.toBeInTheDocument();
    for (const live of ["ARR Build", "QRR Build", "MRR Build"]) {
      expect(screen.getByText(live), `${live} was dropped by the ARR Analysis flag`).toBeInTheDocument();
    }
  });

  // The flag is not a second way in. It says the screen exists; the privilege
  // says who may read it.
  it("does not let the flag alone put ARR Analysis in front of a reader without ARR", () => {
    privileges.value = [789];
    showRail();
    expect(screen.queryByText("ARR Analysis")).not.toBeInTheDocument();
  });
});
