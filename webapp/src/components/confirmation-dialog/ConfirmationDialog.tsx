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

import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@wso2/oxygen-ui";

export interface ConfirmationContent {
  title: string;
  text: string;
  confirmAction: () => void;
  /** Defaults to "Confirm" — override for a caller whose source dialog uses
   * different wording (e.g. "Proceed"). */
  confirmLabel?: string;
}

/**
 * Originally ported from the due-diligence source app's
 * Dialog/ConfirmationDialog.js, now shared beyond it — a single reusable
 * "are you sure?" dialog, driven by whatever content the caller currently
 * has open (`null` = closed).
 */
export default function ConfirmationDialog({
  content,
  onClose,
}: {
  content: ConfirmationContent | null;
  onClose: () => void;
}) {
  if (!content) return null;
  return (
    <Dialog open fullWidth onClose={onClose}>
      <DialogTitle>{content.title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{content.text}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          color="secondary"
          variant="contained"
          autoFocus
          onClick={() => {
            content.confirmAction();
            onClose();
          }}
        >
          {content.confirmLabel ?? "Confirm"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
