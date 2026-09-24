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

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { ArrowLeftIcon, HistoryIcon, PencilIcon, ReceiptTextIcon } from "@wso2/oxygen-ui-icons-react";
import { useAccessToken } from "@hooks/useAccessToken";
import { expenseServiceUrls } from "@config/apiConfig";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { StatusChip, expenseStatusMeta } from "../../components/FinanceChips";
import { ReceiptViewer } from "../../components/ReceiptViewer";
import { describeError } from "../../util/financeError";
import { money } from "../../util/financeFormat";
import { useFillHeight } from "../../util/useFillHeight";
import { fetchReceiptObjectUrl, type ReceiptSource } from "../../util/financeReceipts";
import { useExpenseReceiptUpload, useResubmitExpenseClaim } from "../useExpenseMutations";
import { useExpenseEmployees } from "../useExpense";
import { SubmitterLineDialog } from "../submitter/ExpenseSubmitterLineDialog";
import { useOnBehalfOfTravels } from "../submitter/useExpenseSubmitter";
import type { SubmitterDraftLine } from "../submitter/expenseSubmitterTypes";
import type { ExpenseAppData, ExpenseTransactionPayload } from "../expenseTypes";
import { historyDate, parseUtcTimestamp } from "./expenseHistoryFormat";
import { makeNameResolver, onBehalfOfParty, type HistoryClaim } from "./expenseHistoryTypes";
import { isRejected } from "./ExpenseHistoryTable";

/**
 * ClaimDetails.tsx — one claim in full, shown in place of the list rather than
 * in a dialog: the line cards carry a dozen fields each and a modal at this
 * app's usual `maxWidth="sm"` would squeeze them.
 *
 * A rejected claim opens editable, which is the source's resubmit flow
 * (`PUT /claims/{id}/transactions` — the claim keeps its id and goes back
 * through review rather than becoming a new one).
 */
