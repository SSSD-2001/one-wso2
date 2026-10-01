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

// Wire and domain types for the cafeteria menu backend.
//
// Source of truth for the wire shapes: the standalone service's `types.bal`,
// `modules/people/types.bal`, and the record returned by its `get meta-info`
// resource. Field names below mirror the JSON exactly; the domain types beside
// them are what the UI actually works with.

import {
  CookieIcon,
  CroissantIcon,
  CupSodaIcon,
  DrumstickIcon,
  FishIcon,
  SaladIcon,
  SandwichIcon,
  UtensilsCrossedIcon,
  type LucideIcon,
} from "@wso2/oxygen-ui-icons-react";

// --- wire ------------------------------------------------------------------

/** One meal slot as sent. An unlisted meal arrives as empty strings, not nulls. */
export interface MenuMetaDataWire {
  title: string;
  description: string;
}

export interface MenuWire {
  date: string;
  breakfast: MenuMetaDataWire;
  juice: MenuMetaDataWire;
  lunch: MenuMetaDataWire;
  dessert: MenuMetaDataWire;
  snack: MenuMetaDataWire;
}

/** The service sends seconds too; the window logic ignores them, as it does. */
export interface TimeOfDayWire {
  hour: number;
  minute: number;
  second?: number;
}

export interface MenuMetaInfoWire {
  lunchFeedbackStartTime: TimeOfDayWire;
  lunchFeedbackEndTime: TimeOfDayWire;
}

/** The employee profile, plus the privileges the service resolves from groups. */
export interface MenuUserInfo {
  employeeId: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  jobRole: string;
  department: string;
  team: string | null;
  managerEmail: string;
  employeeThumbnail?: string | null;
  privileges: number[];
}

/**
 * Privilege numbers the service issues.
 *
 * Recorded for completeness only. **Nothing branches on these** — the standalone
 * app rendered identical UI for both, because the menu itself is maintained in a
 * spreadsheet and there is nothing here for an administrator to do. The absence
 * of a capability gate in this feature is deliberate, not unfinished.
 */
export const MENU_PRIVILEGE = { ADMIN: 789, EMPLOYEE: 987 } as const;

// --- domain ----------------------------------------------------------------

export type MealKey = "breakfast" | "juice" | "lunch" | "dessert" | "snack";

/** A meal slot after normalisation: blank titles become null. */
export interface Meal {
  title: string | null;
  description: string | null;
}

export interface DailyMenu {
  /** `YYYY-MM-DD`, or null when the spreadsheet cell wasn't a date. */
  date: string | null;
  meals: Record<MealKey, Meal>;
}

export type MealOption = "Chicken" | "Fish" | "Vegetarian";

/**
 * The current dinner order.
 *
 * `mealOption` is a plain string, not MealOption: the column it comes from is
 * unconstrained, so a value outside the three is representable. Keeping it wide
 * means an unexpected value renders as an order you can cancel, rather than as
 * no order at all.
 */
export interface DinnerOrder {
  id: number;
  mealOption: string;
  /** The date the order is FOR, `YYYY-MM-DD` where parseable. */
  date: string;
}

export interface DinnerPayload {
  /** Present only when changing an existing order. */
  id?: number;
  mealOption: MealOption;
  date: string;
  department: string;
  team: string | null;
  managerEmail: string;
}

// --- display tables --------------------------------------------------------

/**
 * The meal slots, in the order they are served and therefore displayed.
 *
 * An ordered array rather than a keyed object on purpose: the standalone app
 * relied on the insertion order of the JSON response, which is not a contract.
 *
 * `timeRange` is a label. It gates nothing — only the two windows in
 * menuWindows.ts do.
 */
export const MEAL_SLOTS: readonly {
  key: MealKey;
  label: string;
  icon: LucideIcon;
  timeRange: string;
  feedback: boolean;
}[] = [
  { key: "breakfast", label: "Breakfast", icon: CroissantIcon, timeRange: "07:30 – 09:30", feedback: false },
  { key: "juice", label: "Juice", icon: CupSodaIcon, timeRange: "10:30 – 11:00", feedback: false },
  { key: "lunch", label: "Lunch", icon: UtensilsCrossedIcon, timeRange: "12:00 – 14:00", feedback: true },
  { key: "dessert", label: "Dessert", icon: CookieIcon, timeRange: "12:00 – 14:00", feedback: false },
  { key: "snack", label: "Snack", icon: SandwichIcon, timeRange: "15:30 – 16:30", feedback: false },
];

export const MEAL_OPTIONS: readonly { value: MealOption; label: string; icon: LucideIcon }[] = [
  { value: "Chicken", label: "Chicken", icon: DrumstickIcon },
  { value: "Fish", label: "Fish", icon: FishIcon },
  { value: "Vegetarian", label: "Vegetarian", icon: SaladIcon },
];

export function isMealOption(value: string): value is MealOption {
  return MEAL_OPTIONS.some((o) => o.value === value);
}
