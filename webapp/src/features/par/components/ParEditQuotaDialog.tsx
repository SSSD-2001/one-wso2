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
  Autocomplete,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { useParAdminParticipants } from "../api/useParAdmin";
import type { ParQuotaGroup } from "../util/parQuotaGrouping";

// No whole-org employee directory here, so the lead picker is backed by the
// cycle's own participants (useParAdminParticipants) instead — the same
// resource the Employee/Rejected-Reviews admin grids use.
export default function ParEditQuotaDialog({
  open,
  onClose,
  onSave,
  groupData,
  parCycleId,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (group: ParQuotaGroup) => void;
  groupData: ParQuotaGroup;
  parCycleId: number;
}) {
  const participants = useParAdminParticipants(parCycleId, open);
  // ParAssignQuota only renders this while a group is being edited, so a
  // fresh instance mounts on every open — this initializer alone handles the
  // reset, no effect needed.
  const [group, setGroup] = useState<ParQuotaGroup>(groupData);
  const [leadError, setLeadError] = useState(false);

  const handleClose = () => onClose();

  // 5% and 20% are independent, additive bands (calculateDefaultQuotaValues
  // already excludes the 5% band from default20Slots), so each field is
  // capped only against its own default — legacy's EditQuotaDialog.tsx
  // cross-caps one band by the other's current allocation; not reproduced
  // here, since that silently truncates a valid entry in one band whenever
  // the other happens to be set lower.
  const handleSlotsChange = (kind: "5" | "20", raw: string) => {
    const parsed = raw === "" ? 0 : parseInt(raw, 10);
    const value = Number.isNaN(parsed) ? 0 : Math.max(parsed, 0);

    if (kind === "20") {
      setGroup({ ...group, allocated20Slots: Math.min(value, group.default20Slots) });
    } else {
      setGroup({ ...group, allocated5Slots: Math.min(value, group.default5Slots) });
    }
  };

  const handleSubmit = () => {
    if (group.allocatedLeads.length === 0) {
      setLeadError(true);
      return;
    }
    onSave(group);
    onClose();
  };

  const options = participants.data ?? [];
  const selectedLeads = options.filter((o) => group.allocatedLeads.includes(o.workEmail));

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <DialogTitle>{`Edit Group Settings: ${group.name}`}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={12}>
              <Typography variant="subtitle1">Please set the desired quota values for the group</Typography>
            </Grid>
            <Grid size={6}>
              <Tooltip arrow title="Enter 5% quota. Min : 0, Max : 5% of the group's total headcount">
                <TextField
                  required
                  type="number"
                  label="5% Allocated"
                  fullWidth
                  size="small"
                  helperText={`Total ${group.default5Slots}, Left ${group.default5Slots - group.allocated5Slots}`}
                  inputProps={{ min: 0, max: group.default5Slots }}
                  value={group.allocated5Slots}
                  onChange={(e) => handleSlotsChange("5", e.target.value)}
                />
              </Tooltip>
            </Grid>
            <Grid size={6}>
              <Tooltip arrow title="Enter 20% quota. Min : 0, Max : 20% of the group's total headcount">
                <TextField
                  required
                  type="number"
                  label="20% Allocated"
                  fullWidth
                  size="small"
                  helperText={`Total ${group.default20Slots}, Left ${group.default20Slots - group.allocated20Slots}`}
                  inputProps={{ min: 0, max: group.default20Slots }}
                  value={group.allocated20Slots}
                  onChange={(e) => handleSlotsChange("20", e.target.value)}
                />
              </Tooltip>
            </Grid>
            <Grid size={12}>
              <Typography variant="subtitle1">
                Please select and assign the leads who can view this quota allocation
              </Typography>
            </Grid>
            <Grid size={12}>
              <Autocomplete
                multiple
                options={options}
                getOptionLabel={(o) => `${o.employeeName} (${o.workEmail})`}
                isOptionEqualToValue={(o, v) => o.workEmail === v.workEmail}
                loading={participants.isLoading}
                value={selectedLeads}
                onChange={(_e, newValue) => {
                  setLeadError(false);
                  setGroup({ ...group, allocatedLeads: newValue.map((v) => v.workEmail) });
                }}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip variant="outlined" label={option.workEmail} {...getTagProps({ index })} key={option.workEmail} />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search by name or email"
                    error={leadError}
                    helperText={leadError ? "At least one lead is required." : undefined}
                  />
                )}
                noOptionsText={participants.isError ? "Couldn't load participants" : "No participants found"}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose}>Cancel</Button>
          <Button variant="contained" type="submit">
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
