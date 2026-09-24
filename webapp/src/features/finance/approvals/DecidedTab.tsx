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
  Chip,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { useDebouncedValue } from "@hooks/useDebouncedValue";
import { withLoadingAdornment } from "@components/picker-loading/pickerLoading";
import { describeError } from "../util/financeError";
import { formatNice, money } from "../util/financeFormat";
import { useExpenseAppData, useExpenseClaims, useExpenseEmployees } from "../expense/useExpense";
import { useOpdClaims, useOpdEmployees, useOpdUserInfo } from "../opd/useOpd";
import { OPD_ROLE, opdHasRole } from "../opd/opdTypes";
import type { ExpenseClaim } from "../expense/expenseTypes";
import type { OpdClaim } from "../opd/opdTypes";
import { ExpenseApprovalReview } from "../expense/approvals/ExpenseApprovalReview";
import { makeNameResolver } from "../expense/approvals/expenseApprovalTypes";
import { OpdApprovalReview } from "../opd/approvals/OpdApprovalReview";

// Claims in this person's scope that already have a decision.
//
// Called "Decided", not "Decided by you", and the distinction is the data's
// rather than a stylistic one: both DTOs record `financeApproverEmail`, so a
// finance decision can be attributed — but the lead side carries only
// `leadApprovedDate` and `leadRejectedDate`, with no lead approver. A lead's own
// decisions cannot be told from a co-lead's on the same card. Rows say who
// decided wherever the backend knows, and say nothing where it does not.

