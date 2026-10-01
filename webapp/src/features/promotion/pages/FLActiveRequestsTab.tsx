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

// Ports promotion-app's own view/functionalLead/panels/submittedRequests.tsx
// — every SUBMITTED promotion request in the functional lead's own business
// unit scope (enableBuFilter=true), with per-row and bulk Approve/Reject
// plus a job-band edit dialog.
import { useState } from "react";
import { Alert, Box, Button, DataGrid, IconButton, Skeleton, Stack, Tooltip } from "@wso2/oxygen-ui";
import { CalendarOffIcon, CheckIcon, ChevronDownIcon, InboxIcon, PencilIcon, RefreshCwIcon, TriangleAlertIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import { humanizeHttpError } from "@api/http";
import ConfirmationDialog, { type ConfirmationContent } from "@components/confirmation-dialog/ConfirmationDialog";
import { useUserInfo } from "@api/useUserInfo";
import { useAsgardeoUser } from "@hooks/useAsgardeoUser";
import { useActivePromotionCycle, isPromotionDeadlinePast } from "../api/usePromotionCycle";
import {
  PartialBulkFailureError,
  useApprovePromotionRequests,
  useRejectPromotionRequests,
  usePromotionRequests,
} from "../api/usePromotionRequests";
import { basePromotionRequestColumns } from "../components/promotionRequestColumns";
import PromotionDeadlineBanner from "../components/PromotionDeadlineBanner";
import PromotionEmptyState from "../components/PromotionEmptyState";
import PromotionRequestDetailDialog from "../components/PromotionRequestDetailDialog";
import { PromotionGridToolbar } from "../components/PromotionGridToolbar";
import EditJobBandDialog from "../components/EditJobBandDialog";
import RejectReasonDialog from "../components/RejectReasonDialog";
import { resolveGridSelectedIds } from "../util/promotionGridSelection";
import { formatDate } from "../util/promotionHistory";
import type { PromotionRequestFull } from "../api/types";
import { GRID_NO_POINTER_FOCUS_SX } from "@utils/dataGridSx";

const STRIPE_SX = {
  "& .row-stripe": { bgcolor: "action.hover" },
};

export default function FLActiveRequestsTab() {
  const userInfo = useUserInfo();
  const asgardeoUser = useAsgardeoUser();
  const workEmail = userInfo.data?.workEmail ?? asgardeoUser.email;

  const cycle = useActivePromotionCycle();
  const deadlinePast = isPromotionDeadlinePast(cycle.cycle?.functionalLeadDeadline);
  const requests = usePromotionRequests(
    { statusArray: ["SUBMITTED"], enableBuFilter: true, cycleId: cycle.cycle?.id },
    !cycle.isPending && Boolean(workEmail) && Boolean(cycle.cycle),
  );

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [editingRequest, setEditingRequest] = useState<PromotionRequestFull | null>(null);
  const [viewingRequest, setViewingRequest] = useState<PromotionRequestFull | null>(null);
  const [rejectTarget, setRejectTarget] = useState<number[] | null>(null);
  const [confirm, setConfirm] = useState<ConfirmationContent | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const approve = useApprovePromotionRequests("functional_lead");
  const reject = useRejectPromotionRequests("functional_lead");

  const rows = requests.data?.promotionRequests ?? [];

  const confirmApprove = (ids: number[]) => {
    setConfirm({
      title: "",
      text: `Do you want to approve ${ids.length > 1 ? "these promotion requests" : "this promotion request"}?`,
      confirmLabel: "approve",
      confirmAction: () => {
        setActionError(null);
        approve.mutate(ids, {
          onSuccess: () => setSelectedIds([]),
          // A partial failure keeps just the ids that actually failed
          // selected, ready to retry — anything else (a token refresh
          // failing before a single request went out, say) leaves the
          // selection exactly as the user left it, rather than discarding
          // a batch that was never even attempted.
          onError: (error) => {
            if (error instanceof PartialBulkFailureError) setSelectedIds(error.failedIds);
            setActionError(humanizeHttpError(error));
          },
        });
      },
    });
  };

  const columns: DataGrid.GridColDef<PromotionRequestFull>[] = [
    ...basePromotionRequestColumns(),
    {
      field: "action",
      headerName: "Action",
      sortable: false,
      filterable: false,
      disableExport: true,
      width: 170,
      renderCell: (params) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Edit job band">
            <IconButton size="small" onClick={() => setEditingRequest(params.row)}>
              <PencilIcon size={16} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Approve">
            <IconButton size="small" onClick={() => confirmApprove([params.row.id])}>
              <CheckIcon size={16} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Reject">
            <IconButton size="small" onClick={() => setRejectTarget([params.row.id])}>
              <XIcon size={16} />
            </IconButton>
          </Tooltip>
          <Tooltip title="View details">
            <IconButton size="small" onClick={() => setViewingRequest(params.row)}>
              <ChevronDownIcon size={16} />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <>
      <ConfirmationDialog content={confirm} onClose={() => setConfirm(null)} />
      <EditJobBandDialog request={editingRequest} onClose={() => setEditingRequest(null)} />
      <PromotionRequestDetailDialog request={viewingRequest} onClose={() => setViewingRequest(null)} />
      <RejectReasonDialog
        open={rejectTarget !== null}
        count={rejectTarget?.length ?? 0}
        onClose={() => setRejectTarget(null)}
        onConfirm={(reason) => {
          if (!rejectTarget) return;
          setActionError(null);
          reject.mutate(
            { ids: rejectTarget, reason },
            {
              onSuccess: () => setSelectedIds([]),
              onError: (error) => {
                if (error instanceof PartialBulkFailureError) setSelectedIds(error.failedIds);
                setActionError(humanizeHttpError(error));
              },
            },
          );
        }}
      />

      {actionError && (
        <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      {cycle.cycle && !deadlinePast && (
        <PromotionDeadlineBanner>
          Please review and finalize all promotion requests before: {formatDate(cycle.cycle.functionalLeadDeadline)}
        </PromotionDeadlineBanner>
      )}

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            startIcon={<CheckIcon size={16} />}
            disabled={selectedIds.length === 0}
            onClick={() => confirmApprove(selectedIds)}
          >
            Approve
          </Button>
          <Button
            size="small"
            color="error"
            startIcon={<XIcon size={16} />}
            disabled={selectedIds.length === 0}
            onClick={() => setRejectTarget(selectedIds)}
          >
            Reject
          </Button>
        </Stack>
        <Tooltip title="Refresh">
          <IconButton
            size="small"
            onClick={() => {
              if (!cycle.isError && cycle.cycle && workEmail) void requests.refetch();
              else void cycle.refetch();
            }}
          >
            <RefreshCwIcon size={16} />
          </IconButton>
        </Tooltip>
      </Box>

      {cycle.isPending || (Boolean(cycle.cycle) && requests.isPending) ? (
        <Skeleton variant="rectangular" height={360} sx={{ borderRadius: 1 }} />
      ) : cycle.isError ? (
        <PromotionEmptyState
          icon={<TriangleAlertIcon size={28} />}
          tone="error"
          message={`Unable to load the promotion cycle. ${humanizeHttpError(cycle.error)}`}
        />
      ) : deadlinePast ? (
        <PromotionEmptyState icon={<CalendarOffIcon size={28} />} message="The Functional Lead Deadline has passed." />
      ) : requests.isError ? (
        <PromotionEmptyState
          icon={<TriangleAlertIcon size={28} />}
          tone="error"
          message={`Unable to load promotion requests. ${humanizeHttpError(requests.error)}`}
        />
      ) : rows.length === 0 ? (
        <PromotionEmptyState icon={<InboxIcon size={28} />} message="There are no pending promotion requests" />
      ) : (
        <DataGrid.DataGrid
          rows={rows}
          columns={columns}
          checkboxSelection
          rowSelectionModel={{ type: "include", ids: new Set(selectedIds) }}
          onRowSelectionModelChange={(model) =>
            setSelectedIds(resolveGridSelectedIds(model, rows))
          }
          getRowClassName={(params) => (params.indexRelativeToCurrentPage % 2 === 0 ? "row-stripe" : "")}
          showToolbar
          slots={{ toolbar: PromotionGridToolbar }}
          sx={{ border: "none", ...GRID_NO_POINTER_FOCUS_SX, ...STRIPE_SX }}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          pageSizeOptions={[10, 25, 50]}
        />
      )}
    </>
  );
}
