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

import { utcDatesInclusive, type DailySeries } from "@features/engineering/api/productDownloadStats";

export interface DailyChartLine {
  repoId: number;
  dataKey: string;
  name: string;
  stroke: string;
}

// Distinct strokes so two products are not the same line. The list repeats
// only after it is exhausted.
const SERIES_STROKES = [
  "#3E6FA3",
  "#4FA39B",
  "#6FA96B",
  "#E0A33E",
  "#C9756B",
  "#8C79B0",
  "#5C7D99",
  "#B7894C",
  "#A98DA0",
];

export interface DailyChartModel {
  data: Record<string, string | number | null>[];
  lines: DailyChartLine[];
}

// One column per repository id, not per display name: two products can share
// a name, and the later one would otherwise overwrite the earlier one's value.
// A date in the requested window with no point is a row of nulls, so the line
// breaks instead of connecting across a day the API omitted.
export function dailyChartModel(
  series: readonly DailySeries[],
  names: ReadonlyMap<number, string>,
  range: { from: string; to: string },
): DailyChartModel {
  const returned = series.flatMap((item) => item.points.map((point) => point.date));
  const dates = [...new Set([...utcDatesInclusive(range.from, range.to), ...returned])].sort();
  const lines = series.map((item, index) => ({
    repoId: item.repoId,
    dataKey: `repo-${item.repoId}`,
    name: names.get(item.repoId) ?? item.repoName,
    stroke: SERIES_STROKES[index % SERIES_STROKES.length],
  }));
  const data = dates.map((date) => {
    const row: Record<string, string | number | null> = { date };
    for (const item of series) {
      const point = item.points.find((candidate) => candidate.date === date);
      row[`repo-${item.repoId}`] = point ? point.value : null;
    }
    return row;
  });
  return { data, lines };
}
