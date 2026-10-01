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
import { useIsMutating } from "@tanstack/react-query";
import {
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Pagination,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import ConfirmationDialog, { type ConfirmationContent } from "@components/confirmation-dialog/ConfirmationDialog";
import { dialogPaperSx } from "@components/confirmation-dialog/dialogPaperSx";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import ErrorSnackbar from "@components/error-snackbar/ErrorSnackbar";
import { useErrorSnackbar } from "@components/error-snackbar/useErrorSnackbar";
import { useApproveAccount } from "@features/my/api/useApproveAccount";
import { usePendingSalaryAccounts } from "@features/my/api/usePendingSalaryAccounts";
import { useRejectAccount } from "@features/my/api/useRejectAccount";
import type { BankAccount } from "@features/my/api/types";

const REQUESTS_PER_PAGE = 4;

// The Change Requests tab — every pending Salary bank-account request,
// People-Ops-only (BankingAdminTabRoute already keeps everyone else out of
// this route). Approve/Reject/Info are laid out as a searchable, paginated
// card list with per-card actions, not a grid.
export default function ChangeRequestsTab() {
  const accountsQuery = usePendingSalaryAccounts();
  const approveAccount = useApproveAccount();
  const rejectAccount = useRejectAccount();

  // ConfirmationDialog closes synchronously on click without awaiting
  // anything, so nothing else stops a second press from firing a second
  // approve/reject request while the first is still in flight. Gate on the
  // mutation itself so this holds across BOTH actions sharing this tab —
  // see AdminTab's own use of the same pattern.
  const approvingCount = useIsMutating({ mutationKey: ["approve-account"] });
  const rejectingCount = useIsMutating({ mutationKey: ["reject-account"] });
  const submitting = approvingCount > 0 || rejectingCount > 0;

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmation, setConfirmation] = useState<ConfirmationContent | null>(null);
  const [rejectTarget, setRejectTarget] = useState<BankAccount | null>(null);
  const [infoTarget, setInfoTarget] = useState<BankAccount | null>(null);
  const { snack, showError, close: closeSnack } = useErrorSnackbar();

  const requests = accountsQuery.data?.bankAccounts ?? [];
  const filtered = requests.filter((r) => r.employeeEmail.toLowerCase().includes(searchTerm.toLowerCase()));
  const pageCount = Math.max(1, Math.ceil(filtered.length / REQUESTS_PER_PAGE));
  const page = Math.min(currentPage, pageCount);
  const visible = filtered.slice((page - 1) * REQUESTS_PER_PAGE, page * REQUESTS_PER_PAGE);

  function requestApprove(request: BankAccount) {
    setConfirmation({
      title: "Confirm Acceptance",
      text: "Are you sure you want to accept these changes?",
      confirmAction: () => {
        approveAccount
          .mutateAsync(request.accountId)
          .catch((error: unknown) => showError(`Failed to approve the request. ${describeError(error)}`));
      },
    });
  }

  function submitReject(reason: string) {
    if (!rejectTarget) return;
    rejectAccount
      .mutateAsync({ accountId: rejectTarget.accountId, rejectionReason: reason })
      .then(() => setRejectTarget(null))
      .catch((error: unknown) => showError(`Failed to reject the request. ${describeError(error)}`));
  }

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search by employee email"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          sx={{ width: 300 }}
        />
      </Box>

      {accountsQuery.isPending ? (
        <Stack spacing={1.5}>
          {Array.from({ length: REQUESTS_PER_PAGE }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={72} sx={{ borderRadius: 1.5 }} />
          ))}
        </Stack>
      ) : accountsQuery.isError ? (
        <ErrorNotice error={accountsQuery.error} onRetry={() => accountsQuery.refetch()}>
          Couldn&apos;t load pending bank account change requests.
        </ErrorNotice>
      ) : filtered.length === 0 ? (
        <Typography color="text.secondary">No pending bank account change requests.</Typography>
      ) : (
        <Stack spacing={1.5}>
          {visible.map((request) => (
            <RequestCard
              key={request.accountId}
              request={request}
              disabled={submitting}
              onApprove={() => requestApprove(request)}
              onReject={() => setRejectTarget(request)}
              onInfo={() => setInfoTarget(request)}
            />
          ))}
        </Stack>
      )}

      {pageCount > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
          <Pagination count={pageCount} page={page} onChange={(_, p) => setCurrentPage(p)} color="primary" />
        </Box>
      )}

      <ConfirmationDialog content={confirmation} onClose={() => setConfirmation(null)} />

      {rejectTarget && (
        <RejectDialog isSubmitting={submitting} onCancel={() => setRejectTarget(null)} onSubmit={submitReject} />
      )}

      {infoTarget && <AccountDetailsDialog request={infoTarget} onClose={() => setInfoTarget(null)} />}

      <ErrorSnackbar snack={snack} onClose={closeSnack} />
    </Box>
  );
}

