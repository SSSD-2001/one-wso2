/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import type { ExpenseClaim } from "../expenseTypes";

/**
 * `/search-claims` returns `submittedBy` alongside `employeeEmail` — who filed
 * the claim, as opposed to who it is for. The shared `ExpenseClaim` does not
 * name it because the Me-side screens never differ on it, so this view adds it
 * rather than widening the type the other expense screens also depend on.
 */
export interface ApprovalClaim extends ExpenseClaim {
  submittedBy?: string | null;
}

/**
 * utils.ts#isOnBehalfOfClaim — a claim filed by someone other than the person
 * it belongs to. `submittedBy` is absent on older records, which read as own.
 */
export function isOnBehalfOfClaim(claim: ApprovalClaim): boolean {
  return Boolean(claim.submittedBy) && claim.submittedBy !== claim.employeeEmail;
}

/**
 * utils.ts#getOnBehalfOfParty — an on-behalf claim has two people on it, and
 * which one is worth naming depends on which side of it the viewer sits. If
 * they filed it, it was submitted FOR the employee; if somebody else filed it,
 * it was submitted BY that person. Either way the party named is the other
 * one, never the viewer. Null for a claim nobody filed on behalf of.
 */
export interface OnBehalfOfParty {
  label: "Submitted for" | "Submitted by";
  email: string;
}

export function onBehalfOfParty(
  claim: ApprovalClaim,
  viewerEmail: string | null | undefined,
): OnBehalfOfParty | null {
  if (!isOnBehalfOfClaim(claim)) return null;
  return Boolean(viewerEmail) && claim.submittedBy === viewerEmail
    ? { label: "Submitted for", email: claim.employeeEmail }
    : { label: "Submitted by", email: claim.submittedBy! };
}

/**
 * Resolve a work email to a display name, falling back to the address when the
 * employee list has not arrived or does not carry one. Names are what the
 * source shows on screen (`UserCard.tsx`); the address belongs in a tooltip.
 */
export function makeNameResolver(
  employees: { workEmail: string; firstName: string | null; lastName: string | null }[] | undefined,
) {
  const byEmail = new Map((employees ?? []).map((e) => [e.workEmail, e]));
  return (email: string | null | undefined): string => {
    if (!email) return "";
    const match = byEmail.get(email);
    const name = match && [match.firstName, match.lastName].filter(Boolean).join(" ").trim();
    return name || email;
  };
}
