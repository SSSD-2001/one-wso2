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

import { isSecurityBackendConfigured } from "@config/apiConfig";
import { SECURITY_ITEM_PRIVILEGE } from "@constants/securityApps";
import { useRiskPrivileges } from "@features/security/grc/modules/risk/hooks/useRiskPrivileges";
import { useAuditPrivileges } from "@features/security/grc/modules/audit/hooks/useAuditPrivileges";
import { useAdminPrivileges } from "@features/security/grc/modules/admin/hooks/useAdminPrivileges";

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

  const isResolving = active && (risk.loading || audit.loading || admin.loading);

  // Routed by prefix because each module has its own hook and its own cache.
  // All three fetch the SAME endpoint and would answer identically — the split
  // is the source's structure, not a difference in authority. Admin is the
  // fallback because its privileges (MANAGE_*) carry no shared prefix.
  const can = (privilege: string): boolean => {
    if (privilege.startsWith("RISK_")) return risk.can(privilege);
    if (privilege.startsWith("AUDIT_")) return audit.can(privilege);
    return admin.can(privilege);
  };

  const canSee = (itemId: string): boolean => {
    // Fail closed while resolving, while inactive, and for an id nobody mapped —
    // an unmapped item is a registry mistake, not an invitation.
    if (!active || isResolving) return false;
    const required = SECURITY_ITEM_PRIVILEGE[itemId];
    return required ? can(required) : false;
  };

  return {
    canSee,
    isAuthorized: Object.keys(SECURITY_ITEM_PRIVILEGE).some((id) => canSee(id)),
    isResolving,
  };
}
