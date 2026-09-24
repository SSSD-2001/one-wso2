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
import {
  Box,
  Button,
  Chip,
  DataGrid,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { RotateCcwIcon, SearchIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useParAdminParticipants, useParRejectedReviews } from "../api/useParAdmin";
import { useRestoreRejectedReview } from "../api/useParMutations";
import { ParGridToolbar } from "./parGridToolbar";
import ParEmptyState from "./ParEmptyState";
import type { ParCycle, ParRejectedReview } from "../api/types";

// Rejected Reviews tab — declined/withdrawn 360 requests, restorable back
// to PENDING. Names aren't on the wire (see types.ts's comment on
// ParRejectedReview), so they're resolved here against useParAdminParticipants.
export default function ParOrgRejectedReviewsTab({ cycle }: { cycle: ParCycle }) {
  const rejectedReviews = useParRejectedReviews(cycle.parCycleId);
  const participants = useParAdminParticipants(cycle.parCycleId);
  const restore = useRestoreRejectedReview(cycle.parCycleId);
  const { showSuccess, showError } = useNotifications();

  const [searchText, setSearchText] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<ParRejectedReview | undefined>(undefined);

  if (rejectedReviews.isLoading) {
    return <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1.5 }} />;
  }
  if (rejectedReviews.isError) {
    return (
      <ErrorNotice error={rejectedReviews.error} onRetry={() => rejectedReviews.refetch()} retrying={rejectedReviews.isFetching}>
        Error occurred while fetching reviews
      </ErrorNotice>
    );
  }

  const rows = rejectedReviews.data ?? [];
  if (rows.length === 0) {
    return <ParEmptyState text="No reviews found" />;
  }

  const nameByEmail = new Map((participants.data ?? []).map((p) => [p.workEmail, p.employeeName]));
  const displayName = (email: string) => nameByEmail.get(email) ?? email;

  const filteredRows = searchText
    ? rows.filter(
        (row) =>
          displayName(row.employeeEmail).toLowerCase().includes(searchText.toLowerCase()) ||
          displayName(row.reviewerEmail).toLowerCase().includes(searchText.toLowerCase()),
      )
    : rows;

  const columns: DataGrid.GridColDef<ParRejectedReview>[] = [
    {
      field: "employeeEmail",
      headerName: "Reviewee",
      flex: 1.5,
      renderCell: (params) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {displayName(params.row.employeeEmail)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {params.row.employeeEmail}
          </Typography>
        </Box>
      ),
    },
    {
      field: "isOfferedFeedback",
      headerName: "Review Type",
      flex: 1.2,
      renderCell: (params) => (
        <Chip
          size="small"
          color={params.row.isOfferedFeedback === "offered" ? "info" : "warning"}
          label={params.row.isOfferedFeedback === "offered" ? "Was offered a review by" : "Requested a review from"}
        />
      ),
    },
    {
      field: "reviewerEmail",
      headerName: "Reviewer",
      flex: 1.5,
      renderCell: (params) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {displayName(params.row.reviewerEmail)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {params.row.reviewerEmail}
          </Typography>
        </Box>
      ),
    },
    {
      field: "actions",
      headerName: "",
      sortable: false,
      flex: 0.6,
      renderCell: (params) => (
        <Tooltip title="Restore the declined review" arrow>
          <IconButton onClick={() => setConfirmTarget(params.row)}>
            <RotateCcwIcon size={18} />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Stack spacing={1.5}>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <TextField
          size="small"
          placeholder="Search Reviews"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon size={16} />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>
      <DataGrid.DataGrid
        rows={filteredRows}
        columns={columns}
        getRowId={(row) => row.employeeEmail + row.reviewerEmail}
        rowHeight={56}
        disableRowSelectionOnClick
        showToolbar
        slots={{ toolbar: ParGridToolbar }}
        sx={{ border: "none" }}
        initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        pageSizeOptions={[10, 20, 25]}
      />

      <Dialog open={Boolean(confirmTarget)} onClose={() => setConfirmTarget(undefined)} maxWidth="md" fullWidth>
        <DialogTitle>Restore Review</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you need to restore the declined review request?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmTarget(undefined)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            disabled={restore.isPending}
            onClick={() => {
              if (!confirmTarget) return;
              restore.mutate(
                { employeeEmail: confirmTarget.employeeEmail, reviewerEmail: confirmTarget.reviewerEmail },
                {
                  onSuccess: () => {
                    showSuccess("Review restored");
                    setConfirmTarget(undefined);
                  },
                  onError: (err) => showError(describeError(err)),
                },
              );
            }}
          >
            {restore.isPending ? "Restoring…" : "Yes"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
