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
import { Box, Button, Card, Divider, IconButton, Stack, Tooltip, Typography } from "@wso2/oxygen-ui";
import { ArrowLeftIcon, HistoryIcon, ReceiptTextIcon } from "@wso2/oxygen-ui-icons-react";
import { useAccessToken } from "@hooks/useAccessToken";
import { opdServiceUrls } from "@config/apiConfig";
import { StatusChip, opdStatusMeta } from "../../components/FinanceChips";
import { ReceiptViewer } from "../../components/ReceiptViewer";
import { describeError } from "../../util/financeError";
import { money, formatNice } from "../../util/financeFormat";
import { fetchReceiptObjectUrl, type ReceiptSource } from "../../util/financeReceipts";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { OpdClaim } from "../opdTypes";

/**
 * One filed claim, in full.
 *
 * `ClaimDetails.tsx` — the bills it was made of, each with its receipt, and
 * the finance reason when it was rejected. Takes over the page rather than
 * opening in a dialog, the way the source slides it over the list: a claim
 * can carry many bills and a dialog would scroll inside a scroll.
 */
export function OpdHistoryClaimDetails({
  claim,
  onBack,
  onShowActivity,
  onResubmit,
}: {
  claim: OpdClaim;
  onBack: () => void;
  onShowActivity: () => void;
  /**
   * Offered on the employee's own rejected claim — ClaimDetails.tsx:101-114.
   * Absent on the Finance-perspective read of someone's history, which never
   * resubmits somebody else's claim.
   */
  onResubmit?: (claim: OpdClaim) => void;
}) {
  const getAccessToken = useAccessToken();
  const { showError } = useNotifications();
  const [viewing, setViewing] = useState<(() => Promise<ReceiptSource>) | null>(null);
  const meta = opdStatusMeta(claim.statusDetails.status);
  const reason = claim.statusDetails.financeRejectedReason;

  const openReceipt = (fileName: string) =>
    setViewing(() => async () => {
      try {
        return await fetchReceiptObjectUrl(
          opdServiceUrls.receiptFile(fileName),
          await getAccessToken(),
        );
      } catch (err) {
        showError(describeError(err));
        throw err;
      }
    });

  return (
    // A column that owns the height the shell handed down, so the bills panel
    // stretches into whatever is spare and the total rides at its foot —
    // rather than the total sitting under the last bill with a band of dead
    // page beneath it.
    <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2, flexWrap: "wrap", rowGap: 1, flexShrink: 0 }}>
        <IconButton size="small" aria-label="Back to claim history" onClick={onBack}>
          <ArrowLeftIcon size={18} />
        </IconButton>
        <Typography sx={{ fontSize: 15, fontWeight: 700, fontFamily: "monospace" }}>
          {claim.id}
        </Typography>
        <StatusChip label={meta.label} color={meta.color} />
        <Box sx={{ flex: 1 }} />
        {/* :101-114 — only a rejected claim can be taken up again. */}
        {onResubmit && claim.statusDetails.status === "REJECTED" && (
          <Button
            size="small"
            variant="contained"
            color="warning"
            onClick={() => onResubmit(claim)}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Resubmit as New Claim
          </Button>
        )}
        <Button
          size="small"
          variant="outlined"
          startIcon={<HistoryIcon size={14} />}
          onClick={onShowActivity}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Activity
        </Button>
      </Stack>

      {/* Finance's words, when there are any. Above the bills rather than
          below: it is the reason the claim came back, and a person who sees
          "Finance Rejected" is looking for it before anything else. */}
      {reason && (
        <Card variant="outlined" sx={{ p: 1.5, mb: 2, borderColor: "error.main", flexShrink: 0 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: "error.main", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Rejection reason
          </Typography>
          <Typography sx={{ fontSize: 13.5, mt: 0.5, overflowWrap: "anywhere" }}>{reason}</Typography>
        </Card>
      )}

      {/* One bordered panel holding the bills and the total, the way the source
          wraps them. The scrollbar belongs to the list inside it, not to the
          page: the panel is a fixed frame and the bills move within it. */}
      <Card
        variant="outlined"
        sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", p: 2 }}
      >
        {/* `minHeight: 0` lets this shrink below its content so `overflowY` has
            something to do — without it a flex child is floored at its content
            height and the whole page scrolls instead. */}
        <Stack spacing={1.25} sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 0.5 }}>
        {claim.transactions.map((bill, i) => (
          // `flexShrink: 0` so each bill keeps its natural height inside the
          // scrolling list above. Without it, the cards are flex children of
          // a bounded-height column and compress to fit instead of the list
          // scrolling — their second row (date/description/amount) squeezed
          // out rather than staying readable and pushing the list to scroll.
          <Card key={`${bill.date}-${i}`} variant="outlined" sx={{ p: 2, flexShrink: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.02em" }}>
              {`OPD ITEM ${i + 1}`}
            </Typography>
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 3,
                alignItems: "flex-start",
                mt: 1.5,
              }}
            >
              <Figure label="Bill Date" value={formatNice(bill.date)} />
              <Figure label="Description" value={bill.comment || "—"} />
              {/* Its own element, right after Description and still on the
                  left side of the card — absent rather than disabled when
                  there is nothing to open, since older claims can carry a
                  bill with no stored receipt. One button, not a view/download
                  pair: ReceiptViewer carries its own Download in the dialog's
                  footer. */}
              {bill.receiptUrl && (
                <Tooltip describeChild title="View or download the receipt" arrow>
                  <IconButton
                    size="small"
                    aria-label={`View or download receipt for OPD ITEM ${i + 1}`}
                    onClick={() => openReceipt(bill.receiptUrl!)}
                    sx={{
                      mt: 2.5,
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
              {/* Pushes Amount to the far right, whatever room the fields
                  before it take up. */}
              <Box sx={{ flex: 1 }} />
              <Box sx={{ textAlign: "right" }}>
                <FieldLabel>Amount</FieldLabel>
                <Typography sx={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", mt: 0.25 }}>
                  {money(bill.amount)}
                </Typography>
              </Box>
            </Box>
          </Card>
        ))}
        </Stack>

        {/* Outside the scroller, so the total stays against the bottom of the
            panel however many bills the claim carries. */}
        <Divider sx={{ mt: 1.5 }} />
        <Stack
          direction="row"
          justifyContent="flex-end"
          alignItems="baseline"
          spacing={1.5}
          sx={{ mt: 1.5, flexShrink: 0 }}
        >
          <Typography sx={{ fontSize: 13.5, color: "text.secondary" }}>Total Amount:</Typography>
          <Typography sx={{ fontSize: 17, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {money(claim.totalAmount)}
          </Typography>
        </Stack>
      </Card>

      <ReceiptViewer title="Receipt" load={viewing} onClose={() => setViewing(null)} />
    </Box>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{ fontSize: 10.5, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.06em" }}
    >
      {children}
    </Typography>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <FieldLabel>{label}</FieldLabel>
      <Typography sx={{ fontSize: 13.5, mt: 0.25, overflowWrap: "anywhere" }}>{value}</Typography>
    </Box>
  );
}
