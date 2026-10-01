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

// Business-data constants copied verbatim from the source app's
// src/configs/admin-config.js — status/result enum strings and question ids
// that decide approval logic. These are DATA, not styling, so they are
// transcribed exactly rather than redesigned; a mismatched string here
// silently breaks a status comparison or an approval rule.

export const FORM_STATUS = {
  SIGNED: "signed",
  COMPLETED: "completed",
  EDIT_COMPLETED: "edit_completed",
  PENDING: "pending",
  ACTIVE: "active",
  DRAFTED: "drafted",
  TR_DRAFTED: "tr_drafted",
  TR_EDIT_REQUESTED: "tr_edit_requested",
  FULL_EDIT_REQUESTED: "full_edit_requested",
} as const;

// Reseller form status constants as they appear in the dashboard.
export const RESELLER_FORM_STATUS = {
  COMPLETED: "Completed",
  PENDING_SIGNATURE: "Pending Signature",
  PENDING: "pending",
  EXPIRED: "expired",
  DRAFTED: "Drafted",
  REQUESTED_TO_EDIT: "Requested To Edit",
} as const;

export const TRADE_REFERENCE_STATUS = {
  COMPLETED: "completed",
  // Stored as "pending" but displayed as "requested to edit".
  PENDING: "requested to edit",
  DRAFTED: "drafted",
  DEACTIVATED: "deactivated",
  REJECTED: "rejected",
  // Stored as "active" but displayed as "pending".
  ACTIVE: "pending",
  DEFAULT: "pending",
} as const;

/** Colors a trade-reference Form Status chip, keyed by the STORED status (before the stored→shown remap). */
export function tradeReferenceStatusChipColor(status: string): StatusChipColor {
  switch (status) {
    case TRADE_REFERENCE_STATUS.COMPLETED:
      return "success";
    case "rejected":
    case "deactivated":
      return "error";
    case "pending":
      return "warning"; // requested to edit
    default:
      return "default"; // drafted / active ("pending")
  }
}

export const COLUMN_NAMES = {
  COMPANY_NAME: "Company Name",
  CONTACT_EMAIL: "Contact Email",
  CHANNEL_MANAGER_EMAIL: "Channel Manager Email",
  COUNTRY: "Country",
  REGION: "Region",
  FORM_STATUS: "Form Status",
  FINANCE_APPROVAL: "Finance Approval",
  LEGAL_APPROVAL: "Legal Approval",
} as const;

export const REGION = {
  NORTH_AMERICA: "north america",
  LATAM: "latam",
  MIDDLE_EAST: "middle east",
  ANZ: "anz",
  UK: "uk",
  EU: "eu",
  ASIA: "asia",
  AFRICA: "africa",
} as const;

export const LINK_STATUS = {
  ACTIVE: "active",
  EXPIRED: "expired",
  INACTIVE: "inactive",
} as const;

export const FINANCE_RESULT = {
  APPROVED: "approved",
  REJECTED: "rejected",
  PENDING: "pending",
  CREATOR_PENDING: "creator-pending",
  REVIEWER_PENDING: "reviewer-pending",
  APPROVAL_PENDING: "approval-pending",
} as const;

export const LEGAL_RESULT = {
  APPROVED: "approved",
  REJECTED: "rejected",
  PENDING: "pending",
} as const;

// Used in place of hardcoded strings to represent the filter map.
export const FILTERS = {
  SIGNED: "signed",
  COMPLETED: "completed",
  PENDING: "pending",
  EXPIRED: "expired",
  DRAFTED: "drafted",
  REQUESTED_TO_EDIT: "requestedToEdit",
  APPROVED: "approved",
  REJECTED: "rejected",
  CREATOR_PENDING: "creatorPending",
  REVIEWER_PENDING: "reviewerPending",
  APPROVAL_PENDING: "approvalPending",
  NORTH_AMERICA: "northAmerica",
  LATAM: "latam",
  MIDDLE_EAST: "middleEast",
  ANZ: "anz",
  UK: "uk",
  EU: "eu",
  ASIA: "asia",
  AFRICA: "africa",
  OTHER: "other",
} as const;

