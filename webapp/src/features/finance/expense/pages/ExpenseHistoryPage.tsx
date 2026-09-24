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

import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { isExpenseBackendConfigured } from "@config/apiConfig";
import { StatusChip, expenseStatusMeta } from "../../components/FinanceChips";
import { money, formatNice } from "../../util/financeFormat";
import { useExpenseEmployees } from "../useExpense";
import { ExpenseHistoryFilters } from "../history/ExpenseHistoryFilters";
import { ExpenseHistoryTable } from "../history/ExpenseHistoryTable";
import { ExpenseHistoryClaimDetails } from "../history/ExpenseHistoryClaimDetails";
import { ExpenseClaimActivityDrawer } from "../history/ExpenseClaimActivityDrawer";
import { useExpenseHistoryAppData, useExpenseHistoryClaims } from "../history/useExpenseHistory";
import {
  EMPTY_HISTORY_FILTERS,
  makeNameResolver,
  toHistorySearchPayload,
  type HistoryClaim,
  type HistoryFilters,
} from "../history/expenseHistoryTypes";
import type { ExpenseClaim } from "../expenseTypes";

// The Expense tab of Claims. Reports its own backend's connectivity, since the
// screen spans two and either may be missing.
//
// Shares its filters, table and search payload with Finance → Expense Claims
// → Claim History — that screen read the same claims, on-behalf filtering
// included, so there was nothing left for it to do once this tab covered it.
export default function ExpenseClaimsTab() {
  if (!isExpenseBackendConfigured()) {
    return (
      <Alert severity="info">
        Expense claims aren&apos;t connected yet. Set{" "}
        <code>ONE_WSO2_EXPENSE_CLAIMS_BACKEND_URL</code> in <code>public/config.js</code> and
        reload.
      </Alert>
    );
  }
  return <HistoryBody />;
}

function HistoryBody() {
  const appData = useExpenseHistoryAppData();
  // Names are what the source shows on screen; addresses live in tooltips —
  // needed only for the activity trail's submission stage.
  const employees = useExpenseEmployees();
  const nameFor = useMemo(() => makeNameResolver(employees.data), [employees.data]);
  const [filters, setFilters] = useState<HistoryFilters>(EMPTY_HISTORY_FILTERS);
  // The claim being read in full — the details panel takes over the page,
  // the same way Finance → Expense Claims → Claim History slides it over
  // the list.
  const [selected, setSelected] = useState<HistoryClaim | null>(null);
  // Independent of `selected`: the activity trail opens straight from a row's
  // status chip, or from the detail view's own header button.
  const [activityClaim, setActivityClaim] = useState<HistoryClaim | null>(null);

  const email = appData.data?.userInfo.workEmail ?? undefined;
  const payload = useMemo(() => toHistorySearchPayload(filters, email), [filters, email]);
  const claims = useExpenseHistoryClaims(payload, Boolean(email));

  // FilterHolder.tsx:285 — nobody to have filed for means nothing to filter by.
  const canFilterBySubmission = (appData.data?.onBehalfOfEmployees ?? []).length > 0;

  // Same review screen Finance → Expense Claims → Claim History uses, taking
  // over this tab the same way it takes over that screen — bills in full,
  // and a rejected claim still opens editable for resubmit, not a
  // shrunk-down copy in a dialog.
  if (selected) {
    return (
      <>
        <ExpenseHistoryClaimDetails
          claim={selected}
          appData={appData.data}
          viewerEmail={email}
          onBack={() => setSelected(null)}
          onShowActivity={() => setActivityClaim(selected)}
        />
        <ExpenseClaimActivityDrawer
          claim={activityClaim}
          nameFor={nameFor}
          viewerEmail={email}
          onClose={() => setActivityClaim(null)}
        />
      </>
    );
  }

  // A fill column, not plain flow: the list below can run long, and without
  // this the whole page scrolled — carrying the filters away with it —
  // instead of just the table.
  return (
    <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <ExpenseHistoryFilters
        filters={filters}
        onChange={setFilters}
        canFilterBySubmission={canFilterBySubmission}
      />

      {/* The scrolling region: the filters above stay fixed, only this —
          the skeleton, the empty state, or the table — scrolls when it
          runs long. */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {appData.isLoading || claims.isLoading ? (
          <Stack spacing={1}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} variant="rectangular" height={48} sx={{ borderRadius: 1 }} />
            ))}
          </Stack>
        ) : appData.isError || claims.isError ? (
          <ErrorNotice
            error={appData.error ?? claims.error}
            // Retry whichever query actually failed. Retrying only the claims
            // search left an app-data failure permanently on screen: that
            // search is disabled without an email, so it had nothing to
            // re-run and the button could never clear the error it was
            // offered for.
            onRetry={() => {
              if (appData.isError) void appData.refetch();
              if (claims.isError) void claims.refetch();
            }}
            retrying={appData.isFetching || claims.isFetching}
          >
            Couldn&apos;t load your claims.
          </ErrorNotice>
        ) : (claims.data?.length ?? 0) === 0 ? (
          <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>
            No claims match these filters.
          </Typography>
        ) : (
          <ExpenseHistoryTable
            claims={claims.data!}
            onView={setSelected}
            onShowActivity={setActivityClaim}
          />
        )}
      </Box>

      <ExpenseClaimActivityDrawer
        claim={activityClaim}
        nameFor={nameFor}
        viewerEmail={email}
        onClose={() => setActivityClaim(null)}
      />
    </Box>
  );
}

// Shared table also used by the approvals screens (with a `userColumn`).
export function ClaimsTable({
  claims,
  onView,
  userColumn,
  actionLabel = "View",
  actionVariant = "outlined",
}: {
  claims: ExpenseClaim[];
  onView: (c: ExpenseClaim) => void;
  userColumn?: boolean;
  actionLabel?: string;
  actionVariant?: "outlined" | "contained";
}) {
  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, overflow: "hidden" }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ "& th": { fontSize: 11, fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.04em" } }}>
            <TableCell>Claim ID</TableCell>
            {userColumn && <TableCell>User</TableCell>}
            <TableCell>Submitted</TableCell>
            <TableCell align="right">Amount</TableCell>
            {!userColumn && <TableCell>Status</TableCell>}
            <TableCell align="right">&nbsp;</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {claims.map((c) => {
            const meta = expenseStatusMeta(c.statusDetails.status);
            return (
              <TableRow key={c.id} hover>
                <TableCell sx={{ fontSize: 12.5, fontFamily: "monospace" }}>{c.id}</TableCell>
                {userColumn && <TableCell sx={{ fontSize: 12.5 }}>{c.employeeEmail}</TableCell>}
                <TableCell sx={{ fontSize: 12.5 }}>{formatNice(c.createdDate)}</TableCell>
                <TableCell align="right" sx={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
                  {money(c.totalAmount, c.currencyCode ?? "LKR")}
                </TableCell>
                {!userColumn && (
                  <TableCell>
                    <StatusChip label={meta.label} color={meta.color} />
                  </TableCell>
                )}
                <TableCell align="right">
                  <Button size="small" variant={actionVariant} onClick={() => onView(c)} sx={{ textTransform: "none", fontWeight: 600 }}>
                    {actionLabel}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}
