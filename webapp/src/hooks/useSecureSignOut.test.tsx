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
import { DEFAULT_REPOSITORY_ACCESS_PENDING_KEY } from "@features/infra/github/githubOAuth";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const signOut = vi.fn();
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ signOut }) }));

const forgetResolvedSubOnSignOut = vi.fn();
vi.mock("@hooks/useAsgardeoSub", () => ({ forgetResolvedSubOnSignOut }));

const { useSecureSignOut } = await import("./useSecureSignOut");

// This is the whole fix: `useSecureSignOut` is every production path out of a
// session (UserProfileMenu, SessionExpiryWatcher, IdleTimeoutProvider,
// AccessDenied all call it, never Asgardeo's own `signOut` directly), so it
// is the one place a clear is guaranteed to run — unlike `useAsgardeoSub`'s
// own effect, which only fires for an instance still mounted to observe
// `isSignedIn` going false, and `AuthGuard` unmounts every one of them before
// any can. Asserted here as "was this called", not re-testing what it does —
// that contract belongs to useAsgardeoSub.test.tsx.
describe("useSecureSignOut", () => {
  it("drops the shared identity alongside clearing the query cache", () => {
    const qc = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    sessionStorage.setItem(DEFAULT_REPOSITORY_ACCESS_PENDING_KEY, "{\"sub\":\"previous-user\"}");
    const { result } = renderHook(() => useSecureSignOut(), { wrapper });
    result.current();

    expect(forgetResolvedSubOnSignOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(DEFAULT_REPOSITORY_ACCESS_PENDING_KEY)).toBeNull();
  });
});
