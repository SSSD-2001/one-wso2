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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";

// Mocked at the query layer rather than at useParIsAdmin, so the real gate
// formula (useParEmployeeInfo's `isAdmin` field, off the self-lookup
// useMeProfile resolves) is what runs here.
const profileQuery: {
  isLoading: boolean;
  isError: boolean;
  data?: { userInfo: { workEmail: string } };
  refetch: () => void;
} = {
  isLoading: false,
  isError: false,
  data: { userInfo: { workEmail: "someone@wso2.com" } },
  refetch: () => {},
};
const adminQuery: {
  isLoading: boolean;
  isError: boolean;
  data?: { isAdmin: boolean };
  refetch: () => void;
} = {
  isLoading: false,
  isError: false,
  refetch: () => {},
};

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    if (queryKey[0] === "me-profile") return profileQuery;
    if (queryKey[0] === "par-employee-info") return adminQuery;
    return { data: undefined, isLoading: false, isError: false, refetch: () => {} };
  },
  useQueryClient: () => ({}),
}));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true, getDecodedIdToken: async () => ({}) }) }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "someone@wso2.com" }, retry: () => {} }),
  foldIdentityError: (query: unknown) => query,
}));

vi.mock("../components/ParShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const { default: ParAdminGroupPage, ParAdminGroupIndex, ParRequiresAdminRoute } = await import(
  "./ParAdminGroupPage"
);

/** Always mounted, so a redirect is visible even when the route renders nothing. */
function UrlProbe() {
  const { pathname } = useLocation();
  return <div data-testid="url">{pathname}</div>;
}

function Tab({ name }: { name: string }) {
  return <div data-testid="tab-body">{name}</div>;
}

beforeEach(() => {
  profileQuery.isLoading = false;
  profileQuery.isError = false;
  profileQuery.data = { userInfo: { workEmail: "someone@wso2.com" } };
  adminQuery.isLoading = false;
  adminQuery.isError = false;
  adminQuery.data = undefined;
});

function isAdmin(value: boolean) {
  adminQuery.data = { isAdmin: value };
}

/** The group, wired the way App.tsx wires it. */
function show(initial = "/people-ops/performance/admin") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <UrlProbe />
      <Routes>
        <Route path="/me/performance" element={<div data-testid="employee-portal" />} />
        <Route
          path="/people-ops/performance/admin"
          element={
            <ParRequiresAdminRoute>
              <ParAdminGroupPage />
            </ParRequiresAdminRoute>
          }
        >
          <Route index element={<ParAdminGroupIndex />} />
          <Route path="ongoing" element={<Tab name="Ongoing" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("a PAR admin", () => {
  beforeEach(() => isAdmin(true));

  it("sees the Ongoing tab", async () => {
    show();
    expect(await screen.findByRole("tab", { name: "Ongoing" })).toBeInTheDocument();
  });

  it("lands on Ongoing, so the group URL is never blank", async () => {
    show();
    expect(await screen.findByTestId("url")).toHaveTextContent("/people-ops/performance/admin/ongoing");
  });
});

describe("someone who isn't a PAR admin", () => {
  beforeEach(() => isAdmin(false));

  it("is redirected to the Employee Portal", async () => {
    show();
    expect(await screen.findByTestId("url")).toHaveTextContent("/me/performance");
    expect(screen.queryByTestId("tab-body")).not.toBeInTheDocument();
  });

  it("is redirected away even when deep-linking straight to a tab", async () => {
    show("/people-ops/performance/admin/ongoing");
    expect(await screen.findByTestId("url")).toHaveTextContent("/me/performance");
  });
});

describe("before the admin lookup has answered", () => {
  it("renders nothing rather than a flash of the portal", async () => {
    adminQuery.isLoading = true;
    show();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByTestId("employee-portal")).not.toBeInTheDocument();
  });
});

describe("when the admin lookup fails", () => {
  it("shows a retry notice rather than silently denying access", async () => {
    adminQuery.isError = true;
    show();
    expect(await screen.findByText(/Couldn't check whether you're a PAR admin/)).toBeInTheDocument();
  });
});
