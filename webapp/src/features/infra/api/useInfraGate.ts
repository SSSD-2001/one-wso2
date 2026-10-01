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
import { INFRA_APPS } from "@constants/infraApps";
import { HttpError } from "@api/http";
import { describeError } from "@api/errors";
import { INFRA_PRIVILEGE } from "./infraTypes";
import {
    isInfraBackendConfigured,
    useInfraUserInfo,
  } from "./useInfraUserInfo";

const RESTRICTED_IDS = new Set(
  INFRA_APPS.flatMap((app) => app.items)
    .filter((it) => it.requires && it.requires.length > 0)
    .map((it) => it.id),
);

const EMPLOYEE_IDS = new Set([
  "infra-github-new-repository",
  "infra-github-repository-access",
  "infra-github-request-access",
  "infra-github-my-requests",
  "infra-security-dashboard",
]);

export interface InfraGate {
        canSee: (itemId: string) => boolean;
        isAuthorized: boolean;
        isEmployee: boolean;
        isApprover: boolean;
        isAdmin: boolean;
        isResolving: boolean;
        isForbidden: boolean;
        isError: boolean;
        errorMessage?: string;
        retry: () => void;
    }
    export function useInfraGate(enabled = true): InfraGate {  
        const effectiveEnabled = enabled && isInfraBackendConfigured();
        const userInfo = useInfraUserInfo(effectiveEnabled);
        const privileges = userInfo.data?.privileges ?? [];
        const isEmployee = privileges.includes(INFRA_PRIVILEGE.EMPLOYEE);
        const isApprover = privileges.includes(INFRA_PRIVILEGE.APPROVER);
        const isAdmin = privileges.includes(INFRA_PRIVILEGE.ADMIN);
        const isAuthorized = isEmployee || isApprover || isAdmin;
        const isForbidden =
            effectiveEnabled &&
            userInfo.error instanceof HttpError &&
            userInfo.error.status === 403;
        
        const canSee = (itemId: string): boolean => {
            if (!isAuthorized) return false;
            switch (itemId) {
            case "infra-github-review-requests":
                return isApprover || isAdmin;
            case "infra-github-settings":
                return isAdmin;
            default:
                if (EMPLOYEE_IDS.has(itemId)) return isEmployee;
                return !RESTRICTED_IDS.has(itemId);
            }
        };

        const isError = effectiveEnabled && userInfo.isError && !isForbidden;

    return {
        canSee,
        isAuthorized,
        isEmployee,
        isApprover,
        isAdmin,
        isResolving: effectiveEnabled && userInfo.isPending,
        isForbidden,
        isError,
        errorMessage:
        effectiveEnabled && userInfo.isError
            ? describeError(userInfo.error)
            : undefined,
        retry: () => void userInfo.refetch(),
    };
}

export function infraVisibility(gate: InfraGate): VisibilityAnswer {
  return gate.isError
    ? { canSee: gate.canSee, resolving: gate.isResolving, error: gate.errorMessage, retry: gate.retry }
    : { canSee: gate.canSee, resolving: gate.isResolving, retry: () => undefined };
}