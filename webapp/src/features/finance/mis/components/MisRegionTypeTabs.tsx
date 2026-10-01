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

import MisSegmentedControl from "./MisSegmentedControl";

// Which geography Exit ARR by Region cuts its rows by.
//
// Sales Region or Sub Region. It
// commits on click, like the Table and unit tabs above it, because it is not a
// narrowing of the report — it is a different cut of it, and the backend
// computes it (`isSalesRegionSummary` in the request body).
//
// ---- why this is not in the address bar ------------------------------------
//
// Every other control on this screen is in the URL; this one is not, and the
// asymmetry is deliberate rather than an omission. It is component state that
// dies with the table, so it is not in the Applied set, it is not serialised,
// and no link anyone holds carries it. Putting it in the query string would
// promise a shared view this screen does not have, including what an
// unrecognised value degrades to and what a stale link means. Worth its own
// decision rather than a side effect of building the table.
//
// The consequence, stated plainly so nobody has to discover it: a reader who
// shares a Sub Region view sends a Sales Region one.

const REGION_TYPE_OPTIONS = [
  { value: "sales", label: "Sales Region" },
  { value: "sub", label: "Sub Region" },
] as const;

export default function MisRegionTypeTabs({
  bySalesRegion,
  onChange,
}: {
  bySalesRegion: boolean;
  onChange: (bySalesRegion: boolean) => void;
}) {
  return (
    <MisSegmentedControl
      label="Region Type"
      value={bySalesRegion ? "sales" : "sub"}
      options={REGION_TYPE_OPTIONS}
      onChange={(next) => onChange(next === "sales")}
    />
  );
}
