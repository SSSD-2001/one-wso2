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
import { renderHook } from "@testing-library/react";

// Both flags, as React Query reports them: a query that is fetching is pending
// AND loading; a DISABLED query is pending but not loading, because it never
// fetches. The gate has to read the second one, or a caller that switched it
// off would be told forever that it is mid-flight.
const userInfo: { data?: unknown; isPending?: boolean; isLoading?: boolean } = {};
const backend = { configured: true };

vi.mock("./useInfraUserInfo", () => ({
  useInfraUserInfo: () => userInfo,
  isInfraBackendConfigured: () => backend.configured,
}));

const { useInfraGate } = await import("./useInfraGate");
const { INFRA_PRIVILEGE } = await import("./infraTypes");

function gateFor(data: unknown) {
  userInfo.data = data;
  userInfo.isPending = false;
  userInfo.isLoading = false;
  return renderHook(() => useInfraGate()).result.current;
}

const P = INFRA_PRIVILEGE;

const EMPLOYEE_ITEMS = [
  "infra-github-connection",
  "infra-github-my-requests",
] as const;

function expectEmployeeScreens(gate: ReturnType<typeof useInfraGate>, visible: boolean) {
  for (const id of EMPLOYEE_ITEMS) {
    expect(gate.canSee(id), id).toBe(visible);
  }
}

describe("who can see Review", () => {
  it("an approver can", () => {
    expect(gateFor({ privileges: [P.APPROVER] }).canSee("infra-github-review-requests")).toBe(true);
  });
  it("an admin can", () => {
    expect(gateFor({ privileges: [P.ADMIN] }).canSee("infra-github-review-requests")).toBe(true);
  });
  it("an employee cannot — Review is not tied to 987", () => {
    expect(gateFor({ privileges: [P.EMPLOYEE] }).canSee("infra-github-review-requests")).toBe(false);
  });
});

describe("who can see Settings", () => {
  it("an admin can", () => {
    expect(gateFor({ privileges: [P.ADMIN] }).canSee("infra-github-settings")).toBe(true);
  });
  it("an approver cannot", () => {
    expect(gateFor({ privileges: [P.APPROVER] }).canSee("infra-github-settings")).toBe(false);
  });
  it("an employee cannot", () => {
    expect(gateFor({ privileges: [P.EMPLOYEE] }).canSee("infra-github-settings")).toBe(false);
  });
});

describe("who can file and track requests", () => {
  it("an employee can", () => {
    expectEmployeeScreens(gateFor({ privileges: [P.EMPLOYEE] }), true);
  });
  it("an approver-only account cannot", () => {
    expectEmployeeScreens(gateFor({ privileges: [P.APPROVER] }), false);
  });
  it("an admin who also holds employee can", () => {
    const gate = gateFor({ privileges: [P.ADMIN, P.EMPLOYEE] });
    expectEmployeeScreens(gate, true);
    expect(gate.canSee("infra-github-review-requests")).toBe(true);
    expect(gate.canSee("infra-github-settings")).toBe(true);
  });
});

describe("someone in no infra group", () => {
  it("sees nothing", () => {
    const gate = gateFor({ privileges: [] });
    expect(gate.isAuthorized).toBe(false);
    expect(gate.canSee("infra-github-review-requests")).toBe(false);
    expectEmployeeScreens(gate, false);
  });
});

describe("an unknown item", () => {
  it("fails closed when it is restricted in the registry", () => {
    expect(gateFor({ privileges: [P.EMPLOYEE] }).canSee("infra-github-settings")).toBe(false);
  });
  it("is open when it declares no restriction and the caller is authorized", () => {
    expect(gateFor({ privileges: [P.EMPLOYEE] }).canSee("infra-something-new")).toBe(true);
  });
});

describe("before /user-info has answered", () => {
  it("reports that it is still resolving, and grants nothing", () => {
    userInfo.data = undefined;
    userInfo.isPending = true;
    userInfo.isLoading = true;
    const gate = renderHook(() => useInfraGate()).result.current;
    expect(gate.isResolving).toBe(true);
    expect(gate.canSee("infra-github-review-requests")).toBe(false);
    expect(gate.isAuthorized).toBe(false);
  });
});

describe("when the caller switches the gate off", () => {
  it("is not reported as resolving", () => {
    userInfo.data = undefined;
    userInfo.isPending = true;
    userInfo.isLoading = false;
    const gate = renderHook(() => useInfraGate(false)).result.current;
    expect(gate.isResolving).toBe(false);
  });
});

describe("while identity is still resolving", () => {
  it("reports itself as still resolving, not as a finished denial", () => {
    userInfo.data = undefined;
    userInfo.isPending = true;
    userInfo.isLoading = false;
    const gate = renderHook(() => useInfraGate()).result.current;
    expect(gate.isResolving).toBe(true);
    expect(gate.canSee("infra-github-review-requests")).toBe(false);
  });

  it("is inert when the Infra backend is unconfigured", () => {
    backend.configured = false;
    userInfo.data = undefined;
    userInfo.isPending = true;
  
    const gate = renderHook(() => useInfraGate()).result.current;
  
    expect(gate.isResolving).toBe(false);
    expect(gate.isForbidden).toBe(false);
    expect(gate.isError).toBe(false);
    expect(gate.errorMessage).toBeUndefined();
  
    backend.configured = true;
  });
});