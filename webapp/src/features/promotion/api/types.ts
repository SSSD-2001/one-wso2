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

// DTOs for the digiops-hr promotion app backend
// (digiops-hr/apps/promotion/backend). Moved out of features/my (which
// keeps only the "Last promotion" summary card + history dialog on the
// profile page) the same way PAR's types moved into features/par — this is
// the canonical home now that the Lead/Functional Lead/Promotion Board/Admin
// portals also need these.

// GET /employee-info response. Mirrors backend/types.bal's EmployeeInfo
// (outer) + EmployeeInfoWithLead (inner). All string? fields default to ""
// server-side, so treat "" the same as null when rendering.
export interface PromotionEmployeeInfoWithLead {
  workEmail: string;
  startDate: string;
  jobBand: number | null;
  joinedJobRole: string | null;
  joinedBusinessUnit: string | null;
  joinedDepartment: string | null;
  joinedTeam: string | null;
  joinedLocation: string | null;
  lastPromotedDate: string | null;
  employeeThumbnail: string | null;
  reportingLead: string;
  reportingLeadThumbnail: string;
}

export interface PromotionEmployeeInfoResponse {
  employeeInfo: PromotionEmployeeInfoWithLead;
}

// The four kinds of promotion the backend's own PromotionType enum
// (backend/enums.bal) defines. INDIVIDUAL_CONTRIBUTOR is unused today —
// source's own "Individual Contributors Promotions" route is commented out
// (route.ts) — but it's a real wire value a Lead/Admin-facing screen could
// still see on an old record, so it's part of the type rather than narrowed
// to what /me/promotion happens to render.
export type PromotionType = "NORMAL" | "SPECIAL" | "TIME_BASED" | "INDIVIDUAL_CONTRIBUTOR";

// Approved promotion request from GET /promotion/requests. Subset of the
// backend's FullPromotionRequest — only the fields the profile card, history
// dialog, and the /me/promotion timeline render. Recommendations,
// notification flags, and drafts are intentionally omitted.
export interface PromotionHistoryEntry {
  id: number;
  employeeEmail: string;
  currentJobBand: number;
  currentJobRole: string;
  nextJobBand: number;
  promotionCycle: string;
  promotionStatement: string | null;
  businessUnit: string;
  department: string;
  team: string;
  subTeam: string | null;
  promotionType: PromotionType;
  status: string;
  createdOn: string;
  updatedOn: string;
}

export interface PromotionHistoryResponse {
  promotionRequests: PromotionHistoryEntry[];
}

// GET /employee-privileges. A flat list of numeric privilege codes
// (backend/constants.bal — EMPLOYEE_PRIVILEGE=987, LEAD_PRIVILEGE=862,
// HR_ADMIN_PRIVILEGE=762, FUNCTIONAL_LEAD_PRIVILEGE=662,
// PROMOTION_BOARD_MEMBER_PRIVILEGE=562), the same shape source's own
// authSlice maps to a Role[] for route gating. This is presentation only —
// every mutating endpoint re-derives the caller's role from the JWT
// server-side and rejects a caller who doesn't hold it, the same
// "gate is cosmetic, not the boundary" relationship par-app's
// useParIsAdmin already has with its own admin check.
export interface PromotionPrivilegesResponse {
  privileges: number[];
}

export type PromotionCycleStatus = "OPEN" | "END";

// GET /promotion/cycles. Mirrors backend/modules/db/types.bal's
// PromotionCycle record.
export interface PromotionCycle {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  leadDeadline: string;
  functionalLeadDeadline: string;
  promotionBoardDeadline: string;
  status: PromotionCycleStatus;
  createdBy: string;
  createdOn: string;
  updatedBy: string;
  updatedOn: string;
}

export interface PromotionCyclesResponse {
  promotionCycles: PromotionCycle[];
}

export type RecommendationStatus = "REQUESTED" | "SUBMITTED" | "DECLINED" | "EXPIRED";

