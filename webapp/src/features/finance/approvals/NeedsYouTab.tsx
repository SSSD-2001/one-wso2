/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@wso2/oxygen-ui";
import { useDebouncedValue } from "@hooks/useDebouncedValue";
import { withLoadingAdornment } from "@components/picker-loading/pickerLoading";
import { describeError } from "../util/financeError";
import { money } from "../util/financeFormat";
import { useExpenseAppData, useExpenseClaims, useExpenseEmployees } from "../expense/useExpense";
import { useOpdClaims, useOpdEmployees, useOpdUserInfo } from "../opd/useOpd";
import { opdStatusFilter, opdHasRole, OPD_ROLE } from "../opd/opdTypes";
import type { ApproverView, ExpenseClaim } from "../expense/expenseTypes";
import type { OpdClaim } from "../opd/opdTypes";
import { ExpenseApprovalReview } from "../expense/approvals/ExpenseApprovalReview";
import { makeNameResolver } from "../expense/approvals/expenseApprovalTypes";
import { OpdApprovalReview } from "../opd/approvals/OpdApprovalReview";
import { byLongestWait, daysWaiting, waitingLabel, waitingSince } from "./claimWaiting";

// Everything waiting on the person looking, grouped by which app it came from.
//
// Grouped rather than merged into one table: an OPD claim is a set of medical
// bills checked against an annual limit, an expense claim is a set of lines with
// receipts and a stage. Merging them would mean one column set that fits
// neither, and an Amount column mixing currencies whose total means nothing.
//
// The expense group is itself one stage at a time for someone holding both —
// the same "As lead / As finance" toggle the Expense claims tab offers,
// rather than the two stages merged into one list with a per-row chip saying
// which is which.
//
// Longest wait first within each group, because the claim someone is chasing is
// the one to show first.

