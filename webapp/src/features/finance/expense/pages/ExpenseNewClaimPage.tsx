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
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { ArrowLeftIcon, PencilIcon, ReceiptTextIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import { useNavigate } from "react-router";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { isExpenseBackendConfigured, expenseServiceUrls } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import { withLoadingAdornment } from "@components/picker-loading/pickerLoading";
import { FINANCE_EYEBROW } from "@constants/financeApps";
import FinanceShell from "../../components/FinanceShell";
import { DraftStatusChip } from "../../components/DraftStatusChip";
import { ReceiptViewer } from "../../components/ReceiptViewer";
import { describeError } from "../../util/financeError";
import { money, formatNice } from "../../util/financeFormat";
import { fetchReceiptObjectUrl, type ReceiptSource } from "../../util/financeReceipts";
import { useDraftAutosave } from "../../util/useDraftAutosave";
import { useFillHeight } from "../../util/useFillHeight";
import { claimTabPath } from "../../claims/claimsTabs";
import { useExpenseEmployees } from "../useExpense";
import { useExpenseReceiptUpload } from "../useExpenseMutations";
import type { ExpenseTransactionPayload } from "../expenseTypes";
import { SubmitterLineDialog, SubmitterFieldLabel } from "../submitter/ExpenseSubmitterLineDialog";
import {
  useOnBehalfOfTravels,
  useSubmitClaimForEmployee,
  useSubmitterAppData,
  useSubmitterDraftSync,
} from "../submitter/useExpenseSubmitter";
import type { SubmitterDraftLine, SubmitterTravel } from "../submitter/expenseSubmitterTypes";

/**
 * New expense claim. The reader's own form, plus — for the handful of people
 * who file on others' behalf — the one thing only they can do: file the claim
 * FOR another employee, against their job numbers and routed to their lead.
 */
export default function ExpenseNewClaimPage() {
  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.claims}
      title="New expense claim"
      subtitle="File a claim for yourself, or on behalf of another employee."
      configured={isExpenseBackendConfigured()}
      configKey="ONE_WSO2_EXPENSE_CLAIMS_BACKEND_URL"
    >
      <NewClaimBody />
    </FinanceShell>
  );
}

