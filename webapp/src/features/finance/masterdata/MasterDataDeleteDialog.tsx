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

import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@wso2/oxygen-ui";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { MASTER_DATA_DELETE_COPY, MASTER_DATA_SNACK } from "./masterDataCopy";
import { describeDeleteError, useDeleteMasterData } from "./useMasterDataMutations";
import type { MasterDataRow, MasterDataTab } from "./masterDataTypes";

/**
 * "Are you sure?" for a master-data row — `dialogs/DeleteConfirmationDialog.tsx`.
 *
 * Not the shared `ConfirmationDialog`: a delete here can fail with a 409
 * because something still references the record, so the dialog has to stay
 * open and disabled while the request is in flight rather than closing
 * optimistically the moment the button is pressed. The shared component
 * confirms and dismisses in one step, which would report that conflict to a
 * reader who had already been returned to the table.
 */
export default function MasterDataDeleteDialog({
  tab,
  row,
  onClose,
}: {
  tab: MasterDataTab;
  /** The row awaiting confirmation; `null` closes the dialog. */
  row: MasterDataRow | null;
  onClose: () => void;
}) {
  const { showSuccess, showError } = useNotifications();
  const remove = useDeleteMasterData(tab);

  if (!row) return null;

  const handleConfirm = () =>
    remove.mutate(row.id, {
      onSuccess: () => {
        showSuccess(MASTER_DATA_SNACK.success.deleted);
        onClose();
      },
      // Stay open on failure — including the 409 case the doc comment above
      // is about. Closing here would return the reader to the table with
      // only a snackbar saying why, and no way back into this dialog without
      // starting the delete over; leaving it open lets them read the reason
      // and immediately retry or back out themselves.
      onError: (error) => showError(describeDeleteError(error)),
    });

  return (
    <Dialog
      open
      onClose={remove.isPending ? undefined : onClose}
      aria-labelledby="master-data-delete-title"
    >
      <DialogTitle id="master-data-delete-title">{MASTER_DATA_DELETE_COPY.title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{MASTER_DATA_DELETE_COPY.text}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={remove.isPending} color="inherit">
          {MASTER_DATA_DELETE_COPY.cancel}
        </Button>
        <Button
          variant="contained"
          color="error"
          autoFocus
          onClick={handleConfirm}
          disabled={remove.isPending}
          startIcon={remove.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {MASTER_DATA_DELETE_COPY.confirm}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
