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
  DataGrid,
  Autocomplete,
  Box,
  Button,
  Card,
  Chip,
  FormControlLabel,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { describeError } from "../util/leaveError";
import VirtualizedListbox from "@components/virtualized-listbox/VirtualizedListbox";
import { EmployeeOption } from "../components/EmployeeOption";
import { employeeDisplayName } from "../util/employeeName";
import { LeaveTypeChip } from "../components/LeaveChips";
import type { DatabaseLeave, EmployeeStatus, LeaveFilter } from "../api/leaveTypes";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { REPORT_VALIDATION_MESSAGE } from "../util/leaveCopy";
import { useLeaveEmployees, useLeaveUserInfo, useLeaves } from "../api/useLeaveData";
import { useLeaveGate } from "../api/useLeaveGate";
import { formatNice, startOfYearIso, todayIso } from "../util/leaveDates";
import { withLoadingAdornment } from "@components/picker-loading/pickerLoading";
import { GRID_NO_POINTER_FOCUS_SX } from "@utils/dataGridSx";

const PERIOD_LABEL: Record<string, string> = {
  multiple: "Multiple days",
  one: "Full day",
  half: "Half day",
};

// Matches leave-app's Toolbar.tsx EMPLOYEE_STATUS_OPTIONS — People Ops can
// filter by all three; "Left" defaults off since most reports care about
// current/exiting staff, not departed ones.
const EMPLOYEE_STATUS_OPTIONS: EmployeeStatus[] = ["Active", "Marked leaver", "Left"];
const DEFAULT_EMPLOYEE_STATUSES: EmployeeStatus[] = ["Active", "Marked leaver"];

// The General tab of Reports (route.ts:136-142).
export default function GeneralReportTab() {
  return <ReportsBody />;
}