function RequestCard({
  request,
  disabled,
  onApprove,
  onReject,
  onInfo,
}: {
  request: BankAccount;
  disabled: boolean;
  onApprove: () => void;
  onReject: () => void;
  onInfo: () => void;
}) {
  return (
    <Card sx={{ p: 2 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
        <Stack direction="row" spacing={3} sx={{ flexWrap: "wrap", rowGap: 1 }}>
          <Typography variant="body2">
            <strong>Employee:</strong> {request.employeeEmail}
          </Typography>
          <Typography variant="body2">
            <strong>Account No:</strong> {request.accountNumber}
          </Typography>
          <Typography variant="body2">
            <strong>Bank:</strong> {request.bankName ?? "N/A"}
          </Typography>
          <Typography variant="body2">
            <strong>Branch:</strong> {request.branchName ?? "N/A"}
          </Typography>
          <Typography variant="body2">
            <strong>Effective:</strong> {request.effectiveFrom}
          </Typography>
          <Typography variant="body2">
            <strong>Type:</strong> {request.accountType}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button size="small" disabled={disabled} onClick={onApprove}>
            Approve
          </Button>
          <Button size="small" color="error" disabled={disabled} onClick={onReject}>
            Reject
          </Button>
          <Button size="small" onClick={onInfo}>
            Info
          </Button>
        </Stack>
      </Box>
    </Card>
  );
}

function RejectDialog({
  isSubmitting,
  onCancel,
  onSubmit,
}: {
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <Dialog open onClose={onCancel} fullWidth slotProps={{ paper: { sx: dialogPaperSx } }}>
      <DialogTitle>Reason for Rejection</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>You need to mention a reason for rejection</Typography>
        <TextField
          label="Reason for Rejection"
          fullWidth
          multiline
          minRows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Discard</Button>
        <Button
          variant="contained"
          color="error"
          disabled={reason.trim() === "" || isSubmitting}
          onClick={() => onSubmit(reason)}
        >
          Reject
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// The Info action's detail view — a read-only field dump, no branching
// logic, so not a unit-test target of its own; only exercised through
// ChangeRequestsTab's own "opens the Info dialog" test.
function AccountDetailsDialog({ request, onClose }: { request: BankAccount; onClose: () => void }) {
  const rows: [string, string][] = [
    ["Account Id", String(request.accountId)],
    ["Effective Month", request.effectiveFrom],
    ["NetSuite InternalId", request.netSuiteInternalId ?? "N/A"],
    ["NetSuite VendorId", request.netSuiteVendorId ?? "N/A"],
    ["NetSuite Payment FileFormat", request.netSuitePaymentFileFormat ?? "N/A"],
    ["Payment Method", request.paymentMethod ?? "N/A"],
    ["Employee Email", request.employeeEmail],
    ["Account Name", request.accountName],
    ["Account Number", request.accountNumber],
    ["Account Holder's Address", request.beneficiaryAddress ?? "N/A"],
    ["Account Status", request.accountStatus],
    ["Account Type", request.accountType],
    ["Bank Code", request.bankCode ?? "N/A"],
    ["Bank Swift Code", request.bankSwiftCode ?? "N/A"],
    ["Bank Name", request.bankName ?? "N/A"],
    ["Bank Location", request.bankLocation ?? "N/A"],
    ["Branch Code", request.branchCode ?? "N/A"],
    ["Branch Name", request.branchName ?? "N/A"],
    ["Bank Address", request.bankAddress ?? "N/A"],
  ];

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: dialogPaperSx } }}>
      <DialogTitle>Account Details</DialogTitle>
      <DialogContent>
        <Stack spacing={1}>
          {rows.map(([label, value]) => (
            <Typography key={label} variant="body2">
              <strong>{label}:</strong> {value}
            </Typography>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
