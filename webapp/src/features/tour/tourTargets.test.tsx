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

/**
 * Every step's selector, resolved against the components that actually render.
 *
 * This exists because the first attempt marked `Sidebar.Nav` and `Sidebar.Item`
 * with `data-tour` and neither reached the DOM — Oxygen drops unknown props, so
 * both markers vanished silently and those steps would have been skipped forever
 * with nothing anywhere to show it.
 *
 * The selectors are read FROM `TOUR_STEPS` rather than restated here, and the
 * rail is the real `SideRail`, not a stand-in. A first version of this file did
 * neither and passed happily while the step selector was broken and the marker
 * deleted — a test that renders its own copy of the thing it is checking proves
 * only that the copy works.
 */
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { TOUR_STEPS } from "./tourSteps";
import SideRail from "@components/side-rail/SideRail";
import { HouseIcon } from "@wso2/oxygen-ui-icons-react";

vi.mock("@features/infra/api/useInfraGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/infra/api/useInfraGate")>()),
  useInfraGate: () => ({ ...gate, isAuthorized: true, isAdmin: true }),
}));
vi.mock("@context/perspective/PerspectiveContext", () => ({
  useActivePerspective: () => ({
    key: "me",
    label: "Me",
    // SideRail renders `<active.icon />` for the overview row, so a stand-in
    // without one crashes the component rather than failing an assertion.
    icon: HouseIcon,
    path: "/me",
    access: true,
    sections: [],
  }),
}));
vi.mock("@api/useUserInfo", () => ({
  useUserInfo: () => ({ data: { privileges: [] }, isLoading: false, isError: false }),
}));
const gate = { canSee: () => true, isResolving: false };
vi.mock("@features/finance/api/useFinanceGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/finance/api/useFinanceGate")>()),
  useFinanceGate: () => gate,
}));
vi.mock("@features/leave/api/useLeaveGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/leave/api/useLeaveGate")>()),
  useLeaveGate: () => gate,
}));
vi.mock("@features/marketing-ops/api/useMarketingOpsGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/marketing-ops/api/useMarketingOpsGate")>()),
  useMarketingOpsGate: () => ({ ...gate, isAuthorized: true, isAdmin: true }),
}));
// Mocked for the same reason as the three above — SideRail asks every gate on
// every render — and for one extra: this gate reaches Asgardeo's SDK to read
// the id_token's `groups` claim, which does not resolve under the test runner.
vi.mock("@features/subscriptions/api/useSubscriptionGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/subscriptions/api/useSubscriptionGate")>()),
  useSubscriptionGate: () => ({ ...gate, isAdmin: true, isCommuteAdmin: true, isLunchAdmin: true }),
}));
// The visibility fold reads `*Visibility` off the same module as the hook.
// Replacing the module outright drops that export, and the Me rail asks
// finance, leave, banking and subscriptions. Spread the real module and
// override only the hook.
vi.mock("@features/my/api/useBankingAccess", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/my/api/useBankingAccess")>()),
  useBankingAccess: () => ({ canSee: true, isResolving: false, isError: false, retry: () => {} }),
}));
vi.mock("@features/my/api/useBankingAdminAccess", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/my/api/useBankingAdminAccess")>()),
  useBankingAdminAccess: () => ({ canSee: false, isResolving: false, isError: false, retry: () => {} }),
}));
vi.mock("@features/finance/mis/api/useMisGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/finance/mis/api/useMisGate")>()),
  useMisGate: () => ({ ...gate, isError: false, retry: () => {} }),
}));

/** The selector a named step carries, so a rename fails here rather than silently. */
function selectorFor(fragment: string): string {
  const step = TOUR_STEPS.find((s) => s.title.includes(fragment));
  if (!step?.selector) throw new Error(`no step with a selector matching "${fragment}"`);
  return step.selector;
}

describe("tour selectors against the real rail", () => {
  function renderRail() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/me"]}>
          <SideRail collapsed={false} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it("finds the rail", () => {
    const { container } = renderRail();
    expect(
      container.querySelector(selectorFor("Moving around")),
      "the rail step no longer matches SideRail's markup",
    ).not.toBeNull();
  });

  it("finds the Settings row", () => {
    const { container } = renderRail();
    expect(
      container.querySelector(selectorFor("Choose where you start")),
      "the Settings marker is missing from SideRail",
    ).not.toBeNull();
  });

  it("gives every step copy, and every selector some content", () => {
    for (const step of TOUR_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body.length, `${step.title}: empty body`).toBeGreaterThan(0);
      if (step.selector !== undefined) {
        expect(step.selector.length, `${step.title}: empty selector`).toBeGreaterThan(0);
      }
    }
  });
});
