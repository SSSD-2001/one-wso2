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

import { Skeleton } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useParAdminQuotaGroups } from "../api/useParAdmin";
import ParAllocationGroupsList from "./ParAllocationGroupsList";
import ParEmptyState from "./ParEmptyState";
import type { ParCycle } from "../api/types";

// Quota Allocations tab — org-wide quota groups (no leadEmail filter).
// A thin wrapper over ParAllocationGroupsList, same as
// ParLeadAllocationTab.tsx — only the data source differs.
export default function ParOrgQuotaAllocationsTab({ cycle }: { cycle: ParCycle }) {
  const allocations = useParAdminQuotaGroups(cycle.parCycleId);

  if (allocations.isLoading) {
    return <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />;
  }
  if (allocations.isError) {
    return (
      <ErrorNotice error={allocations.error} onRetry={() => allocations.refetch()} retrying={allocations.isFetching}>
        Error occurred while retrieving quota allocations
      </ErrorNotice>
    );
  }

  const rows = allocations.data ?? [];
  if (rows.length === 0) {
    return <ParEmptyState text="No special rating allocations found for this cycle." />;
  }

  return <ParAllocationGroupsList rows={rows} />;
}
