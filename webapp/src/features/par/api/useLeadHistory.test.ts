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

// Captures the queries useParRatingFanOut builds, so tests can invoke a
// query's own queryFn directly and assert on the real 404/error handling
// it implements — a canned useQueries mock would only prove the plumbing,
// not this logic.
let capturedQueries: Array<{ queryFn: () => Promise<unknown> }> = [];
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isLoading: false, isError: false }),
  useQueries: ({ queries }: { queries: Array<{ queryFn: () => Promise<unknown> }> }) => {
    capturedQueries = queries;
    return queries.map(() => ({ data: undefined, isLoading: true, isError: false, refetch: () => {} }));
  },
}));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@api/http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@api/http")>();
  return { ...actual, authedGet: vi.fn() };
});

const { authedGet, HttpError } = await import("@api/http");
const { useParRatingFanOut } = await import("./useLeadHistory");

describe("useParRatingFanOut", () => {
  it("maps a 404 to null — no rating record yet, not an error", async () => {
    vi.mocked(authedGet).mockRejectedValueOnce(new HttpError("url", 404, ""));
    renderHook(() => useParRatingFanOut(1, ["jane@example.com"]));
    await expect(capturedQueries[0].queryFn()).resolves.toBeNull();
  });

  it("rethrows a non-404 error rather than mapping it to null", async () => {
    vi.mocked(authedGet).mockRejectedValueOnce(new HttpError("url", 403, ""));
    renderHook(() => useParRatingFanOut(1, ["jane@example.com"]));
    await expect(capturedQueries[0].queryFn()).rejects.toThrow();
  });

  it("returns the rating record on success", async () => {
    const record = { parRatingId: 1, parCycleId: 1, parEmployeeEmail: "jane@example.com" };
    vi.mocked(authedGet).mockResolvedValueOnce(record);
    renderHook(() => useParRatingFanOut(1, ["jane@example.com"]));
    await expect(capturedQueries[0].queryFn()).resolves.toEqual(record);
  });
});
