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

import { useState, type HTMLAttributes, type Key } from "react";
import {
  Autocomplete,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useLeaveEmployees } from "@features/leave/api/useLeaveData";
import { useSyncEmployee } from "../api/useParMutations";
import type { ParCycle } from "../api/types";
import type { MinimalEmployeeInfo } from "@features/leave/api/leaveTypes";

// This app has no org-wide employee directory of its own, so the picker
// reuses Leave's employee list — the same deviation other PAR views make.
export default function ParSyncEmployeeDialog({
  open,
  onClose,
  cycle,
}: {
  open: boolean;
  onClose: () => void;
  cycle: ParCycle;
}) {
  const employees = useLeaveEmployees(open);
  const syncEmployee = useSyncEmployee(cycle.parCycleId);
  const { showSuccess, showError } = useNotifications();

  const [selected, setSelected] = useState<MinimalEmployeeInfo | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleClose = () => {
    setSelected(null);
    setConfirmOpen(false);
    onClose();
  };

  const handleSync = () => {
    if (!selected) return;
    syncEmployee.mutate(selected.workEmail, {
      onSuccess: () => {
        showSuccess("Employee information synced");
        handleClose();
      },
      onError: (err) => {
        showError(describeError(err));
        setConfirmOpen(false);
      },
    });
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 2 }}>Sync an Employee</DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3 }}>
          <Autocomplete
            options={employees.data ?? []}
            loading={employees.isLoading}
            getOptionLabel={(option) => `${option.firstName} ${option.lastName} (${option.workEmail})`}
            value={selected}
            onChange={(_e, value) => {
              if (value) setConfirmOpen(true);
              setSelected(value);
            }}
            isOptionEqualToValue={(option, value) => option.workEmail === value.workEmail}
            renderInput={(params) => (
              <TextField {...params} label="Search by name or email" placeholder="Search by name or email" fullWidth />
            )}
            renderOption={(props, option) => {
              // `props` already carries its own `key` — pull it out before
              // spreading, or React won't get a real key prop here.
              const { key, ...rest } = props as HTMLAttributes<HTMLLIElement> & { key?: Key };
              return (
                <Box component="li" key={key} {...rest} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Avatar src={option.employeeThumbnail} sx={{ height: "2.2rem", width: "2.2rem" }} />
                  <Box>
                    <Typography variant="body2">
                      {option.firstName} {option.lastName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.workEmail}
                    </Typography>
                  </Box>
                </Box>
              );
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Synchronize Employee Information</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {selected && `Are you sure you want to sync the details of ${selected.workEmail}? This action cannot be undone.`}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" color="warning" disabled={syncEmployee.isPending} onClick={handleSync}>
            {syncEmployee.isPending ? "Syncing…" : "Yes"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
