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
import { Box, Button, Card, Dialog, DialogContent, DialogTitle, Divider, Grid, IconButton, Link, Skeleton, Stack, Tab, Tabs, Tooltip, Typography } from "@wso2/oxygen-ui";
import {
  CalendarIcon,
  ClipboardCheckIcon,
  ExternalLinkIcon,
  FileTextIcon,
  MessageSquareIcon,
  PercentIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SendIcon,
  SettingsIcon,
  UserIcon,
  UsersIcon,
  VideoIcon,
  XCircleIcon,
} from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useNotifications } from "@context/notifications/NotificationsContext";
import ConfirmationDialog, { type ConfirmationContent } from "@components/confirmation-dialog/ConfirmationDialog";
import { formatShortDate } from "../util/parDate";
import { calculateCycleActiveStep } from "../util/parCycleActiveStep";
import { calculateTeamsCompletionTotals } from "../util/parTeamsSummary";
import { useParAdminTeams } from "../api/useParAdmin";
import { useSetParCycleStatus } from "../api/useParMutations";
import ParCompletionKpiTile from "./ParCompletionKpiTile";
import ParCompletionOverview from "./ParCompletionOverview";
import ParCycleDatesStepper from "./ParCycleDatesStepper";
import ParLeadReviewTabs from "./ParLeadReviewTabs";
import ParOrgTeamRoster from "./ParOrgTeamRoster";
import ParOrgTeamViewTab from "./ParOrgTeamViewTab";
import ParOrgEmployeeViewTab from "./ParOrgEmployeeViewTab";
import ParOrgRejectedReviewsTab from "./ParOrgRejectedReviewsTab";
import ParOrgQuotaAllocationsTab from "./ParOrgQuotaAllocationsTab";
import ParBulkReminderDialog from "./ParBulkReminderDialog";
import ParCycleSettingsDialog from "./ParCycleSettingsDialog";
import ParSyncEmployeeDialog from "./ParSyncEmployeeDialog";
import ParViewReportsDialog from "./ParViewReportsDialog";
import type { ParCycle, ParTeamSummary } from "../api/types";