function ReportsBody() {
  const userInfo = useLeaveUserInfo();
  // One source of truth with the rail, so the menu and the page cannot
  // disagree about who gets in. Previously this also accepted `isLead === true`
  // and `subordinateCount > 0`, granting the report to people the source never
  // grants it to — it checks the privilege number alone.
  const { isPeopleOps, isLead } = useLeaveGate();

  const employees = useLeaveEmployees(isPeopleOps);

  // Draft filter (edited in the toolbar) vs applied filter (drives the query).
  const [fromDate, setFromDate] = useState(startOfYearIso(new Date().getFullYear()));
  const [toDate, setToDate] = useState(todayIso());
  const [employee, setEmployee] = useState<string | null>(null);
  // People-Ops-only: default to org-wide, matching leave-app's LeadReportTab
  // default (showAllEmployees=true for People Ops). Leads-without-People-Ops
  // never see this toggle — they're always scoped to their subordinates,
  // same as before.
  const [showAllEmployees, setShowAllEmployees] = useState(true);
  const [employeeStatuses, setEmployeeStatuses] = useState<EmployeeStatus[]>(DEFAULT_EMPLOYEE_STATUSES);
  const [applied, setApplied] = useState({
    from: fromDate,
    to: toDate,
    email: null as string | null,
    showAllEmployees: true,
    employeeStatuses: DEFAULT_EMPLOYEE_STATUSES,
  });

  const { showError } = useNotifications();

  // Checked on Fetch, not left to the To field's `min` — that only constrains
  // the picker, and a typed date goes straight past it (Toolbar.tsx:95-107).
  const runReport = () => {
    if (!fromDate || !toDate) {
      showError(REPORT_VALIDATION_MESSAGE.datesRequired);
      return;
    }
    if (toDate < fromDate) {
      showError(REPORT_VALIDATION_MESSAGE.endBeforeStart);
      return;
    }
    setApplied({ from: fromDate, to: toDate, email: employee, showAllEmployees, employeeStatuses });
  };

  const workEmail = userInfo.data?.workEmail ?? null;
  // Whether *this* applied filter needs approverEmail scoping — plain leads
  // always do; People Ops only once they've narrowed to "Subordinates only".
  const needsApproverScope = isPeopleOps ? !applied.showAllEmployees : true;
  // If scoping is needed but workEmail is unavailable, the request must NOT
  // silently fall through to an unscoped (org-wide) report — that would
  // show far more than the user asked for. Block the query entirely
  // instead of ever letting approverEmail end up undefined.
  const canScopeToApprover = !needsApproverScope || Boolean(workEmail);

  const filter: LeaveFilter = useMemo(() => {
    const base: LeaveFilter = {
      startDate: applied.from,
      endDate: applied.to,
      statuses: ["APPROVED"],
      // No orderBy and no limit — the running app sends neither
      // (LeadReportTab.tsx:55-62). The cap existed only because every row was
      // rendered at once; the table pages now, and the totals below cover the
      // whole result rather than the first page of it.
    };
    // Sent for everyone, not only People Ops. The running app spreads it
    // unconditionally (LeadReportTab.tsx:46,61) even though only People Ops can
    // edit the control — its state defaults to [Active, Marked leaver] and goes
    // out on every request, including a plain lead's.
    //
    // It is not a display filter: it changes which rows the backend returns, so
    // withholding it for leads gave them a different report from the one they
    // get in the app that is live today. Reproducing what ships is the whole
    // point; the mechanism behind it is the backend's business.
    if (applied.employeeStatuses.length > 0) base.employeeStatuses = applied.employeeStatuses;

    if (isPeopleOps) {
      if (applied.email) base.email = applied.email;
      // Matches leave-app's "Subordinates only" toggle — People Ops default
      // to org-wide, but can narrow to their own reports like a plain lead.
      if (!applied.showAllEmployees && workEmail) base.approverEmail = workEmail;
    } else if (workEmail) {
      // Lead: scope to their subordinates via approverEmail.
      base.approverEmail = workEmail;
    }
    return base;
  }, [applied, isPeopleOps, workEmail]);

  const allowed = isPeopleOps || isLead;
  const leaves = useLeaves(filter, Boolean(userInfo.data) && allowed && canScopeToApprover);

  const offerable = useMemo(
    () => (employees.data ?? []).filter((e) => e.workEmail),
    [employees.data],
  );
  const employeeOptions = useMemo(() => offerable.map((e) => e.workEmail), [offerable]);
  const byEmail = useMemo(() => new Map(offerable.map((e) => [e.workEmail, e])), [offerable]);
  // Memoised: `?? []` would hand a fresh array to the grid on every render.
  const rows = useMemo(() => leaves.data?.leaves ?? [], [leaves.data]);
  const totalDays = rows.reduce((sum, r) => sum + (r.numberOfDays ?? 0), 0);

  // The source shows its total only for a single-employee result
  // (LeadReportTable.tsx:141) — summing days across a mixed list answers no
  // question anyone asked.
  const oneEmployee = new Set(rows.map((r) => r.email)).size === 1;

  if (userInfo.isLoading) {
    return <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1.5 }} />;
  }
  if (userInfo.isError) {
    return <Alert severity="error">Couldn't load your leave profile. {describeError(userInfo.error)}</Alert>;
  }
  if (!allowed) {
    return <Alert severity="info">Leave reports are available to leads and People Ops.</Alert>;
  }
  if (!canScopeToApprover) {
    return (
      <Alert severity="error">
        Couldn't resolve your work email, please try again later.
      </Alert>
    );
  }


  return (
    <Box>
      {/* Toolbar */}
      <Card variant="outlined" sx={{ p: 1.75, mb: 2 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "auto auto 1fr auto" }, gap: 1.5, alignItems: "end" }}>
          <DateField label="From" value={fromDate} onChange={setFromDate} />
          <DateField label="To" value={toDate} min={fromDate} onChange={setToDate} />
          {isPeopleOps ? (
            <Box>
              <Typography sx={{ fontSize: 11, color: "text.secondary", mb: 0.375 }}>Employee</Typography>
              <Autocomplete
                size="small"
                options={employeeOptions}
                value={employee}
                onChange={(_e, v) => setEmployee(v as string | null)}
                loading={employees.isLoading}
                disabled={employees.isLoading}
                loadingText="Loading employees…"
                noOptionsText={employees.isError ? "Couldn't load employees" : "No employees found"}
                disableListWrap
                ListboxComponent={VirtualizedListbox}
                renderOption={(props, option) => {
                  const person = byEmail.get(option);
                  return person ? (
                    <EmployeeOption key={option} employee={person} props={props} showStatus />
                  ) : (
                    <li {...props} key={option}>
                      {option}
                    </li>
                  );
                }}
                // Names are on screen now, so they have to be searchable.
                filterOptions={(options, { inputValue }) => {
                  const q = inputValue.trim().toLowerCase();
                  if (!q) return options;
                  return options.filter((o) => {
                    const e = byEmail.get(o);
                    return (
                      o.toLowerCase().includes(q) ||
                      (e ? employeeDisplayName(e).toLowerCase().includes(q) : false)
                    );
                  });
                }}
                renderInput={(params) => (
                  <TextField
                    {...withLoadingAdornment(params, employees.isLoading)}
                    placeholder={employees.isLoading ? "Loading people…" : "All employees"}
                  />
                )}
              />
            </Box>
          ) : (
            <Box />
          )}
          <Button
            variant="contained"
            onClick={() =>
              runReport()
            }
            disabled={leaves.isFetching}
            sx={{ fontWeight: 600 }}
          >
            {leaves.isFetching ? "Loading…" : "Fetch report"}
          </Button>
        </Box>

        {isPeopleOps && (
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2, mt: 1.5 }}>
            <Tooltip title={workEmail ? "" : "Your work email couldn't be resolved."}>
              {/* span wrapper so the tooltip still fires when the control is disabled */}
              <span>
                <FormControlLabel
                  disabled={!workEmail}
                  control={
                    <Switch
                      size="small"
                      checked={!showAllEmployees}
                      onChange={(e) => setShowAllEmployees(!e.target.checked)}
                    />
                  }
                  label={
                    <Typography
                      sx={{
                        fontSize: 12.5,
                        fontWeight: showAllEmployees ? 400 : 600,
                        color: showAllEmployees ? "text.secondary" : "text.primary",
                      }}
                    >
                      Subordinates only
                    </Typography>
                  }
                />
              </span>
            </Tooltip>
            <Box sx={{ minWidth: 260 }}>
              <Autocomplete
                multiple
                size="small"
                disableCloseOnSelect
                options={EMPLOYEE_STATUS_OPTIONS}
                value={employeeStatuses}
                onChange={(_e, v) => setEmployeeStatuses(v as EmployeeStatus[])}
                renderInput={(params) => <TextField {...params} label="Employee status" />}
              />
            </Box>
          </Box>
        )}
      </Card>

      {leaves.isLoading ? (
        <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1.5 }} />
      ) : leaves.isError ? (
        <Alert severity="error">{describeError(leaves.error)}</Alert>
      ) : rows.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>
          No approved leave in this range.
        </Typography>
      ) : (
        <>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: "wrap" }}>
            <Chip label={`${rows.length} record${rows.length === 1 ? "" : "s"}`} size="small" variant="outlined" sx={{ height: 22, fontSize: 11, fontWeight: 600 }} />
            {oneEmployee && (
              <Chip label={`Total: ${totalDays} day${totalDays === 1 ? "" : "s"}`} size="small" color="primary" variant="outlined" sx={{ height: 22, fontSize: 11, fontWeight: 600 }} />
            )}
          </Stack>
          {/* The same component the running app uses, reached through Oxygen's
              re-export. Sorting, paging, the filter panel, column visibility,
              density and CSV/print export all arrive with it — hand-building
              any of that onto a plain table would be reimplementing a
              dependency we already ship. LeadReportTable.tsx:150-178. */}
          <Card variant="outlined">
            <DataGrid.DataGrid
              rows={rows}
              columns={REPORT_COLUMNS}
              loading={leaves.isFetching}
              initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
              pageSizeOptions={[5, 10, 25]}
              disableRowSelectionOnClick
              showToolbar
              rowHeight={52}
              // Nothing here is per-cell actionable, so the ring MUI puts on
              // the last-clicked cell only reads as a selection that does
              // nothing. See GRID_NO_POINTER_FOCUS_SX.
              sx={{ border: "none", ...GRID_NO_POINTER_FOCUS_SX }}
            />
          </Card>
        </>
      )}
    </Box>
  );
}

