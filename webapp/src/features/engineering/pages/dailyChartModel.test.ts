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
import type { DailySeries } from "@features/engineering/api/productDownloadStats";
import { dailyChartModel } from "./dailyChartModel";

const range = { from: "2026-09-27", to: "2026-09-29" };

function series(repoId: number, repoName: string, points: DailySeries["points"]): DailySeries {
  return { repoId, repoName, points };
}

describe("the daily chart", () => {
  it("keeps a day every series omitted, so the line can break there", () => {
    const model = dailyChartModel(
      [series(1, "product-apim", [{ date: "2026-09-27", value: 4 }, { date: "2026-09-29", value: 9 }])],
      new Map(),
      range,
    );

    expect(model.data.map((row) => row.date)).toEqual(["2026-09-27", "2026-09-28", "2026-09-29"]);
    expect(model.data.map((row) => row["repo-1"])).toEqual([4, null, 9]);
  });

  it("keeps both series when they share a display name", () => {
    const names = new Map<number, string>([
      [1, "API Manager"],
      [2, "API Manager"],
    ]);
    const model = dailyChartModel(
      [
        series(1, "product-apim", [{ date: "2026-09-29", value: 4 }]),
        series(2, "product-am", [{ date: "2026-09-29", value: 7 }]),
      ],
      names,
      range,
    );

    const last = model.data[model.data.length - 1];
    expect(last["repo-1"]).toBe(4);
    expect(last["repo-2"]).toBe(7);
    expect(model.lines.map((line) => line.name)).toEqual(["API Manager", "API Manager"]);
    expect(new Set(model.lines.map((line) => line.dataKey)).size).toBe(2);
    expect(model.lines[0].stroke).not.toBe(model.lines[1].stroke);
  });
});
