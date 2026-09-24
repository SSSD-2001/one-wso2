/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// Claim approval: one Finance entry holding every claim waiting on the person
// looking at it, whichever app the claim came from.
//
// Approving is work you do for other people, so it does not belong under Me
// alongside the things you do for yourself. Submitting a claim and looking up
// what you submitted stay there; only the deciding moves.
//
// Just two tabs, both spanning every claim type: the per-type Expense claims
// and OPD claims tabs that used to sit beside Needs You and Decided were
// retired once those two grew the same filters (by employee, by claim id) and
// the same lead/finance toggle the per-type tabs offered — there was nothing
// left for a second, narrower view to do.
//
// Credit card is the one type with no tab here at all: its own Approve
// Submissions screen under Credit Card Expenses is the ONLY place to approve
// a card submission.

/** Permissions, resolved by `useFinanceGate().canSee`. */
export type ClaimApprovalGateId =
  /** Any claim at all is approvable by this person. */
  "claim-approval";

export interface ClaimApprovalTabDef {
  segment: string;
  label: string;
  gateId: ClaimApprovalGateId;
}

export const CLAIM_APPROVAL_PATH = "/finance/claim-approval";

export const CLAIM_APPROVAL_TABS: readonly ClaimApprovalTabDef[] = [
  // The question anyone opens this screen with — every claim waiting on them,
  // across both apps, one stage at a time via its own toggle.
  { segment: "needs-you", label: "Needs you", gateId: "claim-approval" },
  // Named "Decided", not "Decided by you": the expense DTO records
  // `financeApproverEmail` but has no lead equivalent — only `leadApprovedDate`
  // and `leadRejectedDate` — so a lead's own decisions cannot be told apart
  // from their co-leads'. Claiming otherwise would be a promise the data does
  // not keep.
  { segment: "decided", label: "Decided", gateId: "claim-approval" },
] as const;

/**
 * The first tab this person may open, or undefined when they may open none.
 * Drives the index redirect and the empty case from one place.
 */
export function firstAllowedClaimTab(
  canSee: (id: string) => boolean,
): ClaimApprovalTabDef | undefined {
  return CLAIM_APPROVAL_TABS.find((t) => canSee(t.gateId));
}
