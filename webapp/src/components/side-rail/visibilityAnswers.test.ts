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
import {
  PROMOTION_ADMIN_PORTAL_ITEM_ID,
  PROMOTION_CYCLE_HISTORY_ITEM_ID,
  PROMOTION_FUNCTIONAL_LEAD_PORTAL_ITEM_ID,
  PROMOTION_LEAD_PORTAL_ITEM_ID,
} from "@constants/perspectives";
import { PAR_ADMIN_PORTAL_ITEM_ID, PAR_LEAD_PORTAL_ITEM_ID } from "@constants/perspectives";
import { PAR_EMPLOYEE_ITEM_ID } from "@constants/parApps";
import { parVisibility } from "@features/par/api/parVisibility";
import { promotionVisibility } from "@features/promotion/api/usePromotionRoles";
import { salesVisibility } from "@features/sales/api/useSalesGate";
import { subscriptionVisibility } from "@features/subscriptions/api/useSubscriptionGate";
import { umtVisibility } from "@features/umt/api/useUmtGate";

const quiet = { isLoading: false, isResolving: false };

describe("salesVisibility", () => {
  it("passes the section id through to the sales gate", () => {
    const canSee = vi.fn(() => true);
    const answer = salesVisibility({
      canSee,
      isResolving: false,
      isError: false,
      errorMessage: undefined,
      retry: () => undefined,
    });

    expect(answer.canSee("sales-meetings")).toBe(true);
    expect(canSee).toHaveBeenCalledWith("sales-meetings");
  });
});

describe("promotionVisibility", () => {
  const none = {
    isLead: false,
    isFunctionalLead: false,
    isPromotionBoardMember: false,
    isHrAdmin: false,
    isLoading: false,
  };

  it("shows the lead portal only to a lead, and waits while privileges load", () => {
    expect(promotionVisibility(none).canSee(PROMOTION_LEAD_PORTAL_ITEM_ID)).toBe(false);
    expect(promotionVisibility({ ...none, isLead: true }).canSee(PROMOTION_LEAD_PORTAL_ITEM_ID)).toBe(true);
    expect(promotionVisibility({ ...none, isFunctionalLead: true }).canSee(PROMOTION_FUNCTIONAL_LEAD_PORTAL_ITEM_ID)).toBe(
      true,
    );
    expect(
      promotionVisibility({ ...none, isHrAdmin: true }).canSee(PROMOTION_CYCLE_HISTORY_ITEM_ID),
    ).toBe(true);
    expect(promotionVisibility({ ...none, isLoading: true }).resolving).toBe(true);
    expect(promotionVisibility({ ...none, isHrAdmin: true }).canSee(PROMOTION_ADMIN_PORTAL_ITEM_ID)).toBe(true);
  });
});

describe("parVisibility", () => {
  it("hides the employee item while the profile failed, and shows lead and admin from their own answers", () => {
    const answer = parVisibility({
      admin: { isAdmin: true, ...quiet },
      lead: { canSee: true, ...quiet },
      employee: { canSee: true, ...quiet },
      profileFailed: true,
    });

    expect(answer.canSee(PAR_ADMIN_PORTAL_ITEM_ID)).toBe(true);
    expect(answer.canSee(PAR_LEAD_PORTAL_ITEM_ID)).toBe(true);
    expect(answer.canSee(PAR_EMPLOYEE_ITEM_ID)).toBe(false);
    expect(answer.error).toBeUndefined();
  });
});

describe("umtVisibility", () => {
  it("hides Product Management on a failed read and does not ask the landing to retry", () => {
    const retry = vi.fn();
    const answer = umtVisibility({
      isAuthorized: false,
      isUser: false,
      isAdmin: false,
      isProductLead: false,
      hasRole: () => false,
      isResolving: false,
      isError: true,
      errorMessage: "boom",
      retry,
    });

    expect(answer.canSee("umt-products")).toBe(false);
    expect(answer.error).toBeUndefined();
  });
});

describe("subscriptionVisibility", () => {
  it("forwards a failed read so the landing can retry", () => {
    const retry = vi.fn();
    const answer = subscriptionVisibility({
      isCommuteAdmin: false,
      isLunchAdmin: false,
      isAdmin: false,
      isInExcludedGroup: false,
      serviceChargeMsg: "",
      isResolving: false,
      isError: true,
      errorMessage: "token",
      retry,
    });

    expect(answer.canSee("people-subscriptions-mine")).toBe(true);
    expect(answer.canSee("people-subscriptions-manage")).toBe(false);
    expect(answer.error).toBe("token");
    answer.retry();
    expect(retry).toHaveBeenCalledOnce();
  });
});
