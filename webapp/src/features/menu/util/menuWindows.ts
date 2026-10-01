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

// The two cafeteria time windows, as data plus pure predicates.
//
// Windows are values and the checks are functions of `(now, ...)`, so every rule
// below is testable at any instant without faking a clock. The one place a real
// clock is read is useCafeteriaClock.

import {
  cafeteriaMoment,
  formatMinuteOfDay,
  normalizeSheetDate,
  type CafeteriaMoment,
} from "./menuTime";
import type { MenuMetaInfoWire } from "../api/menuTypes";

/** Minutes since IST midnight. Both ends inclusive, matching the backend. */
export interface TimeWindow {
  startMinute: number;
  endMinute: number;
}

const MINUTES_PER_DAY = 24 * 60;

/**
 * Lunch feedback, used only when the server's own configuration is unavailable.
 * The real values come from GET /meta-info — see windowFromMetaInfo.
 */
export const FEEDBACK_WINDOW_FALLBACK: TimeWindow = { startMinute: 12 * 60, endMinute: 16 * 60 + 15 };

/**
 * Dinner ordering, 16:00–19:00.
 *
 * Hard-coded because the server has no equivalent of /meta-info for it — and no
 * time check of its own either. This is a kitchen convention the UI upholds, not
 * a boundary the backend enforces.
 */
export const DINNER_WINDOW: TimeWindow = { startMinute: 16 * 60, endMinute: 19 * 60 };

/**
 * The feedback window as configured on the server, falling back when the
 * response is missing or unusable.
 *
 * Validated rather than trusted: a malformed configuration must not produce a
 * window that is permanently shut or permanently open.
 */
export function windowFromMetaInfo(meta: MenuMetaInfoWire | undefined): TimeWindow {
  const start = toMinuteOfDay(meta?.lunchFeedbackStartTime);
  const end = toMinuteOfDay(meta?.lunchFeedbackEndTime);
  if (start === null || end === null || start >= end) return FEEDBACK_WINDOW_FALLBACK;
  return { startMinute: start, endMinute: end };
}

function toMinuteOfDay(t: { hour?: number; minute?: number } | undefined): number | null {
  if (!t || typeof t.hour !== "number" || typeof t.minute !== "number") return null;
  if (!Number.isInteger(t.hour) || !Number.isInteger(t.minute)) return null;
  if (t.hour < 0 || t.hour > 23 || t.minute < 0 || t.minute > 59) return null;
  // The backend ignores the seconds component of its own configuration, so we
  // do the same rather than being stricter than the thing we mirror.
  return t.hour * 60 + t.minute;
}

/** Whether a moment is before, inside, or past a window. */
export function windowPhase(m: CafeteriaMoment, w: TimeWindow): "before" | "open" | "after" {
  if (m.minuteOfDay < w.startMinute) return "before";
  if (m.minuteOfDay > w.endMinute) return "after";
  return "open";
}

/**
 * Whether lunch feedback is open.
 *
 * Two conditions, both the server's: the menu on display must be today's on the
 * cafeteria's calendar, and the cafeteria clock must be inside the window.
 *
 * An unparseable menu date falls back to the time check alone. Refusing outright
 * would hide a working feature whenever someone typed the date oddly; letting it
 * through means at worst the server declines and says why.
 */
export function isFeedbackOpen(now: Date, menuDate: string | null | undefined, w: TimeWindow): boolean {
  const moment = cafeteriaMoment(now);
  if (windowPhase(moment, w) !== "open") return false;
  const normalized = normalizeSheetDate(menuDate);
  if (normalized === null) return true;
  return normalized === moment.dateIso;
}

/** Whether dinner ordering and changes are open. */
export function isDinnerOrderingOpen(now: Date): boolean {
  return windowPhase(cafeteriaMoment(now), DINNER_WINDOW) === "open";
}

/** "12:00 PM – 4:15 PM", for the notices. */
export function describeWindow(w: TimeWindow): string {
  return `${formatMinuteOfDay(w.startMinute)} – ${formatMinuteOfDay(w.endMinute)}`;
}

/**
 * Milliseconds until the next moment any of these windows opens or closes, or
 * the IST day rolls over — whichever comes first.
 *
 * This is what lets one timer keep the UI exact at a boundary instead of polling.
 * Always strictly positive: standing exactly on a boundary returns the distance
 * to the next one, never zero, so a re-arming timer cannot spin.
 */
export function nextBoundaryMs(now: Date, windows: readonly TimeWindow[]): number {
  const { minuteOfDay } = cafeteriaMoment(now);
  const seconds = Math.floor(now.getTime() / 1000) % 60;
  const millis = now.getTime() % 1000;

  const marks = new Set<number>([MINUTES_PER_DAY]);
  for (const w of windows) {
    marks.add(w.startMinute);
    // The minute AFTER the end is when "open" becomes "after", since the end
    // itself is inclusive.
    marks.add(w.endMinute + 1);
  }

  let bestMinutes = MINUTES_PER_DAY;
  for (const mark of marks) {
    const delta = mark - minuteOfDay;
    if (delta > 0 && delta < bestMinutes) bestMinutes = delta;
  }

  // Subtract however far we already are into the current minute.
  const ms = bestMinutes * 60_000 - (seconds * 1000 + millis);
  return Math.max(ms, 1_000);
}