export const SPECIAL_APPROVAL_QID = 79;
export const LEGAL_RESULT_SUB_QID = 46;
export const LEGAL_OPINION_CATEGORY_ID = "3";
export const LEGAL_COMMENT_QUESTION_ID = 80;
export const LEGAL_APPROVAL_QUESTION_ID = 45;
export const FILE_UPLOAD_LIMIT = 5;
// Matches the "PDF, JPEG, PNG, JPG" hint shown next to every upload zone in
// this feature. Checked in useUploadPartnerFile itself, not just the
// input's `accept` attribute (a picker hint only — drag-and-drop bypasses
// it), so every caller of that hook applies the same client-side check
// without duplicating it. This is a UX guard, not an authorization
// boundary — it narrows what the picker/dropzone will hand off, but the
// backend is the actual authority on what it accepts.
export const ALLOWED_FILE_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png"]);
export const LEGAL_CHOOSE_FILE_SUBQUESTION_ID = 104;
export const FINANCE_CHOOSE_FILE_SUBQUESTION_ID = 100;
export const CREATOR_COMMENT_QUESTION_ID = 42;
export const REVIEWER_COMMENT_QUESTION_ID = 43;
export const APPROVER_COMMENT_QUESTION_ID = 44;

/** The reseller-dashboard status label shown for a row, given its form + link status. */
export function getFormStatusLabel(formStatus: string, linkStatus: string): string {
  if (linkStatus === LINK_STATUS.INACTIVE) return "Inactive";
  if (formStatus === FORM_STATUS.SIGNED) return RESELLER_FORM_STATUS.COMPLETED;
  if (formStatus === FORM_STATUS.COMPLETED || formStatus === FORM_STATUS.EDIT_COMPLETED) {
    return RESELLER_FORM_STATUS.PENDING_SIGNATURE;
  }
  if (formStatus === FORM_STATUS.TR_EDIT_REQUESTED || formStatus === FORM_STATUS.FULL_EDIT_REQUESTED) {
    return RESELLER_FORM_STATUS.REQUESTED_TO_EDIT;
  }
  if (formStatus === FORM_STATUS.DRAFTED || formStatus === FORM_STATUS.TR_DRAFTED) {
    return RESELLER_FORM_STATUS.DRAFTED;
  }
  if (formStatus === FORM_STATUS.ACTIVE && linkStatus === LINK_STATUS.EXPIRED) {
    return RESELLER_FORM_STATUS.EXPIRED;
  }
  return RESELLER_FORM_STATUS.PENDING;
}

export type StatusChipColor = "success" | "warning" | "error" | "info" | "default";

/**
 * Colors a Form Status chip, keyed by the exact label getFormStatusLabel
 * returns — shared by the Partners list and the partner dashboard header so
 * the two can't drift into different color schemes for the same status.
 *
 * "Completed" gets its own blue ("info"), not green — it means the reseller
 * finished filling out the form, not that anyone has approved anything yet.
 * Reserving "success" (green) for an actual approved decision (Finance/Legal
 * Approval columns) keeps the two from reading as the same kind of good news.
 */
export function formStatusChipColor(label: string): StatusChipColor {
  switch (label) {
    case RESELLER_FORM_STATUS.COMPLETED:
      return "info";
    case RESELLER_FORM_STATUS.EXPIRED:
      return "error";
    case RESELLER_FORM_STATUS.PENDING_SIGNATURE:
    case RESELLER_FORM_STATUS.REQUESTED_TO_EDIT:
      return "warning";
    default:
      // "pending" (drafted/active) and "Drafted" — nothing to flag yet.
      return "default";
  }
}

/**
 * Colors the Finance/Legal Approval chips — both share the same raw values.
 * Distinguishes the "nothing has happened yet" baseline ("pending") from the
 * "someone specific owes an action" states — collapsing all four pending-ish
 * values onto the same amber made "creator-pending" and plain "pending" read
 * as identical, even though one means "no one's touched this" and the other
 * means "the creator needs to act on it."
 */
export function approvalChipColor(result: string): StatusChipColor {
  switch (result) {
    case FINANCE_RESULT.APPROVED:
      return "success";
    case FINANCE_RESULT.REJECTED:
      return "error";
    case FINANCE_RESULT.PENDING:
      return "default";
    case FINANCE_RESULT.REVIEWER_PENDING:
      return "info";
    case FINANCE_RESULT.CREATOR_PENDING:
    case FINANCE_RESULT.APPROVAL_PENDING:
      return "warning";
    default:
      return "default";
  }
}
