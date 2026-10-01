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

// Ports promotion-app's own view/administration/panels/withdrawalRequest.tsx
// — every WITHDRAW (pending decision) and REMOVED (withdrawal already
// approved) promotion request, org-wide. A card list (source's own
// withdrawalRequestLine.tsx, not CustomTable) with per-row
// approve/reject on WITHDRAW rows only.
import { useState } from "react";
import { Box, Divider, IconButton, Skeleton, Stack, Tooltip, Typography } from "@wso2/oxygen-ui";
import { InboxIcon, RefreshCwIcon, TriangleAlertIcon } from "@wso2/oxygen-ui-icons-react";
import { humanizeHttpError } from "@api/http";
import ConfirmationDialog, { type ConfirmationContent } from "@components/confirmation-dialog/ConfirmationDialog";
import { useApproveWithdrawal, useRejectWithdrawal, useWithdrawalRequests } from "../api/useWithdrawalRequests";
import PromotionEmptyState from "../components/PromotionEmptyState";
import WithdrawalRequestCard from "../components/WithdrawalRequestCard";

export default function AdminWithdrawalRequestsTab() {
  const requests = useWithdrawalRequests();
  const approve = useApproveWithdrawal();
  const reject = useRejectWithdrawal();
  const [confirm, setConfirm] = useState<ConfirmationContent | null>(null);

  const rows = requests.data?.promotionRequests ?? [];
  const withdrawalCount = rows.filter((r) => r.status === "WITHDRAW").length;
  const approvedCount = rows.filter((r) => r.status === "REMOVED").length;

  return (
    <>
      <ConfirmationDialog content={confirm} onClose={() => setConfirm(null)} />

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={() => void requests.refetch()}>
            <RefreshCwIcon size={16} />
          </IconButton>
        </Tooltip>
        {rows.length > 0 && (
          <Stack direction="row" spacing={2} divider={<Divider orientation="vertical" flexItem />} alignItems="center">
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>All Count: {rows.length}</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "success.main" }}>
              Withdrawal Count: {withdrawalCount}
            </Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "error.main" }}>
              Approved Withdrawal Count: {approvedCount}
            </Typography>
          </Stack>
        )}
      </Box>

      {requests.isPending ? (
        <Skeleton variant="rectangular" height={360} sx={{ borderRadius: 1 }} />
      ) : requests.isError ? (
        <PromotionEmptyState
          icon={<TriangleAlertIcon size={28} />}
          tone="error"
          message={`Unable to load withdrawal requests. ${humanizeHttpError(requests.error)}`}
        />
      ) : rows.length === 0 ? (
        <PromotionEmptyState icon={<InboxIcon size={28} />} message="There are no pending withdrawal requests" />
      ) : (
        rows.map((request) => (
          <WithdrawalRequestCard
            key={request.id}
            request={request}
            approving={approve.isPending && approve.variables === request.id}
            rejecting={reject.isPending && reject.variables === request.id}
            onApprove={() =>
              setConfirm({
                title: "Are you sure?",
                text: "Do you want to approve this withdrawal request?",
                confirmLabel: "Approve",
                confirmAction: () => approve.mutate(request.id),
              })
            }
            onReject={() =>
              setConfirm({
                title: "Are you sure?",
                text: "Do you want to reject this withdrawal request?",
                confirmLabel: "Reject",
                confirmAction: () => reject.mutate(request.id),
              })
            }
          />
        ))
      )}
    </>
  );
}