export function ExpenseHistoryClaimDetails({
  claim,
  appData,
  viewerEmail,
  onBack,
  onShowActivity,
}: {
  claim: HistoryClaim;
  /** Needed only to price edited lines during a resubmit. */
  appData: ExpenseAppData | undefined;
  /** The signed-in person — who a claim is "for" or "by" is relative to them. */
  viewerEmail: string | undefined;
  onBack: () => void;
  onShowActivity: () => void;
}) {
  const getAccessToken = useAccessToken();
  const { showSuccess, showError } = useNotifications();
  const employees = useExpenseEmployees();
  const nameFor = useMemo(() => makeNameResolver(employees.data), [employees.data]);
  const resubmit = useResubmitExpenseClaim();
  const upload = useExpenseReceiptUpload();
  const qc = useQueryClient();

  // ClaimDetails.tsx:128-146 — correcting a claim filed FOR somebody else has
  // to offer that person's job numbers, not the reader's. A claim somebody
  // else filed for the reader is still the reader's own claim, so only the
  // employee side decides this.
  const forSomeoneElse = Boolean(viewerEmail) && claim.employeeEmail !== viewerEmail;
  const onBehalfEmail = forSomeoneElse ? claim.employeeEmail : null;
  const onBehalfTravels = useOnBehalfOfTravels(onBehalfEmail);
  const travels = onBehalfEmail ? (onBehalfTravels.data ?? []) : (appData?.travels ?? []);
  const travelsLoading = Boolean(onBehalfEmail) && onBehalfTravels.isLoading;

  const original = useMemo<SubmitterDraftLine[]>(
    () =>
      claim.transactions.map((t) => ({
        date: t.date,
        amount: t.amount,
        currency: t.currency,
        expenseTypeId: t.expenseTypeId,
        comment: t.comment ?? null,
        receiptUrl: t.receiptUrl ?? null,
        travelJobNumber: t.travelJobNumber ?? null,
        reimbursementAmount: t.reimbursementAmount,
        reimbursementCurrency: t.reimbursementCurrency,
        expenseType: t.expenseType,
      })),
    [claim],
  );

  const [lines, setLines] = useState<SubmitterDraftLine[]>(original);
  // Re-measured on the rejected-claim banner, which appears above the card and
  // shifts its top edge without resizing anything else.
  const [fillRef, fillHeight] = useFillHeight<HTMLDivElement>(isRejected(claim));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [confirmingResubmit, setConfirmingResubmit] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [receiptLoad, setReceiptLoad] = useState<(() => Promise<ReceiptSource>) | null>(null);

  // utils.ts#getOnBehalfOfParty — "Submitted for X" when the reader filed it,
  // "Submitted by Y" when somebody filed it for them.
  const party = onBehalfOfParty(claim, viewerEmail);
  const editable = isRejected(claim);
  const dirty = JSON.stringify(lines) !== JSON.stringify(original);
  const cur = claim.currencyCode ?? "LKR";
  const total = lines.reduce((sum, l) => sum + l.reimbursementAmount, 0);
  const meta = expenseStatusMeta(claim.statusDetails.status);

  // The in-app exits are confirmed by `leaveDetails`, but a reload, a closed
  // tab or the browser's own Back leave without asking — React never gets to
  // run anything that could stop them. This is the one hook the platform gives
  // for that, and it costs nothing while there is nothing to lose.
  //
  // A route-level blocker would cover in-app navigation away from the page too,
  // but `useBlocker` needs a data router; this app mounts a plain
  // `<BrowserRouter>` (`AppWithConfig.tsx:88`), so that is a router change
  // rather than a change to this screen.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const leaveDetails = () => {
    // :127-142 — walking away from edits is confirmed, not silent.
    if (dirty) {
      setConfirmingDiscard(true);
      return;
    }
    onBack();
  };

  const viewReceipt = (fileName: string) =>
    setReceiptLoad(() => async () => {
      const accessToken = await getAccessToken();
      return fetchReceiptObjectUrl(expenseServiceUrls.receiptFile(fileName), accessToken);
    });


  const handleResubmit = () => {
    setConfirmingResubmit(false);
    const transactions: ExpenseTransactionPayload[] = lines.map((l) => ({
      date: l.date,
      amount: l.amount,
      currency: l.currency,
      expenseTypeId: l.expenseTypeId,
      comment: l.comment,
      receiptUrl: l.receiptUrl,
      travelJobNumber: l.travelJobNumber ?? null,
    }));
    resubmit.mutate(
      { id: claim.id, transactions },
      {
        onSuccess: async () => {
          // The shared mutation invalidates `expense-claims`, which is the
          // Me-side key; this screen searches under its own one, so without
          // this the corrected claim would keep reading "Lead Rejected" until
          // the entry went stale on its own (tableSlice's `needsClaimRefetch`).
          await qc.invalidateQueries({ queryKey: ["expense-history-claims"] });
          showSuccess("Claim resubmitted for review");
          onBack();
        },
        onError: (err) => showError(describeError(err)),
      },
    );
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 2, flexWrap: "wrap" }}>
        <IconButton size="small" onClick={leaveDetails} aria-label="Back to claim history">
          <ArrowLeftIcon size={17} />
        </IconButton>
        <Typography sx={{ fontSize: 15, fontWeight: 700, fontFamily: "monospace" }}>{claim.id}</Typography>
        <StatusChip label={meta.label} color={meta.color} />

        {claim.leadEmails[0] && (
          <Tooltip describeChild arrow title={claim.leadEmails[0]}>
            <Chip
              size="small"
              variant="outlined"
              label={`Lead: ${nameFor(claim.leadEmails[0])}`}
              sx={{ fontSize: 11 }}
            />
          </Tooltip>
        )}
        {party && (
          <Tooltip describeChild arrow title={party.email}>
            <Chip
              size="small"
              variant="outlined"
              label={`${party.label} ${nameFor(party.email)}`}
              sx={{ fontSize: 11 }}
            />
          </Tooltip>
        )}

        <Box sx={{ flex: 1 }} />

        <Button
          size="small"
          variant="outlined"
          startIcon={<HistoryIcon size={14} />}
          onClick={onShowActivity}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Activity
        </Button>
        {editable && (
          <Button
            size="small"
            variant="contained"
            color="warning"
            // :262 — the source disables Resubmit while an on-behalf claim's
            // job numbers are still loading, so a correction cannot be sent
            // against a list that has not arrived.
            disabled={resubmit.isPending || travelsLoading}
            onClick={() => setConfirmingResubmit(true)}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {resubmit.isPending ? "Resubmitting…" : "Resubmit"}
          </Button>
        )}
      </Stack>

      {editable && (
        <Alert severity="warning" sx={{ mb: 2, fontSize: 12.5 }}>
          This claim was rejected. Correct the items below and resubmit — it keeps the same claim ID
          and goes back to your lead for review.
        </Alert>
      )}

      {/* A measured, FIXED height: the card fills the page and the item list
          inside it scrolls, so a long claim never grows the page. The Total row
          stays pinned at the bottom (AmountFooter's placement in the source)
          and the header above it stays put. */}
      <Card
        ref={fillRef}
        variant="outlined"
        sx={{ p: 3, height: fillHeight ?? 420, display: "flex", flexDirection: "column" }}
      >
        {/* Only this list scrolls. `minHeight: 0` is what lets a flex child
            shrink enough to scroll rather than pushing the card open. */}
        <Stack
          spacing={1.5}
          sx={{ flex: 1, minHeight: 0, overflowY: "auto", alignContent: "flex-start", pr: 0.5 }}
        >
          {lines.map((line, i) => {
            const rate = line.amount > 0 ? line.reimbursementAmount / line.amount : 0;
            return (
              // `flexShrink: 0` so the card keeps its natural height inside the
              // scrolling list instead of compressing and clipping its content.
              <Card key={i} variant="outlined" sx={{ bgcolor: "action.hover", p: 2, flexShrink: 0 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "0.03em" }}>
                    EXPENSE ITEM {i + 1}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                    {editable && (
                      <Tooltip describeChild arrow title="Edit this expense">
                        <IconButton
                          size="small"
                          aria-label={`Edit expense item ${i + 1}`}
                          onClick={() => setEditingIndex(i)}
                          sx={{ borderRadius: 1, bgcolor: "grey.500", color: "white", "&:hover": { bgcolor: "grey.700" } }}
                        >
                          <PencilIcon size={14} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </Stack>

                <Box sx={{ display: "flex", gap: 3, mt: 1.5, flexWrap: "wrap" }}>
                  <Stack spacing={1.5} sx={{ flex: 1, minWidth: 240 }}>
                    <Box sx={{ display: "flex", gap: 3 }}>
                      <Box sx={{ flex: 1 }}>
                        <ItemLabel>Bill Date</ItemLabel>
                        <Typography sx={{ fontSize: 13 }}>{historyDate(line.date)}</Typography>
                      </Box>
                      <Box sx={{ flex: 2 }}>
                        <ItemLabel>Job Number</ItemLabel>
                        <Typography sx={{ fontSize: 13 }}>{line.travelJobNumber ?? "N/A"}</Typography>
                        {/* One icon rather than "Receipt" plus View and
                            Download: the viewer it opens carries its own
                            Download, so the second button was a duplicate. */}
                        <Tooltip
                          describeChild
                          arrow
                          title={line.receiptUrl ? "View or download the receipt" : "No receipt attached"}
                        >
                          <IconButton
                            size="small"
                            aria-label={line.receiptUrl ? "View receipt" : "No receipt attached"}
                            disabled={!line.receiptUrl}
                            onClick={() => viewReceipt(line.receiptUrl!)}
                            sx={{
                              mt: 1,
                              borderRadius: 1,
                              bgcolor: "grey.500",
                              color: "white",
                              "&:hover": { bgcolor: "grey.700" },
                              "&.Mui-disabled": {
                                bgcolor: "action.disabledBackground",
                                color: "action.disabled",
                              },
                            }}
                          >
                            <ReceiptTextIcon size={14} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                    <Box>
                      <ItemLabel>Expense Type</ItemLabel>
                      <Typography sx={{ fontSize: 13, wordBreak: "break-word" }}>{line.expenseType}</Typography>
                    </Box>
                    <Box>
                      <ItemLabel>Comment</ItemLabel>
                      <Typography sx={{ fontSize: 13, wordBreak: "break-word" }}>{line.comment}</Typography>
                    </Box>
                  </Stack>

                  <Stack alignItems="flex-end" spacing={1.5} sx={{ flexShrink: 0 }}>
                    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, px: 1.5, py: 1, minWidth: 220 }}>
                      <Stack direction="row" justifyContent="space-between" spacing={2}>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>Reimbursement Amount</Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                          {money(line.reimbursementAmount, line.reimbursementCurrency)}
                        </Typography>
                      </Stack>
                      <Divider sx={{ my: 0.75 }} />
                      <Stack direction="row" justifyContent="space-between" spacing={2}>
                        <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>Conversion Rate</Typography>
                        <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                          (1 {line.currency} = {rate.toFixed(3)} {line.reimbursementCurrency})
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" spacing={2}>
                        <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>Transaction Amount</Typography>
                        <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                          {money(line.amount, line.currency)}
                        </Typography>
                      </Stack>
                    </Box>
                  </Stack>
                </Box>
              </Card>
            );
          })}
        </Stack>

        <Divider sx={{ mt: 2, mb: 1 }} />
        <Stack direction="row" justifyContent="flex-end" alignItems="baseline" spacing={1}>
          <Typography sx={{ fontSize: 13 }}>Total Amount:</Typography>
          <Typography sx={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {money(total, cur)}
          </Typography>
        </Stack>
      </Card>

      {resubmit.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {describeError(resubmit.error)}
        </Alert>
      )}

      {/* :225-248 — resubmitting sends the claim back for review, so it is
          confirmed; an unchanged claim says so rather than silently resending. */}
      <Dialog open={confirmingResubmit} onClose={() => setConfirmingResubmit(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Resubmit Confirmation</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontSize: 13.5 }}>
            {dirty
              ? "This claim will go back to your lead for review with the corrections you have made."
              : "You haven't changed any claim items. Resubmit this claim as it is?"}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setConfirmingResubmit(false)}>
            Cancel
          </Button>
          <Button size="small" variant="contained" onClick={handleResubmit} disabled={resubmit.isPending}>
            Resubmit
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmingDiscard} onClose={() => setConfirmingDiscard(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Discard Changes</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontSize: 13.5 }}>
            You have unsaved corrections on this claim. Leaving now discards them.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setConfirmingDiscard(false)}>
            Keep editing
          </Button>
          <Button size="small" color="error" variant="contained" onClick={onBack}>
            Discard
          </Button>
        </DialogActions>
      </Dialog>

      <ReceiptViewer load={receiptLoad} onClose={() => setReceiptLoad(null)} />

      {editingIndex !== null && appData && (
        <SubmitterLineDialog
          appData={appData}
          travels={travels}
          travelsLoading={travelsLoading}
          onBehalfOfEmail={onBehalfEmail}
          onBehalfOfName={onBehalfEmail ? nameFor(onBehalfEmail) : null}
          // ExpenseForm.tsx:137-139 — a correction is measured from the date
          // the claim was FILED, so an old claim's lines do not suddenly fail
          // a past-date rule they satisfied when first submitted.
          //
          // Handed over as a zone-marked instant, not raw. `createdDate` is UTC
          // with no marker ("2026-09-09 20:30:00.0"), and the dialog parses what
          // it is given with `new Date` — which reads an unmarked date-time as
          // LOCAL. For a claim filed inside the offset window that lands the
          // restriction floor a day out, either refusing a correction that
          // should pass or allowing a bill date that should not. This is the
          // same discrepancy `historyDate` exists for, applied to the one field
          // that leaves this screen.
          restrictionFrom={parseUtcTimestamp(claim.createdDate)?.toISOString()}
          editing={lines[editingIndex]}
          uploading={upload.isPending}
          onUpload={(file) => upload.mutateAsync({ email: claim.employeeEmail, file })}
          onClose={() => setEditingIndex(null)}
          onAdd={(line) => {
            setLines((prev) => prev.map((l, j) => (j === editingIndex ? line : l)));
            setEditingIndex(null);
          }}
        />
      )}
    </Box>
  );
}

function ItemLabel({ children }: { children: ReactNode }) {
  return <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.25 }}>{children}</Typography>;
}
