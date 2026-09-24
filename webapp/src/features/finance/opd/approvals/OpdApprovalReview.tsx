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
import {
  Box,
  Button,
  ButtonBase,
  Card,
  Chip,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { ArrowLeftIcon, ChevronRightIcon, ReceiptTextIcon } from "@wso2/oxygen-ui-icons-react";
import { useAccessToken } from "@hooks/useAccessToken";
import { opdServiceUrls } from "@config/apiConfig";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { StatusChip, opdStatusMeta } from "../../components/FinanceChips";
import { ReceiptViewer } from "../../components/ReceiptViewer";
import { describeError } from "../../util/financeError";
import { money, formatNice } from "../../util/financeFormat";
import { fetchReceiptObjectUrl, type ReceiptSource } from "../../util/financeReceipts";
import { useFillHeight } from "../../util/useFillHeight";
import { OpdClaimActivityDrawer } from "../history/OpdClaimActivityDrawer";
import { useOpdClaimStatus } from "../useOpdMutations";
import type { OpdClaim } from "../opdTypes";
import { OpdApprovalDecisionDialog, type OpdApprovalDecision } from "./OpdApprovalDecisionDialog";

/**
 * One OPD claim in full — `ExpenseApprovalReview`'s shape, carried over for
 * OPD, sharing its bill-card layout with `OpdHistoryClaimDetails` (the
 * submitter's own read of a filed claim). This one adds the finance
 * decision: approve/reject on the pending queue, the activity trail in their
 * place once a claim is decided.
 *
 * Takes over the page rather than opening in a dialog, for the reason the
 * expense side does: a claim can carry many bills, and this app's usual
 * `maxWidth="sm"` dialog would squeeze them.
 */
export function OpdApprovalReview({
  claim,
  pending,
  onBack,
  onDecided,
}: {
  claim: OpdClaim;
  /** True on the Pending queue — the only place a decision can be taken. */
  pending: boolean;
  onBack: () => void;
  /** Hands the decided claim back so the queue can fade the row out. */
  onDecided: (claimId: string) => void;
}) {
  const getAccessToken = useAccessToken();
  const { showSuccess, showError } = useNotifications();
  const status = useOpdClaimStatus();

  // Re-measured on the decision row, the same reason the expense side does:
  // Approve/Reject exist only on the pending queue, so the card's top edge
  // moves without anything above it resizing.
  const [fillRef, fillHeight] = useFillHeight<HTMLDivElement>(pending);
  const [receiptLoad, setReceiptLoad] = useState<(() => Promise<ReceiptSource>) | null>(null);
  const [deciding, setDeciding] = useState<OpdApprovalDecision | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);

  const meta = opdStatusMeta(claim.statusDetails.status);

  const viewReceipt = (fileName: string) =>
    setReceiptLoad(() => async () => {
      const accessToken = await getAccessToken();
      return fetchReceiptObjectUrl(opdServiceUrls.receiptFile(fileName), accessToken);
    });

  const confirmDecision = (reason: string | undefined) => {
    const decision = deciding;
    if (!decision) return;
    status.mutate(
      {
        claimId: claim.id,
        body: { status: decision === "approve" ? "APPROVED" : "REJECTED", reason },
      },
      {
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
      },
    );
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 2, flexWrap: "wrap" }}>
        <IconButton size="small" onClick={onBack} aria-label="Back to the approval queue">
          <ArrowLeftIcon size={17} />
        </IconButton>
        <Typography sx={{ fontSize: 15, fontWeight: 700, fontFamily: "monospace" }}>{claim.id}</Typography>

        <Tooltip describeChild arrow title={claim.employeeEmail}>
          <Chip size="small" variant="outlined" label={`Employee: ${claim.employeeEmail}`} sx={{ fontSize: 11 }} />
        </Tooltip>

        <Box sx={{ flex: 1 }} />

        {pending ? (
          <>
            <Button
              size="small"
              variant="contained"
              color="success"
              disabled={status.isPending}
              onClick={() => setDeciding("approve")}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Approve
            </Button>
            <Button
              size="small"
              variant="contained"
              color="error"
              disabled={status.isPending}
              onClick={() => setDeciding("reject")}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Reject
            </Button>
          </>
        ) : (
          // On a decided claim the status chip is the way into the trail,
          // hence the chevron — matches the expense side.
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

      {/* A measured, FIXED height, same reasoning as expense: the card
          reaches the bottom of the page and the bill list inside it scrolls,
          so a claim with a dozen bills never grows the page. */}
      <Card
        ref={fillRef}
        variant="outlined"
        sx={{ p: 3, height: fillHeight ?? 420, display: "flex", flexDirection: "column" }}
      >
        <Stack spacing={1.5} sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 0.5 }}>
          {claim.transactions.map((t, i) => (
            <Card key={i} variant="outlined" sx={{ bgcolor: "action.hover", p: 2, flexShrink: 0 }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "0.03em" }}>
                OPD ITEM {i + 1}
              </Typography>

              <Box sx={{ display: "flex", gap: 3, mt: 1.5, flexWrap: "wrap" }}>
                <Stack spacing={1.5} sx={{ flex: 1, minWidth: 240 }}>
                  <Box>
                    <ItemLabel>Bill Date</ItemLabel>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Typography sx={{ fontSize: 13 }}>{formatNice(t.date)}</Typography>
                      {/* Right next to Bill Date, its own element — absent
                          rather than disabled when there is nothing to open,
                          since older claims can carry a bill with no stored
                          receipt. One button, not a view/download pair:
                          ReceiptViewer carries its own Download in the
                          dialog's footer. */}
                      {t.receiptUrl && (
                        <Tooltip describeChild arrow title="View or download the receipt">
                          <IconButton
                            size="small"
                            aria-label={`View receipt for OPD item ${i + 1}`}
                            onClick={() => viewReceipt(t.receiptUrl!)}
                            sx={{
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
                    </Stack>
                  </Box>
                  <Box>
                    <ItemLabel>Description</ItemLabel>
                    <Typography sx={{ fontSize: 13, wordBreak: "break-word" }}>{t.comment}</Typography>
                  </Box>
                </Stack>

                <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, px: 1.5, py: 1, minWidth: 160 }}>
                  <Stack direction="row" justifyContent="space-between" spacing={2}>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>Amount</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      {money(t.amount)}
                    </Typography>
                  </Stack>
                </Box>
              </Box>
            </Card>
          ))}
        </Stack>

        <Divider sx={{ mt: 2, mb: 1 }} />
        <Stack direction="row" justifyContent="flex-end" alignItems="baseline" spacing={1}>
          <Typography sx={{ fontSize: 13 }}>Total Amount:</Typography>
          <Typography sx={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {money(claim.totalAmount)}
          </Typography>
        </Stack>
      </Card>

      <OpdApprovalDecisionDialog
        decision={deciding ?? "approve"}
        open={deciding !== null}
        pending={status.isPending}
        onCancel={() => setDeciding(null)}
        onConfirm={confirmDecision}
      />

      <OpdClaimActivityDrawer claim={activityOpen ? claim : null} onClose={() => setActivityOpen(false)} />

      <ReceiptViewer load={receiptLoad} onClose={() => setReceiptLoad(null)} />
    </Box>
  );
}

function ItemLabel({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.25 }}>{children}</Typography>;
}