export default function DecidedTab() {
  const expenseAppData = useExpenseAppData();
  const opdUserInfo = useOpdUserInfo();

  const canLead = Boolean(expenseAppData.data?.enableLeadView);
  const canExpenseFinance = Boolean(expenseAppData.data?.enableFinanceView);
  const canOpd = opdHasRole(opdUserInfo.data, OPD_ROLE.FINANCE_APPROVER);
  const myEmail = expenseAppData.data?.userInfo.workEmail ?? undefined;

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

  // A lead's decided queue is the claims they forwarded or turned down, so it is
  // scoped to their reports the same way their pending queue is.
  //
  // Someone holding BOTH flags gets a narrowed version rather than none. The
  // finance list below covers what they settled as finance and nothing else, so
  // a claim they only forwarded — still PENDING_FINANCE — or turned down as
  // lead was in neither query and simply vanished from Decided. The two status
  // lists are kept disjoint, or the same claim would appear twice.
  const leadDecided = useExpenseClaims(
    {
      leadEmail: myEmail,
      status: canExpenseFinance
        ? ["PENDING_FINANCE", "LEAD_REJECTED"]
        : ["PENDING_FINANCE", "APPROVED", "FINANCE_REJECTED", "LEAD_REJECTED"],
      email: employee ?? undefined,
      ids,
    },
    canLead && Boolean(myEmail),
  );
  const financeDecided = useExpenseClaims(
    { status: ["APPROVED", "FINANCE_REJECTED"], email: employee ?? undefined, ids },
    canExpenseFinance,
  );
  const opdDecided = useOpdClaims(
    { status: ["APPROVED", "REJECTED"], email: employee ?? undefined, ids },
    canOpd,
  );

  const [expenseTarget, setExpenseTarget] = useState<ExpenseClaim | null>(null);
  const [opdTarget, setOpdTarget] = useState<OpdClaim | null>(null);
  // Splits this already-decided set by outcome, the same "Pending / Approved /
  // Rejected" tabs Claim Approval's OPD tab offers — minus Pending, since
  // nothing here is still pending by definition. A lead's forwarded claim
  // (PENDING_FINANCE) is not rejected, so it sorts under Approved alongside
  // the Outcome chip's own "Sent to finance" label — every decided row lands
  // in exactly one tab, none of them hidden.
  const [outcome, setOutcome] = useState<DecidedOutcome>("approved");

  const expenseRows = useMemo(
    () =>
      [...(financeDecided.data ?? []), ...(leadDecided.data ?? [])].filter(
        (c) => isRejectedOutcome(c.statusDetails.status) === (outcome === "rejected"),
      ),
    [financeDecided.data, leadDecided.data, outcome],
  );
  const opdRows = useMemo(
    () =>
      (opdDecided.data ?? []).filter(
        (c) => isRejectedOutcome(c.statusDetails.status) === (outcome === "rejected"),
      ),
    [opdDecided.data, outcome],
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
  // otherwise blank the whole tab — the Approved/Rejected tabs and the filter
  // fields themselves included — losing focus mid-keystroke. Only
  // identity/role resolution gates the whole tab; a queue reloading after a
  // filter change shows its loading state in place of the list, below still-
  // mounted controls.
  const identityLoading = expenseAppData.isLoading || opdUserInfo.isLoading;
  const queuesLoading = leadDecided.isLoading || financeDecided.isLoading || opdDecided.isLoading;

  if (identityLoading) return <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 1.5 }} />;

  // Same review screen Needs You opens, `pending={false}`: Approve/Reject are
  // replaced by the status chip, which opens the activity trail instead — the
  // decision already made, not offered again. `stage` still matters here even
  // read-only, because only it decides whether Print shows.
  if (expenseTarget) {
    const decidedAtFinance =
      expenseTarget.statusDetails.status === "APPROVED" ||
      expenseTarget.statusDetails.status === "FINANCE_REJECTED";
    return (
      <ExpenseApprovalReview
        claim={expenseTarget}
        stage={decidedAtFinance ? "FINANCE" : "LEAD"}
        pending={false}
        nameFor={nameFor}
        viewerEmail={myEmail}
        onBack={() => setExpenseTarget(null)}
        onDecided={() => {}}
      />
    );
  }

  // Same takeover for a decided OPD claim, `pending={false}` — the activity
  // trail rather than Approve/Reject.
  if (opdTarget) {
    return (
      <OpdApprovalReview
        claim={opdTarget}
        pending={false}
        onBack={() => setOpdTarget(null)}
        onDecided={() => {}}
      />
    );
  }

  const failure =
  // The two calls that decide WHICH queues run belong here too. When either
  // fails its flags read false, so the queues are disabled rather than failing
  // — and a disabled query reports no error. Without these the screen would
  // tell an approver nothing is waiting when nothing had loaded.
    (expenseAppData.isError && describeError(expenseAppData.error)) ||
    (opdUserInfo.isError && describeError(opdUserInfo.error)) ||
    (leadDecided.isError && describeError(leadDecided.error)) ||
    (financeDecided.isError && describeError(financeDecided.error)) ||
    (opdDecided.isError && describeError(opdDecided.error)) ||
    null;

  return (
    <Box>
      {failure && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Some queues couldn&apos;t be loaded. {failure}
        </Alert>
      )}

      <Tabs
        value={outcome}
        onChange={(_e, v) => setOutcome(v as DecidedOutcome)}
        sx={{ mb: 2, minHeight: 36, "& .MuiTab-root": { minHeight: 36, textTransform: "none", fontSize: 13, fontWeight: 600 } }}
      >
        <Tab value="approved" label="Approved" />
        <Tab value="rejected" label="Rejected" />
      </Tabs>

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

      {/* "Nothing has been decided" is a claim about the data, so it is only
          made when the data actually arrived — a failure stands alone,
          saying both at once tells the reader two different things. */}
      {queuesLoading ? (
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1.5 }} />
      ) : expenseRows.length === 0 && opdRows.length === 0 ? (
        !failure && (
          <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>
            {employee || claimIdFilter ? "No claims match these filters." : `Nothing ${outcome} yet.`}
          </Typography>
        )
      ) : (
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableBody>
            {opdRows.length > 0 && <Heading label="OPD claims" count={opdRows.length} />}
            {opdRows.map((claim) => (
              <TableRow key={claim.id} hover>
                <TableCell sx={ID}>{claim.id}</TableCell>
                <TableCell sx={CELL}>{claim.employeeEmail}</TableCell>
                <TableCell sx={CELL}>
                  {decidedOn(claim.statusDetails.financeApprovedDate, claim.statusDetails.financeRejectedDate)}
                </TableCell>
                <TableCell align="right" sx={CELL}>{money(claim.totalAmount, "LKR")}</TableCell>
                <TableCell sx={CELL}>{claim.statusDetails.financeApproverEmail ?? "—"}</TableCell>
                <TableCell sx={CELL}>
                  <Outcome status={claim.statusDetails.status ?? null} />
                </TableCell>
                <ViewCell onClick={() => setOpdTarget(claim)} />
              </TableRow>
            ))}

            {expenseRows.length > 0 && <Heading label="Expense claims" count={expenseRows.length} />}
            {expenseRows.map((claim) => (
              <TableRow key={claim.id} hover>
                <TableCell sx={ID}>{claim.id}</TableCell>
                <TableCell sx={CELL}>{claim.employeeEmail}</TableCell>
                <TableCell sx={CELL}>
                  {decidedOn(
                    claim.statusDetails.financeApprovedDate ?? claim.statusDetails.leadApprovedDate,
                    claim.statusDetails.financeRejectedDate ?? claim.statusDetails.leadRejectedDate,
                  )}
                </TableCell>
                <TableCell align="right" sx={CELL}>
                  {money(claim.totalAmount, claim.currencyCode ?? "LKR")}
                </TableCell>
                {/* Blank for a lead-stage decision: the backend records no lead
                    approver, so naming one would be a guess. */}
                <TableCell sx={CELL}>{claim.statusDetails.financeApproverEmail ?? "—"}</TableCell>
                <TableCell sx={CELL}>
                  <Outcome status={claim.statusDetails.status} />
                </TableCell>
                <ViewCell onClick={() => setExpenseTarget(claim)} />
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
const ID = { ...CELL, fontWeight: 600 } as const;

/**
 * Opens the record for one claim.
 *
 * A button in the row rather than an onClick on the row itself: a `<tr>` takes
 * no focus and answers no key, so the dialog was unreachable without a mouse.
 * Matches Needs you, whose rows have always been opened this way.
 */
function ViewCell({ onClick }: { onClick: () => void }) {
  return (
    <TableCell align="right">
      <Button size="small" variant="outlined" onClick={onClick} sx={{ textTransform: "none" }}>
        View
      </Button>
    </TableCell>
  );
}

function decidedOn(approved: string | null | undefined, rejected: string | null | undefined): string {
  const when = approved ?? rejected;
  return when ? formatNice(when) : "—";
}

function Heading({ label, count }: { label: string; count: number }) {
  return (
    <TableRow>
      <TableCell colSpan={7} sx={{ border: 0, pt: 2, pb: 0.75 }}>
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
          {label} · {count}
        </Typography>
      </TableCell>
    </TableRow>
  );
}

type DecidedOutcome = "approved" | "rejected";

function isRejectedOutcome(status: string | null | undefined): boolean {
  return Boolean(status?.includes("REJECTED"));
}

function Outcome({ status }: { status: string | null }) {
  const rejected = isRejectedOutcome(status);
  const forwarded = status === "PENDING_FINANCE";
  return (
    <Chip
      size="small"
      color={rejected ? "error" : forwarded ? "default" : "success"}
      label={rejected ? "Rejected" : forwarded ? "Sent to finance" : "Approved"}
      sx={{ height: 18, fontSize: 10.5 }}
    />
  );
}
