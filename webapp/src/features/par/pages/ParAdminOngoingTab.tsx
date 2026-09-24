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

import { useState } from "react";
import { Box, Button, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useParCyclesByStatus } from "../api/useParAdmin";
import ParCycleCreationDialog from "../components/ParCycleCreationDialog";
import ParAssignQuota from "../components/ParAssignQuota";
import ParOrgSummary from "../components/ParOrgSummary";

// Queries OPEN and PENDING_QUOTA in parallel (both cheap org-wide lookups),
// with OPEN taking priority whenever both resolve — a cycle can't be in two
// statuses at once, so in practice at most one ever comes back non-empty.
// PENDING only matters right after creating a cycle, while the backend is
// still seeding its special-rating groups asynchronously — see the poll below.
export default function ParAdminOngoingTab() {
  const [creationOpen, setCreationOpen] = useState(false);
  const [awaitingQuotaSeed, setAwaitingQuotaSeed] = useState(false);

  const open = useParCyclesByStatus("OPEN");
  const pendingQuota = useParCyclesByStatus("PENDING_QUOTA", {
    refetchInterval: awaitingQuotaSeed ? 10 * 1000 : false,
  });
  const pending = useParCyclesByStatus("PENDING", {
    enabled: awaitingQuotaSeed,
    refetchInterval: awaitingQuotaSeed ? 10 * 1000 : false,
  });

  // Once the freshly-created cycle has moved off PENDING, stop polling —
  // whichever of pendingQuota/open picks it up next takes over normally.
  // The `pending.isSuccess` guard means this only fires once the poll has
  // actually run, not on the hook's first render.
  if (awaitingQuotaSeed && pending.isSuccess && pending.data.length === 0) {
    setAwaitingQuotaSeed(false);
  }

  const isLoading = open.isLoading || pendingQuota.isLoading;
  if (isLoading) return <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1.5 }} />;

  if (open.isError) {
    return (
      <ErrorNotice error={open.error} onRetry={() => open.refetch()} retrying={open.isFetching}>
        Couldn't load the current PAR cycle.
      </ErrorNotice>
    );
  }
  if (pendingQuota.isError) {
    return (
      <ErrorNotice error={pendingQuota.error} onRetry={() => pendingQuota.refetch()} retrying={pendingQuota.isFetching}>
        Couldn't check whether a cycle is awaiting quota assignment.
      </ErrorNotice>
    );
  }

  const openCycle = open.data?.[0];
  const pendingQuotaCycle = pendingQuota.data?.[0];

  if (openCycle) return <ParOrgSummary cycle={openCycle} />;

  if (pendingQuotaCycle) return <ParAssignQuota cycle={pendingQuotaCycle} />;

  if (awaitingQuotaSeed) {
    return (
      <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ minHeight: 400 }}>
        <Typography color="text.secondary">Setting up the new cycle…</Typography>
      </Stack>
    );
  }

  return (
    <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" sx={{ minHeight: 400 }}>
      <Box paddingBottom={2}>PAR cycle not in progress.</Box>
      <Button variant="contained" onClick={() => setCreationOpen(true)}>
        Create Cycle
      </Button>
      <ParCycleCreationDialog
        open={creationOpen}
        onClose={(created) => {
          setCreationOpen(false);
          if (created) setAwaitingQuotaSeed(true);
        }}
      />
    </Box>
  );
}
