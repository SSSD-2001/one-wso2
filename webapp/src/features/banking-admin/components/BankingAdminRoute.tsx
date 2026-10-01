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

import type { JSX, ReactNode } from "react";
import { Box } from "@wso2/oxygen-ui";
import { Navigate } from "react-router";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useBankingAdminAccess } from "@features/my/api/useBankingAdminAccess";

/**
 * Closes the Banking admin routes to callers who are neither a People Ops
 * nor a Finance admin. Same shape as BankingRoute (the employee gate): wait
 * rather than refuse while the backend has not answered yet, and treat a
 * failed read as a failure with a retry, not as a refusal.
 *
 * This is the "can reach the page at all" gate. Which of the four tabs a
 * caller who does get in may see is a separate, finer question — see
 * BankingAdminTabRoute and canSeeBankingAdminTab.
 */
export default function BankingAdminRoute({ children }: { children: ReactNode }): JSX.Element | null {
  const access = useBankingAdminAccess();

  if (access.isResolving) return null;

  if (access.isError) {
    return (
      <Box sx={{ p: 2 }}>
        <ErrorNotice error={access.errorMessage} onRetry={access.retry}>
          Couldn&apos;t check your access to Banking.
        </ErrorNotice>
      </Box>
    );
  }

  // To Me, not to a refusal page: neither the People Ops nor the Finance
  // rail is offering this screen to them, so there is nothing here to
  // explain — same reasoning BankingRoute already uses for its own refusal.
  if (!access.canSee) return <Navigate to="/me" replace />;

  return <>{children}</>;
}
