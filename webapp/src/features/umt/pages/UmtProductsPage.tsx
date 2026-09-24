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

import { useMemo, useState, type ReactNode } from "react";
import { Box, Button, Chip, DataGrid, IconButton, LinearProgress, Paper, Stack, Tooltip, Typography } from "@wso2/oxygen-ui";
import { InboxIcon, PlusIcon, Trash2Icon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import type { UmtBaseProduct } from "../api/umtProducts";
import { useUmtBaseProducts } from "../api/useUmtProducts";
import { formatDate } from "../lib/umtDates";
import { gridCellContentSx } from "../lib/umtGrid";
import { productRowId } from "../lib/umtProducts";
import UmtAddProductDialog from "../components/UmtAddProductDialog";
import UmtDeprecateProductDialog from "../components/UmtDeprecateProductDialog";
import UmtShell from "../components/UmtShell";

const { DataGrid: DataGridComponent } = DataGrid;

// Admin-only: UmtShell's `requireAdmin` is the real authorization boundary
// (the sidebar rail item is hidden separately as a UX layer — see SideRail.tsx
// — but per the functional spec, hiding the rail item alone is not enough).
export default function UmtProductsPage() {
  return (
    <UmtShell title="Product Management" requireAdmin>
      <UmtProductsBody />
    </UmtShell>
  );
}

function UmtProductsBody() {
  const baseProducts = useUmtBaseProducts();
  const [addOpen, setAddOpen] = useState(false);
  const [deprecateTarget, setDeprecateTarget] = useState<UmtBaseProduct | null>(null);

  const rows = baseProducts.data ?? [];

  const columns = useMemo<DataGrid.GridColDef<UmtBaseProduct>[]>(
    () => [
      {
        field: "name",
        headerName: "Name",
        flex: 2,
        minWidth: 160,
        renderCell: (params: DataGrid.GridRenderCellParams<UmtBaseProduct>) => (
          <ProductCell>{params.row.name}</ProductCell>
        ),
      },
      {
        field: "version",
        headerName: "Version",
        flex: 1,
        minWidth: 160,
        renderCell: (params: DataGrid.GridRenderCellParams<UmtBaseProduct>) => (
          <ProductCell>{params.row.version}</ProductCell>
        ),
      },
      {
        field: "isActive",
        headerName: "Active",
        flex: 1,
        minWidth: 120,
        renderCell: (params: DataGrid.GridRenderCellParams<UmtBaseProduct>) => (
          <ProductCell>
            <Chip
              label={params.row.isActive ? "Active" : "Deprecated"}
              size="small"
              color={params.row.isActive ? "success" : "default"}
              variant="outlined"
            />
          </ProductCell>
        ),
      },
      {
        field: "createdBy",
        headerName: "Created By",
        flex: 2,
        minWidth: 200,
        renderCell: (params: DataGrid.GridRenderCellParams<UmtBaseProduct>) => (
          <ProductCell>{params.row.createdBy}</ProductCell>
        ),
      },
      {
        field: "createdOn",
        headerName: "Created On",
        flex: 1,
        minWidth: 150,
        renderCell: (params: DataGrid.GridRenderCellParams<UmtBaseProduct>) => (
          <ProductCell>{formatDate(params.row.createdOn)}</ProductCell>
        ),
      },
      {
        field: "deprecatedOn",
        headerName: "Deprecated On",
        flex: 1,
        minWidth: 150,
        renderCell: (params: DataGrid.GridRenderCellParams<UmtBaseProduct>) => (
          <ProductCell>{formatDate(params.row.deprecatedOn)}</ProductCell>
        ),
      },
      {
        field: "action",
        headerName: "Action",
        filterable: false,
        headerAlign: "center",
        align: "center",
        minWidth: 90,
        resizable: false,
        sortable: false,
        renderCell: (params: DataGrid.GridRenderCellParams<UmtBaseProduct>) => {
          if (!params.row.isActive) return null;
          return (
            <ProductCell justify="center">
              <Tooltip title={`Deprecate ${params.row.name} ${params.row.version}`}>
                <IconButton
                  aria-label={`Deprecate ${params.row.name} ${params.row.version}`}
                  color="error"
                  size="small"
                  onClick={() => setDeprecateTarget(params.row)}
                >
                  <Trash2Icon size={17} />
                </IconButton>
              </Tooltip>
            </ProductCell>
          );
        },
      },
    ],
    // setDeprecateTarget is a stable setState function; the grid's own
    // guidance is that columns should keep a stable reference across
    // renders, so this must not depend on addOpen/deprecateTarget toggling
    // or baseProducts refetching.
    [],
  );

  return (
    <Stack spacing={2} sx={{ minWidth: 0, width: "100%" }}>
      <Box sx={{ alignItems: "center", display: "flex", gap: 1.5, justifyContent: "space-between" }}>
        {/* Same level and size as DashboardWidgetHolder's title (e.g.
            "Update #123" on the update view), so UMT section headings match. */}
        <Typography component="h2" variant="h3" sx={{ m: 0 }}>
          Products
        </Typography>
        <Button variant="contained" startIcon={<PlusIcon size={16} />} onClick={() => setAddOpen(true)}>
          Product
        </Button>
      </Box>

      {baseProducts.isError && (
        <ErrorNotice
          error={baseProducts.error}
          onRetry={() => void baseProducts.refetch()}
          retrying={baseProducts.isFetching}
        >
          Couldn&apos;t load base products.
        </ErrorNotice>
      )}

      <Paper variant="outlined" sx={{ minWidth: 0, overflow: "hidden", position: "relative" }}>
        {baseProducts.isFetching && !baseProducts.isPending && (
          <LinearProgress sx={{ left: 0, position: "absolute", right: 0, top: 0, zIndex: 4 }} />
        )}
        {/* Flex column rather than a fixed height: DataGrid v8 sizes itself to
            its rows inside one (autoHeight is deprecated in its favour), so a
            short page no longer leaves dead space under the last row. maxHeight
            keeps a full page scrolling inside the card instead of the window,
            and the empty state still needs a floor to draw its overlay in. */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            maxHeight: { xs: "calc(100dvh - 300px)", md: "calc(100dvh - 260px)" },
            minHeight: rows.length === 0 ? 240 : undefined,
          }}
        >
          <DataGridComponent
            columnHeaderHeight={40}
            columns={columns}
            disableRowSelectionOnClick
            getRowHeight={() => "auto"}
            getRowId={(row: UmtBaseProduct) => productRowId(row)}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            loading={baseProducts.isPending}
            pageSizeOptions={[10, 20, 30, 50]}
            rows={rows}
            slots={{ noRowsOverlay: baseProducts.isError ? NoOverlay : ProductsEmptyState }}
            sx={{ border: 0 }}
          />
        </Box>
      </Paper>

      <UmtAddProductDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <UmtDeprecateProductDialog product={deprecateTarget} onClose={() => setDeprecateTarget(null)} />
    </Stack>
  );
}

// Every cell's content goes through this wrapper: see gridCellContentSx for
// why auto-height rows need it. Plain text is wrapped in a Typography so it
// picks up the same body styling the rest of the UMT tables use.
function ProductCell({ children, justify }: { children: ReactNode; justify?: "center" }) {
  return (
    <Box sx={{ ...gridCellContentSx, justifyContent: justify }}>
      {typeof children === "string" ? <Typography variant="body2">{children}</Typography> : children}
    </Box>
  );
}

// The ErrorNotice above the grid already explains a failed fetch; an empty
// grid on top of it would otherwise still claim "No base products yet",
// asserting the catalog is empty when we simply failed to load it.
function NoOverlay() {
  return null;
}

function ProductsEmptyState() {
  return (
    <Stack sx={{ alignItems: "center", color: "text.disabled", height: "100%", justifyContent: "center" }} spacing={1}>
      <InboxIcon size={36} />
      <Typography variant="body2">No base products yet</Typography>
    </Stack>
  );
}
