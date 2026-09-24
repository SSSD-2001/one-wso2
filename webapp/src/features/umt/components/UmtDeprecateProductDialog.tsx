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
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { UmtBaseProduct } from "../api/umtProducts";
import { useUmtDeprecateProduct } from "../api/useUmtProducts";

// Legacy's row action is labeled "Delete" but only ever deprecates the
// product (a soft, reversible-by-backend state change, not a removal). This
// port uses the accurate verb throughout instead of reproducing the
// misleading label.
export default function UmtDeprecateProductDialog({
  product,
  onClose,
}: {
  product: UmtBaseProduct | null;
  onClose: () => void;
}) {
  const { showSuccess } = useNotifications();
  const deprecateProduct = useUmtDeprecateProduct();
  const [error, setError] = useState<string | null>(null);
  // Parent nulls `product` as soon as Cancel/Deprecate fires, which would
  // otherwise blank the confirmation text mid fade-out; keep showing the
  // last real target's name/version through the close transition.
  const [lastKnownProduct, setLastKnownProduct] = useState<UmtBaseProduct | null>(null);
  if (product && product !== lastKnownProduct) {
    setLastKnownProduct(product);
  }
  const displayProduct = product ?? lastKnownProduct;

  const isBusy = deprecateProduct.isPending;

  const handleClose = () => {
    if (isBusy) return;
    setError(null);
    onClose();
  };

  async function handleDeprecate() {
    if (!product) return;
    setError(null);
    try {
      await deprecateProduct.mutateAsync({ name: product.name, version: product.version });
      showSuccess(`${product.name} ${product.version} deprecated successfully.`);
      handleClose();
    } catch (thrown) {
      setError(describeError(thrown));
    }
  }

  return (
    <Dialog open={Boolean(product)} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Deprecate product</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <DialogContentText>
          Are you sure you want to deprecate <strong>{displayProduct?.name}</strong> version{" "}
          <strong>{displayProduct?.version}</strong>?
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isBusy}>
          Cancel
        </Button>
        <Button variant="contained" color="error" loading={isBusy} onClick={() => void handleDeprecate()}>
          Deprecate
        </Button>
      </DialogActions>
    </Dialog>
  );
}
