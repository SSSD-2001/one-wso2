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

import type { ParLegacyQuestionAnswer, ParLegacyThreeSixtyReview } from "../api/types";

// Ports HistoryPanel.tsx's own hasLegacyContent: a legacy text field is
// "empty" both when it's genuinely blank and when the migration wrote the
// literal string "N/A" into it.
export function hasLegacyContent(text: string | null | undefined): boolean {
  return Boolean(text) && text!.trim() !== "" && text!.trim().toUpperCase() !== "N/A";
}

// Ports utils/types.ts's own parseLegacyQuestionAnswers/parseLegacyFeedback360:
// both fields are raw JSON strings on the wire; a parse failure reads as "no
// data" rather than throwing.
export function parseLegacyQuestionAnswers(json: string | null): ParLegacyQuestionAnswer[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as ParLegacyQuestionAnswer[]) : [];
  } catch {
    return [];
  }
}

export function parseLegacyFeedback360(json: string | null): ParLegacyThreeSixtyReview[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as ParLegacyThreeSixtyReview[]) : [];
  } catch {
    return [];
  }
}

// Legacy data has no overallRating/overallSpecialRating in the database —
// both are always null (never added to the new legacy_* tables). This
// derives a display-only rating from the manager's legacy PeopleHR score
// code instead: 1->Top 5%, 2->Top 20%, 3->Successful, 4->Needs Improvements.
// Score 5 and anything else intentionally has no mapping yet. UI-only —
// never touches par-app's own current-cycle rating logic.
export function deriveLegacyRatingFromScore(score: number | null): { rating: string | null; special: string | null } {
  switch (score) {
    case 1:
      return { rating: "Successful", special: "TOP5P" };
    case 2:
      return { rating: "Successful", special: "TOP20P" };
    case 3:
      return { rating: "Successful", special: null };
    case 4:
      return { rating: "Needs Improvements", special: null };
    default:
      return { rating: null, special: null };
  }
}

// Legacy cycle names follow the same "<Year> Performance Evaluation - H1/H2"
// convention as the current app — derive display dates from that, since the
// legacy PeopleHR system doesn't expose explicit cycle start/end dates.
// Used purely for sort ordering of the merged (real + legacy) cycle picker.
export function deriveLegacyCycleDates(cycleName: string): { startDate: string | null; endDate: string | null } {
  const match = cycleName.match(/(\d{4}).*H([12])/);
  if (!match) return { startDate: null, endDate: null };
  const [, year, half] = match;
  return half === "1"
    ? { startDate: `${year}-01-01`, endDate: `${year}-06-30` }
    : { startDate: `${year}-07-01`, endDate: `${year}-12-31` };
}
