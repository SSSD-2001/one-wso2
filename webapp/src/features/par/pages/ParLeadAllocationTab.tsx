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

import { Alert, Skeleton } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useMeProfile } from "@features/my/api/useMeProfile";
import { useActiveParCycle } from "../api/useParData";
import { useParSpecialRatingAllocations } from "../api/useSpecialRatingAllocation";
import ParAllocationGroupsList from "../components/ParAllocationGroupsList";
import ParEmptyState from "../components/ParEmptyState";

// People Ops → Performance → Lead Portal → Top 5%/20% Allocation, lead view
// (the admin view, which omits leadEmail to see every quota group, is
// ParOrgQuotaAllocationsTab.tsx instead — both share ParAllocationGroupsList,
// differing only in which hook fetches `rows`).
export default function ParLeadAllocationTab() {
  const profile = useMeProfile();
  const workEmail = profile.data?.userInfo.workEmail;
  const activeCycles = useActiveParCycle(workEmail);
  const cycle = activeCycles.data?.[0];
  const allocations = useParSpecialRatingAllocations(cycle?.parCycleId, workEmail);

  if (activeCycles.isLoading || profile.isLoading) {
    return <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />;
  }
  if (profile.isError) {
    return (
      <ErrorNotice error={profile.error} onRetry={() => profile.refetch()} retrying={profile.isFetching}>
        Couldn't load your profile.
      </ErrorNotice>
    );
  }
  if (activeCycles.isError) {
    return (
      <ErrorNotice error={activeCycles.error} onRetry={() => activeCycles.refetch()} retrying={activeCycles.isFetching}>
        Couldn't load the current PAR cycle.
      </ErrorNotice>
    );
  }
  if (!cycle) {
    return <Alert severity="info">Currently there is no ongoing PAR cycle</Alert>;
  }
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
    return (
      <ParEmptyState text="No special rating allocations found. Please ensure you have the necessary permissions to view this data." />
    );
  }

  return <ParAllocationGroupsList rows={rows} />;
}
