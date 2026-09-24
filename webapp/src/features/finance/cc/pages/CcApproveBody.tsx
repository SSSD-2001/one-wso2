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

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  DataGrid,
  IconButton,
  Popover,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { FilterIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { describeError } from "../../util/financeError";
import { CcApproveDetail } from "../CcApproveDetail";
import { StatusChip, ccStatusMeta } from "../../components/FinanceChips";
import { FINANCE_GRID_SX } from "../../util/financeGridSx";
import { bareAmount, formatNice } from "../../util/financeFormat";
import { ToolbarNoExport as ApproveToolbar } from "../ccGridToolbar";
import { selectedIds as gridSelectedIds } from "../ccSelection";
import { useCcApprove, useCcSaveEdit } from "../useCcMutations";
import { CcEditDialog } from "../CcEditDialog";
import { CcPickOne } from "../CcPickOne";
import { CC_SNACK } from "../ccCopy";
import { useCcTransactions, useCcUserInfo, useCreditCards } from "../useCc";
import type { CcTransaction } from "../ccTypes";

// FILTER_ALL in approve-submissions/index.tsx.
const ALL = "all";

export type ApproveRole = "lead" | "finance";

/**
 * The Credit Card Expenses approval queue: the grid, the detail panel, the
 * filter popover, and the approve/edit mutations. `CcApprovePage.tsx` is its
 * only caller — CC approving lives entirely under Credit Card Expenses, with
 * no second entry point through Claim Approval the way Expense and OPD have.
 *
 * Approving is a mode, not a per-row decision.
 *
 * The source derives one `approveRole` from the user's own roles with finance
 * winning (index.tsx:83-87), names it in the heading, and offers a switcher
 * only to someone who holds both (index.tsx:198). The mode decides what the
 * queue contains, so the heading has to say which mode is in force — a merged
 * list under a role-named heading would claim a filter it had not applied.
 *
 * Derived-with-override rather than the source's effect: `approveRole` is null
 * until someone picks, and the default is computed. Same behaviour, without a
 * state write on first render.
 */
export function ApproveBody({
  userInfo,
  isLead,
  isFinance,
  role,
  checked,
  setChecked,
}: {
  userInfo: ReturnType<typeof useCcUserInfo>;
  isLead: boolean;
  isFinance: boolean;
  role: ApproveRole | null;
  // Owned by the caller, not this component: switching role is a selection
  // change too (the row on screen a moment ago may not even be actionable in
  // the new mode), and the codebase clears a selection at the point of
  // change rather than from an effect reacting to a prop — so the toggle
  // that changes `role`, above this component, is exactly where its own
  // selection has to be cleared alongside it.
  checked: Set<number>;
  setChecked: Dispatch<SetStateAction<Set<number>>>;
}) {
  const txns = useCcTransactions();
  // Only for the reassignment list — the queue itself is not card-scoped here.
  // `true` to include inactive cards: a pending row can outlive its card, and
  // whether someone is a valid lead has nothing to do with whether a card is
  // still open. Without it the row's own current lead could be missing from
  // the options, leaving the control showing a value it does not offer.
  const allCards = useCreditCards(true);
  const { showSuccess, showError } = useNotifications();

  const email = userInfo.data?.workEmail;
  // ApproveFilterPopover.tsx — the source narrows this queue by user, by card
  // and, for finance only, by stage. Without the stage filter finance reads a
  // list of both stages mixed together with no way to see just its own; the
  // port had none of the three.
  const [user, setUser] = useState(ALL);
  const [card, setCard] = useState(ALL);
  const [stage, setStage] = useState(ALL);
  const [editing, setEditing] = useState<CcTransaction | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [filterOpen, setFilterOpen] = useState<HTMLElement | null>(null);
  const saveEdit = useCcSaveEdit();
  const leadApprove = useCcApprove("lead");
  const financeApprove = useCcApprove("finance");

  const isUserLeadOf = (t: CcTransaction) => {
    const leads = (t.leadEmail ?? "").split(",").map((s) => s.trim());
    return email != null && leads.includes(email);
  };

  // ApproveTransactionsDataGrid.tsx:157-166 — actionable is decided by the mode
  // alone: finance acts on pending_finance, a lead on pending_lead. Nothing is
  // actionable before the mode is known.
  const isSelectable = (t: CcTransaction) =>
    role === "finance"
      ? t.status === "pending_finance"
      : role === "lead"
        ? t.status === "pending_lead"
        : false;

  // index.tsx:116-127 — what the queue contains, per mode. As a lead you see
  // only your own reports' first-stage rows; as finance you see both stages,
  // anyone's, so what is still upstream is visible rather than absent.
  const isVisible = (t: CcTransaction) =>
    role === "finance"
      ? t.status === "pending_lead" || t.status === "pending_finance"
      : role === "lead"
        ? t.status === "pending_lead" && isUserLeadOf(t)
        : false;

  const inMode = useMemo(
    () => (txns.data ?? []).filter(isVisible),
    // isVisible closes over role and email
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [txns.data, role, email],
  );

  // Built from what the mode already put on screen, so a filter never offers
  // a person or card with nothing behind it.
  const users = useMemo(() => [...new Set(inMode.map((t) => t.employeeEmail))].sort(), [inMode]);
  const cards = useMemo(() => [...new Set(inMode.map((t) => t.ccNumber))].sort(), [inMode]);

  // Who a submission can be re-pointed at. From every card rather than from the
  // rows on screen (index.tsx:62-69): a lead with nothing pending right now is
  // still a lead, and is often exactly who a misrouted row belongs to. Each
  // card's `leadEmail` may name several, comma-separated.
  const leadList = useMemo(
    () =>
      [
        ...new Set(
          (allCards.data ?? []).flatMap((c) =>
            (c.leadEmail ?? "").split(",").map((s) => s.trim()).filter(Boolean),
          ),
        ),
      ].sort(),
    [allCards.data],
  );

  const rows = useMemo(() => {
    let list = inMode;
    if (user !== ALL) list = list.filter((t) => t.employeeEmail === user);
    if (card !== ALL) list = list.filter((t) => t.ccNumber === card);
    // index.tsx:91-95 resets the stage filter whenever the mode is Lead — a
    // lead's queue is one stage by definition, so the control is finance-only.
    if (role === "finance" && stage !== ALL) list = list.filter((t) => t.status === stage);
    return list;
  }, [inMode, user, card, stage, role]);

  // One stage per mode, so one endpoint — the source approves as the selected
  // role (handleApproveSelection, ApproveTransactionsDataGrid.tsx:171-180).
  const selected = useMemo(
    () => rows.filter((t) => checked.has(t.id) && isSelectable(t)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, checked, role],
  );
  const selectedIds = selected.map((t) => t.id);
  const selectedCount = selectedIds.length;
  const approving = leadApprove.isPending || financeApprove.isPending;
  // An edit saved from this screen is a separate request. Approving before it
  // lands would book the row as it was before the correction, so the button
  // waits for it. (The source does not guard this; see the spec.)
  const busy = approving || saveEdit.isPending;

  /**
   * Narrowing or switching mode clears the selection.
   *
   * `checked` holds ids and `selected` intersects it with what is on screen, so
   * a hidden tick is never submitted — but it is not forgotten either. Widen the
   * filter again, or switch role and back, and it returns as a live selection
   * the reader last saw a different queue for. Cleared at the point of change
   * rather than from an effect, which this codebase treats as an error.
   */
  const narrow = <T,>(set: (v: T) => void) => (v: T) => {
    setChecked(new Set());
    set(v);
  };

  const toggle = (id: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleApprove = () => {
    if (selectedCount === 0 || !role) return;
    const approve = role === "finance" ? financeApprove : leadApprove;
    approve
      .mutateAsync(selectedIds)
      .then(() => {
        showSuccess(CC_SNACK.success.approveSubmission);
        setChecked(new Set());
      })
      .catch((err) => showError(describeError(err)));
  };

  const columns = useMemo<DataGrid.GridColDef<CcTransaction>[]>(
    () => [
      { field: "id", headerName: "ID", width: 70 },
      { field: "txnDescription", headerName: "Description", flex: 1, minWidth: 120 },
      {
        field: "txnDate",
        headerName: "Date",
        width: 105,
        renderCell: (p) => formatNice(p.value as string),
      },
      {
        // ApproveTransactionsDataGrid.tsx:110-128 — this queue mixes both
        // stages, so which one a row is at is the column that earns its place.
        field: "status",
        headerName: "Status",
        width: 130,
        align: "center",
        headerAlign: "center",
        renderCell: (p) => {
          const meta = ccStatusMeta(p.value as string);
          return <StatusChip label={meta.label} color={meta.color} />;
        },
      },
      {
        field: "txnAmount",
        headerName: "Amount($)",
        type: "number",
        width: 100,
        renderCell: (p) => bareAmount(p.value as number),
      },
    ],
    [],
  );

  if (userInfo.isLoading) {
    return <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1.5 }} />;
  }
  if (userInfo.isError) {
    return <Alert severity="error">Couldn't load your finance profile. {describeError(userInfo.error)}</Alert>;
  }
  if (!isFinance && !isLead) {
    return <Alert severity="info">Approvals are limited to leads and finance approvers.</Alert>;
  }

  // The row the panel is showing. Derived, so a row approved out of the queue
  // falls back to the first rather than leaving the panel on something gone.
  const activeRowId = rows.some((r) => r.id === selectedRowId) ? selectedRowId : rows[0]?.id ?? null;
  const selectedRow = rows.find((r) => r.id === activeRowId) ?? null;
  const activeFilters = [user, card, role === "finance" ? stage : ALL].filter((f) => f !== ALL).length;

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {/* ApproveFilterPopover.tsx — the source keeps these behind one trigger
          rather than spending a row of the page on three selects that are
          usually left alone. The badge says how many are narrowing the queue. */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Button
          variant="text"
          onClick={(e) => setFilterOpen(e.currentTarget)}
          startIcon={<FilterIcon size={16} />}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Filter
          {activeFilters > 0 && (
            <Chip label={activeFilters} size="small" color="primary" sx={{ ml: 0.75, height: 18, fontSize: 10.5 }} />
          )}
        </Button>
        {/* :266-273 — the disabled tooltip names the role, because the reason a
            row cannot be ticked is which stage it is at. */}
        <Tooltip
          title={
            selectedCount === 0 || busy
              ? `Select transactions to approve as ${role === "lead" ? "lead" : "finance"}`
              : "Approve selected transactions"
          }
        >
          <span>
            <Button
              variant="contained"
              color="success"
              onClick={handleApprove}
              disabled={selectedCount === 0 || busy}
              sx={{ fontWeight: 600 }}
            >
              {approving ? "Approving…" : `Approve ${selectedCount || ""}`.trim()}
            </Button>
          </span>
        </Tooltip>
      </Stack>

      <Popover
        open={filterOpen !== null}
        anchorEl={filterOpen}
        onClose={() => setFilterOpen(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        {/* ApproveFilterPopover.tsx, down to the wording: the fields are named
            "Filter by …" and their empty option is "No Filter", which inside a
            Filter panel reads as the absence of a value rather than as one. */}
        <Stack spacing={2} sx={{ p: 2, width: 320 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography sx={{ fontSize: 16, fontWeight: 700 }}>Filter</Typography>
            <IconButton size="small" aria-label="Close filters" onClick={() => setFilterOpen(null)}>
              <XIcon size={16} />
            </IconButton>
          </Stack>
          {/* index.tsx:91-95 resets the stage whenever the mode is Lead — a
              lead's queue is one stage by definition, so it is finance-only. */}
          {role === "finance" && (
            <CcPickOne
              label="Filter by status"
              value={stage}
              onChange={narrow(setStage)}
              options={["pending_lead", "pending_finance"]}
              optionLabel={(o) => (o === "pending_lead" ? "Pending Lead" : "Pending Finance")}
              emptyLabel="No Filter"
            />
          )}
          <CcPickOne label="Filter by user" value={user} onChange={narrow(setUser)} options={users} emptyLabel="No Filter" />
          <CcPickOne label="Filter by card" value={card} onChange={narrow(setCard)} options={cards} emptyLabel="No Filter" />
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              // Nothing to reset until something is narrowing the queue.
              disabled={activeFilters === 0}
              onClick={() => {
                setUser(ALL);
                setCard(ALL);
                setStage(ALL);
              }}
            >
              Reset
            </Button>
            <Button size="small" variant="contained" onClick={() => setFilterOpen(null)}>
              Apply
            </Button>
          </Stack>
        </Stack>
      </Popover>

      {txns.isLoading ? (
        <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 1.5 }} />
      ) : txns.isError ? (
        <Alert severity="error">Couldn't load transactions. {describeError(txns.error)}</Alert>
      ) : rows.length === 0 ? (
        // ApproveTransactionsDataGrid.tsx:216-220 for the second pair. The
        // first is ours: the source says "All submissions have been Approved."
        // however the list came to be empty, which is plainly untrue when a
        // filter is what emptied it and work is still waiting behind it.
        <Box sx={{ py: 3 }}>
          {activeFilters > 0 ? (
            <>
              <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>No submissions match these filters.</Typography>
              <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                Clear them to see the rest of the queue.
              </Typography>
            </>
          ) : (
            <>
              <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>No submissions to approve.</Typography>
              <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                All submissions have been Approved.
              </Typography>
            </>
          )}
        </Box>
      ) : (
        // The source's 50/50 split (:365-380): the queue stays readable while a
        // row is inspected. Neither half scrolls the page — the panel scrolls
        // inside its own card when the window is short.
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems="stretch"
          sx={{ flex: { md: 1 }, minHeight: { xs: "auto", md: 0 } }}
        >
          <Box
            sx={{
              width: { xs: "100%", md: "50%" },
              display: "flex",
              flexDirection: "column",
              height: { xs: 440, md: "100%" },
              minHeight: 0,
              "& .MuiDataGrid-row": { cursor: "pointer" },
              "& .MuiDataGrid-row.selected-row": {
                bgcolor: "action.selected",
                boxShadow: (theme) => `inset 3px 0 0 ${theme.palette.primary.main}`,
              },
              "& .MuiDataGrid-row.selected-row .MuiDataGrid-cell": { fontWeight: 600 },
            }}
          >
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <DataGrid.DataGrid
                rows={rows}
                columns={columns}
                showToolbar
                slots={{ toolbar: ApproveToolbar }}
                density="compact"
                disableRowSelectionOnClick
                checkboxSelection
                // :159-164 — actionable is decided by the mode alone.
                isRowSelectable={(p) => isSelectable(p.row)}
                rowSelectionModel={{ type: "include", ids: new Set(checked) }}
                onRowSelectionModelChange={(model) => {
                  const next = gridSelectedIds(model, rows.filter(isSelectable));
                  for (const t of rows) {
                    if (next.has(t.id) !== checked.has(t.id)) toggle(t.id);
                  }
                }}
                onRowClick={(p) => setSelectedRowId(Number(p.id))}
                // The grid turns neither Enter nor Space into a row click, so
                // without this a keyboard reader could move the focus ring down
                // the list while the panel stayed where they left it.
                onCellKeyDown={(p, e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  setSelectedRowId(Number(p.id));
                }}
                getRowClassName={(p) => (p.id === activeRowId ? "selected-row" : "")}
                initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
                pageSizeOptions={[5, 10, 25]}
                sx={FINANCE_GRID_SX}
              />
            </Box>
          </Box>

          <Box
            sx={{
              width: { xs: "100%", md: "50%" },
              display: "flex",
              flexDirection: "column",
              height: { xs: "auto", md: "100%" },
              minHeight: 0,
              overflowY: "auto",
              border: 1,
              borderColor: "divider",
              borderRadius: 1.5,
              p: 1.75,
            }}
          >
            {selectedRow ? (
              <CcApproveDetail
                key={selectedRow.id}
                txn={selectedRow}
                // :372 — Edit is finance's alone. What it may then change
                // depends on the stage; `CcEditDialog` decides that.
                canEdit={isFinance}
                onEdit={() => setEditing(selectedRow)}
              />
            ) : (
              <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                Select a transaction to see its details.
              </Typography>
            )}
          </Box>
        </Stack>
      )}

      <CcEditDialog
        txn={editing}
        financeAdmin={role === "finance"}
        leadList={leadList}
        onClose={() => setEditing(null)}
        onSave={(patched) => {
          setEditing(null);
          saveEdit.mutate([patched], {
            onSuccess: () => showSuccess(CC_SNACK.success.saveEdit),
            onError: (err) => showError(describeError(err)),
          });
        }}
      />
    </Box>
  );
}
