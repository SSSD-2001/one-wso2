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
import { fireEvent, render, screen, within } from "@testing-library/react";

const profile = { data: { userInfo: { workEmail: "lead@example.com" } }, isLoading: false };

const employees: { isSuccess: boolean; isLoading: boolean; isError: boolean; data?: unknown[] } = {
  isSuccess: false,
  isLoading: false,
  isError: false,
};

const realCycles: { isSuccess: boolean; isLoading: boolean; isError: boolean; data?: unknown[] } = {
  isSuccess: false,
  isLoading: false,
  isError: false,
};

const thumbnails: { data?: unknown[] } = { data: [] };

// Per-email fan-out results, keyed the same way useParLegacyHistoryFanOut /
// useParRatingFanOut key their own useQueries entries.
const legacyByEmail: Record<string, { data?: unknown[]; isLoading: boolean }> = {};
const ratingFanOutByEmail: Record<string, { data?: unknown; isLoading: boolean; isError: boolean }> = {};

// The selected employee's own useParRating/useParEmployeeReviews — only
// relevant once a real cycle + employee are both chosen.
const singleRating: { isSuccess: boolean; isLoading: boolean; isError: boolean; data?: unknown } = {
  isSuccess: false,
  isLoading: false,
  isError: false,
};
const reviews: { isSuccess: boolean; isLoading: boolean; isError: boolean; data?: unknown[] } = {
  isSuccess: false,
  isLoading: false,
  isError: false,
};

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    if (queryKey[0] === "par-lead-employees") return employees;
    if (queryKey[0] === "par-all-closed-cycles") return realCycles;
    if (queryKey[0] === "leave-employees") return thumbnails;
    if (queryKey[0] === "par-rating") return singleRating;
    if (queryKey[0] === "par-employee-reviews") return reviews;
    return { data: undefined, isLoading: false, isError: false };
  },
  useQueries: ({ queries }: { queries: Array<{ queryKey: unknown[] }> }) =>
    queries.map((q) => {
      if (q.queryKey[0] === "par-legacy-history") {
        const email = q.queryKey[1] as string;
        return { ...(legacyByEmail[email] ?? { data: undefined, isLoading: false }), isError: false, refetch: () => {} };
      }
      if (q.queryKey[0] === "par-rating") {
        const email = q.queryKey[2] as string;
        return { ...(ratingFanOutByEmail[email] ?? { data: undefined, isLoading: false, isError: false }), refetch: () => {} };
      }
      return { data: undefined, isLoading: false, isError: false, refetch: () => {} };
    }),
}));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@features/my/api/useMeProfile", () => ({ useMeProfile: () => profile }));

const { default: ParLeadEmployeeHistoryTab } = await import("./ParLeadEmployeeHistoryTab");
const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");

function show() {
  return render(
    <NotificationsProvider>
      <ParLeadEmployeeHistoryTab />
    </NotificationsProvider>,
  );
}

function realCycle(overrides: Record<string, unknown> = {}) {
  return {
    parCycleId: 1,
    parCycleName: "2026 H1",
    parCycleStartDate: "2026-01-01",
    parCycleEndDate: "2026-06-30",
    parEvaluationStartDate: "2026-01-01",
    parEvaluationEndDate: "2026-06-30",
    parEmployeeDeadline: "2026-02-01",
    parThreeSixtyRatingDeadline: "2026-03-01",
    parLeadDeadline: "2026-04-01",
    parF2FDeadline: "2026-05-01",
    parCycleConfigurations: {
      employeeParQuestion: "",
      threeSixtyReviewQuestion: "",
      parRatings: [],
      threeSixtyReviewRatings: [],
    },
    parCycleStatus: "CLOSED",
    ...overrides,
  };
}

beforeEach(() => {
  profile.isLoading = false;
  employees.isSuccess = true;
  employees.isLoading = false;
  employees.isError = false;
  employees.data = [
    { employeeName: "Jane Doe", workEmail: "jane@example.com" },
    { employeeName: "Amy Lee", workEmail: "amy@example.com" },
  ];
  realCycles.isSuccess = true;
  realCycles.isLoading = false;
  realCycles.isError = false;
  realCycles.data = [realCycle()];
  Object.keys(legacyByEmail).forEach((k) => delete legacyByEmail[k]);
  Object.keys(ratingFanOutByEmail).forEach((k) => delete ratingFanOutByEmail[k]);
  ratingFanOutByEmail["jane@example.com"] = { data: { parRatingId: 1, parLeadEmail: "lead@example.com", parRating: "EXCEEDS" }, isLoading: false, isError: false };
  ratingFanOutByEmail["amy@example.com"] = { data: { parRatingId: 2, parLeadEmail: "lead@example.com", parRating: "MEETS" }, isLoading: false, isError: false };
  singleRating.isSuccess = false;
  singleRating.isLoading = false;
  singleRating.isError = false;
  singleRating.data = undefined;
  reviews.isSuccess = false;
  reviews.isLoading = false;
  reviews.isError = false;
  reviews.data = undefined;
});

describe("ParLeadEmployeeHistoryTab", () => {
  it("defaults to the most recent cycle and shows every report in the All Employees table", async () => {
    show();
    expect(await screen.findByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Amy Lee")).toBeInTheDocument();
    // No cycle-picker prompt, no detail view, no back button — the table is
    // the default landing state once cycleDataReady settles.
    expect(screen.queryByText("Choose a PAR cycle to view your team's PAR history.")).not.toBeInTheDocument();
    expect(screen.queryByText("All employees")).not.toBeInTheDocument();
  });

  it("clicking a table row shows that employee's detail and a back button", async () => {
    singleRating.isSuccess = true;
    singleRating.data = { parRatingId: 1, parEmployeeEmail: "jane@example.com", parLeadEmail: "lead@example.com", parRating: "EXCEEDS" };
    reviews.isSuccess = true;
    reviews.data = [];

    show();
    const row = (await screen.findByText("Jane Doe")).closest('[role="button"]');
    expect(row).not.toBeNull();
    fireEvent.click(row!);

    expect(await screen.findByRole("button", { name: "All employees" })).toBeInTheDocument();
  });

  it("picking an employee directly from the dropdown shows detail without a back button", async () => {
    singleRating.isSuccess = true;
    singleRating.data = { parRatingId: 1, parEmployeeEmail: "jane@example.com", parLeadEmail: "lead@example.com", parRating: "EXCEEDS" };
    reviews.isSuccess = true;
    reviews.data = [];

    show();
    const combo = screen.getAllByRole("combobox")[1];
    fireEvent.mouseDown(combo);
    const listbox = await screen.findByRole("listbox");
    fireEvent.click(within(listbox).getByText("Jane Doe"));

    // "Employee PAR" only appears once the detail view actually renders —
    // unlike the employee's own name/email, which the closed Select also
    // echoes as its selected-value display, so those would match twice.
    expect(await screen.findByText("Employee PAR")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "All employees" })).not.toBeInTheDocument();
  });
});
