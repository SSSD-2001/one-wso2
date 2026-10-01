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

// A Google Sheet URL. Anchored (`^`/`$`) so the whole input must be a URL,
// not just contain one somewhere.
const URL_PATTERN = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})[/\w .\-?=&%]*\/?$/i;

// Shared by two Admin Portal sync flows: User Management's "Import users
// from google sheet" and Time Based Promotions' "Sync"/initial import —
// both are a single required Google Sheet URL field, source's own
// near-identical dialog shape in each panel.
export default function GoogleSheetLinkDialog({
  open,
  title,
  description,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  /** Optional explanatory text shown above the URL field. Omit it when no
   * explanation is needed. */
  description?: string;
  onClose: () => void;
  onSubmit: (url: string) => void;
}) {
  const [url, setUrl] = useState("");
  const valid = URL_PATTERN.test(url.trim());

  const handleClose = () => {
    setUrl("");
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        {description && <DialogContentText sx={{ mb: 2 }}>{description}</DialogContentText>}
        <TextField
          fullWidth
          type="url"
          label="Google Sheet URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoFocus
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          disabled={!valid}
          onClick={() => {
            onSubmit(url.trim());
            setUrl("");
          }}
        >
          Sync
        </Button>
      </DialogActions>
    </Dialog>
  );
}
