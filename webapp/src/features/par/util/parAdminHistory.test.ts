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
import { buildAdminHistoryRows, groupLegacyParticipantsByTeam } from "./parAdminHistory";
import type { ParCycle, ParLegacyCycleSummary, ParLegacyHistory } from "../api/types";

function cycle(overrides: Partial<ParCycle> = {}): ParCycle {
  return {
    parCycleId: 1,
    parCycleName: "2026 Performance Evaluation - H1",
    parCycleStartDate: "2026-01-01",
    parCycleEndDate: "2026-06-30",
    parEvaluationStartDate: "2026-01-01",
    parEvaluationEndDate: "2026-06-30",
    parEmployeeDeadline: "2026-02-01",
    parThreeSixtyRatingDeadline: "2026-03-01",
    parLeadDeadline: "2026-04-01",
    parF2FDeadline: "2026-05-01",
    parCycleConfigurations: { employeeParQuestion: "", threeSixtyReviewQuestion: "", parRatings: [], threeSixtyReviewRatings: [] },
    parCycleStatus: "CLOSED",
    ...overrides,
  };
}

function legacyCycle(overrides: Partial<ParLegacyCycleSummary> = {}): ParLegacyCycleSummary {
  return { cycleName: "2024 Performance Evaluation - H1", participantCount: 10, latestCompletedDate: "2024-06-15", ...overrides };
}

function legacyRecord(overrides: Partial<ParLegacyHistory> = {}): ParLegacyHistory {
  return {
    legacyHeaderId: 1,
    employeeEmail: "employee@wso2.com",
    location: null,
    businessUnit: "Engineering",
    department: "Platform",
    team: null,
    subTeam: null,
    reviewerName: "Lead One",
    reviewerEmail: "lead@wso2.com",
    cycleName: "2024 Performance Evaluation - H1",
    reviewCompletedDate: "2024-06-01",
    overallRating: null,
    overallSpecialRating: null,
    overallCommentEmployee: "Some employee comment",
    overallCommentManager: "Some manager comment",
    employeeScoreCode: null,
    managerScoreCode: 3,
    questionAnswers: null,
    feedback360: null,
    ...overrides,
  };
}

describe("buildAdminHistoryRows", () => {
  it("merges real and legacy cycles, latest end date first", () => {
    const rows = buildAdminHistoryRows(
      [cycle({ parCycleId: 1, parCycleName: "2026 H1", parCycleEndDate: "2026-06-30" })],
      [legacyCycle({ cycleName: "2024 Performance Evaluation - H1" })],
    );
    expect(rows.map((r) => r.cycleName)).toEqual(["2026 H1", "2024 Performance Evaluation - H1"]);
  });

  it("tags legacy rows and carries no parCycleId for them", () => {
    const rows = buildAdminHistoryRows([], [legacyCycle()]);
    expect(rows[0].isLegacy).toBe(true);
    expect(rows[0].parCycleId).toBeUndefined();
  });

  it("tags real rows with isLegacy false and their parCycleId", () => {
    const rows = buildAdminHistoryRows([cycle({ parCycleId: 42 })], []);
    expect(rows[0]).toMatchObject({ isLegacy: false, parCycleId: 42 });
  });

  it("derives legacy row dates from the cycle name", () => {
    const rows = buildAdminHistoryRows([], [legacyCycle({ cycleName: "2023 Performance Evaluation - H2" })]);
    expect(rows[0]).toMatchObject({ startDate: "2023-07-01", endDate: "2023-12-31" });
  });

  it("is empty for no cycles at all", () => {
    expect(buildAdminHistoryRows([], [])).toEqual([]);
  });
});

describe("groupLegacyParticipantsByTeam", () => {
  it("groups by department + reviewer name", () => {
    const groups = groupLegacyParticipantsByTeam([
      legacyRecord({ department: "Platform", reviewerName: "Lead One" }),
      legacyRecord({ department: "Platform", reviewerName: "Lead One" }),
      legacyRecord({ department: "Platform", reviewerName: "Lead Two" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.parLeadEmail === "Lead One")?.participants).toHaveLength(2);
  });

  it("defaults a missing department or reviewer to Unassigned", () => {
    const groups = groupLegacyParticipantsByTeam([legacyRecord({ department: null, reviewerName: null })]);
    expect(groups[0]).toMatchObject({ parDepartment: "-", parLeadEmail: "-" });
  });

  it("counts employee PAR / lead feedback completion, treating blank and N/A as not done", () => {
    const groups = groupLegacyParticipantsByTeam([
      legacyRecord({ overallCommentEmployee: "Written", overallCommentManager: "N/A" }),
      legacyRecord({ overallCommentEmployee: "", overallCommentManager: "Written" }),
    ]);
    expect(groups[0]).toMatchObject({ employeeParCompletion: "1/2", leadFeedbackCompletion: "1/2" });
  });

  it("counts employee PAR as done from questionAnswers content even with no overallCommentEmployee", () => {
    const groups = groupLegacyParticipantsByTeam([
      legacyRecord({
        overallCommentEmployee: null,
        questionAnswers: JSON.stringify([{ title: "Q1", employeeAnswer: "A real answer", managerFeedback: null }]),
      }),
      legacyRecord({ overallCommentEmployee: null, questionAnswers: null }),
    ]);
    expect(groups[0]).toMatchObject({ employeeParCompletion: "1/2" });
  });

  it("counts 5% and 20% special-rating slots from overallSpecialRating", () => {
    const groups = groupLegacyParticipantsByTeam([
      legacyRecord({ overallSpecialRating: "TOP5P" }),
      legacyRecord({ overallSpecialRating: "TOP20P" }),
      legacyRecord({ overallSpecialRating: "TOP20P" }),
      legacyRecord({ overallSpecialRating: null }),
    ]);
    expect(groups[0]).toMatchObject({ numberOf5pSlots: 1, numberOf20pSlots: 2 });
  });

  it("is empty for no participants", () => {
    expect(groupLegacyParticipantsByTeam([])).toEqual([]);
  });
});
