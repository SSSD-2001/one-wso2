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

// Wire types for the Echo (meet-app) backend. Mirrored from the service's own
// Ballerina records rather than from the standalone webapp's Redux slice, so
// the field names here are the ones actually on the wire.

/** `meeting_status` — whether the calendar event still stands. */
export type MeetingStatus = "ACTIVE" | "CANCELLED";

/**
 * Server-computed, relative to now — NOT derived from startTime on the client.
 * The backend decides this so a stale tab can't disagree with it.
 */
export type TimeStatus = "PAST" | "UPCOMING";

/** One row of the meeting list. */
export interface Meeting {
  meetingId: number;
  title: string;
  googleEventId: string;
  host: string;
  /** Naive datetime string, no zone suffix — always UTC. See util/salesTime. */
  startTime: string;
  endTime: string;
  /** Comma-separated emails, not an array. Split for display only. */
  internalParticipants: string;
  /**
   * External (non-wso2.com) attendees, comma-separated.
   *
   * Null on meetings recorded before the pipeline captured them — which is NOT the same as
   * a meeting that genuinely had none, and the UI says so rather than showing an empty list
   * that implies nobody external was there.
   */
  externalParticipants?: string | null;
  meetingStatus: MeetingStatus;
  timeStatus?: TimeStatus;
  isRecurring: boolean;

  // ---- Salesforce context -------------------------------------------------
  // All optional, and routinely absent. A meeting scheduled through meet-app's
  // own form has no Salesforce link at all; one linked by the calendar add-on
  // carries only whichever of account / opportunity its call type targets.

  /**
   * The call type picked in the add-on, or the category parsed from the title
   * on older scheduled meetings.
   */
  meetingType?: string | null;
  /** Salesforce Opportunity id. Null for account- and lead-targeted calls. */
  opportunityId?: string | null;
  /** Deal snapshot, a JSON STRING. Parse with parseOpportunityDetails. */
  opportunityDetails?: string | null;
  /** Salesforce Account id, for calls that target an account rather than a deal. */
  accountId?: string | null;
  /** The account's display name, denormalised at link time. */
  accountName?: string | null;
}

/**
 * The deal snapshot the add-on writes, as it appears once parsed.
 *
 * Every field is optional: this is a JSON string produced by another codebase
 * and stored verbatim, so the shape is a description of what it usually holds
 * rather than a contract this app can rely on.
 */
export interface OpportunityDetails {
  customerId?: string;
  customerName?: string;
  stage?: string;
  recordType?: string | null;
  amount?: number;
  currency?: string;
  closeDate?: string;
  createdDate?: string;
  isClosed?: boolean;
}

/** Human labels for the add-on's call types. */
const MEETING_TYPE_LABELS: Record<string, string> = {
  inbound: "Inbound",
  outbound: "Outbound",
  monthly_weekly: "Monthly / weekly sync",
  renewal: "Renewal / convert",
  first_sale: "First sale",
  expansion: "Expansion",
  internal: "Internal prep",
};

/**
 * Label for a call type, falling back to the raw value.
 *
 * The fallback is the point: unknown values are shown, not hidden. A value this
 * app has never heard of still says something true about the meeting.
 */
export function meetingTypeLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return MEETING_TYPE_LABELS[value] ?? value;
}

/**
 * Parse the deal snapshot, tolerating anything.
 *
 * Returns null rather than throwing on malformed JSON: the string is written by
 * the calendar add-on and stored without validation, so one bad row must not
 * take down the table it appears in.
 */
export function parseOpportunityDetails(
  raw: string | null | undefined,
): OpportunityDetails | null {
  if (!raw?.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as OpportunityDetails;
  } catch {
    return null;
  }
}

/**
 * The customer to show for a meeting, from whichever link the call type produced.
 *
 * Account first: it is set for account-targeted calls, which includes the
 * add-on's default type and so is the common case. The snapshot's customerName
 * covers opportunity-targeted calls, which have no account row of their own.
 */
export function meetingCustomer(meeting: Meeting): string | null {
  if (meeting.accountName?.trim()) return meeting.accountName.trim();
  const details = parseOpportunityDetails(meeting.opportunityDetails);
  return details?.customerName?.trim() || null;
}

/** `GET /meetings` — `count` is the unpaged total, for server-side paging. */
export interface MeetingList {
  count: number;
  meetings: Meeting[];
}

/**
 * A Drive file attached to the meeting's calendar event.
 *
 * Links only — the backend returns no file content, which is why the
 * attachments dialog can only ever open these in a new tab. The Gong-style
 * in-app player needs endpoints that do not exist yet.
 */
export interface Attachment {
  fileId: string;
  title: string;
  fileUrl: string;
  iconLink: string;
  mimeType: string;
}

export interface AttachmentList {
  attachments: Attachment[];
}

/**
 * `GET /meetings/{id}/playback` — where to stream the recording from, and until when.
 *
 * The URL carries its own credential in the query string, because a `<video src>` cannot
 * send an Authorization header. It is therefore short-lived and names one file and one
 * viewer; see the backend's modules/playback.
 */
export interface PlaybackUrl {
  url: string;
  /** ISO-8601. Returned so a player can refresh before a viewer meets a stall. */
  expiresAt: string;
}

/** One utterance in a transcript. */
export interface TranscriptLine {
  /** Display name, resolved from the conference's participants. */
  speaker: string;
  text: string;
  /**
   * Where the line sits in the RECORDING — what the player seeks to.
   *
   * Approximate: Meet timestamps lines against the wall clock, and converting to a player
   * position needs the moment recording began, which the transcript does not carry. The
   * conference's start is used instead. For calls that auto-record from the start — which
   * is all of these — the two coincide.
   */
  offsetSeconds: number;
  startTime: string;
  endTime: string;
}

export interface Transcript {
  lines: TranscriptLine[];
}

export interface SmartNotes {
  text: string;
}

/** Seconds to `m:ss` / `h:mm:ss`, for a transcript's timestamp column. */
export function formatOffset(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** `GET /regions` — a bare string list under one key. */
export interface Regions {
  regions: string[];
}

/**
 * `GET /user-info`. `privileges` is what useSalesGate reads; the rest is here
 * because the same response identifies the caller for the host comparison that
 * decides whether Delete is offered.
 */
export interface SalesUserInfo {
  employeeId: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  employeeThumbnail: string | null;
  jobRole: string;
  privileges: number[];
}

/**
 * meet-app's own privilege numbers, unrelated to the people-app numbers the
 * rest of One WSO2 uses for its four capabilities. 762 is the meet-app admin
 * and 987 an ordinary member of the team; a caller with neither is refused by
 * the backend on every endpoint.
 */
export const SALES_PRIVILEGE = {
  ADMIN: 762,
  TEAM: 987,
} as const;

/** Which meetings the list is showing — the Past/All radio. */
export type MeetingScope = "past" | "all";
