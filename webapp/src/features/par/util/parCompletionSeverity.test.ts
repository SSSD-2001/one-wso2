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
import { completionPercent, completionSeverity } from "./parCompletionSeverity";

describe("completionSeverity", () => {
  it.each([
    [0, "error"],
    [39, "error"],
    [40, "warning"],
    [69, "warning"],
    [70, "success"],
    [100, "success"],
  ])("%i%% -> %s", (percent, expected) => {
    expect(completionSeverity(percent)).toBe(expected);
  });
});

describe("completionPercent", () => {
  it("computes a percentage from completed/total", () => {
    expect(completionPercent(1, 4)).toBe(25);
  });

  it("is zero for a zero total rather than dividing by zero", () => {
    expect(completionPercent(3, 0)).toBe(0);
  });

  it("is zero for a negative total", () => {
    expect(completionPercent(3, -1)).toBe(0);
  });

  it("caps at 100 even if completed exceeds total", () => {
    expect(completionPercent(9, 4)).toBe(100);
  });
});