export default function NeedsYouTab() {
  const expenseAppData = useExpenseAppData();
  const opdUserInfo = useOpdUserInfo();

  const canLead = Boolean(expenseAppData.data?.enableLeadView);
  const canExpenseFinance = Boolean(expenseAppData.data?.enableFinanceView);
  const canOpd = opdHasRole(opdUserInfo.data, OPD_ROLE.FINANCE_APPROVER);
  const myEmail = expenseAppData.data?.userInfo.workEmail ?? undefined;

  // Same toggle the Expense claims tab offers, for the same reason: someone
  // holding both flags decides one stage at a time, not a merged list. Opens
  // on whichever stage this person actually holds; someone with one flag
  // never sees the switch at all — there is nothing to switch to.
  //
  // Derived-with-override, the same as CcApprovePage's own `role`: `picked`
  // is null until someone chooses, and the default is computed fresh every
  // render rather than captured once. `canLead` reads false on the render
  // before expense app data has arrived — a plain `useState(canLead ? ... )`
  // would freeze on that false and never reconsider it once the data landed,
  // leaving a dual-role approver stuck on Finance.
  const [picked, setPicked] = useState<ApproverView | null>(null);
  const expenseStage: ApproverView = picked ?? (canLead ? "LEAD" : "FINANCE");

  // For the review screen's name display — falls back to the bare email until
  // this arrives, same as the standalone Lead/Finance Approvals screens do.
  const employees = useExpenseEmployees();
  const nameFor = useMemo(() => makeNameResolver(employees.data), [employees.data]);
  // Also the "Filter by email" dropdown's options, merged with OPD's own
  // directory: an OPD claimant may never have touched expense claims, and the
  // other way round, so neither list alone would offer everyone this queue
  // could actually show.
  const opdEmployees = useOpdEmployees(canOpd);
  const employeeOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...(employees.data ?? []).map((e) => e.workEmail),
          ...(opdEmployees.data ?? []).map((e) => e.workEmail),
        ]),
      ),
    [employees.data, opdEmployees.data],
  );
  const employeesLoading = employees.isLoading || opdEmployees.isLoading;

  // FilterHolder.tsx-style narrowing: a claim of a known employee or id,
  // without which the only way to find one is to scroll the whole company's.
  const [employee, setEmployee] = useState<string | null>(null);
  const [claimId, setClaimId] = useState("");
  // Debounced before it reaches the queries: they key on the whole payload, so
  // the raw value would fire a search per keystroke.
  const claimIdFilter = useDebouncedValue(claimId.trim());
  const ids = claimIdFilter ? [claimIdFilter] : undefined;

  // Two independent flags, so a person can be waiting on both stages at once.
  // `leadEmail` scopes the lead queue to their own reports; the finance queue is
  // company-wide and needs no scoping.
  const leadQueue = useExpenseClaims(
    { leadEmail: myEmail, status: ["PENDING_LEAD"], email: employee ?? undefined, ids },
    canLead && Boolean(myEmail),
  );
  const financeQueue = useExpenseClaims(
    { status: ["PENDING_FINANCE"], email: employee ?? undefined, ids },
    canExpenseFinance,
  );
  // opdStatusFilter adds PENDING_OLD: claims filed before the status was split
  // carry it, and asking for PENDING alone hides them from the queue entirely.
  const opdQueue = useOpdClaims(
    { status: opdStatusFilter(["PENDING"]), email: employee ?? undefined, ids },
    canOpd,
  );

  const [expenseTarget, setExpenseTarget] = useState<ExpenseClaim | null>(null);
  const [opdTarget, setOpdTarget] = useState<OpdClaim | null>(null);

  const expenseRows = useMemo(
    () =>
      byLongestWait(
        expenseStage === "LEAD" ? (leadQueue.data ?? []) : (financeQueue.data ?? []),
        waitingSince,
      ),
    [expenseStage, leadQueue.data, financeQueue.data],
  );
  const opdRows = useMemo(
    () => byLongestWait(opdQueue.data ?? [], waitingSince),
    [opdQueue.data],
  );

  // `isLoading`, not `isPending`. React Query leaves a DISABLED query pending
  // for good — it never fetches, so it never resolves — and every queue here is
  // disabled for someone lacking that role. Waiting on `isPending` meant the
  // screen spun forever for anyone holding less than all three, which is most
  // people. `isLoading` is pending AND fetching, so a disabled query reads as
  // not loading, which is what it is.
  //
  // Split from the queues' own loading: `email`/`ids` are part of every query
  // KEY below, so typing a filter starts a brand new query and this would
  // otherwise blank the whole tab — the toggle and the filter fields
  // themselves included — losing focus mid-keystroke. Only identity/role
  // resolution gates the whole tab; a queue reloading after a filter change
  // shows its loading state in place of the list, below still-mounted
  // controls.
  const identityLoading = expenseAppData.isLoading || opdUserInfo.isLoading;
  const queuesLoading = leadQueue.isLoading || financeQueue.isLoading || opdQueue.isLoading;

  if (identityLoading) {
    return <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 1.5 }} />;
  }

  // Opening an expense claim replaces this whole tab with the same review
  // screen Lead/Finance Approvals uses — the app's own decision, its own
  // amounts-in-full, its own print and activity trail — rather than a
  // shrunk-down copy in a dialog. Needs You has no tabs of its own, so
  // `pending` is always true: everything reaching this tab is, by
  // definition, still waiting on a decision.
  if (expenseTarget) {
    return (
      <ExpenseApprovalReview
        claim={expenseTarget}
        stage={expenseTarget.statusDetails.status === "PENDING_LEAD" ? "LEAD" : "FINANCE"}
        pending
        nameFor={nameFor}
        viewerEmail={myEmail}
        onBack={() => setExpenseTarget(null)}
        // Nothing to fade here, unlike the decided-tab UX this component also
        // serves: a claim just decided drops out of the PENDING queue on its
        // own once `useExpenseClaimStatus`'s onSuccess invalidates
        // ["expense-claims"], which both leadQueue and financeQueue key off.
        onDecided={() => {}}
      />
    );
  }

  // Same takeover for OPD, its own review screen in place of the dialog —
  // `useOpdClaims`'s own invalidation on `["opd-claims"]` is what drops a
  // decided claim out of the queue.
  if (opdTarget) {
    return (
      <OpdApprovalReview
        claim={opdTarget}
        pending
        onBack={() => setOpdTarget(null)}
        onDecided={() => {}}
      />
    );
  }

  // One queue failing must not blank the other: a finance approver whose OPD
  // backend is down still has expense claims to get through.
  const failures = [
  // The two calls that decide WHICH queues run belong here too. When either
  // fails its flags read false, so the queues are disabled rather than failing
  // — and a disabled query reports no error. Without these the screen would
  // tell an approver nothing is waiting when nothing had loaded.
    expenseAppData.isError ? describeError(expenseAppData.error) : null,
    opdUserInfo.isError ? describeError(opdUserInfo.error) : null,
    leadQueue.isError ? describeError(leadQueue.error) : null,
    financeQueue.isError ? describeError(financeQueue.error) : null,
    opdQueue.isError ? describeError(opdQueue.error) : null,
  ].filter(Boolean);

  const total = expenseRows.length + opdRows.length;

  return (
    <Box>
      {failures.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Some queues couldn&apos;t be loaded. {failures[0]}
        </Alert>
      )}

      {canLead && canExpenseFinance && (
        <ToggleButtonGroup
          size="small"
          exclusive
          value={expenseStage}
          onChange={(_e, v) => v && setPicked(v as ApproverView)}
          sx={{ mb: 2 }}
        >
          <ToggleButton value="LEAD" sx={{ textTransform: "none" }}>
            As lead
          </ToggleButton>
          <ToggleButton value="FINANCE" sx={{ textTransform: "none" }}>
            As finance
          </ToggleButton>
        </ToggleButtonGroup>
      )}

      <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: "wrap", rowGap: 1.5 }}>
        <Autocomplete
          size="small"
          options={employeeOptions}
          value={employee}
          onChange={(_e, v) => setEmployee(v)}
          loading={employeesLoading}
          disabled={employeesLoading}
          sx={{ minWidth: 260 }}
          renderInput={(params) => (
            <TextField {...withLoadingAdornment(params, employeesLoading)} label="Filter by email" />
          )}
        />
        <TextField
          size="small"
          label="Filter by claim ID"
          value={claimId}
          onChange={(e) => setClaimId(e.target.value)}
          sx={{ minWidth: 200 }}
        />
      </Stack>

      {queuesLoading ? (
        <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1.5 }} />
      ) : total === 0 && failures.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>
          {employee || claimIdFilter ? "No claims match these filters." : "Nothing is waiting on you."}
        </Typography>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableBody>
              {opdRows.length > 0 && (
                <GroupHeading
                  label="OPD claims"
                  count={opdRows.length}
                  note="you decide as finance"
                />
              )}
              {opdRows.map((claim) => (
                <TableRow key={claim.id} hover>
                  <IdCell id={claim.id} />
                  <WhoCell email={claim.employeeEmail} />
                  <WaitCell since={waitingSince(claim)} />
                  <AmountCell amount={claim.totalAmount} currency="LKR" />
                  <TableCell sx={CELL}>
                    {claim.transactions.length} bill{claim.transactions.length === 1 ? "" : "s"}
                  </TableCell>
                  <ReviewCell onClick={() => setOpdTarget(claim)} />
                </TableRow>
              ))}

              {expenseRows.length > 0 && (
                <GroupHeading
                  label="Expense claims"
                  count={expenseRows.length}
                  note={`you decide as ${expenseStage === "LEAD" ? "lead" : "finance"}`}
                />
              )}
              {expenseRows.map((claim) => (
                <TableRow key={claim.id} hover>
                  <IdCell id={claim.id} />
                  <WhoCell email={claim.employeeEmail} />
                  <WaitCell since={waitingSince(claim)} />
                  <AmountCell amount={claim.totalAmount} currency={claim.currencyCode ?? "LKR"} />
                  <TableCell sx={CELL}>
                    {claim.transactions.length} item{claim.transactions.length === 1 ? "" : "s"}
                  </TableCell>
                  <ReviewCell onClick={() => setExpenseTarget(claim)} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

    </Box>
  );
}

const CELL = { fontSize: 12.5, fontVariantNumeric: "tabular-nums" } as const;

function GroupHeading({
  label,
  count,
  note,
}: {
  label: string;
  count: number;
  note: string;
}) {
  return (
    <TableRow>
      <TableCell colSpan={6} sx={{ border: 0, pt: 2, pb: 0.75 }}>
        <Typography
          component="span"
          sx={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "text.secondary",
          }}
        >
          {label} · {count} · {note}
        </Typography>
      </TableCell>
    </TableRow>
  );
}

function IdCell({ id }: { id: string }) {
  return <TableCell sx={{ ...CELL, fontWeight: 600 }}>{id}</TableCell>;
}

function WhoCell({ email }: { email: string }) {
  return <TableCell sx={CELL}>{email}</TableCell>;
}

function WaitCell({ since }: { since: string }) {
  const days = daysWaiting(since);
  return (
    <TableCell sx={{ ...CELL, color: days >= 7 ? "error.main" : undefined }}>
      {waitingLabel(days)}
    </TableCell>
  );
}

function AmountCell({ amount, currency }: { amount: number; currency: string }) {
  return (
    <TableCell align="right" sx={CELL}>
      {money(amount, currency)}
    </TableCell>
  );
}

function ReviewCell({ onClick }: { onClick: () => void }) {
  return (
    <TableCell align="right">
      <Button size="small" variant="contained" onClick={onClick} sx={{ textTransform: "none" }}>
        Review
      </Button>
    </TableCell>
  );
}
