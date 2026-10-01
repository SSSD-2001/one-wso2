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

import { describe, expect, it } from "vitest";
import {
  buildMergedCycleOptions,
  filterEmployeesForCycle,
  filterOwnedByLead,
  resolveEmployeeCycleRating,
  sortClosedCyclesLatestFirst,
} from "./parEmployeeHistory";
import type { ParCycle, ParEmployee, ParLegacyHistory, ParRating } from "../api/types";
import type { ParLegacyHistoryByEmail, ParRatingByEmail } from "../api/useLeadHistory";

function rating(overrides: Partial<ParRating>): ParRating {
  return {
    parRatingId: 1,
    parCycleId: 1,
    parEmployeeEmail: "jane@example.com",
    parEmployeeStatus: "SHARED",
    parLeadStatus: "SHARED",
    parF2fStatus: "COMPLETED",
    ...overrides,
  };
}

function realCycle(overrides: Partial<ParCycle>): ParCycle {
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

function legacyRecord(overrides: Partial<ParLegacyHistory>): ParLegacyHistory {
  return {
    legacyHeaderId: 1,
    employeeEmail: "jane@example.com",
    location: null,
    businessUnit: null,
    department: null,
    team: null,
    subTeam: null,
    reviewerName: null,
    reviewerEmail: null,
    cycleName: "2023 Performance Evaluation - H1",
    reviewCompletedDate: null,
    overallRating: null,
    overallSpecialRating: null,
    overallCommentEmployee: null,
    overallCommentManager: null,
    employeeScoreCode: null,
    managerScoreCode: null,
    questionAnswers: null,
    feedback360: null,
    ...overrides,
  };
}

describe("sortClosedCyclesLatestFirst", () => {
  it("sorts by id (creation order), latest first — NOT by start date", () => {
    // The reported bug, with real row data: id 4 ("2026 H2 Test Performance
    // Cycle") was created last despite having the EARLIEST start date of the
    // four — a test/demo cycle backdated relative to when it was actually
    // set up. Sorting by start date would put it last again; sorting by id
    // (the only creation-order signal the API exposes) puts it first.
    const cycles = [
      realCycle({ parCycleId: 1, parCycleName: "test 2026 H2", parCycleStartDate: "2026-09-10" }),
      realCycle({ parCycleId: 2, parCycleName: "testing lead portal", parCycleStartDate: "2026-09-17" }),
      realCycle({ parCycleId: 3, parCycleName: "2030 H1", parCycleStartDate: "2026-09-18" }),
      realCycle({ parCycleId: 4, parCycleName: "2026 H2 Test Performance Cycle", parCycleStartDate: "2026-07-01" }),
    ];
    expect(sortClosedCyclesLatestFirst(cycles).map((c) => c.parCycleName)).toEqual([
      "2026 H2 Test Performance Cycle",
      "2030 H1",
      "testing lead portal",
      "test 2026 H2",
    ]);
  });

  it("does not mutate the input array", () => {
    const cycles = [realCycle({ parCycleId: 1 }), realCycle({ parCycleId: 2 })];
    const original = [...cycles];
    sortClosedCyclesLatestFirst(cycles);
    expect(cycles).toEqual(original);
  });
});

describe("buildMergedCycleOptions", () => {
  it("includes one option per real cycle", () => {
    const options = buildMergedCycleOptions([realCycle({ parCycleId: 1 }), realCycle({ parCycleId: 2 })], {});
    expect(options.filter((o) => !o.isLegacy)).toHaveLength(2);
  });

  it("dedupes legacy cycles across multiple reports sharing one cycle name", () => {
    const byEmail: ParLegacyHistoryByEmail = {
      "a@example.com": [legacyRecord({ cycleName: "2023 Performance Evaluation - H1" })],
      "b@example.com": [legacyRecord({ cycleName: "2023 Performance Evaluation - H1" })],
    };
    const options = buildMergedCycleOptions([], byEmail);
    expect(options).toHaveLength(1);
    expect(options[0].label).toBe("2023 Performance Evaluation - H1 (Legacy)");
  });

  it("sorts latest first, real and legacy cycles interleaved by date", () => {
    const real = realCycle({ parCycleId: 1, parCycleName: "2024 H2", parCycleStartDate: "2024-07-01" });
    const byEmail: ParLegacyHistoryByEmail = {
      "a@example.com": [legacyRecord({ cycleName: "2023 Performance Evaluation - H2" })],
    };
    const options = buildMergedCycleOptions([real], byEmail);
    expect(options.map((o) => o.cycleName)).toEqual(["2024 H2", "2023 Performance Evaluation - H2"]);
  });

  it("sorts an option with no derivable date to the end", () => {
    const byEmail: ParLegacyHistoryByEmail = {
      "a@example.com": [legacyRecord({ cycleName: "Unparseable Cycle Name" })],
    };
    const real = realCycle({ parCycleId: 1 });
    const options = buildMergedCycleOptions([real], byEmail);
    expect(options[options.length - 1].cycleName).toBe("Unparseable Cycle Name");
  });
});

function employee(overrides: Partial<ParEmployee>): ParEmployee {
  return { employeeName: "Jane Doe", workEmail: "jane@example.com", ...overrides };
}

describe("filterEmployeesForCycle", () => {
  it("excludes the caller's own email", () => {
    const employees = [employee({ workEmail: "me@example.com" }), employee({ workEmail: "jane@example.com" })];
    expect(filterEmployeesForCycle(employees, "", "me@example.com", null)).toHaveLength(1);
  });

  it("matches the search term against name or email", () => {
    const employees = [employee({ employeeName: "Jane Doe", workEmail: "jane@example.com" })];
    expect(filterEmployeesForCycle(employees, "jane", undefined, null)).toHaveLength(1);
    expect(filterEmployeesForCycle(employees, "Doe", undefined, null)).toHaveLength(1);
    expect(filterEmployeesForCycle(employees, "nope", undefined, null)).toHaveLength(0);
  });

  it("scopes to a real cycle's participants", () => {
    const employees = [employee({ workEmail: "jane@example.com" }), employee({ workEmail: "amy@example.com" })];
    const scope = { participantEmails: new Set(["jane@example.com"]) };
    expect(filterEmployeesForCycle(employees, "", undefined, scope)).toEqual([employees[0]]);
  });

  it("scopes to a legacy cycle's reports", () => {
    const employees = [employee({ workEmail: "jane@example.com" }), employee({ workEmail: "amy@example.com" })];
    const scope = {
      legacyCycleName: "2023 H1",
      legacyHistoryByEmail: { "jane@example.com": [legacyRecord({ cycleName: "2023 H1" })] },
    };
    expect(filterEmployeesForCycle(employees, "", undefined, scope)).toEqual([employees[0]]);
  });

  it("returns every report unfiltered by scope when no cycle is selected", () => {
    const employees = [employee({ workEmail: "jane@example.com" }), employee({ workEmail: "amy@example.com" })];
    expect(filterEmployeesForCycle(employees, "", undefined, null)).toHaveLength(2);
  });

  it("falls back to the full in-scope list when the search text is the selected option's own label", () => {
    // MUI Autocomplete resets inputValue to `${name} (${email})` on
    // selection — filtering literally against that string would otherwise
    // match nothing and leave the dropdown empty on reopen.
    const jane = employee({ employeeName: "Jane Doe", workEmail: "jane@example.com" });
    const amy = employee({ employeeName: "Amy Lee", workEmail: "amy@example.com" });
    const result = filterEmployeesForCycle([jane, amy], "Jane Doe (jane@example.com)", undefined, null, jane);
    expect(result).toEqual([jane, amy]);
  });
});

describe("resolveEmployeeCycleRating", () => {
  const jane = employee({ employeeName: "Jane Doe", workEmail: "jane@example.com" });

  it("real cycle: reads rating/special off the fan-out record, dropping NOT_ASSIGNED", () => {
    const ratingByEmail: ParRatingByEmail = {
      "jane@example.com": rating({ parRating: "EXCEEDS_EXPECTATIONS", parSpecialRating: "NOT_ASSIGNED" }),
    };
    const result = resolveEmployeeCycleRating(jane, true, undefined, {}, ratingByEmail, {}, {});
    expect(result).toEqual({ rating: "EXCEEDS_EXPECTATIONS", special: null, hasRecord: true, isLoading: false, isError: false });
  });

  it("real cycle: still fetching reports isLoading, not a missing record", () => {
    const result = resolveEmployeeCycleRating(jane, true, undefined, {}, {}, { "jane@example.com": true }, {});
    expect(result).toEqual({ rating: null, special: null, hasRecord: false, isLoading: true, isError: false });
  });

  it("real cycle: fetched with no record (404 → null) reports hasRecord false", () => {
    const ratingByEmail: ParRatingByEmail = { "jane@example.com": null };
    const result = resolveEmployeeCycleRating(jane, true, undefined, {}, ratingByEmail, {}, {});
    expect(result).toEqual({ rating: null, special: null, hasRecord: false, isLoading: false, isError: false });
  });

  // A failed fetch (403/500/...) must read as a distinct error, not fall
  // through to "no record" — the lead can't otherwise tell a genuine
  // failure apart from an employee who simply wasn't rated that cycle.
  it("real cycle: a fetch error reports isError, not hasRecord false alone", () => {
    const result = resolveEmployeeCycleRating(jane, true, undefined, {}, {}, {}, { "jane@example.com": true });
    expect(result).toEqual({ rating: null, special: null, hasRecord: false, isLoading: false, isError: true });
  });

  it("legacy cycle: reads overallRating/overallSpecialRating off the matching cycleName", () => {
    const legacyByEmail: ParLegacyHistoryByEmail = {
      "jane@example.com": [legacyRecord({ cycleName: "2023 H1", overallRating: "Successful", overallSpecialRating: "TOP20P" })],
    };
    const result = resolveEmployeeCycleRating(jane, false, "2023 H1", legacyByEmail, {}, {}, {});
    expect(result).toEqual({ rating: "Successful", special: "TOP20P", hasRecord: true, isLoading: false, isError: false });
  });

  it("legacy cycle: falls back to deriveLegacyRatingFromScore when overallRating is absent", () => {
    const legacyByEmail: ParLegacyHistoryByEmail = {
      "jane@example.com": [legacyRecord({ cycleName: "2023 H1", overallRating: null, overallSpecialRating: null, managerScoreCode: 1 })],
    };
    const result = resolveEmployeeCycleRating(jane, false, "2023 H1", legacyByEmail, {}, {}, {});
    expect(result).toEqual({ rating: "Successful", special: "TOP5P", hasRecord: true, isLoading: false, isError: false });
  });

  it("legacy cycle: no record for that cycle name reports hasRecord false", () => {
    const legacyByEmail: ParLegacyHistoryByEmail = {
      "jane@example.com": [legacyRecord({ cycleName: "2022 H2" })],
    };
    const result = resolveEmployeeCycleRating(jane, false, "2023 H1", legacyByEmail, {}, {}, {});
    expect(result).toEqual({ rating: null, special: null, hasRecord: false, isLoading: false, isError: false });
  });
});

describe("filterOwnedByLead", () => {
  const caller = "lead@example.com";
  const jane = employee({ employeeName: "Jane Doe", workEmail: "jane@example.com" });
  const amy = employee({ employeeName: "Amy Lee", workEmail: "amy@example.com" });

  it("keeps a report whose resolved record names this lead, drops one that names someone else", () => {
    const ratingByEmail: ParRatingByEmail = {
      "jane@example.com": rating({ parLeadEmail: caller }),
      "amy@example.com": rating({ parLeadEmail: "other-lead@example.com" }),
    };
    expect(filterOwnedByLead([jane, amy], ratingByEmail, caller)).toEqual([jane]);
  });

  it("keeps a report whose rating hasn't loaded yet, or has no record at all", () => {
    const ratingByEmail: ParRatingByEmail = { "amy@example.com": null };
    expect(filterOwnedByLead([jane, amy], ratingByEmail, caller)).toEqual([jane, amy]);
  });
});
