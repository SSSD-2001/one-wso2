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

import { useState, type ChangeEvent } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
} from "@wso2/oxygen-ui";
import { XIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import {
  EMPTY_CREATE_PRODUCT_FORM,
  buildUmtCreateProductRequest,
  isCreateProductFormValid,
  type UmtCreateProductFormValues,
} from "../lib/umtProducts";
import { useUmtCreateProduct } from "../api/useUmtProducts";

// Full port of legacy's "Add a Product" form (product-management-view). The
// one deliberate fix: FTP Password is masked here (legacy leaves it as a
// plain, readable TextField) — the functional spec is explicit that
// credentials must never be exposed after submission, and an unmasked field
// on screen is exactly that. Every field resets on close, and nothing here is
// ever written to browser storage.
export default function UmtAddProductDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { showSuccess } = useNotifications();
  const createProduct = useUmtCreateProduct();
  const [values, setValues] = useState<UmtCreateProductFormValues>(EMPTY_CREATE_PRODUCT_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isBusy = createProduct.isPending;
  const isFormValid = isCreateProductFormValid(values);

  const field = (key: keyof UmtCreateProductFormValues, label: string) => ({
    value: values[key],
    onChange: (event: ChangeEvent<HTMLInputElement>) =>
      setValues((current) => ({ ...current, [key]: event.target.value })),
    error: submitted && values[key].trim().length === 0,
    helperText: submitted && values[key].trim().length === 0 ? `${label} is required` : undefined,
  });

  const handleClose = () => {
    if (isBusy) return;
    setValues(EMPTY_CREATE_PRODUCT_FORM);
    setSubmitted(false);
    setSubmitError(null);
    createProduct.reset();
    onClose();
  };

  async function handleAdd() {
    setSubmitted(true);
    setSubmitError(null);
    if (!isFormValid) return;

    try {
      await createProduct.mutateAsync(buildUmtCreateProductRequest(values));
      showSuccess("Base product added successfully.");
      handleClose();
    } catch (error) {
      setSubmitError(describeError(error));
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontSize: 18, fontWeight: 600, pr: 7 }}>
        Add a Product
        <IconButton
          aria-label="Close add product dialog"
          onClick={handleClose}
          disabled={isBusy}
          sx={{ position: "absolute", right: 12, top: 12 }}
        >
          <XIcon size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.25}>
          {submitError && <Alert severity="error">{submitError}</Alert>}

          <TextField label="Product Name (eg: wso2am)" required size="small" {...field("name", "Product name")} />
          <TextField label="Product Version (eg: 4.0.0)" required size="small" {...field("version", "Product version")} />
          <TextField label="Lead Email" required size="small" {...field("leadMail", "Lead email")} />
          <TextField label="ED Email" required size="small" {...field("edMail", "ED email")} />
          <TextField label="FTP Host" required size="small" {...field("ftpHost", "FTP host")} />
          <TextField label="FTP Port" required size="small" {...field("ftpPort", "FTP port")} />
          <TextField label="FTP Username" required size="small" {...field("ftpUsername", "FTP username")} />
          {/* new-password, not off/current-password: this is a shared service
              credential, not this admin's own login, so the browser must
              neither offer to save it to their personal password manager nor
              autofill it in from one. */}
          <TextField
            label="FTP Password"
            type="password"
            required
            size="small"
            autoComplete="new-password"
            {...field("ftpPassword", "FTP password")}
          />
          <TextField label="FTP Absolute Path" required size="small" {...field("ftpAbsolutePath", "FTP absolute path")} />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="outlined" onClick={handleClose} disabled={isBusy}>
          Cancel
        </Button>
        <Button variant="contained" disabled={isBusy} loading={isBusy} onClick={() => void handleAdd()}>
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}
