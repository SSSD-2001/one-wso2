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
import { Alert, Box } from "@wso2/oxygen-ui";
import { useNotifications } from "@context/notifications/NotificationsContext";
import SalesShell from "../components/SalesShell";
import MeetingFilters from "../components/MeetingFilters";
import MeetingsTable from "../components/MeetingsTable";
import AttachmentsDialog from "../components/AttachmentsDialog";
import CancelMeetingDialog from "../components/CancelMeetingDialog";
import type { Meeting, MeetingScope } from "../api/salesTypes";
import { isSalesBackendConfigured, useSalesRegions, useMeetings } from "../api/useSalesData";
import { useSalesGate } from "../api/useSalesGate";
import { useCancelMeeting } from "../api/useSalesMutations";
import { describeError, isForbidden } from "../util/salesError";

const DEFAULT_PAGE_SIZE = 10;

/**
 * Echo — meeting history.
 *
 * Ported from meet-app's Meeting History tab. Create Meeting and the Dashboard
 * are deliberately not here: scheduling still happens in the calendar add-on,
 * and the analytics screen is not part of this one.
 */
export default function SalesMeetingsPage() {
  const configured = isSalesBackendConfigured();

  const [scope, setScope] = useState<MeetingScope>("past");
  const [region, setRegion] = useState<string | null>(null);
  const [search, setSearch] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [attachmentsFor, setAttachmentsFor] = useState<Meeting | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Meeting | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const { showSuccess } = useNotifications();
  const gate = useSalesGate();
  const regionsQuery = useSalesRegions();
  const cancelMeeting = useCancelMeeting();

  // "Past" means "already ended". The cutoff instant is NOT computed here: it belongs to
  // the fetch, so it advances with each one. Computing it here froze the list at whatever
  // moment the scope was chosen, and a tab left open stopped showing meetings as they ended.
  const meetingsQuery = useMeetings({
    search,
    region,
    pastOnly: scope === "past",
    page,
    pageSize,
  });

  // Any filter change invalidates the current page number — page 4 of the old
  // result set is meaningless in the new one, and asking the server for it
  // yields an empty table that looks like "no meetings" rather than "you are
  // past the end".
  //
  // Done in the handlers rather than in an effect on [scope, region, search].
  // An effect would render once with the new filter still paired with the old
  // page, firing a request for a page that may not exist, and only then correct
  // itself. React batches these two setters into a single render, so the
  // out-of-range pairing never reaches a query.
  const changeScope = (next: MeetingScope) => {
    setScope(next);
    setPage(0);
  };
  const changeRegion = (next: string | null) => {
    setRegion(next);
    setPage(0);
  };
  const changeSearch = (next: string | null) => {
    setSearch(next);
    setPage(0);
  };
  const changePageSize = (next: number) => {
    setPageSize(next);
    setPage(0);
  };

  const meetings = meetingsQuery.data?.meetings ?? [];
  const totalCount = meetingsQuery.data?.count ?? 0;

  // One 403 anywhere means the caller is in no authorised group — the backend
  // refuses every endpoint in that case — so the page says so once instead of
  // repeating it per panel.
  const forbidden = isForbidden(meetingsQuery.error) || isForbidden(regionsQuery.error);

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelError(null);
    try {
      await cancelMeeting.mutateAsync(cancelTarget.meetingId);
      showSuccess(`"${cancelTarget.title}" was cancelled.`);
      setCancelTarget(null);
    } catch (error: unknown) {
      // Kept in the dialog rather than raised as a toast: the dialog is still
      // open and is where the user is looking, and the backend's reason
      // ("Insufficient privileges...") belongs next to the action it refused.
      setCancelError(describeError(error));
    }
  };

  return (
    <SalesShell
      title="Sales"
      subtitle="Meetings recorded across the sales team."
      configured={configured}
      configKey="ONE_WSO2_REVOPS_BACKEND_URL"
      forbidden={forbidden}
    >
      <Box>
        <MeetingFilters
          scope={scope}
          onScopeChange={changeScope}
          region={region}
          onRegionChange={changeRegion}
          regions={regionsQuery.data?.regions ?? []}
          regionsLoading={regionsQuery.isLoading}
          search={search}
          onSearchChange={changeSearch}
        />

        {/* A failed list is shown here rather than swapping out the filters:
            the user's next move is almost always to change a filter, so taking
            them away would remove the fix along with the problem. */}
        {meetingsQuery.error && !forbidden && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {describeError(meetingsQuery.error)}
          </Alert>
        )}

        <MeetingsTable
          meetings={meetings}
          totalCount={totalCount}
          loading={meetingsQuery.isLoading || meetingsQuery.isFetching}
          scope={scope}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={changePageSize}
          onOpenAttachments={setAttachmentsFor}
          onCancelMeeting={(meeting) => {
            setCancelError(null);
            setCancelTarget(meeting);
          }}
          canCancel={gate.canCancel}
        />
      </Box>

      <AttachmentsDialog meeting={attachmentsFor} onClose={() => setAttachmentsFor(null)} />

      <CancelMeetingDialog
        meeting={cancelTarget}
        onConfirm={confirmCancel}
        onClose={() => {
          setCancelTarget(null);
          setCancelError(null);
        }}
        pending={cancelMeeting.isPending}
        error={cancelError}
      />
    </SalesShell>
  );
}
