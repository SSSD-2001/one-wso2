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
import { canSeeBankingAdminTab, firstAllowedBankingAdminTab } from "./bankingAdminTabs";

const peopleOpsOnly = { isPeopleOperationsAdmin: true, isFinanceAdmin: false };
const financeOnly = { isPeopleOperationsAdmin: false, isFinanceAdmin: true };
const neither = { isPeopleOperationsAdmin: false, isFinanceAdmin: false };

describe("canSeeBankingAdminTab", () => {
  it("shows a people-ops-admin tab only to a People Ops admin", () => {
    expect(canSeeBankingAdminTab("people-ops-admin", peopleOpsOnly)).toBe(true);
    expect(canSeeBankingAdminTab("people-ops-admin", financeOnly)).toBe(false);
  });

  it("shows an either-admin tab to a People Ops admin or a Finance admin", () => {
    expect(canSeeBankingAdminTab("either-admin", peopleOpsOnly)).toBe(true);
    expect(canSeeBankingAdminTab("either-admin", financeOnly)).toBe(true);
    expect(canSeeBankingAdminTab("either-admin", neither)).toBe(false);
  });
});

describe("firstAllowedBankingAdminTab", () => {
  it("is Change Requests for a People Ops admin, the first tab they can see", () => {
    expect(firstAllowedBankingAdminTab(peopleOpsOnly)?.segment).toBe("change-requests");
  });

  it("is Report for a Finance-only admin, since Change Requests is People-Ops-only", () => {
    expect(firstAllowedBankingAdminTab(financeOnly)?.segment).toBe("report");
  });

  it("is undefined for a caller with neither admin flag", () => {
    expect(firstAllowedBankingAdminTab(neither)).toBeUndefined();
  });
});
