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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { describe, expect, it } from "vitest";
import { promotionServiceUrls } from "@config/apiConfig";

// statusArray's comma must stay unencoded, or the backend won't split it.
// These pin the exact query string so a switch back to URLSearchParams
// fails loudly instead of silently.
describe("promotionServiceUrls: statusArray must stay comma-joined, not percent-encoded", () => {
  it("promotionRequests keeps a raw comma between multiple statuses", () => {
    const url = promotionServiceUrls.promotionRequests({ statusArray: ["WITHDRAW", "REMOVED"] });
    expect(url).toContain("statusArray=WITHDRAW,REMOVED");
    expect(url).not.toContain("%2C");
  });

  it("promotionRecommendations keeps a raw comma between multiple statuses", () => {
    const url = promotionServiceUrls.promotionRecommendations({
      statusArray: ["SUBMITTED", "DECLINED", "EXPIRED"],
    });
    expect(url).toContain("statusArray=SUBMITTED,DECLINED,EXPIRED");
    expect(url).not.toContain("%2C");
  });

  it("still percent-encodes other free-text params on both builders", () => {
    expect(promotionServiceUrls.promotionRequests({ employeeEmail: "a b@x.com" })).toContain(
      `employeeEmail=${encodeURIComponent("a b@x.com")}`,
    );
    expect(promotionServiceUrls.promotionRecommendations({ leadEmail: "a b@x.com" })).toContain(
      `leadEmail=${encodeURIComponent("a b@x.com")}`,
    );
  });
});
