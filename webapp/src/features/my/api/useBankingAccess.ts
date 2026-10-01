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

// Who may use the Banking page: callers the banking backend itself says are
// employees. The source banking webapp keeps an EMPLOYEE_ROLE group name in its
// own config and matches it against the browser's group list; here the backend
// answers directly (GET /employee-privileges), from the roles it enforces, so
// there is no group name to keep in step and no chance of the two disagreeing.
// Same rule for the rail entry, the route and the overview card, so the menu
// and the screen cannot disagree.
//
// Presentation only, like every gate here: every banking endpoint still
// re-checks the caller, so this decides what is worth showing, never what is
// allowed.
//
// Two deliberate non-gating cases, both because hiding the page is the worse
// mistake when the answer is simply unavailable:
//  - no banking backend configured: the page itself says "not configured";
//  - the backend has no such route yet (a 404, or — because a gateway answers
//    an unknown route without CORS headers — a request that fails with no
//    HTTP status at all): there is nothing to gate on yet, and a rollout
//    order must not hide the page. A 5xx from a backend that does have the
//    route is a real failure and shows a retry.
export interface BankingAccess {
  /** May this caller see the Banking entry and page? Fails closed while resolving. */
  canSee: boolean;
  /** True while the backend has not answered — never redirect on this. */
  isResolving: boolean;
  /** The check itself failed (not a refusal), so a retry is worth offering. */
  isError: boolean;
  errorMessage?: string;
  retry: () => void;
}

export function useBankingAccess(enabled = true): BankingAccess {
  const backendConfigured = Boolean(bankingBackendUrl);
  const privileges = useBankingPrivileges(enabled && backendConfigured);
  const retry = () => void privileges.refetch();

  if (!backendConfigured) {
    return { canSee: true, isResolving: false, isError: false, retry };
  }

  // Not asked (a perspective without a Banking entry): nothing to wait for.
  if (!enabled) return { canSee: false, isResolving: false, isError: false, retry };

  if (privileges.isPending) return { canSee: false, isResolving: true, isError: false, retry };

  if (privileges.isError) {
    const status = privileges.error instanceof HttpError ? privileges.error.status : undefined;
    // The backend turns away a caller who holds no banking role at all.
    if (status === 403) return { canSee: false, isResolving: false, isError: false, retry };
    // No route to ask yet: no HTTP status at all, or a plain 404.
    if (status === undefined || status === 404) {
      return { canSee: true, isResolving: false, isError: false, retry };
    }
    return {
      canSee: false,
      isResolving: false,
      isError: true,
      errorMessage: "Couldn't check your access to Banking.",
      retry,
    };
  }

  return { canSee: Boolean(privileges.data?.isEmployee), isResolving: false, isError: false, retry };
}

/** Rail and landing facts. BankingRoute still retries a failed privileges read; the landing does not. */
export function bankingVisibility(access: BankingAccess): VisibilityAnswer {
  return {
    canSee: () => access.canSee,
    resolving: access.isResolving,
    retry: () => undefined,
  };
}
