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

// Business logic behind ParAssignQuota's local group state. Nothing here is
// persisted until "SAVE QUOTA VALUES" POSTs, so it all operates on a
// client-side working model rather than the wire types directly.

import type {
  ParSpecialRatingGroup,
  ParSpecialRatingGroupQuota,
  ParSpecialRatingGroupWithHeadCount,
  ParSpecialRatingQuotaWithName,
} from "../api/types";

export interface ParQuotaGroup {
  id: number;
  name: string;
  teams: ParSpecialRatingGroupWithHeadCount[];
  totalHeadCount: number;
  default5Slots: number;
  default20Slots: number;
  allocated5Slots: number;
  allocated20Slots: number;
  allocatedLeads: string[];
}

export function calculateTotalHeadCount(teams: { headCount: number }[]): number {
  return teams.reduce((sum, t) => sum + (t.headCount || 0), 0);
}

// 5% and 20% of headcount, rounded, each floored to at least 1 so a small
// group still gets a slot. The 20% figure is then reduced by the 5% amount,
// since "top 20%" is the band ABOVE the top 5% — the two allocations are
// additive, not overlapping.
export function calculateDefaultQuotaValues(totalHeadCount: number): {
  default5Slots: number;
  default20Slots: number;
} {
  let default5Slots = Math.round(totalHeadCount * 0.05);
  let default20Slots = Math.round(totalHeadCount * 0.2);

  if (default5Slots === 0 && default20Slots === 0 && totalHeadCount > 0) {
    return { default5Slots: 1, default20Slots: 0 };
  }

  if (default5Slots < 1) {
    default5Slots = 1;
  }
  if (default20Slots < 1) {
    default20Slots = 1;
  }
  default20Slots -= default5Slots;

  return { default5Slots, default20Slots };
}

// Applied before a team ever reaches the grid, so the grouped payload keeps
// the same display casing the admin saw regardless of how the backend cased it.
export function titleCaseWords(text: string): string {
  return text
    .split(" ")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(" ");
}

