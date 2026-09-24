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
import { Alert, Box, Button, Card, CardContent, Divider, Grid, MenuItem, Skeleton, Stack, TextField, Typography } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useParRating } from "../api/useParData";
import { useLeadRatingUpdate } from "../api/useLeadRatingUpdate";
import ParDateField from "./ParDateField";
import type { ParCycle, ParEmployeeStatus, ParF2fStatus, ParLeadStatus } from "../api/types";

function todayDateOnly(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Admin-only direct override of the four status/date fields a normal
// review flow only ever moves one at a time. Distinct from
// ParLeadReviewPanel.tsx: that one edits rating/comment content, this one
// edits workflow state — same PATCH resource, different field set.
export default function ParUpdateStatusPanel({ cycle, employeeEmail }: { cycle: ParCycle; employeeEmail: string }) {
  const rating = useParRating(cycle.parCycleId, employeeEmail);
  const ratingUpdate = useLeadRatingUpdate(cycle.parCycleId);
  const { showSuccess, showError } = useNotifications();

  const [employeeStatus, setEmployeeStatus] = useState<ParEmployeeStatus>("PENDING");
  const [leadStatus, setLeadStatus] = useState<ParLeadStatus>("PENDING");
  // The real value, not collapsed to the two options the dropdown below
  // offers (matches legacy's UpdateStatusPanel.tsx) — otherwise a save that
  // doesn't touch this field would overwrite a SCHEDULED record with PENDING.
  const [f2fStatus, setF2fStatus] = useState<ParF2fStatus>("PENDING");
  const [f2fDate, setF2fDate] = useState("");
  const [seededForId, setSeededForId] = useState<number | undefined>(undefined);

  const parRatingData = rating.data;

  // Seed once per record so a background refetch doesn't overwrite an
  // in-progress edit.
  if (parRatingData && parRatingData.parRatingId !== seededForId) {
    setSeededForId(parRatingData.parRatingId);
    setEmployeeStatus(parRatingData.parEmployeeStatus);
    setLeadStatus(parRatingData.parLeadStatus);
    setF2fStatus(parRatingData.parF2fStatus);
    setF2fDate(parRatingData.parF2fDate ?? "");
  }

  if (rating.isLoading) {
    return <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />;
  }
  if (rating.isError) {
    return (
      <ErrorNotice error={rating.error} onRetry={() => rating.refetch()} retrying={rating.isFetching}>
        Couldn't load this employee's PAR record.
      </ErrorNotice>
    );
  }
  if (!parRatingData) {
    return <Alert severity="info">This employee's record for this cycle isn't ready yet.</Alert>;
  }

  // Employee status locks once the lead has shared; F2F only opens up once
  // the lead's feedback is shared, or is already Completed (so an admin can
  // still revert a mistaken entry).
  const employeeStatusDisabled = leadStatus === "SHARED";
  const f2fDisabled = leadStatus !== "SHARED" && f2fStatus !== "COMPLETED";

  const dirty =
    employeeStatus !== parRatingData.parEmployeeStatus ||
    leadStatus !== parRatingData.parLeadStatus ||
    f2fStatus !== parRatingData.parF2fStatus ||
    f2fDate !== (parRatingData.parF2fDate ?? "");

  const handleSave = () => {
    ratingUpdate.mutate(
      {
        employeeEmail,
        parRatingId: parRatingData.parRatingId,
        payload: {
          parEmployeeStatus: employeeStatus,
          parLeadStatus: leadStatus,
          parF2fStatus: f2fStatus,
          ...(f2fStatus === "COMPLETED" && f2fDate ? { parF2fDate: f2fDate } : {}),
        },
      },
      {
        onSuccess: () => showSuccess("Status updated"),
        onError: (err) => showError(describeError(err)),
      },
    );
  };

  const handleCancel = () => {
    setEmployeeStatus(parRatingData.parEmployeeStatus);
    setLeadStatus(parRatingData.parLeadStatus);
    setF2fStatus(parRatingData.parF2fStatus);
    setF2fDate(parRatingData.parF2fDate ?? "");
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2.5} sx={{ maxWidth: 560 }}>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Review status
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="Employee PAR Status"
                  size="small"
                  fullWidth
                  value={employeeStatus}
                  disabled={employeeStatusDisabled || ratingUpdate.isPending}
                  onChange={(e) => setEmployeeStatus(e.target.value as ParEmployeeStatus)}
                >
                  <MenuItem value="PENDING">Pending</MenuItem>
                  <MenuItem value="DRAFT">Draft</MenuItem>
                  <MenuItem value="SHARED">Shared</MenuItem>
                  <MenuItem value="SHARED_BLOCKED" disabled>
                    Shared Blocked
                  </MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="Lead's Feedback Status"
                  size="small"
                  fullWidth
                  value={leadStatus}
                  disabled={ratingUpdate.isPending}
                  onChange={(e) => setLeadStatus(e.target.value as ParLeadStatus)}
                >
                  <MenuItem value="PENDING">Pending</MenuItem>
                  <MenuItem value="DRAFT">Draft</MenuItem>
                  <MenuItem value="SHARED">Shared</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </Box>

          <Divider />

          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Face to face
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="F2F Status"
                  size="small"
                  fullWidth
                  value={f2fStatus}
                  disabled={f2fDisabled || ratingUpdate.isPending}
                  onChange={(e) => setF2fStatus(e.target.value as ParF2fStatus)}
                >
                  <MenuItem value="PENDING">Pending</MenuItem>
                  <MenuItem value="COMPLETED">Completed</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <ParDateField
                  label="F2F Date"
                  fullWidth
                  ariaLabel="F2F date"
                  value={f2fDate}
                  min={cycle.parCycleStartDate}
                  max={todayDateOnly()}
                  disabled={f2fStatus !== "COMPLETED" || ratingUpdate.isPending}
                  onChange={setF2fDate}
                />
              </Grid>
            </Grid>
          </Box>

          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5, pt: 1, borderTop: 1, borderColor: "divider" }}>
            <Button disabled={!dirty || ratingUpdate.isPending} onClick={handleCancel}>
              Cancel
            </Button>
            <Button variant="contained" disabled={!dirty || ratingUpdate.isPending} onClick={handleSave}>
              {ratingUpdate.isPending ? "Updating…" : "Update"}
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