// Every status a promotion REQUEST (not the recommendation row itself) can
// carry — mirrors the digiops-hr source's own ApplicationState enum
// (utils/types.ts). A recommendation's own promotionRequestStatus is one of
// these; only a handful are reachable through the Lead Portal specifically,
// but the Admin/Promotion Board portals (not yet ported) will see the rest.
export type PromotionRequestStatus =
  | "REQUESTED"
  | "ACTIVE"
  | "SUBMITTED"
  | "DRAFT"
  | "DECLINED"
  | "WITHDRAW"
  | "REMOVED"
  | "FL_APPROVED"
  | "APPROVED"
  | "FL_REJECTED"
  | "REJECTED"
  | "EXPIRED"
  | "PROCESSING"
  | "IN_PROGRESS";

// GET /promotion/recommendations. Mirrors backend/modules/db/types.bal's
// FullPromotionRecommendation, plus employeeName — added server-side
// (service.bal's own GET handler resolves it per row via
// employee:getEmployeeName, since the base record only carries the email).
export interface PromotionRecommendation {
  requestId: number;
  promotionType: PromotionType;
  recommendationID: number;
  promotionCycleId: number;
  promotionCycle: string;
  employeeEmail: string;
  employeeName: string;
  leadEmail: string;
  recommendationStatement: string | null;
  recommendationAdditionalComment: string | null;
  recommendationStatus: RecommendationStatus;
  promotingJobBand: number;
  currentJobBand: number;
  promotionRequestStatus: PromotionRequestStatus;
  reasonForRejection: string | null;
  createdBy: string;
  createdOn: string;
  updatedBy: string;
  updatedOn: string;
}

export interface PromotionRecommendationsResponse {
  recommendations: PromotionRecommendation[];
}

// GET /employees?managerEmail=|additionalManagerEmail=. Mirrors
// backend/modules/employee/types.bal's EmployeeInfo — a roster entry for
// the Lead Portal's Team Promotion History tabs (Direct/Indirect
// Reportings). "Additional manager" is a dotted-line/secondary reporting
// relationship, distinct from managerEmail's direct-report one.
export interface PromotionEmployee {
  firstName: string;
  lastName: string;
  workEmail: string;
  jobBand: number | null;
  jobRole: string;
  employeeThumbnail: string | null;
  lastPromotedDate: string | null;
  managerEmail: string | null;
  startDate: string | null;
  employmentType: string;
  businessUnit: string;
  department: string;
  team: string | null;
  subTeam: string | null;
}

export interface PromotionEmployeesResponse {
  employees: PromotionEmployee[];
}

// GET /promotion/requests (the "full" shape — used by the Functional Lead
// Portal's grids). Mirrors backend/modules/db/types.bal's
// FullPromotionRequest exactly — notably, this does NOT carry location,
// joinDate, or lastPromotedDate, despite source's own frontend
// PromotionRequest interface (utils/types.ts) declaring those fields: they
// aren't part of the backend record at all, so any source column bound to
// them renders blank in the real running app too. Not reproduced as columns
// here.
export interface PromotionRequestFull {
  id: number;
  employeeEmail: string;
  currentJobBand: number;
  currentJobRole: string;
  nextJobBand: number;
  promotionCycle: string;
  promotionStatement: string | null;
  businessUnit: string;
  department: string;
  team: string;
  subTeam: string | null;
  recommendations: PromotionRecommendation[];
  createdBy: string;
  createdOn: string;
  updatedBy: string;
  updatedOn: string;
  promotionType: PromotionType;
  status: PromotionRequestStatus;
  reasonForRejection: string | null;
  isNotificationEmailSent: boolean;
}

export interface PromotionRequestsResponse {
  promotionRequests: PromotionRequestFull[];
}

// ---- Admin Portal ---------------------------------------------------------

// promotion-app's own Role enum (backend/enums.bal) — the same five roles
// the numeric privilege codes in usePromotionRoles.ts decode, spelled out
// here because the Admin Portal's User Management tab assigns them directly
// (a `Role[]` on a system user), rather than reading them back off a JWT.
export type PromotionRole = "HR_ADMIN" | "PROMOTION_BOARD_MEMBER" | "FUNCTIONAL_LEAD" | "EMPLOYEE" | "LEAD";

