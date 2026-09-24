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
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, MenuItem, TextField, Typography } from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useSendBulkReminder } from "../api/useParMutations";

type ReminderKind = "employee" | "lead" | "special-rating";

// Only offers the three kinds useSendBulkReminder accepts — no "360 Reminder"
// option, since that one is lead-only.
export default function ParBulkReminderDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [kind, setKind] = useState<ReminderKind | "">("");
  const sendReminder = useSendBulkReminder();
  const { showSuccess, showError } = useNotifications();

  const handleClose = () => {
    setKind("");
    onClose();
  };

  const handleSend = () => {
    if (!kind) return;
    sendReminder.mutate(kind, {
      onSuccess: () => {
        showSuccess("Successfully sent");
        handleClose();
      },
      onError: (err) => showError(describeError(err)),
    });
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 2 }}>Send Bulk Reminders</DialogTitle>
      <Divider />
      <DialogContent>
        <TextField
          select
          label="Select Type"
          size="small"
          fullWidth
          sx={{ mt: 2 }}
          value={kind}
          onChange={(e) => setKind(e.target.value as ReminderKind)}
        >
          <MenuItem value="employee">Employee Reminder</MenuItem>
          <MenuItem value="lead">Lead Reminder</MenuItem>
          <MenuItem value="special-rating">Top 5%/20% Rating Reminder</MenuItem>
        </TextField>
        {sendReminder.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {describeError(sendReminder.error)}
          </Alert>
        )}
        {!kind && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            Choose a reminder type to send it to everyone who hasn't yet completed that step.
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose}>Cancel</Button>
        <Button variant="contained" disabled={!kind || sendReminder.isPending} onClick={handleSend}>
          {sendReminder.isPending ? "Sending…" : "Send"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
