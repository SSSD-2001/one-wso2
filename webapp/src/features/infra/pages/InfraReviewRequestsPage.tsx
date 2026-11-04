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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { useMemo, useState } from "react";
import { Navigate, Outlet } from "react-router";
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  DataGrid,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import {
  BanIcon,
  CheckCircleIcon,
  SearchIcon,
  XIcon,
} from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { INFRA_EYEBROW } from "@constants/infraApps";
import { useNotifications } from "@context/notifications/NotificationsContext";
import RoutedTabs, { type RoutedTabDef } from "@components/routed-tabs/RoutedTabs";
import InfraShell from "../components/InfraShell";
import InfraConfirmDialog from "../components/InfraConfirmDialog";
import { useInfraGate } from "../api/useInfraGate";
import { useInfraUserInfo } from "../api/useInfraUserInfo";
import {
  useApproveRepositoryRequest,
  useRejectRepositoryRequest,
  useReviewCreationRequests,
} from "../api/useInfraRequests";
import type { InfraRepositoryRequest } from "../api/infraTypes";
import CreationRequestDialog, { formatRequestDateTime } from "../my-requests/CreationRequestDialog";
import {
  CountChip,
  RequestRowActions,
  StateChip,
} from "../my-requests/requestTableUi";
import { visitRepository } from "../my-requests/requestTableUtils";

const PAGE_SIZE = 10;
export const REVIEW_REQUESTS_BASE = "/infra/github/review-repository-requests";

const ASSIGNED_TAB: RoutedTabDef = { segment: "assigned", label: "Assigned to me" };
const ALL_TAB: RoutedTabDef = { segment: "all", label: "All Requests" };

export default function InfraReviewRequestsPage() {
  const gate = useInfraGate();
  const canReview = gate.isApprover || gate.isAdmin;
  const tabs = gate.isAdmin ? [ASSIGNED_TAB, ALL_TAB] : [ASSIGNED_TAB];

  return (
    <InfraShell
      eyebrow={INFRA_EYEBROW.github}
      title="Review Repository Requests"
      subtitle="Review, comment on and approve or reject repository requests."
    >
      {canReview ? (
        <Stack spacing={0}>
          <RoutedTabs
            basePath={REVIEW_REQUESTS_BASE}
            tabs={tabs}
            ariaLabel="Review repository requests"
          />
          <Outlet />
        </Stack>
      ) : (
        <Alert severity="warning">Only approvers and admins can review repository requests.</Alert>
      )}
    </InfraShell>
  );
}

export function InfraReviewRequestsIndex() {
  return <Navigate to="assigned" replace />;
}

export function InfraReviewAssignedTab() {
  return <ReviewTable mode="assigned" />;
}

export function InfraReviewAllTab() {
  const gate = useInfraGate();
  if (!gate.isAdmin) return <Navigate to="../assigned" replace />;
  return <ReviewTable mode="all" />;
}

