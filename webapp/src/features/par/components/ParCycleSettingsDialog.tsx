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
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Grid, TextField, Typography } from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import ParDateField from "./ParDateField";
import ConfirmationDialog, { type ConfirmationContent } from "@components/confirmation-dialog/ConfirmationDialog";
import { useUpdateParCycle } from "../api/useParMutations";
import type { ParCycle } from "../api/types";

function fieldsFromCycle(cycle: ParCycle) {
  return {
    parCycleStartDate: cycle.parCycleStartDate,
    parCycleEndDate: cycle.parCycleEndDate,
    parEvaluationEndDate: cycle.parEvaluationEndDate,
    parEmployeeDeadline: cycle.parEmployeeDeadline,
    parThreeSixtyRatingDeadline: cycle.parThreeSixtyRatingDeadline,
    parLeadDeadline: cycle.parLeadDeadline,
    parSpecialRatingDeadline: cycle.parSpecialRatingDeadline ?? "",
    parF2FDeadline: cycle.parF2FDeadline,
  };
}

// Same fields as ParCycleCreationDialog.tsx minus the name and the (always
// disabled) PAR creation date, prefilled from the current cycle instead of
// useParGlobalConfig.
export default function ParCycleSettingsDialog({
  open,
  onClose,
  cycle,
}: {
  open: boolean;
  onClose: () => void;
  cycle: ParCycle;
}) {
  const updateCycle = useUpdateParCycle(cycle.parCycleId);
  const { showSuccess, showError } = useNotifications();

  const [form, setForm] = useState(fieldsFromCycle(cycle));
  const [employeeQuestion, setEmployeeQuestion] = useState(cycle.parCycleConfigurations?.employeeParQuestion ?? "");
  const [reviewQuestion, setReviewQuestion] = useState(cycle.parCycleConfigurations?.threeSixtyReviewQuestion ?? "");
  const [confirmContent, setConfirmContent] = useState<ConfirmationContent | null>(null);

  const set = (field: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [field]: value }));

  const isValid =
    form.parCycleStartDate &&
    form.parCycleEndDate &&
    form.parEvaluationEndDate &&
    form.parEmployeeDeadline &&
    form.parThreeSixtyRatingDeadline &&
    form.parLeadDeadline &&
    form.parLeadDeadline > form.parEmployeeDeadline &&
    form.parSpecialRatingDeadline &&
    form.parF2FDeadline &&
    employeeQuestion.trim() &&
    reviewQuestion.trim();

  const hasChanged =
    JSON.stringify(form) !== JSON.stringify(fieldsFromCycle(cycle)) ||
    employeeQuestion !== (cycle.parCycleConfigurations?.employeeParQuestion ?? "") ||
    reviewQuestion !== (cycle.parCycleConfigurations?.threeSixtyReviewQuestion ?? "");

  const handleClose = () => {
    setForm(fieldsFromCycle(cycle));
    setEmployeeQuestion(cycle.parCycleConfigurations?.employeeParQuestion ?? "");
    setReviewQuestion(cycle.parCycleConfigurations?.threeSixtyReviewQuestion ?? "");
    onClose();
  };

  const handleSubmit = () => {
    setConfirmContent({
      title: "Update PAR Cycle Settings",
      text: "Are you sure you want to update the PAR cycle settings? This may affect active dashboards and notifications.",
      confirmAction: () => {
        updateCycle.mutate(
          {
            ...form,
            // Partial update — rating scales aren't edited by this dialog, so
            // only the two question fields go out.
            parCycleConfigurations: {
              employeeParQuestion: employeeQuestion.trim(),
              threeSixtyReviewQuestion: reviewQuestion.trim(),
            },
          },
          {
            onSuccess: () => {
              showSuccess("Cycle settings updated");
              handleClose();
            },
            onError: (err) => showError(describeError(err)),
          },
        );
      },
    });
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>PAR Cycle Settings</DialogTitle>
        <Divider />
        <DialogContent sx={{ maxHeight: "70vh" }}>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <ParDateField
                label="Cycle starts"
                fullWidth
                ariaLabel="PAR cycle start date"
                value={form.parCycleStartDate}
                onChange={set("parCycleStartDate")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <ParDateField
                label="Cycle ends"
                fullWidth
                ariaLabel="PAR cycle end date"
                value={form.parCycleEndDate}
                min={form.parCycleStartDate || undefined}
                onChange={set("parCycleEndDate")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <ParDateField
                label="PAR creation date"
                fullWidth
                ariaLabel="PAR creation date"
                value={cycle.parEvaluationStartDate}
                disabled
                onChange={() => {}}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <ParDateField
                label="PAR evaluation closing date"
                fullWidth
                ariaLabel="PAR evaluation closing date"
                value={form.parEvaluationEndDate}
                min={cycle.parEvaluationStartDate}
                onChange={set("parEvaluationEndDate")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <ParDateField
                label="Deadline for employee PAR"
                fullWidth
                ariaLabel="Deadline for employee PAR"
                value={form.parEmployeeDeadline}
                min={cycle.parEvaluationStartDate}
                max={form.parEvaluationEndDate || undefined}
                onChange={set("parEmployeeDeadline")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <ParDateField
                label="Deadline for 360° feedback"
                fullWidth
                ariaLabel="Deadline for 360° feedback"
                value={form.parThreeSixtyRatingDeadline}
                min={cycle.parEvaluationStartDate}
                max={form.parEvaluationEndDate || undefined}
                onChange={set("parThreeSixtyRatingDeadline")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <ParDateField
                label="Deadline for lead's feedback"
                fullWidth
                ariaLabel="Deadline for lead's feedback"
                value={form.parLeadDeadline}
                min={form.parEmployeeDeadline || cycle.parEvaluationStartDate}
                max={form.parEvaluationEndDate || undefined}
                error={Boolean(form.parLeadDeadline) && form.parLeadDeadline <= form.parEmployeeDeadline}
                helperText={
                  form.parLeadDeadline && form.parLeadDeadline <= form.parEmployeeDeadline
                    ? "Must be later than the employee PAR deadline"
                    : undefined
                }
                onChange={set("parLeadDeadline")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <ParDateField
                label="Top 5%/20% rating submission"
                fullWidth
                ariaLabel="Top 5%/20% rating submission"
                value={form.parSpecialRatingDeadline}
                min={cycle.parEvaluationStartDate}
                max={form.parEvaluationEndDate || undefined}
                onChange={set("parSpecialRatingDeadline")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <ParDateField
                label="PAR F2F deadline"
                fullWidth
                ariaLabel="PAR F2F deadline"
                value={form.parF2FDeadline}
                min={cycle.parEvaluationStartDate}
                max={form.parEvaluationEndDate || undefined}
                onChange={set("parF2FDeadline")}
              />
            </Grid>

            <Grid size={12}>
              <Typography variant="subtitle2" sx={{ mt: 1 }}>
                Cycle configuration
              </Typography>
            </Grid>
            <Grid size={12}>
              <TextField
                label="Employee PAR question"
                size="small"
                fullWidth
                multiline
                minRows={3}
                aria-label="Employee PAR question"
                value={employeeQuestion}
                onChange={(e) => setEmployeeQuestion(e.target.value)}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                label="360° feedback question"
                size="small"
                fullWidth
                multiline
                minRows={3}
                aria-label="360 feedback question"
                value={reviewQuestion}
                onChange={(e) => setReviewQuestion(e.target.value)}
              />
            </Grid>

            {updateCycle.isError && (
              <Grid size={12}>
                <Alert severity="error">{describeError(updateCycle.error)}</Alert>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose}>Cancel</Button>
          <Button variant="contained" disabled={!isValid || !hasChanged || updateCycle.isPending} onClick={handleSubmit}>
            {updateCycle.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
      <ConfirmationDialog content={confirmContent} onClose={() => setConfirmContent(null)} />
    </>
  );
}
