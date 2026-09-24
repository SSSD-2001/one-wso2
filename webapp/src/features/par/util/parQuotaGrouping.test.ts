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
  calculateDefaultQuotaValues,
  calculateTotalHeadCount,
  formatGroupsToQuotaPayload,
  getUnderServedGroupNames,
  titleCaseWords,
  validateGroup,
  validateQuotaPayload,
  type ParQuotaGroup,
} from "./parQuotaGrouping";
import type { ParSpecialRatingGroupWithHeadCount } from "../api/types";

function team(overrides: Partial<ParSpecialRatingGroupWithHeadCount> = {}): ParSpecialRatingGroupWithHeadCount {
  return {
    parCycleId: 1,
    specialRatingGroupId: 1,
    businessUnit: "Engineering",
    department: "Platform",
    team: "Core",
    headCount: 10,
    ...overrides,
  };
}

function group(overrides: Partial<ParQuotaGroup> = {}): ParQuotaGroup {
  return {
    id: 1,
    name: "Group A",
    teams: [team()],
    totalHeadCount: 10,
    default5Slots: 1,
    default20Slots: 1,
    allocated5Slots: 1,
    allocated20Slots: 1,
    allocatedLeads: ["lead@wso2.com"],
    ...overrides,
  };
}

describe("calculateTotalHeadCount", () => {
  it("sums headcount across teams", () => {
    expect(calculateTotalHeadCount([{ headCount: 5 }, { headCount: 3 }])).toBe(8);
  });

  it("treats a missing headCount as zero", () => {
    expect(calculateTotalHeadCount([{ headCount: 0 }])).toBe(0);
  });

  it("is zero for no teams", () => {
    expect(calculateTotalHeadCount([])).toBe(0);
  });
});

describe("calculateDefaultQuotaValues", () => {
  // 20% is the band above the top 5%, so it's always default5Slots's
  // complement within the rounded 20% figure — every case below is floored
  // to at least 1 for the 5% slot, with the 20% slot allowed to land at 0
  // for small groups (the case getUnderServedGroupNames must not flag).
  it.each([
    [1, { default5Slots: 1, default20Slots: 0 }],
    [2, { default5Slots: 1, default20Slots: 0 }],
    [4, { default5Slots: 1, default20Slots: 0 }],
    [6, { default5Slots: 1, default20Slots: 0 }],
    [8, { default5Slots: 1, default20Slots: 1 }],
    [10, { default5Slots: 1, default20Slots: 1 }],
    [20, { default5Slots: 1, default20Slots: 3 }],
    [100, { default5Slots: 5, default20Slots: 15 }],
  ])("headcount %i -> %o", (headCount, expected) => {
    expect(calculateDefaultQuotaValues(headCount)).toEqual(expected);
  });
});

describe("titleCaseWords", () => {
  it("title-cases each word", () => {
    expect(titleCaseWords("SOFTWARE engineering")).toBe("Software Engineering");
  });

  it("collapses to a single word cleanly", () => {
    expect(titleCaseWords("PLATFORM")).toBe("Platform");
  });
});

describe("validateGroup", () => {
  it("passes for a group matching its computed defaults", () => {
    expect(validateGroup(group())).toEqual([]);
  });

  it("flags a non-integer id", () => {
    expect(validateGroup(group({ id: 1.5 }))).toContain('Group "Group A" has an invalid ID');
  });

  it("flags a non-positive total headcount", () => {
    expect(validateGroup(group({ totalHeadCount: 0 }))).toContain(
      'Total Headcount for group "Group A" must be a positive integer',
    );
  });

  it("flags a default5Slots that doesn't match the computed value", () => {
    expect(validateGroup(group({ default5Slots: 99 }))).toContain(
      'Default 5% Slots for group "Group A" must match 5% of the total headcount',
    );
  });

  it("flags a default20Slots that doesn't match the computed value", () => {
    expect(validateGroup(group({ default20Slots: 99 }))).toContain(
      'Default 20% Slots for group "Group A" must match 20% of the total headcount',
    );
  });

  it("flags an allocated5Slots exceeding the default", () => {
    expect(validateGroup(group({ allocated5Slots: 2 }))).toContain(
      'Allocated 5% Slots for group "Group A" must not exceed the default 5% value',
    );
  });

  it("flags an allocated20Slots exceeding the default", () => {
    expect(validateGroup(group({ allocated20Slots: 2 }))).toContain(
      'Allocated 20% Slots for group "Group A" must not exceed the default 20% value',
    );
  });

  it("flags a negative allocated5Slots as invalid rather than over-the-default", () => {
    expect(validateGroup(group({ allocated5Slots: -1 }))).toContain(
      'Allocated 5% Slots for group "Group A" must be a valid number',
    );
  });
});