function ReviewTable({ mode }: { mode: "assigned" | "all" }) {
  const userInfo = useInfraUserInfo();
  const email = userInfo.data?.workEmail ?? "";
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [searchInput, setSearchInput] = useState("");
  const [repoName, setRepoName] = useState("");
  const [viewing, setViewing] = useState<InfraRepositoryRequest | null>(null);
  const [decision, setDecision] = useState<InfraRepositoryRequest | null>(null);
  const [approveTarget, setApproveTarget] = useState<InfraRepositoryRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<InfraRepositoryRequest | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const approve = useApproveRepositoryRequest();
  const reject = useRejectRepositoryRequest();
  const { showSuccess } = useNotifications();

  const requests = useReviewCreationRequests(
    mode === "assigned" ? { leadEmail: email } : { fetchAll: true },
    { limit: pageSize, offset: page * pageSize, repoName },
  );

  const applySearch = () => {
    setPage(0);
    setRepoName(searchInput.trim());
  };

  const openApprove = (request: InfraRepositoryRequest) => {
    setDecision(null);
    approve.reset();
    setApproveTarget(request);
  };

  const openReject = (request: InfraRepositoryRequest) => {
    setDecision(null);
    reject.reset();
    setRejectComment("");
    setRejectTarget(request);
  };

  const confirmApprove = () => {
    if (!approveTarget) return;
    approve.mutate(approveTarget.id, {
      onSuccess: () => {
        showSuccess("Repository request approved.");
        setApproveTarget(null);
      },
    });
  };

  const confirmReject = () => {
    if (!rejectTarget) return;
    const commentText = rejectComment.trim();
    if (!commentText) return;
    reject.mutate(
      { id: rejectTarget.id, commentText },
      {
        onSuccess: () => {
          showSuccess("Repository request rejected.");
          setRejectTarget(null);
          setRejectComment("");
        },
      },
    );
  };

  const rows = requests.data?.repositoryRequests ?? [];
  const columns = useMemo<DataGrid.GridColDef<InfraRepositoryRequest>[]>(
    () => [
      { field: "id", headerName: "Id", width: 70 },
      { field: "repoName", headerName: "Repository Name", flex: 1.4, minWidth: 160 },
      { field: "email", headerName: "Requester", flex: 1.2, minWidth: 180 },
      { field: "organizationName", headerName: "GitHub Organization", flex: 1, minWidth: 140 },
      { field: "repoType", headerName: "Visibility", width: 110 },
      { field: "requirement", headerName: "Requirement", flex: 1.4, minWidth: 160 },
      {
        field: "timestamp",
        headerName: "Created On",
        width: 170,
        valueFormatter: (value) => formatRequestDateTime(value as string),
      },
      {
        field: "updatedAt",
        headerName: "Updated On",
        width: 170,
        valueFormatter: (value) => formatRequestDateTime(value as string | null),
      },
      {
        field: "state",
        headerName: "Decision",
        width: 120,
        renderCell: (params) => <StateChip state={params.row.state} />,
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 140,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <RequestRowActions
            onView={() => setViewing(params.row)}
            onDecide={
              params.row.state === "Pending" ? () => setDecision(params.row) : undefined
            }
            onVisit={
              params.row.state === "Approved"
                ? () => visitRepository(params.row.organizationName, params.row.repoName)
                : undefined
            }
          />
        ),
      },
    ],
    [],
  );

  if (userInfo.isLoading) return <CircularProgress size={24} />;
  if (userInfo.isError && !userInfo.data) {
    return <Alert severity="error">{describeError(userInfo.error)}</Alert>;
  }
  if (mode === "assigned" && !email) {
    return <Alert severity="warning">Your work email is required to load assigned requests.</Alert>;
  }
  if (requests.isError && !requests.data) {
    return <Alert severity="error">{describeError(requests.error)}</Alert>;
  }

  const counts = requests.data;

  return (
    <Stack spacing={1.5}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", alignItems: "center" }}>
          <CountChip label="Total" count={counts?.totalCount ?? 0} color="info" />
          <CountChip label="Pending" count={counts?.pendingCount ?? 0} color="warning" />
          <CountChip label="Approved" count={counts?.approvedCount ?? 0} color="success" />
          <CountChip label="Rejected" count={counts?.rejectedCount ?? 0} color="error" />
        </Stack>
        <TextField
          size="small"
          label="Search by Repository Name"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") applySearch();
          }}
          sx={{ ml: "auto", width: 320, flexShrink: 0 }}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton aria-label="Search" onClick={applySearch} edge="end">
                    <SearchIcon size={16} />
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>
      {requests.isError && <Alert severity="error">{describeError(requests.error)}</Alert>}
      <Card variant="outlined">
        <DataGrid.DataGrid
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          loading={requests.isFetching}
          rowCount={counts?.totalCount ?? 0}
          paginationMode="server"
          paginationModel={{ page, pageSize }}
          onPaginationModelChange={(model) => {
            setPage(model.page);
            setPageSize(model.pageSize);
          }}
          pageSizeOptions={[10, 25, 50]}
          disableRowSelectionOnClick
          rowHeight={47}
          sx={{ border: "none", height: 560 }}
        />
      </Card>

      {viewing && <CreationRequestDialog request={viewing} onClose={() => setViewing(null)} />}

      <Dialog open={Boolean(decision)} onClose={() => setDecision(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          Take Decision
          <IconButton aria-label="Close" color="primary" onClick={() => setDecision(null)}>
            <XIcon size={16} />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2, color: "text.secondary" }}>
            {decision?.repoName} — {decision?.organizationName}
          </Typography>
          <Box sx={{ display: "flex", justifyContent: "center", gap: 2, py: 1 }}>
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckCircleIcon size={16} />}
              onClick={() => decision && openApprove(decision)}
              sx={{ minWidth: 120 }}
            >
              Approve
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<BanIcon size={16} />}
              onClick={() => decision && openReject(decision)}
              sx={{ minWidth: 120 }}
            >
              Reject
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      <InfraConfirmDialog
        open={Boolean(approveTarget)}
        title="Confirm Approval"
        confirmLabel={approve.isPending ? "Approving…" : "Approve"}
        busy={approve.isPending}
        onConfirm={confirmApprove}
        onCancel={() => setApproveTarget(null)}
        body={
          <>
            <Typography sx={{ fontWeight: 700, color: "text.primary" }}>
              I acknowledge that I have thoroughly reviewed this repository request and confirm that
              its creation complies with WSO2&apos;s engineering and security best practices.
            </Typography>
            {approveTarget && (
              <Typography sx={{ mt: 1 }}>
                {approveTarget.repoName} — {approveTarget.organizationName}
              </Typography>
            )}
            {approve.isError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {describeError(approve.error)}
              </Alert>
            )}
          </>
        }
      />

      <InfraConfirmDialog
        open={Boolean(rejectTarget)}
        title="Reject Request"
        tone="danger"
        confirmLabel={reject.isPending ? "Rejecting…" : "Reject"}
        busy={reject.isPending}
        confirmDisabled={!rejectComment.trim()}
        onConfirm={confirmReject}
        onCancel={() => setRejectTarget(null)}
        body={
          <>
            <Typography sx={{ fontWeight: 700, color: "text.primary", mb: 1 }}>
              Please note that the repository creation request should be rejected only if the
              requirement is no longer valid and this decision cannot be reversed.
            </Typography>
            <Typography sx={{ mb: 2 }}>Please provide a comment for rejection.</Typography>
            <TextField
              label="Rejection Comment"
              value={rejectComment}
              onChange={(event) => setRejectComment(event.target.value)}
              required
              fullWidth
              multiline
              rows={3}
              size="small"
              helperText="Required for rejection"
              InputLabelProps={{ shrink: true }}
            />
            {reject.isError && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {describeError(reject.error)}
              </Alert>
            )}
          </>
        }
      />
    </Stack>
  );
}
