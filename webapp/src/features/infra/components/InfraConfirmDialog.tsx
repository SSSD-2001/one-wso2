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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import type { ReactNode } from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@wso2/oxygen-ui";
import { primaryBtnSx, secondaryBtnSx } from "./infraUi";

export default function InfraConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  tone = "primary",
  busy,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  tone?: "primary" | "danger";
  busy?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onClose={() => !busy && onCancel()} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 800 }}>{title}</DialogTitle>
      <DialogContent>
        <Typography component="div" sx={{ fontSize: 13, color: "text.secondary", lineHeight: 1.55 }}>
          {body}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} disabled={busy} sx={secondaryBtnSx}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={busy || confirmDisabled}
          variant="contained"
          color={tone === "danger" ? "error" : "primary"}
          autoFocus
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}
          sx={primaryBtnSx}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}