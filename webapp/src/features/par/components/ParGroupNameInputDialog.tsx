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
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from "@wso2/oxygen-ui";

// Validated client-side rather than by the backend — the group doesn't exist
// server-side until the final "SAVE QUOTA VALUES" POST.
export default function ParGroupNameInputDialog({
  open,
  onClose,
  groupNames,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  /** Names already in use by other groups — checked case-insensitively. */
  groupNames: string[];
  onSave: (groupName: string) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const validate = (value: string): string | null => {
    if (!value.trim()) return "Group name cannot be empty";
    if (/[^a-zA-Z0-9\s]/.test(value)) return "Group name contains invalid characters";
    if (groupNames.some((existing) => existing.toLowerCase() === value.toLowerCase())) {
      return "Group name already exists";
    }
    return null;
  };

  const handleClose = () => {
    setName("");
    setError(null);
    onClose();
  };

  const handleSave = () => {
    const validationError = validate(name);
    if (validationError) {
      setError(validationError);
      return;
    }
    onSave(name);
    // This dialog stays mounted across opens, so state must be reset
    // explicitly or the next open would inherit this name.
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
        <DialogTitle>New Group</DialogTitle>
        <DialogContent>
          <DialogContentText>Please enter a name for the group. (Max: 50 characters)</DialogContentText>
          <TextField
            autoFocus
            required
            margin="dense"
            fullWidth
            variant="outlined"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={Boolean(error)}
            helperText={error}
            inputProps={{ maxLength: 50 }}
          />
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
