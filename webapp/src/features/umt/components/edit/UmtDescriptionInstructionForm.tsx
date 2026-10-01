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

import { useMemo, useState, type ReactNode } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  DataGrid,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Link,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { PlusIcon, TrashIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { UmtBehaviorChangeRequest, UmtProductDetailsRequest, UmtUpdateProduct, UmtUpdateSummary } from "../../api/umtUpdates";
import { useUmtSaveDescriptionInstruction } from "../../api/useUmtDescriptionInstruction";
import { umtProductHasDescriptionInstruction } from "../../lib/umtDescriptionInstruction";

const { DataGrid: DataGridComponent } = DataGrid;

// Verification/approval documentation links.
// TODO: move these links out of the code, into runtime config (public/config.js).
const DESCRIPTION_DOC_LINK = "https://sites.google.com/wso2.com/updatemanagertool/home#h.6kt0o1wzf1y1";
const BEHAVIOR_CHANGE_APPROVAL_LINK = "https://sites.google.com/wso2.com/updatemanagertool/home#h.g836jj6cxa2r";

type ProductWithId = UmtUpdateProduct & { productId: string | number };

interface DescriptionInstructionRow {
  productId: string | number;
  productName: string | null;
  version: string | null;
  description: string;
  instruction: string;
}

function toRow(product: ProductWithId): DescriptionInstructionRow {
  return {
    productId: product.productId,
    productName: product.product?.name ?? null,
    version: product.product?.version ?? null,
    description: product.description ?? "",
    instruction: product.instruction ?? "",
  };
}

// Shared by the Description and Instruction step and the Validate step: both
// steps operate on the exact same products/description/instruction/
// behavior-change data and the exact same two backend calls
// (PUT /products/details, PUT /update/{id}), so both step wrappers mount
// this one component instead of duplicating it.
export default function UmtDescriptionInstructionForm({
  id,
  update,
  heading = "Description and Instruction",
}: {
  id: string;
  update: UmtUpdateSummary;
  heading?: string;
}) {
  const { showSuccess, showError } = useNotifications();
  const saveMutation = useUmtSaveDescriptionInstruction(id);
  const products = useMemo(
    () => (update.products ?? []).filter((p): p is ProductWithId => p.productId != null),
    [update.products],
  );

  // ---- Hotfix branch state, seeded/kept in sync from the first product ----
  const firstProduct = products[0];
  const [hotfixDescription, setHotfixDescription] = useState(firstProduct?.description ?? "");
  const [hotfixInstruction, setHotfixInstruction] = useState(firstProduct?.instruction ?? "");
  const [lastHotfixSignal, setLastHotfixSignal] = useState(
    `${firstProduct?.description ?? ""} ${firstProduct?.instruction ?? ""}`,
  );
  const hotfixSignal = `${firstProduct?.description ?? ""} ${firstProduct?.instruction ?? ""}`;
  if (hotfixSignal !== lastHotfixSignal) {
    setLastHotfixSignal(hotfixSignal);
    setHotfixDescription(firstProduct?.description ?? "");
    setHotfixInstruction(firstProduct?.instruction ?? "");
  }

  // ---- Non-hotfix rows table, reseeded on a confirmed save or a different
  // update — never just because the backend product list's array reference
  // changed. `["umt-update"]` is invalidated by many unrelated mutations
  // elsewhere on this page (mark as duplicate, testing saves, lifecycle
  // transitions, ...), each handing back a structurally-new (even if
  // content-identical) product list; reseeding on that alone would silently
  // discard rows the user added/removed locally but hadn't saved yet. ----
  const initialRows = useMemo(
    () => products.filter(umtProductHasDescriptionInstruction).map(toRow),
    [products],
  );
  const [rows, setRows] = useState<DescriptionInstructionRow[]>(initialRows);
  const [isRowsDirty, setIsRowsDirty] = useState(false);
  const [lastInitialRows, setLastInitialRows] = useState(initialRows);
  const [lastId, setLastId] = useState(id);
  if (id !== lastId) {
    setLastId(id);
    setLastInitialRows(initialRows);
    setRows(initialRows);
    setIsRowsDirty(false);
  } else if (!isRowsDirty && initialRows !== lastInitialRows) {
    setLastInitialRows(initialRows);
    setRows(initialRows);
  }

  const shownProductIds = useMemo(() => new Set(rows.map((row) => row.productId)), [rows]);
  const missingProducts = useMemo(
    () => products.filter((product) => !shownProductIds.has(product.productId)),
    [products, shownProductIds],
  );

  // ---- Add modal state ----
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isProductSpecific, setIsProductSpecific] = useState(false);
  const [commonDescription, setCommonDescription] = useState("");
  const [commonInstruction, setCommonInstruction] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [productDescription, setProductDescription] = useState("");
  const [productInstruction, setProductInstruction] = useState("");

  function closeAddModal() {
    setIsAddModalOpen(false);
    setIsProductSpecific(false);
    setCommonDescription("");
    setCommonInstruction("");
    setSelectedProductId(null);
    setProductDescription("");
    setProductInstruction("");
  }

  function handleAddModalSave() {
    if (isProductSpecific) {
      const product = missingProducts.find((p) => String(p.productId) === selectedProductId);
      if (!product) return;
      setRows((prev) => [
        ...prev,
        {
          productId: product.productId,
          productName: product.product?.name ?? null,
          version: product.product?.version ?? null,
          description: productDescription.trim(),
          instruction: productInstruction.trim(),
        },
      ]);
    } else {
      setRows((prev) => [
        ...prev,
        ...missingProducts.map((product) => ({
          productId: product.productId,
          productName: product.product?.name ?? null,
          version: product.product?.version ?? null,
          description: commonDescription.trim(),
          instruction: commonInstruction.trim(),
        })),
      ]);
    }
    setIsRowsDirty(true);
    closeAddModal();
  }

  const isAddSaveDisabled = isProductSpecific
    ? !selectedProductId || !productDescription.trim() || !productInstruction.trim()
    : !commonDescription.trim() || !commonInstruction.trim();

  // ---- Verification checkboxes (not backend-persisted; reset after save) ----
  const [isGeneralDescriptionChecked, setIsGeneralDescriptionChecked] = useState(false);
  const [isImplementationDetailsChecked, setIsImplementationDetailsChecked] = useState(false);
  const [isImpactChecked, setIsImpactChecked] = useState(false);

  // ---- Behavior-change block, seeded/kept in sync from the backend ----
  // (unlike the verification checkboxes above, these ARE backend-persisted,
  // so they must not be force-reset after a successful save.)
  const backendBehaviorChanged = update.isBehaviorChanged ?? false;
  const backendBehaviorChangeApproved = update.isBehaviorChangeApproved ?? false;
  const [isBehaviorChanged, setIsBehaviorChanged] = useState<"Yes" | "No">(backendBehaviorChanged ? "Yes" : "No");
  const [isBehaviorChangeApproved, setIsBehaviorChangeApproved] = useState(backendBehaviorChangeApproved);
  const [lastBackendBehaviorChanged, setLastBackendBehaviorChanged] = useState(backendBehaviorChanged);
  const [lastBackendBehaviorChangeApproved, setLastBackendBehaviorChangeApproved] = useState(backendBehaviorChangeApproved);
  if (
    backendBehaviorChanged !== lastBackendBehaviorChanged ||
    backendBehaviorChangeApproved !== lastBackendBehaviorChangeApproved
  ) {
    setLastBackendBehaviorChanged(backendBehaviorChanged);
    setLastBackendBehaviorChangeApproved(backendBehaviorChangeApproved);
    setIsBehaviorChanged(backendBehaviorChanged ? "Yes" : "No");
    setIsBehaviorChangeApproved(backendBehaviorChangeApproved);
  }

  const isSaveDisabled =
    rows.length === 0 ||
    !isGeneralDescriptionChecked ||
    !isImplementationDetailsChecked ||
    !isImpactChecked ||
    (isBehaviorChanged === "Yes" && !isBehaviorChangeApproved);

  async function handleSave() {
    const productsPayload: UmtProductDetailsRequest[] = rows.map((row) => ({
      productId: row.productId,
      description: row.description,
      instruction: row.instruction,
    }));
    const behaviorChange: UmtBehaviorChangeRequest = {
      isBehaviorChanged: isBehaviorChanged === "Yes",
      isBehaviorChangeApproved: isBehaviorChanged === "Yes" ? isBehaviorChangeApproved : false,
    };
    try {
      await saveMutation.mutateAsync({ products: productsPayload, behaviorChange });
      showSuccess("Description and instructions saved.");
      setIsGeneralDescriptionChecked(false);
      setIsImplementationDetailsChecked(false);
      setIsImpactChecked(false);
      setIsRowsDirty(false);
    } catch (error) {
      showError(`Failed to save description and instructions. ${describeError(error)}`);
    }
  }

  async function handleSaveHotfix() {
    const productsPayload: UmtProductDetailsRequest[] = products.map((product) => ({
      productId: product.productId,
      description: hotfixDescription,
      instruction: hotfixInstruction,
    }));
    try {
      await saveMutation.mutateAsync({ products: productsPayload, behaviorChange: null });
      showSuccess("Hotfix description and instruction saved.");
    } catch (error) {
      showError(`Failed to save hotfix description and instruction. ${describeError(error)}`);
    }
  }

  if (update.isHotfix) {
    return (
      <Stack spacing={3}>
        <Typography variant="h5">{heading}</Typography>
        <TextField
          label="Hotfix Description"
          value={hotfixDescription}
          onChange={(event) => setHotfixDescription(event.target.value)}
          fullWidth
          multiline
          minRows={4}
          maxRows={12}
        />
        <TextField
          label="Hotfix Instruction"
          value={hotfixInstruction}
          onChange={(event) => setHotfixInstruction(event.target.value)}
          fullWidth
          multiline
          minRows={4}
          maxRows={12}
        />
        <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
          <Button variant="contained" loading={saveMutation.isPending} onClick={() => void handleSaveHotfix()}>
            Save
          </Button>
        </Stack>
      </Stack>
    );
  }

  const columns: DataGrid.GridColDef[] = [
    {
      field: "productName",
      headerName: "Product Name",
      flex: 2,
      sortable: false,
      renderCell: (params) => <CellCenter>{params.row.productName ?? "N/A"}</CellCenter>,
    },
    {
      field: "version",
      headerName: "Version",
      flex: 1,
      sortable: false,
      renderCell: (params) => <CellCenter>{params.row.version ?? "N/A"}</CellCenter>,
    },
    {
      field: "description",
      headerName: "Description",
      flex: 3,
      sortable: false,
      renderCell: (params) => <CellCenter>{params.row.description}</CellCenter>,
    },
    {
      field: "instruction",
      headerName: "Instruction",
      flex: 3,
      sortable: false,
      renderCell: (params) => <CellCenter>{params.row.instruction}</CellCenter>,
    },
    {
      field: "delete",
      headerName: "",
      width: 52,
      sortable: false,
      renderCell: (params) => (
        <CellCenter>
          <IconButton
            aria-label="Delete row"
            size="small"
            onClick={() => {
              setRows((prev) => prev.filter((row) => row.productId !== params.row.productId));
              setIsRowsDirty(true);
            }}
          >
            <TrashIcon size={16} />
          </IconButton>
        </CellCenter>
      ),
    },
  ];

  return (
    <Stack spacing={3}>
      <Typography variant="h5">{heading}</Typography>

      <Box>
        <DataGridComponent
          autoHeight
          columnHeaderHeight={40}
          columns={columns}
          disableColumnMenu
          disableRowSelectionOnClick
          getRowHeight={() => "auto"}
          getRowId={(row: DescriptionInstructionRow) => row.productId}
          hideFooter
          rows={rows}
        />
      </Box>

      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Button
          variant="outlined"
          startIcon={<PlusIcon size={16} />}
          disabled={missingProducts.length === 0}
          onClick={() => setIsAddModalOpen(true)}
        >
          Description and Instructions
        </Button>
        <Button
          variant="outlined"
          disabled={rows.length === 0}
          onClick={() => {
            setRows([]);
            setIsRowsDirty(true);
          }}
        >
          Clear All
        </Button>
        {missingProducts.length === 0 && products.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            All products already have a description and instruction.
          </Typography>
        )}
      </Stack>

      <Divider />

      <Typography variant="body1">
        Verify the following information in the descriptions. Refer for more information here:{" "}
        <Link href={DESCRIPTION_DOC_LINK} target="_blank" rel="noopener noreferrer" underline="none">
          Update Manager Tool documentation
        </Link>
        .
      </Typography>
      <Stack>
        <FormControlLabel
          control={
            <Checkbox
              checked={isGeneralDescriptionChecked}
              onChange={(event) => setIsGeneralDescriptionChecked(event.target.checked)}
            />
          }
          label="General Description"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={isImplementationDetailsChecked}
              onChange={(event) => setIsImplementationDetailsChecked(event.target.checked)}
            />
          }
          label="Implementation details"
        />
        <FormControlLabel
          control={<Checkbox checked={isImpactChecked} onChange={(event) => setIsImpactChecked(event.target.checked)} />}
          label="Impact"
        />
      </Stack>

      <Typography variant="body1">
        Does this update change the behavior of the product? If so, have you got this approved from the leads?{" "}
        <Link href={BEHAVIOR_CHANGE_APPROVAL_LINK} target="_blank" rel="noopener noreferrer" underline="none">
          Read more
        </Link>
        .
      </Typography>
      <RadioGroup
        row
        value={isBehaviorChanged}
        onChange={(event) => {
          const value = event.target.value as "Yes" | "No";
          setIsBehaviorChanged(value);
          if (value === "No") setIsBehaviorChangeApproved(false);
        }}
      >
        <FormControlLabel value="Yes" control={<Radio />} label="Yes" />
        <FormControlLabel value="No" control={<Radio />} label="No" />
      </RadioGroup>
      {isBehaviorChanged === "Yes" && (
        <FormControlLabel
          control={
            <Checkbox
              checked={isBehaviorChangeApproved}
              onChange={(event) => setIsBehaviorChangeApproved(event.target.checked)}
            />
          }
          label="Behavioral change approved by BU CS lead and EM/Architecture Owner/Product Manager."
        />
      )}

      <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
        <Button variant="contained" disabled={isSaveDisabled} loading={saveMutation.isPending} onClick={() => void handleSave()}>
          Save
        </Button>
      </Stack>

      <Dialog open={isAddModalOpen} onClose={closeAddModal} fullWidth maxWidth="sm">
        <DialogTitle>Add Description and Instructions</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormControlLabel
              control={
                <Checkbox checked={isProductSpecific} onChange={(event) => setIsProductSpecific(event.target.checked)} />
              }
              label="Product Specific"
            />
            {isProductSpecific ? (
              <>
                <Autocomplete<string, false, false, false>
                  options={missingProducts.map((product) => String(product.productId))}
                  getOptionLabel={(value) => {
                    const product = missingProducts.find((p) => String(p.productId) === value);
                    return product ? `${product.product?.name ?? "N/A"} - ${product.product?.version ?? "N/A"}` : value;
                  }}
                  value={selectedProductId}
                  onChange={(_event, value) => setSelectedProductId(value)}
                  renderInput={(params) => <TextField {...params} label="Select Product" required />}
                />
                <TextField
                  label="Product Description"
                  value={productDescription}
                  onChange={(event) => setProductDescription(event.target.value)}
                  fullWidth
                  multiline
                  minRows={4}
                  maxRows={12}
                  required
                />
                <TextField
                  label="Product Instructions"
                  value={productInstruction}
                  onChange={(event) => setProductInstruction(event.target.value)}
                  fullWidth
                  multiline
                  minRows={4}
                  maxRows={12}
                  required
                />
              </>
            ) : (
              <>
                <TextField
                  label="Common Description"
                  value={commonDescription}
                  onChange={(event) => setCommonDescription(event.target.value)}
                  fullWidth
                  multiline
                  minRows={4}
                  maxRows={12}
                  required
                />
                <TextField
                  label="Common Instructions"
                  value={commonInstruction}
                  onChange={(event) => setCommonInstruction(event.target.value)}
                  fullWidth
                  multiline
                  minRows={4}
                  maxRows={12}
                  required
                />
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAddModal}>Cancel</Button>
          <Button variant="contained" disabled={isAddSaveDisabled} onClick={handleAddModalSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function CellCenter({ children }: { children: ReactNode }) {
  return <Stack sx={{ justifyContent: "center", minHeight: "100%", py: 0.75, width: "100%" }}>{children}</Stack>;
}
