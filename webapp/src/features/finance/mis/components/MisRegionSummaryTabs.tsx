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

// Which of the Region Summary's two views is on screen.
//
// Exit ARR and All ARR Metrics. Exit ARR is the default.
//
// The two are one Table asked two ways: Exit ARR is each region's BALANCE at
// the column's date, split by business unit, and All ARR Metrics is each
// region's MOVEMENT over the column, narrowed to one business unit. So they do
// not share a body, a row builder or a cache entry — only their rows, which
// both take from the response.
//
// Component state rather than the address bar, like the Region Type control
// beside it and for the same reason: it is table state, so it reaches no
// link anyone holds, and moving it into the URL would extend that contract.
// The same question stands for both controls.

/** The two views, and the word each is known by. */
export const MIS_REGION_SUMMARY_VIEWS = {
  EXIT_ARR: "exit-arr",
  ALL_ARR_METRICS: "all-arr-metrics",
} as const;

export type MisRegionSummaryView =
  (typeof MIS_REGION_SUMMARY_VIEWS)[keyof typeof MIS_REGION_SUMMARY_VIEWS];

/**
 * What each view is called, everywhere it is named.
 *
 * Exported because the name is not only this control's: it is the grid's
 * accessible name, the export sheet's name and the exported filename. One
 * spelling, so a reader searching for what they clicked finds all four.
 */
export const MIS_REGION_SUMMARY_VIEW_LABELS: Readonly<Record<MisRegionSummaryView, string>> = {
  [MIS_REGION_SUMMARY_VIEWS.EXIT_ARR]: "Exit ARR",
  [MIS_REGION_SUMMARY_VIEWS.ALL_ARR_METRICS]: "All ARR Metrics",
};

const REGION_SUMMARY_OPTIONS = Object.values(MIS_REGION_SUMMARY_VIEWS).map((value) => ({
  value,
  label: MIS_REGION_SUMMARY_VIEW_LABELS[value],
}));

export default function MisRegionSummaryTabs({
  view,
  onChange,
}: {
  view: MisRegionSummaryView;
  onChange: (view: MisRegionSummaryView) => void;
}) {
  return (
    <MisSegmentedControl
      label="View"
      // "View" alone is the word the FILTER BAR spends on geography, so the
      // group says which View it is to anyone who cannot see it sitting over
      // the Region Summary.
      ariaLabel="Region Summary view"
      value={view}
      options={REGION_SUMMARY_OPTIONS}
      onChange={onChange}
    />
  );
}
