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
import { HttpError } from "@api/http";
import { bankingBackendUrl } from "@config/apiConfig";
import { useBankingPrivileges } from "./useBankingPrivileges";

// Who may reach the Banking admin screens (Change Requests, Report, Employee
// Operations, Admin): a People Ops or Finance admin, per the same
// GET /employee-privileges the employee gate (useBankingAccess) already
// reads.
//
// Deliberately the OPPOSITE default from useBankingAccess in every case
// where the real answer isn't known yet — backend not configured, the
// privileges route not deployed yet, or the fetch still in flight. That
// hook defaults OPEN in those cases because the worst case is showing
// someone their own accounts screen. This one defaults CLOSED, because an
// unknown answer here would otherwise show every employee other people's
// bank records and admin actions.
export interface BankingAdminAccess {
  /** May this caller reach the Banking admin screens? Fails closed. */
  canSee: boolean;
  /** True while the backend has not answered — never redirect on this. */
  isResolving: boolean;
  /** The check itself failed (not a refusal), so a retry is worth offering. */
  isError: boolean;
  errorMessage?: string;
  retry: () => void;
}

export function useBankingAdminAccess(enabled = true): BankingAdminAccess {
  const backendConfigured = Boolean(bankingBackendUrl);
  const privileges = useBankingPrivileges(enabled && backendConfigured);
  const retry = () => void privileges.refetch();

  if (!enabled || !backendConfigured) {
    return { canSee: false, isResolving: false, isError: false, retry };
  }

  if (privileges.isPending) return { canSee: false, isResolving: true, isError: false, retry };

  if (privileges.isError) {
    const status = privileges.error instanceof HttpError ? privileges.error.status : undefined;
    // No banking role at all (403), or the privileges route doesn't exist
    // yet (404 / no status at all): both read as "not an admin", never as
    // "let them in" — unlike useBankingAccess, a rollout gap here must not
    // default to showing admin screens to everyone.
    if (status === 403 || status === undefined || status === 404) {
      return { canSee: false, isResolving: false, isError: false, retry };
    }
    return {
      canSee: false,
      isResolving: false,
      isError: true,
      errorMessage: "Couldn't check your access to Banking.",
      retry,
    };
  }

  return {
    canSee: Boolean(privileges.data?.isPeopleOperationsAdmin || privileges.data?.isFinanceAdmin),
    isResolving: false,
    isError: false,
    retry,
  };
}

/** Rail and landing facts. A failed read hides the admin section; the landing does not retry it. */
export function bankingAdminVisibility(access: BankingAdminAccess): VisibilityAnswer {
  return {
    canSee: () => access.canSee,
    resolving: access.isResolving,
    retry: () => undefined,
  };
}