// A generic sync/import progress flag, shared by two independent
// /app-configs keys (SYNC_STATE for user sync, TIME_BASED_PROMOTION_STATE
// for time-based import) — polled while IN_PROGRESS.
export type PromotionSyncState = "IDLE" | "SUCCESS" | "ERROR" | "IN_PROGRESS";

export interface PromotionAppConfigResponse {
  appConfigs: { key: string; value: string }[];
}

// GET /business-units. Mirrors backend's BUAccessLevel tree — a business
// unit's departments, each department's teams. Used only to populate the
// Functional Lead ACL selector (which businessUnit/department/team scope a
// FUNCTIONAL_LEAD system user gets); sub-teams exist on the wire but the
// selector itself never surfaces them (source's own limitation, not a gap
// introduced here).
export interface PromotionTeamAccess {
  id: number;
  name: string;
  subTeams?: PromotionTeamAccess[];
}

export interface PromotionDepartmentAccess {
  id: number;
  name: string;
  teams?: PromotionTeamAccess[];
}

export interface PromotionBusinessUnitAccess {
  id: number;
  name: string;
  departments?: PromotionDepartmentAccess[];
}

export interface PromotionBusinessUnitsResponse {
  businessUnits: PromotionBusinessUnitAccess[];
}

// GET /users. A promotion-app system-user account — an email plus its
// Role[] and (for a FUNCTIONAL_LEAD) which part of the BU tree it can act
// on. Distinct from PromotionEmployee (the employee directory) — not every
// employee is a system user, and a system user's `email` is the only link
// back to their employee record.
export interface PromotionUser {
  id: number;
  firstName: string;
  lastName: string;
  jobBand?: number;
  email: string;
  roles: PromotionRole[];
  employeeThumbnail: string | null;
  functionalLeadAccessLevels: { businessUnits: PromotionBusinessUnitAccess[] } | null;
  active: boolean;
}

export interface PromotionUsersResponse {
  users: PromotionUser[];
}

// GET /employees?filterLeads=true|false. A narrower directory entry than
// PromotionEmployee above (no reporting/BU fields) — the User Management
// tab's employee pickers (Add User, Transfer Access) only ever render
// name/email/band/photo, and this is the shape the endpoint actually
// returns for that lookup.
export interface PromotionEmployeeDirectoryEntry {
  workEmail: string;
  firstName: string;
  lastName: string;
  jobBand: number | null;
  employeeThumbnail: string | null;
}

export interface PromotionEmployeeDirectoryResponse {
  employees: PromotionEmployeeDirectoryEntry[];
}

// POST /users body.
export interface PromotionUserInsertPayload {
  email: string;
  roles: PromotionRole[];
  functionalLeadAccessLevels?: { businessUnits: PromotionBusinessUnitAccess[] } | null;
}

// PATCH /users body — every field but `id` optional, so a caller sends only
// what it's changing (role edit, active toggle, or a Transfer Access email
// swap all reuse this one shape).
export interface PromotionUserUpdatePayload {
  id: number;
  email?: string;
  roles?: PromotionRole[];
  functionalLeadAccessLevels?: { businessUnits: PromotionBusinessUnitAccess[] } | null;
  active?: boolean;
}

// GET /promotion/history. Pre-HRIS promotions migrated out of the old
// People HR system — a separate, read-only source from every
// PromotionRequestFull above; the same person can legitimately appear in
// both (see Promotion Cycle History's own People HR Archive tab).
export interface ArchivedPromotion {
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  promotedDesignation: string;
  /** A level step-up within the same job band (e.g. Technical Lead ->
   * Technical Lead II) rather than a move to a new band — unrelated to
   * PromotionType's own "TIME_BASED". */
  inBand: boolean;
  promotionEffectiveDate: string;
}

export interface ArchivedPromotionsResponse {
  promotionHistory: ArchivedPromotion[];
}
