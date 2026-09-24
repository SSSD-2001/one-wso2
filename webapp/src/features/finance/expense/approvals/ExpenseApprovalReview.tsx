/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useState, type ReactNode } from "react";
import {
  Box,
  Button,
  ButtonBase,
  Card,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { ArrowLeftIcon, ChevronRightIcon, PrinterIcon, ReceiptTextIcon } from "@wso2/oxygen-ui-icons-react";
import { useAccessToken } from "@hooks/useAccessToken";
import { expenseServiceUrls } from "@config/apiConfig";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { StatusChip, expenseStatusMeta } from "../../components/FinanceChips";
import { ReceiptViewer } from "../../components/ReceiptViewer";
import { describeError } from "../../util/financeError";
import { money } from "../../util/financeFormat";
import { fetchReceiptObjectUrl, type ReceiptSource } from "../../util/financeReceipts";
import { useFillHeight } from "../../util/useFillHeight";
import type { ApproverView } from "../expenseTypes";
import { ExpenseApprovalActivity } from "./ExpenseApprovalActivity";
import { ExpenseApprovalDecisionDialog } from "./ExpenseApprovalDecisionDialog";
import { ExpenseClaimPrintout } from "./ExpenseClaimPrintout";
import { approvalDate } from "./expenseApprovalFormat";
import { onBehalfOfParty, type ApprovalClaim } from "./expenseApprovalTypes";
import { useClaimReceipts } from "./useClaimReceipts";
import { useApprovalDecision, type ApprovalDecision } from "./useExpenseApprovals";

/**
 * One claim in full — `ClaimDetails.tsx` in its lead/finance shape.
 *
 * It **replaces the queue** rather than opening over it, the way the source
 * slides this pane across: the line cards carry a dozen fields each and this
 * app's usual `maxWidth="sm"` dialog would squeeze them.
 *
 * Approve and Reject appear on the pending queue only. On a decided claim the
 * status chip takes their place and opens the activity trail, which is where a
 * lead's rejection reason lives.
 */
export function ExpenseApprovalReview({
  claim,
  stage,
  pending,
  nameFor,
  viewerEmail,
  onBack,
  onDecided,
}: {
  claim: ApprovalClaim;
  stage: ApproverView;
  /** True on the Pending tab — the only place a decision can be taken. */
  pending: boolean;
  nameFor: (email: string | null | undefined) => string;
  viewerEmail: string | undefined;
  onBack: () => void;
  /** Hands the decided claim back so the queue can fade the row out. */
  onDecided: (claimId: string) => void;
}) {
  const getAccessToken = useAccessToken();
  const { showSuccess, showError } = useNotifications();
  const { decide, isPending } = useApprovalDecision();

  // Re-measured on the decision row: Approve/Reject exist only on the pending
  // queue, so the card's top edge moves without anything above it resizing —
  // which no resize observer would catch.
  const [fillRef, fillHeight] = useFillHeight<HTMLDivElement>(pending);
  const [receiptLoad, setReceiptLoad] = useState<(() => Promise<ReceiptSource>) | null>(null);
  const [deciding, setDeciding] = useState<ApprovalDecision | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);

  // Only finance can print, so only finance pays for pre-fetching the images.
  const canPrint = stage === "FINANCE";
  const { sources: receipts, loading: receiptsLoading } = useClaimReceipts(claim.transactions, canPrint);

  const meta = expenseStatusMeta(claim.statusDetails.status);
  const party = onBehalfOfParty(claim, viewerEmail);
  const currency = claim.currencyCode ?? "LKR";
  const total = claim.transactions.reduce((sum, t) => sum + t.reimbursementAmount, 0);

  const viewReceipt = (fileName: string) =>
    setReceiptLoad(() => async () => {
      const accessToken = await getAccessToken();
      return fetchReceiptObjectUrl(expenseServiceUrls.receiptFile(fileName), accessToken);
    });

  const confirmDecision = (reason: string | undefined) => {
    const decision = deciding;
    if (!decision) return;
    decide(claim.id, stage, decision, reason, {
      onSuccess: () => {
        setDeciding(null);
        showSuccess(decision === "approve" ? "Claim approved successfully" : "Claim rejected successfully");
        onDecided(claim.id);
        onBack();
      },
      onError: (err) => {
        setDeciding(null);
        showError(describeError(err));
      },
    });
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 2, flexWrap: "wrap" }}>
        <IconButton size="small" onClick={onBack} aria-label="Back to the approval queue">
          <ArrowLeftIcon size={17} />
        </IconButton>
        <Typography sx={{ fontSize: 15, fontWeight: 700, fontFamily: "monospace" }}>{claim.id}</Typography>

        {/* The source labels this chip "Employee" in both approver views — the
            claim belongs to them, whoever filed it. */}
        <Tooltip describeChild arrow title={claim.employeeEmail}>
          <Chip
            size="small"
            variant="outlined"
            label={`Employee: ${nameFor(claim.employeeEmail)}`}
            sx={{ fontSize: 11 }}
          />
        </Tooltip>
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

        {canPrint && (
          <Tooltip
            describeChild
            arrow
            title={receiptsLoading ? "Fetching receipts…" : "Print this claim"}
          >
            {/* A span, so the tooltip still has a hoverable child once the
                button is disabled. */}
            <span>
              <IconButton
                size="small"
                aria-label="Print claim"
                // The source gates its print button on every receipt having
                // arrived, so a report can never go out with one missing.
                disabled={receiptsLoading}
                onClick={() => window.print()}
                sx={{ borderRadius: 1, bgcolor: "grey.500", color: "white", "&:hover": { bgcolor: "grey.700" } }}
              >
                {receiptsLoading ? (
                  <CircularProgress size={14} sx={{ color: "white" }} />
                ) : (
                  <PrinterIcon size={15} />
                )}
              </IconButton>
            </span>
          </Tooltip>
        )}

        {pending ? (
          <>
            <Button
              size="small"
              variant="contained"
              color="success"
              disabled={isPending}
              onClick={() => setDeciding("approve")}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Approve
            </Button>
            <Button
              size="small"
              variant="contained"
              color="error"
              disabled={isPending}
              onClick={() => setDeciding("reject")}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Reject
            </Button>
          </>
        ) : (
          // ClaimDetails.tsx:346-369 — on a decided claim the status chip is
          // the way into the trail, hence the chevron.
          <ButtonBase
            onClick={() => setActivityOpen(true)}
            aria-label={`Claim activity for ${claim.id}`}
            sx={{ borderRadius: 5, display: "flex", alignItems: "center", gap: 0.25, p: 0.25 }}
          >
            <StatusChip label={meta.label} color={meta.color} />
            <ChevronRightIcon size={13} />
          </ButtonBase>
        )}
      </Stack>

      {/* A measured, FIXED height: the card reaches the bottom of the page and
          the item list inside it scrolls, so a claim with a dozen lines never
          grows the page. The Total row stays pinned under them — where
          `AmountFooter` sits in the source — and the header above stays put. */}
      <Card
        ref={fillRef}
        variant="outlined"
        sx={{ p: 3, height: fillHeight ?? 420, display: "flex", flexDirection: "column" }}
      >
        {/* Only this list scrolls. `minHeight: 0` is what lets a flex child
            shrink far enough to scroll instead of pushing the card open. */}
        <Stack spacing={1.5} sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 0.5 }}>
          {claim.transactions.map((t, i) => {
            const rate = t.amount > 0 ? t.reimbursementAmount / t.amount : 0;
            return (
              // `flexShrink: 0` so a card keeps its natural height inside the
              // scrolling list rather than compressing and clipping itself.
              <Card key={i} variant="outlined" sx={{ bgcolor: "action.hover", p: 2, flexShrink: 0 }}>
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "0.03em" }}>
                  EXPENSE ITEM {i + 1}
                </Typography>

                <Box sx={{ display: "flex", gap: 3, mt: 1.5, flexWrap: "wrap" }}>
                  <Stack spacing={1.5} sx={{ flex: 1, minWidth: 240 }}>
                    <Box sx={{ display: "flex", gap: 3 }}>
                      <Box sx={{ flex: 1 }}>
                        <ItemLabel>Bill Date</ItemLabel>
                        <Typography sx={{ fontSize: 13 }}>{approvalDate(t.date)}</Typography>
                      </Box>
                      <Box sx={{ flex: 2 }}>
                        <ItemLabel>Job Number</ItemLabel>
                        <Typography sx={{ fontSize: 13 }}>{t.travelJobNumber ?? "N/A"}</Typography>
                        {/* Its own row, right under Job Number — absent
                            rather than disabled when there is nothing to
                            open, since older claims can carry a line with no
                            stored receipt. One button, not a view/download
                            pair: ReceiptViewer carries its own Download in
                            the dialog's footer. */}
                        {t.receiptUrl && (
                          <Tooltip describeChild arrow title="View or download the receipt">
                            <IconButton
                              size="small"
                              aria-label={`View receipt for expense item ${i + 1}`}
                              onClick={() => viewReceipt(t.receiptUrl!)}
                              sx={{
                                mt: 1,
                                borderRadius: 1,
                                bgcolor: "grey.500",
                                color: "white",
                                "&:hover": { bgcolor: "grey.700" },
                              }}
                            >
                              <ReceiptTextIcon size={14} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </Box>
                    <Box>
                      <ItemLabel>Expense Type</ItemLabel>
                      <Typography sx={{ fontSize: 13, wordBreak: "break-word" }}>{t.expenseType}</Typography>
                    </Box>
                    <Box>
                      <ItemLabel>Comment</ItemLabel>
                      <Typography sx={{ fontSize: 13, wordBreak: "break-word" }}>{t.comment}</Typography>
                    </Box>
                  </Stack>

                  <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, px: 1.5, py: 1, minWidth: 220 }}>
                    <Stack direction="row" justifyContent="space-between" spacing={2}>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>Reimbursement Amount</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                        {money(t.reimbursementAmount, t.reimbursementCurrency)}
                      </Typography>
                    </Stack>
                    <Divider sx={{ my: 0.75 }} />
                    <Stack direction="row" justifyContent="space-between" spacing={2}>
                      <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>Conversion Rate</Typography>
                      <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                        (1 {t.currency} = {rate.toFixed(3)} {t.reimbursementCurrency})
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" spacing={2}>
                      <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>Transaction Amount</Typography>
                      <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                        {money(t.amount, t.currency)}
                      </Typography>
                    </Stack>
                  </Box>
                </Box>
              </Card>
            );
          })}
        </Stack>

        <Divider sx={{ mt: 2, mb: 1 }} />
        <Stack direction="row" justifyContent="flex-end" alignItems="baseline" spacing={1}>
          <Typography sx={{ fontSize: 13 }}>Total Amount:</Typography>
          <Typography sx={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {money(total, currency)}
          </Typography>
        </Stack>
      </Card>

      <ExpenseApprovalDecisionDialog
        stage={stage}
        decision={deciding ?? "approve"}
        open={deciding !== null}
        pending={isPending}
        onCancel={() => setDeciding(null)}
        onConfirm={confirmDecision}
      />

      <ExpenseApprovalActivity
        claim={activityOpen ? claim : null}
        nameFor={nameFor}
        viewerEmail={viewerEmail}
        onClose={() => setActivityOpen(false)}
      />

      <ReceiptViewer load={receiptLoad} onClose={() => setReceiptLoad(null)} />

      {canPrint && <ExpenseClaimPrintout claim={claim} receipts={receipts} />}
    </Box>
  );
}

function ItemLabel({ children }: { children: ReactNode }) {
  return <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.25 }}>{children}</Typography>;
}