function isValidNumber(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

// A belt-and-braces sanity check on group state this app itself computed,
// run right before the confirm-and-save dialog opens. Should never fail in
// practice, but validated anyway rather than trusting local state blindly.
export function validateGroup(group: ParQuotaGroup): string[] {
  const errors: string[] = [];

  if (!Number.isInteger(group.id)) {
    errors.push(`Group "${group.name}" has an invalid ID`);
  }

  if (!isValidNumber(group.totalHeadCount) || group.totalHeadCount <= 0 || !Number.isInteger(group.totalHeadCount)) {
    errors.push(`Total Headcount for group "${group.name}" must be a positive integer`);
  }

  const expected = calculateDefaultQuotaValues(group.totalHeadCount);
  if (group.default5Slots !== expected.default5Slots) {
    errors.push(`Default 5% Slots for group "${group.name}" must match 5% of the total headcount`);
  }
  if (group.default20Slots !== expected.default20Slots) {
    errors.push(`Default 20% Slots for group "${group.name}" must match 20% of the total headcount`);
  }

  if (!isValidNumber(group.allocated5Slots) || group.allocated5Slots < 0 || !Number.isInteger(group.allocated5Slots)) {
    errors.push(`Allocated 5% Slots for group "${group.name}" must be a valid number`);
  } else if (group.allocated5Slots > group.default5Slots) {
    errors.push(`Allocated 5% Slots for group "${group.name}" must not exceed the default 5% value`);
  }

  if (
    !isValidNumber(group.allocated20Slots) ||
    group.allocated20Slots < 0 ||
    !Number.isInteger(group.allocated20Slots)
  ) {
    errors.push(`Allocated 20% Slots for group "${group.name}" must be a valid number`);
  } else if (group.allocated20Slots > group.default20Slots) {
    errors.push(`Allocated 20% Slots for group "${group.name}" must not exceed the default 20% value`);
  }

  return errors;
}

// A group is "under served" once its allocated slots fall short of its
// default — a warning, not a blocker; the confirm dialog names the affected
// groups so the admin can back out and top them up first. A default of 0
// (a legitimately empty 20% band for small groups) is not itself a shortfall.
export function getUnderServedGroupNames(groups: ParQuotaGroup[]): string[] {
  return groups
    .filter((g) => g.allocated5Slots < g.default5Slots || g.allocated20Slots < g.default20Slots)
    .map((g) => g.name);
}

// Each group becomes one specialRatingQuotas entry (1-indexed id) plus one
// parSpecialRatingGroups row per team it contains.
export function formatGroupsToQuotaPayload(groups: ParQuotaGroup[], parCycleId: number): ParSpecialRatingGroupQuota {
  const parSpecialRatingGroups: ParSpecialRatingGroup[] = [];
  const specialRatingQuotas: ParSpecialRatingQuotaWithName[] = [];

  groups.forEach((group, index) => {
    const specialRatingQuotaId = index + 1;

    specialRatingQuotas.push({
      specialRatingQuotaId,
      specialRatingQuotaName: group.name,
      top5pQuota: group.allocated5Slots,
      top20pQuota: group.allocated20Slots,
      allocatedLeads: group.allocatedLeads,
    });

    group.teams.forEach((team) => {
      parSpecialRatingGroups.push({
        parCycleId,
        specialRatingGroupId: team.specialRatingGroupId,
        businessUnit: team.businessUnit,
        department: team.department,
        team: team.team,
        specialRatingQuotaId,
      });
    });
  });

  return { parSpecialRatingGroups, specialRatingQuotas };
}

// Validated a second time against the exact POST payload shape, right
// before the request goes out, so a bad field gets a specific message
// instead of a generic failed-request toast.
export function validateQuotaPayload(payload: ParSpecialRatingGroupQuota): string[] {
  const errors: string[] = [];

  payload.specialRatingQuotas.forEach((quota) => {
    if (!isValidNumber(quota.specialRatingQuotaId) || quota.specialRatingQuotaId < 0 || !Number.isInteger(quota.specialRatingQuotaId)) {
      errors.push("Special Rating Quota ID is required");
    }
    if (!quota.specialRatingQuotaName) {
      errors.push("Special Rating Quota Name is required");
    }
    if (!isValidNumber(quota.top5pQuota) || quota.top5pQuota < 0 || !Number.isInteger(quota.top5pQuota)) {
      errors.push(`Top 5% Quota for "${quota.specialRatingQuotaName}" is required`);
    }
    if (!isValidNumber(quota.top20pQuota) || quota.top20pQuota < 0 || !Number.isInteger(quota.top20pQuota)) {
      errors.push(`Top 20% Quota for "${quota.specialRatingQuotaName}" is required`);
    }
    if (!quota.allocatedLeads || quota.allocatedLeads.length < 1) {
      errors.push(`A minimum of one lead must be assigned to group "${quota.specialRatingQuotaName}"`);
    }
  });

  payload.parSpecialRatingGroups.forEach((group) => {
    if (!isValidNumber(group.parCycleId) || group.parCycleId <= 0 || !Number.isInteger(group.parCycleId)) {
      errors.push("PAR Cycle ID is required");
    }
    if (
      !isValidNumber(group.specialRatingGroupId) ||
      group.specialRatingGroupId <= 0 ||
      !Number.isInteger(group.specialRatingGroupId)
    ) {
      errors.push("Special Rating Group ID is required");
    }
    if (!group.businessUnit) {
      errors.push("Business Unit is required");
    }
    if (!group.department) {
      errors.push("Department is required");
    }
    if (group.team === undefined || group.team === null) {
      errors.push("Team is required");
    }
    if (
      !isValidNumber(group.specialRatingQuotaId) ||
      group.specialRatingQuotaId < 0 ||
      !Number.isInteger(group.specialRatingQuotaId)
    ) {
      errors.push("Special Rating Quota ID is required");
    }
  });

  return errors;
}
