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

import { useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { useAdminEmployeeDirectory, useInsertUser, useUpdateUser } from "../api/useAdminUsers";
import FunctionalLeadAclSelector from "./FunctionalLeadAclSelector";
import { ASSIGNABLE_PROMOTION_ROLES, promotionRoleColor } from "../util/promotionRoleColors";
import { buildAclPayload, selectionFromAcl, type PromotionAclSelection } from "../util/promotionAcl";
import type { PromotionBusinessUnitAccess, PromotionRole, PromotionUser } from "../api/types";

// Ports promotion-app's own component/dialog/userFormDialog.tsx +
// component/forms/userInsertForm.tsx/userEditForm.tsx — one dialog, two
// modes. Insert picks an employee via a lazy-loaded directory Autocomplete;
// Edit shows the email read-only (email changes only happen through
// Transfer Access — a separate, deliberate action, not a field on this
// form).
export default function UserFormDialog({
  open,
  editingUser,
  existingEmails,
  businessUnits,
  onClose,
}: {
  open: boolean;
  /** null = insert mode (Add a new user); set = edit mode. */
  editingUser: PromotionUser | null;
  existingEmails: string[];
  businessUnits: PromotionBusinessUnitAccess[];
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      {open && (
        <UserFormDialogContent
          key={editingUser?.id ?? "insert"}
          editingUser={editingUser}
          existingEmails={existingEmails}
          businessUnits={businessUnits}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

function UserFormDialogContent({
  editingUser,
  existingEmails,
  businessUnits,
  onClose,
}: {
  editingUser: PromotionUser | null;
  existingEmails: string[];
  businessUnits: PromotionBusinessUnitAccess[];
  onClose: () => void;
}) {
  const isEdit = Boolean(editingUser);
  const [email, setEmail] = useState(editingUser?.email ?? "");
  const [roles, setRoles] = useState<PromotionRole[]>(editingUser?.roles ?? []);
  const [aclSelection, setAclSelection] = useState<PromotionAclSelection>(
    selectionFromAcl(editingUser?.functionalLeadAccessLevels?.businessUnits),
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  const directory = useAdminEmployeeDirectory(true, pickerOpen && !isEdit);
  const insertUser = useInsertUser();
  const updateUser = useUpdateUser();
  const saving = insertUser.isPending || updateUser.isPending;

  const excludeSet = useMemo(() => new Set(existingEmails), [existingEmails]);
  const employeeOptions = (directory.data?.employees ?? []).filter((e) => !excludeSet.has(e.workEmail));

  const needsAcl = roles.includes("FUNCTIONAL_LEAD");
  const canSave = email.trim() !== "" && roles.length > 0 && (!needsAcl || aclSelection.size > 0) && !saving;

  const handleSave = () => {
    const functionalLeadAccessLevels = needsAcl
      ? { businessUnits: buildAclPayload(businessUnits, aclSelection) }
      : null;
    if (isEdit && editingUser) {
      updateUser.mutate(
        { id: editingUser.id, roles, functionalLeadAccessLevels },
        { onSuccess: onClose },
      );
    } else {
      insertUser.mutate({ email, roles, functionalLeadAccessLevels }, { onSuccess: onClose });
    }
  };

  return (
    <>
      <DialogTitle>{isEdit ? "Edit System User" : "New System User"}</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 0.5 }}>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>Employee *</Typography>
            {isEdit ? (
              <TextField fullWidth size="small" disabled value={email} />
            ) : (
              <Autocomplete
                size="small"
                options={employeeOptions}
                loading={directory.isPending}
                getOptionLabel={(o) => `${o.firstName} ${o.lastName} (${o.workEmail})`}
                onOpen={() => setPickerOpen(true)}
                onChange={(_e, value) => setEmail(value?.workEmail ?? "")}
                renderInput={(params) => <TextField {...params} placeholder="Search employees..." />}
              />
            )}
          </Box>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>Roles *</Typography>
            <Select
              fullWidth
              size="small"
              multiple
              value={roles}
              onChange={(e) => setRoles(e.target.value as PromotionRole[])}
              renderValue={(selected) => (
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                  {(selected as PromotionRole[]).map((r) => (
                    <Chip key={r} label={r} size="small" sx={{ bgcolor: promotionRoleColor(r), color: "white" }} />
                  ))}
                </Box>
              )}
            >
              {ASSIGNABLE_PROMOTION_ROLES.map((role) => (
                <MenuItem key={role} value={role}>
                  {role}
                </MenuItem>
              ))}
            </Select>
          </Box>
          <Collapse in={needsAcl}>
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>Functional Lead Access Levels *</Typography>
              <FunctionalLeadAclSelector
                businessUnits={businessUnits}
                selection={aclSelection}
                onChange={setAclSelection}
              />
              {aclSelection.size === 0 && (
                <Typography sx={{ fontSize: 12, color: "warning.main", mt: 0.5 }}>
                  Please configure functional lead access levels
                </Typography>
              )}
            </Box>
          </Collapse>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button disabled={!canSave} onClick={handleSave}>
          Save
        </Button>
      </DialogActions>
    </>
  );
}
