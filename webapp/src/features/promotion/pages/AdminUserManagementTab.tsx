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

// Ports promotion-app's own view/administration/panels/userManagement.tsx
// — lists every promotion-app system user (an account + Role[] + optional
// Functional Lead ACL), not the whole employee directory. Add/edit,
// activate/deactivate, delete, transfer a lead's account to a different
// employee, and bulk-sync the user list from a Google Sheet.
import { useEffect, useRef, useState } from "react";
import { Box, IconButton, InputAdornment, Skeleton, TextField, Tooltip, Typography } from "@wso2/oxygen-ui";
import { PlusIcon, RefreshCwIcon, SearchIcon, TriangleAlertIcon, UploadIcon } from "@wso2/oxygen-ui-icons-react";
import { humanizeHttpError } from "@api/http";
import ConfirmationDialog, { type ConfirmationContent } from "@components/confirmation-dialog/ConfirmationDialog";
import { useUserInfo } from "@api/useUserInfo";
import { useAsgardeoUser } from "@hooks/useAsgardeoUser";
import { useAdminUsers, useDeleteUser, useSyncUsers, useUpdateUser } from "../api/useAdminUsers";
import { usePromotionSyncState } from "../api/usePromotionSyncState";
import UserRow from "../components/UserRow";
import UserFormDialog from "../components/UserFormDialog";
import TransferAccessDialog from "../components/TransferAccessDialog";
import GoogleSheetLinkDialog from "../components/GoogleSheetLinkDialog";
import PromotionFeedbackSnackbar from "../components/PromotionFeedbackSnackbar";
import { usePromotionFeedback } from "../util/usePromotionFeedback";
import PromotionSyncStatusLabel from "../components/PromotionSyncStatusLabel";
import PromotionEmptyState from "../components/PromotionEmptyState";
import type { PromotionUser } from "../api/types";

export default function AdminUserManagementTab() {
  const userInfo = useUserInfo();
  const asgardeoUser = useAsgardeoUser();
  const selfEmail = userInfo.data?.workEmail ?? asgardeoUser.email;

  const users = useAdminUsers();
  const sync = usePromotionSyncState("SYNC_STATE", true);
  const syncUsers = useSyncUsers();
  const deleteUser = useDeleteUser();
  const updateUser = useUpdateUser();

  const [search, setSearch] = useState("");
  const [formTarget, setFormTarget] = useState<PromotionUser | null | "insert">(null);
  const [transferTarget, setTransferTarget] = useState<PromotionUser | null>(null);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [confirmContent, setConfirmContent] = useState<ConfirmationContent | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const { feedback, notifySuccess, notifyError, close } = usePromotionFeedback();

  // Once a running sync settles, refetch the list on SUCCESS and notify on
  // either outcome. Ref-tracked off a "just transitioned" edge, not the raw
  // level, so this fires once per sync rather than on every re-render while
  // settled.
  const lastSyncState = useRef(sync.state);
  useEffect(() => {
    if (lastSyncState.current === sync.state) return;
    lastSyncState.current = sync.state;
    if (sync.state === "SUCCESS") {
      void users.refetch();
      notifySuccess("Successfully synchronized the user data.");
    } else if (sync.state === "ERROR") {
      notifyError("Unable to synchronize the user data. Please contact the app support.");
    }
  }, [sync.state]); // eslint-disable-line react-hooks/exhaustive-deps

  const allUsers = users.data?.users.users ?? [];
  const businessUnits = users.data?.businessUnits.businessUnits ?? [];
  const filtered = allUsers.filter((u) =>
    `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <>
      <ConfirmationDialog content={confirmContent} onClose={() => setConfirmContent(null)} />
      <PromotionFeedbackSnackbar feedback={feedback} onClose={close} />
      <UserFormDialog
        open={formTarget !== null}
        editingUser={formTarget === "insert" ? null : formTarget}
        existingEmails={allUsers.map((u) => u.email)}
        businessUnits={businessUnits}
        onClose={() => setFormTarget(null)}
      />
      <TransferAccessDialog user={transferTarget} onClose={() => setTransferTarget(null)} />
      <GoogleSheetLinkDialog
        open={syncDialogOpen}
        title="Google Sheet User Data Synchronization"
        onClose={() => setSyncDialogOpen(false)}
        onSubmit={(url) => {
          syncUsers.mutate(url, {
            onError: (error) => notifyError(`Unable to start the sync. ${humanizeHttpError(error)}`),
          });
          setSyncDialogOpen(false);
        }}
      />

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, gap: 1.5, flexWrap: "wrap" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={() => void users.refetch()}>
              <RefreshCwIcon size={16} />
            </IconButton>
          </Tooltip>
          {sync.state === "IN_PROGRESS" && <PromotionSyncStatusLabel message="Synchronizing user data..." />}
        </Box>
        <TextField
          size="small"
          placeholder="Search by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon size={16} /></InputAdornment> } }}
        />
        <Box sx={{ display: "flex", gap: 1 }}>
          <Tooltip title="Import users from google sheet">
            <IconButton size="small" onClick={() => setSyncDialogOpen(true)}>
              <UploadIcon size={16} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Add a new user">
            <IconButton size="small" onClick={() => setFormTarget("insert")}>
              <PlusIcon size={16} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {users.isPending ? (
        <Skeleton variant="rectangular" height={360} sx={{ borderRadius: 1 }} />
      ) : users.isError ? (
        <PromotionEmptyState
          icon={<TriangleAlertIcon size={28} />}
          tone="error"
          message={`Unable to load user information. ${humanizeHttpError(users.error)}`}
        />
      ) : filtered.length === 0 ? (
        <Typography sx={{ fontSize: 14, color: "text.secondary", textAlign: "center", py: 4 }}>
          No users found
        </Typography>
      ) : (
        <Box sx={{ maxHeight: "calc(100vh - 400px)", minHeight: 300, overflow: "auto" }}>
          {filtered.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              isSelf={user.email === selfEmail}
              toggling={togglingId === user.id && updateUser.isPending}
              onEdit={() => setFormTarget(user)}
              onTransfer={() => setTransferTarget(user)}
              onDelete={() =>
                setConfirmContent({
                  title: "Delete user",
                  text: `Are you sure you want to delete ${user.email}?`,
                  confirmLabel: "Delete",
                  confirmAction: () => deleteUser.mutate(user.id),
                })
              }
              onToggleActive={(active) =>
                setConfirmContent({
                  title: active ? "Activate user" : "Deactivate user",
                  text: `Are you sure do you want to ${active ? "activate" : "deactivate"} this user?`,
                  confirmLabel: active ? "Activate" : "Deactivate",
                  confirmAction: () => {
                    setTogglingId(user.id);
                    updateUser.mutate(
                      { id: user.id, active, roles: user.roles, functionalLeadAccessLevels: user.functionalLeadAccessLevels },
                      { onSettled: () => setTogglingId(null) },
                    );
                  },
                })
              }
            />
          ))}
        </Box>
      )}
    </>
  );
}