/** The six columns, in the source's order (LeadReportTable.tsx:61-137). */
// The six columns, in the source's order and with its widths
// (LeadReportTable.tsx:61-137). Defined at module scope so the grid is not
// handed a fresh array on every render, which would reset its own state.
const REPORT_COLUMNS: DataGrid.GridColDef<DatabaseLeave>[] = [
  { field: "email", headerName: "Employee", flex: 1.5 },
  {
    field: "leaveType",
    headerName: "Leave Type",
    flex: 1,
    renderCell: (params) => <LeaveTypeChip leaveType={params.value ?? null} />,
  },
  {
    field: "startDate",
    headerName: "Start Date",
    flex: 1,
    renderCell: (params) => <GridText>{formatNice(params.value ?? "")}</GridText>,
  },
  {
    field: "endDate",
    headerName: "End Date",
    flex: 1,
    renderCell: (params) => <GridText>{formatNice(params.value ?? "")}</GridText>,
  },
  {
    field: "numberOfDays",
    headerName: "Days",
    flex: 0.6,
    renderCell: (params) => <GridText bold>{params.value ?? "—"}</GridText>,
  },
  {
    field: "periodType",
    headerName: "Period",
    flex: 1,
    renderCell: (params) => (
      <GridText muted>{PERIOD_LABEL[params.value ?? ""] ?? params.value ?? "—"}</GridText>
    ),
  },
];

/**
 * A cell's text, vertically centred.
 *
 * The grid gives a cell its full row height, so a bare string sits at the top of
 * a 52px row. The source solves this the same way, wrapping each value in a
 * centred Stack (LeadReportTable.tsx:96-120).
 */
function GridText({
  children,
  bold,
  muted,
}: {
  children: React.ReactNode;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <Stack height="100%" justifyContent="center">
      <Typography
        variant="body2"
        sx={{
          fontSize: 12.5,
          fontWeight: bold ? 700 : undefined,
          color: muted ? "text.secondary" : undefined,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {children}
      </Typography>
    </Stack>
  );
}

function DateField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  onChange: (v: string) => void;
}) {
  return (
    <Box>
      <Typography sx={{ fontSize: 11, color: "text.secondary", mb: 0.375 }}>{label}</Typography>
      <TextField
        type="date"
        size="small"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputProps={{ min }}
      />
    </Box>
  );
}

