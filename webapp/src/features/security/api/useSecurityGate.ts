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

import type { VisibilityAnswer } from "@components/side-rail/visibilityFold";
import { isEvidencePortalBackendConfigured, isSecurityBackendConfigured } from "@config/apiConfig";
import { EVIDENCE_ADMIN_ONLY_ITEM_IDS, EVIDENCE_ITEM_IDS, SECURITY_ITEM_PRIVILEGE } from "@constants/securityApps";
import { useRiskPrivileges } from "@features/security/grc/modules/risk/hooks/useRiskPrivileges";
import { useAuditPrivileges } from "@features/security/grc/modules/audit/hooks/useAuditPrivileges";
import { useAdminPrivileges } from "@features/security/grc/modules/admin/hooks/useAdminPrivileges";
import { useCurrentUser } from "@features/security/evidence-portal/hooks/useCurrentUser";

export interface SecurityGate {
  canSee: (itemId: string) => boolean;
  isAuthorized: boolean;
  isResolving: boolean;
}

// Decides what the rail and the overview show.
//
// DELIBERATELY BUILT ON THE LIFTED HOOKS rather than a fresh query. They are
// what the lifted screens' own PrivilegeGuards consult, so composing them here
// means the rail and the pages cannot disagree about who may see what. A
// separate implementation would be a second copy of the access rule in the
// browser, which is how the two drift.
//
// The cost is inherited, and it is real:
//   - the three hooks fire GET /me/privileges separately, so a Security page
//     load makes three identical calls
//   - each caches in a module-level promise that is NOT keyed on the user, so
//     signing out and back in as someone else in the same tab can serve the
//     previous user's decision until a reload. The audit one is the strict
//     case: it never clears its promise at all, so it caches the first user's
//     answer for the tab's whole lifetime
//   - a failed call resolves to an empty privilege set, making a gateway
//     timeout indistinguishable from "you have no grants"
//
// Those are the source's behaviour today, running in production. Reproducing
// them is the point of lifting; fixing them here would be a rewrite by another
// name, and would put this app's answer out of step with the screens'.
export function useSecurityGate(enabled = true): SecurityGate {
  // `enabled` MUST reach the hooks, not just the derived state below. The side
  // rail asks for this gate on every perspective, so passing it only to
  // `isResolving` left both hooks fetching on every page load — for every user
  // of this app, including everyone with no GRC access, who then saw the 401s
  // in their console. Also gated on `configured`: with no backend URL there is
  // nothing to call.
  const active = enabled && isSecurityBackendConfigured();
  const risk = useRiskPrivileges(active);
  const audit = useAuditPrivileges(active);
  const admin = useAdminPrivileges(active);

  // Evidence Portal's own gate, independent of `active` above: it has its own
  // backend and its own address setting (isEvidencePortalBackendConfigured),
  // unrelated to the GRC one isSecurityBackendConfigured checks. Off whenever
  // the gate itself is disabled or that address is unset — same reasoning as
  // `active`, so a user with no Security access at all still makes no
  // Evidence request either.
  //
  // useCurrentUser (not a fresh query) is the SAME hook the Evidence pages
  // call for their own admin/engineer UI — sharing it, rather than a second
  // reimplementation, is what keeps the rail and the pages from disagreeing,
  // same reasoning as composing the three GRC hooks above. It reads One
  // WSO2's access token directly (see its own comment) rather than through
  // `registerAuth`, because this gate runs on every Security page — long
  // before the Evidence route layout that calls `registerAuth` ever mounts —
  // and both share the exact same react-query key ("me"), so whichever one
  // asks first, the other reuses the answer instead of asking again.
  const evidenceActive = enabled && isEvidencePortalBackendConfigured();
  const evidence = useCurrentUser(evidenceActive);
  const evidenceResolving = evidenceActive && !evidence.isLoaded;

  // Kept apart from the GRC-only value below: Evidence resolves on its own
  // schedule (its own backend, its own query), and folding it into the same
  // flag would make a Risk/Audit/Admin item flicker to "hidden" while ONLY
  // Evidence is still answering.
  const grcResolving = active && (risk.loading || audit.loading || admin.loading);
  const isResolving = grcResolving || evidenceResolving;

  // Routed by prefix because each module has its own hook and its own cache.
  // All three fetch the SAME endpoint and would answer identically — the split
  // is the source's structure, not a difference in authority. Admin is the
  // fallback because its privileges (MANAGE_*) carry no shared prefix.
  const can = (privilege: string): boolean => {
    if (privilege.startsWith("RISK_")) return risk.can(privilege);
    if (privilege.startsWith("AUDIT_")) return audit.can(privilege);
    return admin.can(privilege);
  };

  // Evidence visibility: an engineer sees every Evidence item except the
  // admin-only ones (Catalogue, Cost — EVIDENCE_ADMIN_ONLY_ITEM_IDS); an
  // admin sees all of them; a 403 (isForbidden) or any role /api/me did not
  // return "engineer" or "admin" for hides everything; and, like every GRC
  // check below, this fails closed while unconfigured, disabled, or still
  // resolving.
  const canSeeEvidence = (itemId: string): boolean => {
    if (!evidenceActive || evidenceResolving) return false;
    if (evidence.isForbidden || !(evidence.isAdmin || evidence.isEngineer)) return false;
    if (EVIDENCE_ADMIN_ONLY_ITEM_IDS.has(itemId)) return evidence.isAdmin;
    return true;
  };

  const canSee = (itemId: string): boolean => {
    if (EVIDENCE_ITEM_IDS.has(itemId)) return canSeeEvidence(itemId);

    // Fail closed while resolving, while inactive, and for an id nobody mapped —
    // an unmapped item is a registry mistake, not an invitation.
    if (!active || grcResolving) return false;
    const required = SECURITY_ITEM_PRIVILEGE[itemId];
    return required ? can(required) : false;
  };

  const allItemIds = [...Object.keys(SECURITY_ITEM_PRIVILEGE), ...EVIDENCE_ITEM_IDS];

  return {
    canSee,
    isAuthorized: allItemIds.some((id) => canSee(id)),
    isResolving,
  };
}

/** A failed privilege read means the section is not allowed. The landing does not retry it. */
export function securityVisibility(gate: SecurityGate): VisibilityAnswer {
  return {
    canSee: (id) => gate.canSee(id),
    resolving: gate.isResolving,
    retry: () => undefined,
  };
}
