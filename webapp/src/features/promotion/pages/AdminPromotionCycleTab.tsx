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

// Ports promotion-app's own view/administration/panels/promotionCycle.tsx —
// the currently OPEN cycle's own lifecycle (create when none exists, end
// when one is open), its own stats, and the Notification Hub drill-in.
// Source drives the home/notification-hub split with a `subView` query
// param; this uses local state instead — a two-pane drill-down within one
// tab, not a linkable top-level tab the way the portal's own five tabs are.
import { useState } from "react";
import { Box, Breadcrumbs, Button, Grid, IconButton, Link, Skeleton, Tooltip, Typography } from "@wso2/oxygen-ui";
import { BellIcon, RefreshCwIcon, TriangleAlertIcon, XCircleIcon } from "@wso2/oxygen-ui-icons-react";
import { humanizeHttpError } from "@api/http";
import ConfirmationDialog, { type ConfirmationContent } from "@components/confirmation-dialog/ConfirmationDialog";
import { useActivePromotionCycle } from "../api/usePromotionCycle";
import { useCreatePromotionCycle, useEndPromotionCycle } from "../api/useAdminPromotionCycle";
import { usePromotionRequests } from "../api/usePromotionRequests";
import PromotionCycleCreateForm from "../components/PromotionCycleCreateForm";
import PromotionCycleStatsPanel from "../components/PromotionCycleStatsPanel";
import NotificationHubPanel from "../components/NotificationHubPanel";
import PromotionEmptyState from "../components/PromotionEmptyState";
import PromotionFeedbackSnackbar from "../components/PromotionFeedbackSnackbar";
import { usePromotionFeedback } from "../util/usePromotionFeedback";
import { formatDate } from "../util/promotionHistory";

export default function AdminPromotionCycleTab() {
  const cycle = useActivePromotionCycle();
  const requests = usePromotionRequests({ cycleId: cycle.cycle?.id }, Boolean(cycle.cycle));
  const createCycle = useCreatePromotionCycle();
  const endCycle = useEndPromotionCycle();
  const [view, setView] = useState<"home" | "notifications">("home");
  const [confirmEnd, setConfirmEnd] = useState<ConfirmationContent | null>(null);
  const { feedback, notifySuccess, notifyError, close } = usePromotionFeedback();

  if (cycle.isPending) return <Skeleton variant="rectangular" height={360} sx={{ borderRadius: 1 }} />;
  if (cycle.isError) {
    return (
      <PromotionEmptyState
        icon={<TriangleAlertIcon size={28} />}
        tone="error"
        message={`Unable to load the promotion cycle. ${humanizeHttpError(cycle.error)}`}
      />
    );
  }

  const rows = requests.data?.promotionRequests ?? [];

  return (
    <>
      <ConfirmationDialog content={confirmEnd} onClose={() => setConfirmEnd(null)} />
      <PromotionFeedbackSnackbar feedback={feedback} onClose={close} />

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Tooltip title="Refresh">
          <IconButton
            size="small"
            onClick={() => {
              void cycle.refetch();
              void requests.refetch();
            }}
          >
            <RefreshCwIcon size={16} />
          </IconButton>
        </Tooltip>
        {view === "notifications" && (
          <Breadcrumbs>
            <Link component="button" onClick={() => setView("home")} sx={{ color: "primary.main" }}>
              Home
            </Link>
            <Typography sx={{ color: "text.secondary" }}>Notification Hub</Typography>
          </Breadcrumbs>
        )}
      </Box>

      {view === "notifications" ? (
        <NotificationHubPanel cycle={cycle.cycle ?? null} requests={rows} loading={requests.isPending} />
      ) : !cycle.cycle ? (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, py: 4 }}>
          <Typography variant="h5">Active promotion cycle not found</Typography>
          <Box sx={{ width: "100%", maxWidth: 640 }}>
            <PromotionCycleCreateForm
              creating={createCycle.isPending}
              onCreate={(payload) =>
                createCycle.mutate(payload, {
                  onSuccess: () => notifySuccess("Promotion cycle created."),
                  onError: (error) => notifyError(`Unable to create the promotion cycle. ${humanizeHttpError(error)}`),
                })
              }
            />
          </Box>
        </Box>
      ) : (
        <Grid container spacing={4}>
          <Grid size={6}>
            <Typography variant="h5" sx={{ fontWeight: 500, mb: 2 }}>
              {cycle.cycle.name} Promotion Cycle is {cycle.cycle.status === "OPEN" ? "Open" : cycle.cycle.status}
            </Typography>
            {cycle.cycle.status === "OPEN" && (
              <Box sx={{ mb: 3 }}>
                <Typography sx={{ fontSize: 14 }}>
                  {cycle.cycle.startDate} to {cycle.cycle.endDate}
                </Typography>
                <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 0.5 }}>
                  Lead Deadline: {formatDate(cycle.cycle.leadDeadline)}
                </Typography>
                <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                  Functional Lead Deadline: {formatDate(cycle.cycle.functionalLeadDeadline)}
                </Typography>
                <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                  Promotion Board Deadline: {formatDate(cycle.cycle.promotionBoardDeadline)}
                </Typography>
              </Box>
            )}
            {cycle.cycle.status === "OPEN" && (
              <Button
                variant="contained"
                color="error"
                startIcon={<XCircleIcon size={16} />}
                disabled={endCycle.isPending}
                onClick={() =>
                  setConfirmEnd({
                    title: "End Promotion Cycle",
                    text: "This will close the currently open promotion cycle. This action cannot be undone.",
                    confirmLabel: "End Cycle",
                    confirmAction: () => {
                      if (!cycle.cycle) return;
                      endCycle.mutate(cycle.cycle.id, {
                        onSuccess: () => notifySuccess("Promotion cycle ended."),
                        onError: (error) => notifyError(`Unable to end the promotion cycle. ${humanizeHttpError(error)}`),
                      });
                    },
                  })
                }
              >
                End Promotion Cycle
              </Button>
            )}
          </Grid>
          <Grid size={6}>
            {cycle.cycle.status === "OPEN" && (
              <>
                <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
                  <Button size="small" startIcon={<BellIcon size={16} />} onClick={() => setView("notifications")}>
                    Notification Hub
                  </Button>
                </Box>
                <PromotionCycleStatsPanel loading={requests.isPending} data={rows} />
              </>
            )}
          </Grid>
        </Grid>
      )}
    </>
  );
}
