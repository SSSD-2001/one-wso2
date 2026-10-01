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

// Ports promotion-app's own
// view/administration/panels/notificationHub.tsx — a manual "send the
// outcome email" tool for requests whose automatic notification hasn't
// gone out yet, plus a read-only log of what's already been sent. Every
// tab filters the SAME `requests` list client-side (no separate fetch per
// tab, matching source) rather than issuing three separate queries.
import { useState } from "react";
import { Box, Button, DataGrid, IconButton, Skeleton, Tab, Tabs, Tooltip } from "@wso2/oxygen-ui";
import { CheckIcon, InboxIcon, MailCheckIcon, SendIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import { useNotifyPromotionRequest } from "../api/usePromotionRequests";
import { basePromotionRequestColumns } from "../components/promotionRequestColumns";
import PromotionEmptyState from "./PromotionEmptyState";
import PromotionFeedbackSnackbar from "./PromotionFeedbackSnackbar";
import { usePromotionFeedback } from "../util/usePromotionFeedback";
import { PromotionGridToolbar } from "./PromotionGridToolbar";
import NotifyApplicantDialog from "./NotifyApplicantDialog";
import { resolveGridSelectedIds } from "../util/promotionGridSelection";
import { formatDate } from "../util/promotionHistory";
import { GRID_NO_POINTER_FOCUS_SX } from "@utils/dataGridSx";
import type { PromotionCycle, PromotionRequestFull } from "../api/types";

type SubTab = "approved" | "rejected" | "sent";

export default function NotificationHubPanel({
  cycle,
  requests,
  loading,
}: {
  /** The active cycle this panel's `requests` were scoped to. `null` means
   * no cycle is open, in which case the tabs aren't rendered at all.
   * `undefined` = still loading. */
  cycle: PromotionCycle | null | undefined;
  requests: PromotionRequestFull[];
  loading: boolean;
}) {
  const [tab, setTab] = useState<SubTab>("approved");

  const approved = requests.filter((r) => r.status === "APPROVED" && !r.isNotificationEmailSent);
  const rejected = requests.filter(
    (r) => (r.status === "REJECTED" || r.status === "FL_REJECTED") && !r.isNotificationEmailSent,
  );
  const sent = requests.filter(
    (r) => (r.status === "APPROVED" || r.status === "REJECTED" || r.status === "FL_REJECTED") && r.isNotificationEmailSent,
  );

  if (cycle === null) {
    return <PromotionEmptyState icon={<InboxIcon size={28} />} message="No promotion cycle found" />;
  }

  return (
    <Box>
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}>
        <Tab value="approved" icon={<CheckIcon size={16} />} iconPosition="start" label={`Approved Applications (${approved.length})`} />
        <Tab value="rejected" icon={<XIcon size={16} />} iconPosition="start" label={`Rejected Applications (${rejected.length})`} />
        <Tab value="sent" icon={<MailCheckIcon size={16} />} iconPosition="start" label={`Sent Notifications (${sent.length})`} />
      </Tabs>

      {loading ? (
        <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 1 }} />
      ) : tab === "approved" ? (
        <NotifyGrid rows={approved} requiresEffectiveDate emptyMessage="No records found" />
      ) : tab === "rejected" ? (
        <NotifyGrid rows={rejected} requiresEffectiveDate={false} emptyMessage="No records found" />
      ) : (
        <SentGrid rows={sent} />
      )}
    </Box>
  );
}

function NotifyGrid({
  rows,
  requiresEffectiveDate,
  emptyMessage,
}: {
  rows: PromotionRequestFull[];
  requiresEffectiveDate: boolean;
  emptyMessage: string;
}) {
  const notify = useNotifyPromotionRequest();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [dialog, setDialog] = useState<{ ids: number[]; message: string } | null>(null);
  const { feedback, notifySuccess, notifyError, close } = usePromotionFeedback();

  const columns: DataGrid.GridColDef<PromotionRequestFull>[] = [
    ...basePromotionRequestColumns(),
    {
      field: "action",
      headerName: "",
      sortable: false,
      filterable: false,
      disableExport: true,
      width: 60,
      renderCell: (params) => (
        <Tooltip title="Send notification">
          <IconButton
            size="small"
            onClick={() =>
              setDialog({
                ids: [params.row.id],
                message: `Would you like to send a notification to ${params.row.employeeEmail}?`,
              })
            }
          >
            <SendIcon size={16} />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      <PromotionFeedbackSnackbar feedback={feedback} onClose={close} />
      <NotifyApplicantDialog
        open={Boolean(dialog)}
        message={dialog?.message ?? ""}
        requiresEffectiveDate={requiresEffectiveDate}
        onClose={() => setDialog(null)}
        onConfirm={(effectiveDate) => {
          if (!dialog) return;
          const ids = dialog.ids;
          setSelectedIds([]);
          void Promise.allSettled(ids.map((id) => notify.mutateAsync({ id, effectiveDate }))).then((results) => {
            const failed = results.filter((r) => r.status === "rejected").length;
            if (failed === 0) {
              notifySuccess(ids.length > 1 ? "Notifications sent." : "Notification sent.");
            } else {
              notifyError(`${failed} of ${ids.length} notification${ids.length > 1 ? "s" : ""} failed to send.`);
            }
          });
        }}
      />
      {rows.length === 0 ? (
        <PromotionEmptyState icon={<InboxIcon size={28} />} message={emptyMessage} />
      ) : (
        <>
          <Box sx={{ display: "flex", justifyContent: "flex-start", mb: 1 }}>
            <Button
              size="small"
              startIcon={<SendIcon size={16} />}
              disabled={selectedIds.length === 0}
              onClick={() =>
                setDialog({
                  ids: selectedIds,
                  message: "Would you like to send a notification to the selected list?",
                })
              }
            >
              Notify selected
            </Button>
          </Box>
          <DataGrid.DataGrid
            rows={rows}
            columns={columns}
            checkboxSelection
            rowSelectionModel={{ type: "include", ids: new Set(selectedIds) }}
            onRowSelectionModelChange={(model) => setSelectedIds(resolveGridSelectedIds(model, rows))}
            showToolbar
            slots={{ toolbar: PromotionGridToolbar }}
            sx={{ border: "none", ...GRID_NO_POINTER_FOCUS_SX }}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            pageSizeOptions={[10, 25, 50]}
          />
        </>
      )}
    </>
  );
}

function SentGrid({ rows }: { rows: PromotionRequestFull[] }) {
  const columns: DataGrid.GridColDef<PromotionRequestFull>[] = [
    ...basePromotionRequestColumns(),
    {
      field: "updatedOn",
      headerName: "Notified Timestamp",
      flex: 1,
      minWidth: 160,
      sortable: false,
      valueFormatter: (value: string) => formatDate(value),
    },
  ];

  return rows.length === 0 ? (
    <PromotionEmptyState icon={<InboxIcon size={28} />} message="No records found" />
  ) : (
    <DataGrid.DataGrid
      rows={rows}
      columns={columns}
      showToolbar
      slots={{ toolbar: PromotionGridToolbar }}
      sx={{ border: "none", ...GRID_NO_POINTER_FOCUS_SX }}
      initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
      pageSizeOptions={[10, 25, 50]}
    />
  );
}