function NewClaimBody() {
  const appData = useSubmitterAppData();
  const employees = useExpenseEmployees();
  const upload = useExpenseReceiptUpload();
  const submit = useSubmitClaimForEmployee();
  const draft = useSubmitterDraftSync();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotifications();
  const getAccessToken = useAccessToken();

  const [items, setItems] = useState<SubmitterDraftLine[]>([]);
  // Re-measured when the list goes empty or non-empty, because that is when the
  // action row above the card appears and shifts its top edge.
  const [fillRef, fillHeight] = useFillHeight<HTMLDivElement>(items.length > 0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [confirmingDraftLoss, setConfirmingDraftLoss] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false);
  const [receiptLoad, setReceiptLoad] = useState<(() => Promise<ReceiptSource>) | null>(null);
  // Null means "Myself". Starts there and is never seeded from the saved draft
  // — NewClaim.tsx keeps `onBehalfOfEmail: null` initially, so a draft filed
  // for a colleague simply is not offered until that colleague is picked.
  const [onBehalfOfEmail, setOnBehalfOfEmail] = useState<string | null>(null);
  const savedDraftOnBehalfOf = appData.data?.draft?.onBehalfOfEmail ?? null;

  const email = appData.data?.userInfo.workEmail ?? "";
  const leadEmail = appData.data?.userInfo.managerEmail ?? null;

  // Resolve an address to a display name, falling back to the address itself
  // rather than printing an empty parenthetical.
  const nameFor = useMemo(() => {
    const byEmail = new Map((employees.data ?? []).map((e) => [e.workEmail, e]));
    return (addr: string): string => {
      const match = byEmail.get(addr);
      const name = match && [match.firstName, match.lastName].filter(Boolean).join(" ").trim();
      return name || addr;
    };
  }, [employees.data]);

  const leadLabel = leadEmail ? nameFor(leadEmail) : null;
  const onBehalfOfName = onBehalfOfEmail ? nameFor(onBehalfOfEmail) : null;

  // The job numbers offered are the CLAIM OWNER's. The hook is idle while no
  // one is selected, so filing for yourself never fires it.
  const onBehalfOfTravels = useOnBehalfOfTravels(onBehalfOfEmail);
  const effectiveTravels: SubmitterTravel[] = onBehalfOfEmail
    ? (onBehalfOfTravels.data ?? [])
    : (appData.data?.travels ?? []);
  // Empty for almost everyone — the picker below is hidden entirely then.
  const onBehalfOfEmployees = appData.data?.onBehalfOfEmployees ?? [];
  const reimbursementCurrency = appData.data?.currencyCode ?? "LKR";
  const total = useMemo(() => items.reduce((s, it) => s + it.reimbursementAmount, 0), [items]);

  // Trim a form line down to the wire payload (drops derived fields).
  const toPayload = (line: SubmitterDraftLine): ExpenseTransactionPayload => ({
    date: line.date,
    amount: line.amount,
    currency: line.currency,
    expenseTypeId: line.expenseTypeId,
    comment: line.comment,
    receiptUrl: line.receiptUrl,
    travelJobNumber: line.travelJobNumber ?? null,
  });

  // The saved draft is offered as an explicit choice rather than restored
  // silently, which would make a stale draft look like work in progress.
  const savedDraft = useMemo(() => {
    const drafted = appData.data?.draft?.transactions ?? [];
    // The backend PRICES a draft as it saves it — `ExpenseClaimDraftTransaction`
    // requires currencyConversionRate, reimbursementAmount and
    // reimbursementCurrency, and `validateExpenseClaimDraftTransactions` fills
    // them from the same path a submitted claim goes through. So the echoed
    // line is taken as it stands.
    //
    // Deliberately NOT re-derived with a rate of 1 when a figure looks absent:
    // on a foreign-currency line that shows the raw foreign amount as though it
    // were already converted, understating the total by the whole rate. If the
    // figures are ever genuinely missing, the total should look wrong rather
    // than quietly plausible.
    return drafted.map((t) => ({
      date: t.date,
      amount: t.amount,
      currency: t.currency,
      expenseTypeId: t.expenseTypeId,
      comment: t.comment ?? null,
      receiptUrl: t.receiptUrl ?? null,
      travelJobNumber: t.travelJobNumber ?? null,
      reimbursementAmount: t.reimbursementAmount,
      reimbursementCurrency: t.reimbursementCurrency,
      expenseType: t.expenseType ?? "",
    }));
  }, [appData.data]);

  // A draft belongs to whoever it was being filed FOR, so it is offered
  // against that person and nobody else — `NewClaim.tsx:53` does the same.
  //
  // That is what fixes the reported bug: a draft saved for a colleague no
  // longer appears on your own empty claim, where restoring it used to switch
  // the picker to them unasked. Pick that colleague and it is offered, because
  // then it really is the draft in front of you.
  const draftOffered =
    items.length === 0 && savedDraft.length > 0 && onBehalfOfEmail === savedDraftOnBehalfOf;

  /**
   * Whether starting a line would destroy the stored draft — regardless of who
   * it was saved for, and of whether it can be restored here.
   *
   * `NewClaim.tsx:200` gates the warning on `draftClaimItems.length > 0` alone,
   * while only the Restore button keys off the owner matching. So the warning
   * legitimately appears where the button does not: the draft table is keyed
   * on the caller's email alone, giving one slot per person, and a new line
   * overwrites whatever is in it — including a colleague's draft.
   */
  const draftAtRisk = items.length === 0 && savedDraft.length > 0;



  const draftState = useDraftAutosave(JSON.stringify(items), appData.isSuccess, async () => {
    if (items.length > 0) {
      await draft.save.mutateAsync({ transactions: items.map(toPayload), onBehalfOfEmail });
    } else {
      await draft.remove.mutateAsync();
    }
  });

  if (appData.isLoading) {
    return (
      <Stack spacing={1.75}>
        <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1.5 }} />
        <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1.5 }} />
      </Stack>
    );
  }
  if (appData.isError) {
    return <Alert severity="error">Couldn&apos;t load your expense profile. {describeError(appData.error)}</Alert>;
  }

  const handleRestoreDraft = () => {
    // Only the lines. The picker is already on the draft's owner — that is the
    // condition for offering it at all — so there is nothing to switch, and
    // NewClaim.tsx's own handler does no more than this either.
    setItems(savedDraft);
    showSuccess("Draft restored successfully");
  };

  const handleSubmit = () => {
    if (items.length === 0) return;
    setConfirmingSubmit(false);
    submit.mutate(
      { transactions: items.map(toPayload), onBehalfOfEmail },
      {
        onSuccess: () => {
          showSuccess(
            onBehalfOfName
              ? `Expense claim submitted for ${onBehalfOfName}`
              : "Expense claim submitted to your lead",
          );
          // Delete the draft synchronously so a fast unmount can't leave it to
          // be re-seeded and submitted as a duplicate.
          draft.remove.mutate();
          setItems([]);
          // The next claim starts as your own unless you say otherwise.
          setOnBehalfOfEmail(null);
          // `replace`, so Back does not return to a form already sent.
          navigate(claimTabPath("expense"), { replace: true });
        },
        onError: (err) => showError(describeError(err)),
      },
    );
  };

  return (
    <Stack spacing={1.75}>
      {/* FinanceShell has no back affordance of its own, and this form is
          reached with no other way out but the sidebar. */}
      <IconButton
        size="small"
        aria-label="Back to claims"
        onClick={() => navigate(claimTabPath("expense"))}
        sx={{ alignSelf: "flex-start" }}
      >
        <ArrowLeftIcon size={18} />
      </IconButton>

      {/* Column flex so the Total row sits at the BOTTOM of the card, with the
          empty space above it rather than trailing after it. `fillHeight` is
          measured, so the card reaches the bottom of the page exactly — no gap
          under it, and no scrollbar from asking for more room than the page
          has. */}
      <Card
        ref={fillRef}
        variant="outlined"
        sx={{
          p: 3,
          // A FIXED height, not a floor: the card fills the page and the item
          // list inside it scrolls, so adding expenses never grows the page.
          height: fillHeight ?? 420,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <SubmitterFieldLabel>Expenses in this claim</SubmitterFieldLabel>
          {/* Once the picker is gone (below), this is the only thing saying
              whose claim this is. */}
          {items.length > 0 && onBehalfOfName && (
            <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>(for {onBehalfOfName})</Typography>
          )}
          <DraftStatusChip state={draftState} />
          <Box sx={{ flex: 1 }} />

          {/* The claim's actions live in this header, opposite the draft chip,
              rather than on their own row above the card — that row cost the
              list a chunk of height for three buttons. All three only exist
              once there is a line: on an empty claim the centred call to
              action below is the only way in. */}
          {items.length > 0 && (
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexShrink: 0 }}>
              <Tooltip describeChild title="Remove every expense from this claim" arrow>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={() => setConfirmingDeleteAll(true)}
                  sx={{ fontWeight: 600, textTransform: "none" }}
                >
                  Delete All
                </Button>
              </Tooltip>
              <Tooltip describeChild title="Add another expense to this claim" arrow>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setDialogOpen(true)}
                  sx={{ fontWeight: 600, textTransform: "none" }}
                >
                  + Add expense
                </Button>
              </Tooltip>
              <Tooltip describeChild title="Send this claim for review" arrow>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => setConfirmingSubmit(true)}
                  disabled={submit.isPending}
                  sx={{ fontWeight: 600, textTransform: "none" }}
                >
                  {submit.isPending ? "Submitting…" : "Submit claim"}
                </Button>
              </Tooltip>
            </Stack>
          )}
        </Stack>

        {items.length === 0 ? (
          <Stack alignItems="center" justifyContent="center" spacing={2.5} sx={{ flex: 1, px: 2 }}>
            <Stack alignItems="center" spacing={0.5}>
              <Typography sx={{ fontSize: 14.5 }}>It looks like you haven&apos;t added any expenses yet</Typography>
              <Typography sx={{ fontSize: 13.5 }}>Let&apos;s add your expense claim.</Typography>
            </Stack>

            {/* Who this claim is for, chosen before the first line and then
                locked: the picker only exists in the empty state, so the choice
                cannot change under lines already added against that employee's
                job numbers. */}
            {onBehalfOfEmployees.length > 0 && (
              <Autocomplete
                size="small"
                disableClearable
                options={["", ...onBehalfOfEmployees]}
                getOptionLabel={(addr) => (addr === "" ? "Myself" : nameFor(addr))}
                value={onBehalfOfEmail ?? ""}
                onChange={(_e, v) => setOnBehalfOfEmail(v || null)}
                loading={employees.isLoading}
                sx={{ width: 240 }}
                renderInput={(params) => (
                  <TextField {...withLoadingAdornment(params, employees.isLoading)} label="Submitting for" />
                )}
              />
            )}

            <Stack direction="row" alignItems="center" spacing={2}>
              <Button
                variant="contained"
                onClick={() => {
                  // Same condition as the Restore button, so the two always
                  // agree: you are warned about the draft you were offered,
                  // and never about one that is not on the screen.
                  if (draftAtRisk) {
                    setConfirmingDraftLoss(true);
                    return;
                  }
                  setDialogOpen(true);
                }}
                sx={{ fontWeight: 600, textTransform: "none" }}
              >
                + Add expense
              </Button>
              {draftOffered && (
                <>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: "text.secondary" }}>OR</Typography>
                  <Button
                    color="success"
                    variant="outlined"
                    onClick={handleRestoreDraft}
                    sx={{ textTransform: "none", fontWeight: 600 }}
                  >
                    Restore Draft
                  </Button>
                </>
              )}
            </Stack>
          </Stack>
        ) : (
          // Only THIS list scrolls. The "Expenses in this claim" heading above
          // and the Total row below stay put, the way the source app does it —
          // `minHeight: 0` is what lets a flex child shrink enough to scroll
          // instead of pushing the card open.
          <Stack
            spacing={1.5}
            sx={{ flex: 1, minHeight: 0, overflowY: "auto", alignContent: "flex-start", pr: 0.5 }}
          >
            {items.map((it, i) => {
              // The rate is derived from amount vs. reimbursementAmount rather
              // than stored: both already agree once the line was priced,
              // self-currency included (rate 1).
              const conversionRate = it.amount > 0 ? it.reimbursementAmount / it.amount : 0;
              return (
                // `flexShrink: 0` so the card keeps its natural height inside
                // the scrolling list. Without it the cards are flex children of
                // a fixed-height column, so they compress to fit and their
                // contents get clipped instead of the list scrolling.
                <Card key={i} variant="outlined" sx={{ bgcolor: "action.hover", p: 2, flexShrink: 0 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "0.03em" }}>
                      EXPENSE ITEM {i + 1}
                    </Typography>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      {/* Reads with the actions rather than over the buttons
                          below, so the row is Receipt · edit · remove. */}
                      {/* An icon rather than the word "Receipt" plus a pair of
                          buttons: the viewer it opens carries its own Download,
                          so a second one out here was a duplicate. */}
                      <Tooltip describeChild title={it.receiptUrl ? "View or download the receipt" : "No receipt attached"} arrow>
                        {/* A disabled button fires none of the pointer/focus
                            events Tooltip listens for, so without this span
                            the "No receipt attached" tooltip would never
                            show. */}
                        <span>
                          <IconButton
                            size="small"
                            aria-label={it.receiptUrl ? "View receipt" : "No receipt attached"}
                            disabled={!it.receiptUrl}
                            onClick={() => {
                              const fileName = it.receiptUrl!;
                              setReceiptLoad(() => async () => {
                                const accessToken = await getAccessToken();
                                return fetchReceiptObjectUrl(expenseServiceUrls.receiptFile(fileName), accessToken);
                              });
                            }}
                            sx={{
                              borderRadius: 1,
                              bgcolor: "grey.500",
                              color: "white",
                              "&:hover": { bgcolor: "grey.700" },
                              // Muted rather than grey-on-grey when there is no
                              // receipt to open, so "nothing to see" reads as
                              // unavailable instead of just a darker square.
                              "&.Mui-disabled": {
                                bgcolor: "action.disabledBackground",
                                color: "action.disabled",
                              },
                            }}
                          >
                            <ReceiptTextIcon size={14} />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip describeChild title="Edit this expense" arrow>
                        <IconButton
                          size="small"
                          aria-label="Edit expense"
                          onClick={() => {
                            setEditingIndex(i);
                            setDialogOpen(true);
                          }}
                          sx={{ borderRadius: 1, bgcolor: "grey.500", color: "white", "&:hover": { bgcolor: "grey.700" } }}
                        >
                          <PencilIcon size={14} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip describeChild title="Remove this expense from the claim" arrow>
                        <IconButton
                          size="small"
                          aria-label="Remove expense"
                          onClick={() => setDeletingIndex(i)}
                          sx={{ borderRadius: 1, bgcolor: "error.main", color: "white", "&:hover": { bgcolor: "error.dark" } }}
                        >
                          <XIcon size={15} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>

                  <Box sx={{ display: "flex", gap: 3, mt: 1.5 }}>
                    <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: "flex", gap: 3 }}>
                        <Box sx={{ flex: 1 }}>
                          <ItemFieldLabel>Bill Date</ItemFieldLabel>
                          <Typography sx={{ fontSize: 13 }}>{formatNice(it.date)}</Typography>
                        </Box>
                        <Box sx={{ flex: 2 }}>
                          <ItemFieldLabel>Job Number</ItemFieldLabel>
                          <Typography sx={{ fontSize: 13 }}>{it.travelJobNumber ?? "N/A"}</Typography>
                        </Box>
                      </Box>
                      <Box>
                        <ItemFieldLabel>Expense Type</ItemFieldLabel>
                        <Typography sx={{ fontSize: 13, wordBreak: "break-word" }}>{it.expenseType}</Typography>
                      </Box>
                      <Box>
                        <ItemFieldLabel>Comment</ItemFieldLabel>
                        <Typography sx={{ fontSize: 13, wordBreak: "break-word" }}>{it.comment}</Typography>
                      </Box>
                    </Stack>

                    <Stack alignItems="flex-end" spacing={1.5} sx={{ flexShrink: 0 }}>
                      <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, px: 1.5, py: 1, minWidth: 220 }}>
                        <Stack direction="row" justifyContent="space-between" spacing={2}>
                          <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>Reimbursement Amount</Typography>
                          <Typography sx={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                            {money(it.reimbursementAmount, it.reimbursementCurrency)}
                          </Typography>
                        </Stack>
                        <Divider sx={{ my: 0.75 }} />
                        <Stack direction="row" justifyContent="space-between" spacing={2}>
                          <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>Conversion Rate</Typography>
                          <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                            (1 {it.currency} = {conversionRate.toFixed(3)} {it.reimbursementCurrency})
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" spacing={2}>
                          <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>Transaction Amount</Typography>
                          <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                            {money(it.amount, it.currency)}
                          </Typography>
                        </Stack>
                      </Box>
                    </Stack>
                  </Box>
                </Card>
              );
            })}
          </Stack>
        )}

        {/* The running total, separate from (and always visible alongside) the
            Submit button above. */}
        {items.length > 0 && (
          <>
            <Divider sx={{ mt: 2, mb: 1 }} />
            <Stack direction="row" justifyContent="flex-end" alignItems="baseline" spacing={1}>
              <Typography sx={{ fontSize: 13 }}>Total Amount:</Typography>
              <Typography sx={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {money(total, reimbursementCurrency)}
              </Typography>
            </Stack>
          </>
        )}
      </Card>

      {submit.isError && <Alert severity="error">{describeError(submit.error)}</Alert>}

      {/* A claim leaves for review, so it is confirmed rather than sent on one
          click, and the message says who gets it. */}
      <Dialog open={confirmingSubmit} onClose={() => setConfirmingSubmit(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Claim Submission Confirmation</DialogTitle>
        <DialogContent dividers>
          {/* Filing for someone else goes to THEIR lead, not yours, so the
              confirmation must not name your own. */}
          <Typography sx={{ fontSize: 13.5 }}>
            {onBehalfOfName ? (
              <>
                You are submitting this claim on behalf of <b>{onBehalfOfName}</b>. Once submitted, it will be
                sent to their lead for review.
              </>
            ) : (
              <>
                Are you sure you want to submit this claim? Once submitted, it will be sent to your lead
                {leadLabel && <b>{` (${leadLabel})`}</b>} for review.
              </>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setConfirmingSubmit(false)}>
            Cancel
          </Button>
          <Button size="small" variant="contained" onClick={handleSubmit} disabled={submit.isPending}>
            {submit.isPending ? "Submitting…" : "Submit"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* The saved draft goes the moment a new line is added. */}
      <Dialog open={confirmingDraftLoss} onClose={() => setConfirmingDraftLoss(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Draft Deletion Warning</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontSize: 13.5 }}>
            {onBehalfOfName ? (
              <>
                Adding a new claim for <b>{onBehalfOfName}</b> will delete your draft. Are you sure
                you want to proceed?
              </>
            ) : (
              <>Adding a new claim will delete your draft. Are you sure you want to proceed?</>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setConfirmingDraftLoss(false)}>
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() => {
              setConfirmingDraftLoss(false);
              setDialogOpen(true);
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deletingIndex !== null} onClose={() => setDeletingIndex(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Delete Confirmation</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontSize: 13.5 }}>
            Are you sure you want to delete the claim item? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setDeletingIndex(null)}>
            Cancel
          </Button>
          <Button
            size="small"
            color="error"
            variant="contained"
            onClick={() => {
              setItems((prev) => prev.filter((_, j) => j !== deletingIndex));
              setDeletingIndex(null);
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmingDeleteAll} onClose={() => setConfirmingDeleteAll(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Delete All Confirmation</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontSize: 13.5 }}>
            Are you sure you want to delete all {items.length} expense
            {items.length === 1 ? "" : "s"} in this claim? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setConfirmingDeleteAll(false)}>
            Cancel
          </Button>
          <Button
            size="small"
            color="error"
            variant="contained"
            onClick={() => {
              // Emptying the list also clears the saved draft, via the same
              // autosave effect that removes it whenever items hit zero.
              setItems([]);
              setConfirmingDeleteAll(false);
            }}
          >
            Delete All
          </Button>
        </DialogActions>
      </Dialog>

      <ReceiptViewer load={receiptLoad} onClose={() => setReceiptLoad(null)} />

      {dialogOpen && appData.data && (
        <SubmitterLineDialog
          appData={appData.data}
          travels={effectiveTravels}
          travelsLoading={Boolean(onBehalfOfEmail) && onBehalfOfTravels.isLoading}
          onBehalfOfEmail={onBehalfOfEmail}
          onBehalfOfName={onBehalfOfName}
          editing={editingIndex != null ? items[editingIndex] : undefined}
          uploading={upload.isPending}
          // The receipt is filed under the person actually uploading it, even
          // when the claim is for someone else.
          onUpload={(file) => upload.mutateAsync({ email, file })}
          onClose={() => {
            setDialogOpen(false);
            setEditingIndex(null);
          }}
          onAdd={(line) => {
            setItems((prev) =>
              editingIndex != null ? prev.map((it, j) => (j === editingIndex ? line : it)) : [...prev, line],
            );
            setDialogOpen(false);
            setEditingIndex(null);
          }}
        />
      )}
    </Stack>
  );
}

// The item card's own field captions — sentence case, not the uppercase
// form-field style, since these are read-only summaries.
function ItemFieldLabel({ children }: { children: ReactNode }) {
  return <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.25 }}>{children}</Typography>;
}