// The Admin Portal's main dashboard, for both an OPEN cycle (Ongoing tab)
// and a CLOSED one (History tab, via `historyMode`). Fetches its own
// org-wide teams data for the Completion Status cards — the Team View/
// Employee View/Rejected Reviews/Quota Allocations tabs each fetch their
// own row data.
export default function ParOrgSummary({
  cycle,
  historyMode = false,
  onBack,
}: {
  cycle: ParCycle;
  historyMode?: boolean;
  onBack?: () => void;
}) {
  const teams = useParAdminTeams(cycle.parCycleId);
  const closeCycle = useSetParCycleStatus(cycle.parCycleId);
  const { showSuccess, showError } = useNotifications();

  const [tab, setTab] = useState(0);
  const [selectedTeam, setSelectedTeam] = useState<ParTeamSummary | undefined>(undefined);
  const [reviewEmployeeEmail, setReviewEmployeeEmail] = useState<string | undefined>(undefined);
  const [completionOverviewOpen, setCompletionOverviewOpen] = useState(false);

  const [cycleDatesOpen, setCycleDatesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bulkReminderOpen, setBulkReminderOpen] = useState(false);
  const [syncEmployeeOpen, setSyncEmployeeOpen] = useState(false);
  const [viewReportsOpen, setViewReportsOpen] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState<ConfirmationContent | null>(null);

  // Drill-in: Review takes priority over the team roster so opening a review
  // from within a team's roster and going "back" returns to that roster
  // (selectedTeam stays set), while opening one from Employee View returns
  // straight to this dashboard.
  if (reviewEmployeeEmail) {
    return (
      <ParLeadReviewTabs
        cycle={cycle}
        employeeEmail={reviewEmployeeEmail}
        isAdminView
        onBack={() => setReviewEmployeeEmail(undefined)}
      />
    );
  }
  if (selectedTeam) {
    return (
      <ParOrgTeamRoster
        cycle={cycle}
        team={selectedTeam}
        onBack={() => setSelectedTeam(undefined)}
        onOpenReview={setReviewEmployeeEmail}
      />
    );
  }
  if (completionOverviewOpen) {
    return <ParCompletionOverview cycle={cycle} teams={teams.data ?? []} onBack={() => setCompletionOverviewOpen(false)} />;
  }

  const totals = calculateTeamsCompletionTotals(teams.data ?? []);

  const handleCloseCycle = () => {
    setCloseConfirm({
      title: "Close ongoing PAR cycle?",
      text: "This means members of your organization can't do changes to the current PAR anymore.",
      confirmLabel: "Proceed",
      confirmAction: () => {
        closeCycle.mutate("CLOSED", {
          onSuccess: () => showSuccess("Cycle closed"),
          onError: (err) => showError(describeError(err)),
        });
      },
    });
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Box>
          {historyMode && (
            <>
              <Link component="button" underline="hover" onClick={onBack} sx={{ mr: 0.5 }}>
                History
              </Link>
              <Typography component="span" sx={{ mx: 0.5 }}>
                /
              </Typography>
            </>
          )}
          <Typography variant="h5" component="span">
            {cycle.parCycleName}{" "}
          </Typography>
          <Typography component="span" color="text.secondary">
            ({formatShortDate(cycle.parCycleStartDate)} - {formatShortDate(cycle.parCycleEndDate)})
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Button variant="outlined" size="small" startIcon={<FileTextIcon size={16} />} onClick={() => setViewReportsOpen(true)}>
            View Reports
          </Button>
          {!historyMode && (
            <>
              <Button variant="outlined" size="small" startIcon={<SendIcon size={16} />} onClick={() => setBulkReminderOpen(true)}>
                Bulk Reminders
              </Button>
              <Tooltip title="Sync an Employee" arrow>
                <IconButton size="small" onClick={() => setSyncEmployeeOpen(true)} aria-label="sync an employee">
                  <RefreshCwIcon size={17} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Open Cycle Dates" arrow>
                <IconButton size="small" onClick={() => setCycleDatesOpen(true)} aria-label="cycle dates">
                  <CalendarIcon size={17} />
                </IconButton>
              </Tooltip>
              <Tooltip title="PAR Cycle Settings" arrow>
                <IconButton size="small" onClick={() => setSettingsOpen(true)} aria-label="cycle settings">
                  <SettingsIcon size={17} />
                </IconButton>
              </Tooltip>
              {/* Separated from the routine actions above rather than styled
                  as just another button in the row — the one action here
                  that can't be undone shouldn't be a misclick away from
                  "View Reports". */}
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              <Button
                variant="text"
                size="small"
                color="error"
                startIcon={<XCircleIcon size={16} />}
                onClick={handleCloseCycle}
              >
                Close Cycle
              </Button>
            </>
          )}
        </Stack>
      </Stack>

      {teams.isLoading && <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 2 }} />}
      {teams.isError && (
        <ErrorNotice error={teams.error} onRetry={() => teams.refetch()} retrying={teams.isFetching}>
          Couldn't load completion status.
        </ErrorNotice>
      )}
      {teams.isSuccess && (
        <Box>
          <Box sx={{ display: "flex", justifyContent: "flex-end", mb: -0.5 }}>
            <Tooltip title="PAR Completion Overview" arrow>
              <IconButton size="small" onClick={() => setCompletionOverviewOpen(true)} aria-label="completion overview">
                <ExternalLinkIcon size={16} />
              </IconButton>
            </Tooltip>
          </Box>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <ParCompletionKpiTile
                icon={<ClipboardCheckIcon size={22} />}
                label="Employee PAR"
                completed={totals.totalEmployeeParComplete}
                total={totals.totalEmployees}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <ParCompletionKpiTile
                icon={<MessageSquareIcon size={22} />}
                label="Lead's Feedback"
                completed={totals.totalLeadReviewComplete}
                total={totals.totalEmployees}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <ParCompletionKpiTile
                icon={<VideoIcon size={22} />}
                label="F2F"
                completed={totals.totalF2fComplete}
                total={totals.totalEmployees}
              />
            </Grid>
          </Grid>
        </Box>
      )}

      <Card variant="outlined" sx={{ borderRadius: 2, p: 2.5 }}>
        <Tabs value={tab} onChange={(_e, value) => setTab(value)} aria-label="admin tabs" sx={{ mb: 2 }}>
          <Tab icon={<UsersIcon size={16} />} iconPosition="start" label="Team View" />
          <Tab icon={<UserIcon size={16} />} iconPosition="start" label="Employee View" />
          <Tab icon={<RotateCcwIcon size={16} />} iconPosition="start" label="Rejected Reviews" />
          <Tab icon={<PercentIcon size={16} />} iconPosition="start" label="Quota Allocations" />
        </Tabs>

        {tab === 0 && <ParOrgTeamViewTab cycle={cycle} onSelectTeam={setSelectedTeam} />}
        {tab === 1 && <ParOrgEmployeeViewTab cycle={cycle} onOpenReview={setReviewEmployeeEmail} />}
        {tab === 2 && <ParOrgRejectedReviewsTab cycle={cycle} />}
        {tab === 3 && <ParOrgQuotaAllocationsTab cycle={cycle} />}
      </Card>

      {/* Opened at width="80vw" rather than a fixed maxWidth breakpoint —
          the five stepper steps need the room. */}
      <Dialog open={cycleDatesOpen} onClose={() => setCycleDatesOpen(false)} maxWidth={false} slotProps={{ paper: { sx: { width: "80vw" } } }}>
        <DialogTitle>Cycle Dates</DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 4, pb: 4 }}>
          <ParCycleDatesStepper cycle={cycle} activeStep={calculateCycleActiveStep(cycle)} />
        </DialogContent>
      </Dialog>

      {/* Conditionally rendered, like ParEditQuotaDialog, so a fresh instance
          (and fresh form state) mounts each time it's opened. */}
      {settingsOpen && <ParCycleSettingsDialog open onClose={() => setSettingsOpen(false)} cycle={cycle} />}
      <ParBulkReminderDialog open={bulkReminderOpen} onClose={() => setBulkReminderOpen(false)} />
      <ParSyncEmployeeDialog open={syncEmployeeOpen} onClose={() => setSyncEmployeeOpen(false)} cycle={cycle} />
      <ParViewReportsDialog open={viewReportsOpen} onClose={() => setViewReportsOpen(false)} cycle={cycle} />
      <ConfirmationDialog content={closeConfirm} onClose={() => setCloseConfirm(null)} />
    </Stack>
  );
}