describe("getUnderServedGroupNames", () => {
  it("does not flag a small group whose default20Slots is legitimately 0", () => {
    const smallGroup = group({
      name: "Small Team",
      totalHeadCount: 6,
      default5Slots: 1,
      default20Slots: 0,
      allocated5Slots: 1,
      allocated20Slots: 0,
    });
    expect(getUnderServedGroupNames([smallGroup])).toEqual([]);
  });

  it("flags a group whose allocated 5% falls short of its default", () => {
    const g = group({ name: "Short 5%", default5Slots: 2, allocated5Slots: 0 });
    expect(getUnderServedGroupNames([g])).toEqual(["Short 5%"]);
  });

  it("flags a group whose allocated 20% falls short of its default", () => {
    const g = group({ name: "Short 20%", default20Slots: 2, allocated20Slots: 1 });
    expect(getUnderServedGroupNames([g])).toEqual(["Short 20%"]);
  });

  it("does not flag a fully-allocated group", () => {
    expect(getUnderServedGroupNames([group()])).toEqual([]);
  });
});

describe("formatGroupsToQuotaPayload", () => {
  it("assigns 1-indexed specialRatingQuotaIds in group order", () => {
    const groups = [group({ id: 1, name: "First" }), group({ id: 2, name: "Second" })];
    const payload = formatGroupsToQuotaPayload(groups, 42);
    expect(payload.specialRatingQuotas.map((q) => q.specialRatingQuotaId)).toEqual([1, 2]);
    expect(payload.specialRatingQuotas.map((q) => q.specialRatingQuotaName)).toEqual(["First", "Second"]);
  });

  it("emits one parSpecialRatingGroups row per team, tagged with its group's quota id", () => {
    const groups = [
      group({
        id: 1,
        teams: [team({ specialRatingGroupId: 10 }), team({ specialRatingGroupId: 11 })],
      }),
    ];
    const payload = formatGroupsToQuotaPayload(groups, 42);
    expect(payload.parSpecialRatingGroups).toHaveLength(2);
    expect(payload.parSpecialRatingGroups.every((row) => row.specialRatingQuotaId === 1 && row.parCycleId === 42)).toBe(true);
  });

  it("carries allocated slots and leads through to the payload", () => {
    const g = group({ allocated5Slots: 3, allocated20Slots: 4, allocatedLeads: ["a@wso2.com", "b@wso2.com"] });
    const payload = formatGroupsToQuotaPayload([g], 1);
    expect(payload.specialRatingQuotas[0]).toMatchObject({
      top5pQuota: 3,
      top20pQuota: 4,
      allocatedLeads: ["a@wso2.com", "b@wso2.com"],
    });
  });
});

describe("validateQuotaPayload", () => {
  it("passes for a well-formed payload", () => {
    const payload = formatGroupsToQuotaPayload([group()], 1);
    expect(validateQuotaPayload(payload)).toEqual([]);
  });

  it("requires a quota name", () => {
    const payload = formatGroupsToQuotaPayload([group()], 1);
    payload.specialRatingQuotas[0].specialRatingQuotaName = "";
    expect(validateQuotaPayload(payload)).toContain("Special Rating Quota Name is required");
  });

  it("requires at least one allocated lead", () => {
    const payload = formatGroupsToQuotaPayload([group({ allocatedLeads: [] })], 1);
    expect(validateQuotaPayload(payload)).toContain('A minimum of one lead must be assigned to group "Group A"');
  });

  it("requires a positive parCycleId on every group row", () => {
    const payload = formatGroupsToQuotaPayload([group()], 0);
    expect(validateQuotaPayload(payload)).toContain("PAR Cycle ID is required");
  });

  it("requires a business unit on every group row", () => {
    const payload = formatGroupsToQuotaPayload([group({ teams: [team({ businessUnit: "" })] })], 1);
    expect(validateQuotaPayload(payload)).toContain("Business Unit is required");
  });
});
