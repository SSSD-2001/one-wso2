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

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSubscriptionGate } from "./useSubscriptionGate";

const meta = {
  data: undefined as { commuteAdminGroup?: string; lunchAdminGroup?: string; excludedGroups?: string[] } | undefined,
  isError: false,
  isPending: false,
  error: undefined as unknown,
};

const identity = {
  groups: [] as string[],
  error: undefined as string | undefined,
  ready: true,
  retry: vi.fn(),
};

vi.mock("./useSubscriptionData", () => ({
  useSubscriptionsMetaInfo: () => meta,
}));

vi.mock("@hooks/useAsgardeoGroups", async () => {
  const actual = await vi.importActual<typeof import("@hooks/useAsgardeoGroups")>("@hooks/useAsgardeoGroups");
  return {
    ...actual,
    useAsgardeoGroups: () => identity,
  };
});

beforeEach(() => {
  meta.data = undefined;
  meta.isError = false;
  meta.isPending = false;
  meta.error = undefined;
  identity.groups = [];
  identity.error = "could not decode the token";
  identity.ready = true;
});

describe("useSubscriptionGate", () => {
  it("does not report an identity error while the gate is disabled", () => {
    const disabled = renderHook(() => useSubscriptionGate(false));
    expect(disabled.result.current.isError).toBe(false);
    expect(disabled.result.current.errorMessage).toBeUndefined();

    const enabled = renderHook(() => useSubscriptionGate(true));
    expect(enabled.result.current.isError).toBe(true);
    expect(enabled.result.current.errorMessage).toBe("could not decode the token");
  });
});
