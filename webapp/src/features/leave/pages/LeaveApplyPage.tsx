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

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { describeError } from "../util/leaveError";
import { useNotifications } from "@context/notifications/NotificationsContext";
import VirtualizedListbox from "@components/virtualized-listbox/VirtualizedListbox";
import { EmployeeOption } from "../components/EmployeeOption";
import { employeeDisplayName } from "../util/employeeName";
import EmployeeAvatar from "@features/my/my-team/components/EmployeeAvatar";
import LeaveBalanceSummary from "../components/LeaveBalanceSummary";
import LeaveDateField from "../components/LeaveDateField";
import {
  LEAVE_TYPE_ICON,
  LEAVE_TYPE_POLICY_KEY,
  LEAVE_TYPE_TOOLTIP,
  defaultLeaveTypeForLocation,
  leaveTypeInfo,
  leaveTypesForLocation,
  quotaTrackedTypesForLocation,
  type LeavePayload,
  type LeavePeriodType,
  type LeaveType,
} from "../api/leaveTypes";
import {
  useLeaveAppConfig,
  useLeaveEmployees,
  useLeaveEntitlement,
  useLeaveUserInfo,
} from "../api/useLeaveData";
import { useSubmitLeave, useValidateLeave } from "../api/useLeaveMutations";
import { calendarDaysInclusive, formatNice, startOfYearIso, todayIso } from "../util/leaveDates";
import {
  CONFIRMATION_PORTION_LABEL,
  SUBMIT_CONFIRMATION,
  VALIDATION_MESSAGE,
  leaveTypeLabel,
  GENERIC_LABEL,
  PUBLIC_COMMENT_LABEL,
  PUBLIC_COMMENT_NOTE,
  SUBMIT_SUCCESS,
} from "../util/leaveCopy";
import { withLoadingAdornment } from "@components/picker-loading/pickerLoading";
import { useLeaveGate } from "../api/useLeaveGate";
import { historyPathAfterSubmit } from "../leaveTabs";
import { useNavigate } from "react-router";

type Portion = "full" | "first" | "second";

// The General tab of Apply (route.ts:65-70). The page frame and the tab bar
// are LeaveGroupPage's; this is only the form.
export default function GeneralApplyTab() {
  return <ApplyForm />;
}

function ApplyForm() {
  const userInfo = useLeaveUserInfo();
  const navigate = useNavigate();
  const gate = useLeaveGate();
  const appConfig = useLeaveAppConfig();
  const employees = useLeaveEmployees();
  const validate = useValidateLeave();
  const submit = useSubmitLeave();
  const { showSuccess, showError, showWarning } = useNotifications();

  const today = todayIso();
  const yearStart = startOfYearIso(new Date().getFullYear());

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [leaveType, setLeaveType] = useState<LeaveType>("casual");
  const [portion, setPortion] = useState<Portion>("full");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  // Seed the default leave type from the employee's location once known.
  const location = userInfo.data?.location ?? null;
  useEffect(() => {
    setLeaveType((prev) => (prev === "casual" ? defaultLeaveTypeForLocation(location) : prev));
    // Only re-seed when location resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // Which leave types this employee can pick, and (for the balance panel)
  // which of those are quota-tracked — both location-gated, matching
  // leave-app's LeaveSelection.tsx rather than offering every general type
  // to everyone regardless of where they are.
  const availableLeaveTypes = useMemo(() => leaveTypesForLocation(location), [location]);
  const quotaTrackedTypes = useMemo(() => quotaTrackedTypesForLocation(location), [location]);
  // The balance panel + entitlement-exceeded warning only apply where
  // quota tracking exists today (France/Spain) — matches leave-app's
  // LeaveBalanceSummary early return.
  const hasQuotaTracking = quotaTrackedTypes.length > 0;
  const entitlementQuery = useLeaveEntitlement(userInfo.data?.workEmail ?? undefined, hasQuotaTracking);
  const entitlement = entitlementQuery.data?.[0];
  // France asks a second time for the calendar year and reads the RTT row from
  // that response — LeaveBalanceSummary.tsx:94-100,145. The congés-payés leave
  // year is not the calendar year, so the default record's RTT figures belong
  // to a different window.
  const rttQuery = useLeaveEntitlement(
    userInfo.data?.workEmail ?? undefined,
    location === "France",
    [new Date().getFullYear()],
  );
  const rttEntitlement = rttQuery.data?.[0];

  const days = calendarDaysInclusive(startDate, endDate);
  const rangeValid = days > 0;
  // Half-day only makes sense for a single calendar day.
  useEffect(() => {
    if (days !== 1 && portion !== "full") setPortion("full");
  }, [days, portion]);

  const { periodType, isMorningLeave } = useMemo<{
    periodType: LeavePeriodType;
    isMorningLeave: boolean | null;
  }>(() => {
    if (portion === "full") return { periodType: days === 1 ? "one" : "multiple", isMorningLeave: null };
    return { periodType: "half", isMorningLeave: portion === "first" };
  }, [portion, days]);

  // Live validation whenever the date range / portion changes. Debounced,
  // and guarded against out-of-order settles: only the latest request's
  // result is accepted, so `workingDays` always describes the current range.
  // useMutation keeps only the last-settled result, which two in-flight
  // validations can corrupt — hence the local state + sequence ref.
  const validateAsync = validate.mutateAsync;
  const seqRef = useRef(0);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [workingDays, setWorkingDays] = useState<number | undefined>(undefined);
  // No client-side overlap gate. The running app has none: it posts, and shows
  // whatever the server says if the range is refused (GeneralLeave.tsx:157-159).
  // The port had blocked submission on a `hasOverlap` flag of its own invention,
  // which at best duplicated the server and at worst refused a request the live
  // app would have accepted.
  useEffect(() => {
    if (!rangeValid) {
      setValidating(false);
      setValidationError(null);
      setWorkingDays(undefined);
      return;
    }
    const seq = ++seqRef.current;
    setValidating(true);
    const timer = window.setTimeout(() => {
      // No leaveType: the source's LeaveValidationRequest (types.ts:128-133)
      // carries only these four fields — this call counts working days.
      validateAsync({ startDate, endDate, periodType, isMorningLeave })
        .then((res) => {
          if (seq !== seqRef.current) return; // superseded by a newer request
          setWorkingDays(res.workingDays);
          setValidationError(null);
          setValidating(false);
        })
        .catch((err) => {
          if (seq !== seqRef.current) return;
          setWorkingDays(undefined);
          setValidationError(describeError(err));
          setValidating(false);
        });
    }, 400);
    return () => window.clearTimeout(timer);
    // leaveType is sent for parity with the running app but does not change the
    // working-day count, and validateAsync is a mutation callback that is not
    // referentially stable — including either would re-fire the debounce on
    // every render without changing what it computes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, periodType, isMorningLeave, rangeValid]);

  const canSubmit =
    rangeValid &&
    !validating &&
    !validationError &&
    typeof workingDays === "number" &&
    // Half-day requests are worth 0.5, so gate on > 0, not >= 1.
    workingDays > 0 &&
    !submit.isPending &&
    Boolean(userInfo.data) &&
    // Mandatory recipients (lead + People Ops) come from appConfig; don't
    // let a submit go out without them if appConfig hasn't resolved yet.
    Boolean(appConfig.data);

  // Anyone still on the books, minus the leavers. The backend is asked for
  // Active + Marked leaver + Left (it needs Left to resolve historical rows),
  // and the source drops Left again on the client before offering them as
  // recipients — NotifyPeople.tsx:107. Without that filter the picker offers
  // to email people who have gone.
  const offerable = useMemo(
    () => (employees.data ?? []).filter((e) => e.employeeStatus !== "Left" && e.workEmail),
    [employees.data],
  );
  const employeeOptions = useMemo(() => offerable.map((e) => e.workEmail), [offerable]);
  // Options stay addresses — they are what the payload carries, and what the
  // chips show — so the row is rendered by looking the person up.
  const byEmail = useMemo(
    () => new Map(offerable.map((e) => [e.workEmail, e])),
    [offerable],
  );
  // The always-notified addresses, with the LEAD LAST.
  //
  // The backend sends these lead-first, which put the person who decides ahead
  // of the leave group that only needs telling. The group reads as "where this
  // is announced" and the lead as "who acts on it", and the announcement is the
  // one that belongs at the front.
  //
  // The lead is found by ADDRESS — whoever /user-info calls `leadEmail` — not
  // by position, so this holds however the backend orders the list and whatever
  // else is in it. With no lead resolved, or no lead among them, the backend's
  // order stands untouched.
  //
  // A deliberate deviation: NotifyPeople.tsx renders mandatoryMails in the
  // order received. See docs/ported-apps/leave-app.md.
  const mandatory = useMemo(() => {
    const all = (appConfig.data?.cachedEmails.mandatoryMails ?? []).map((m) => m.email);
    const lead = userInfo.data?.leadEmail;
    if (!lead) return all;
    const withoutLead = all.filter((e) => e !== lead);
    return withoutLead.length === all.length ? all : [...withoutLead, lead];
  }, [appConfig.data, userInfo.data]);

  // Who the backend says was copied on this person's last request. The source
  // pre-selects these (NotifyPeople.tsx:86-99) so a repeat request notifies the
  // same people without the user rebuilding the list. Starting empty — which
  // this page did — quietly notifies fewer people than the standalone app for
  // every default submission.
  const suggested = useMemo(
    () =>
      (appConfig.data?.cachedEmails.optionalMails ?? [])
        .map((m) => m.email)
        .filter((email) => !mandatory.includes(email)),
    [appConfig.data, mandatory],
  );

  // Seeded once, when appConfig first resolves. Not on every change: the user
  // may have removed one of these deliberately, and re-adding it each render
  // would make the field impossible to edit.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || suggested.length === 0) return;
    seeded.current = true;
    setRecipients((current) => (current.length > 0 ? current : suggested));
  }, [suggested]);

  const [confirming, setConfirming] = useState(false);

  // The two blocks the user can act on, each with its own message.
  const explainableBlock = !rangeValid || (typeof workingDays === "number" && workingDays <= 0);

  // Say why, rather than leaving a dead button. The running app blocks with a
  // message for each case (GeneralLeave.tsx:165-189); the port disabled the
  // button silently, which tells the reader nothing about what to change.
  const handleSubmit = () => {
    if (!rangeValid) {
      showError(VALIDATION_MESSAGE.datesRequired);
      return;
    }
    if (typeof workingDays === "number" && workingDays <= 0) {
      showError(VALIDATION_MESSAGE.workingDaysRequired);
      return;
    }
    if (!canSubmit) return;
    setConfirming(true);
  };

  const executeSubmit = () => {
    setConfirming(false);
    // Mandatory recipients (lead + People Ops) are notified by the backend
    // independently of this list — exclude them here rather than merging
    // them in, matching leave-app's GeneralLeave.tsx (filteredEmailRecipients)
    // so we don't risk double-notifying them.
    const emailRecipients = recipients.filter((r) => !mandatory.includes(r));

    // Warn (don't block) if this request would exceed a quota-tracked
    // entitlement — matches leave-app's executeSubmit. Only meaningful
    // where quota tracking exists (France/Spain) and the type itself has
    // a policy key (maternity/paternity/lieu don't).
    const policyKey = LEAVE_TYPE_POLICY_KEY[leaveType];
    if (policyKey && entitlement) {
      const entitled = entitlement.leavePolicy[policyKey] ?? 0;
      const consumed = entitlement.policyAdjustedLeave[policyKey] ?? 0;
      const projected = consumed + (workingDays ?? 0);
      if (entitled > 0 && projected > entitled) {
        showWarning(
          // GeneralLeave.tsx:75-81 uses its own map here, not the location
          // labels — and it points `annual` at the Casual label.
          `This request will exceed your ${GENERIC_LABEL[leaveType]} entitlement (${projected}/${entitled} days)`,
        );
      }
    }

    const payload: LeavePayload = {
      startDate,
      endDate,
      periodType,
      isMorningLeave,
      leaveType,
      emailRecipients,
      comment,
      isPublicComment: isPublic,
    };
    submit.mutate(payload, {
      onSuccess: () => {
        showSuccess(SUBMIT_SUCCESS);
        // Reset to a clean single-day request — dates, type, portion and the
        // comment, exactly what GeneralLeave.tsx:150-155 clears.
        //
        // NOT the recipients. The source deliberately leaves them, and clearing
        // them here did more than empty the chips: `seeded` is a ref, so they
        // were never re-seeded, the next submit sent an empty emailRecipients,
        // and the backend stored that as the copyEmailList — which is the list
        // it hands back as optionalMails. One submit cleared the suggestions;
        // a second erased them for good.
        setComment("");
        setPortion("full");
        setStartDate(today);
        setEndDate(today);
        // Show them the request they just made. The snackbar survives the
        // navigation — NotificationsProvider sits above the router.
        const landing = historyPathAfterSubmit("general", gate.canSee);
        if (landing) navigate(landing);
      },
      onError: (err) => showError(describeError(err)),
    });
  };

  const confirmationBody = SUBMIT_CONFIRMATION.body({
    leaveLabel: leaveTypeLabel(userInfo.data?.location, leaveType),
    workingDays: workingDays ?? 0,
    dateRange:
      startDate === endDate
        ? formatNice(startDate)
        : `${formatNice(startDate)} – ${formatNice(endDate)}`,
    portionLabel: CONFIRMATION_PORTION_LABEL[portion],
  });

  if (userInfo.isLoading) {
    return (
      <Stack spacing={1.75}>
        <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1.5 }} />
        <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1.5 }} />
        <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1.5 }} />
      </Stack>
    );
  }
  if (userInfo.isError) {
    return <Alert severity="error">Couldn't load your leave profile. {describeError(userInfo.error)}</Alert>;
  }
  if (appConfig.isError) {
    return (
      <Alert severity="error">
        Couldn't load leave configuration, so submissions are disabled (the required
        notifications can't be resolved). {describeError(appConfig.error)}
      </Alert>
    );
  }

  return (
    <Stack spacing={1.75} sx={{ maxWidth: 880 }}>
      {/* Dates + working-day validity */}
      <Card variant="outlined" sx={{ p: 2 }}>
        <FieldLabel>Dates</FieldLabel>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr auto auto" }, gap: 1.5, alignItems: "end" }}>
          <LeaveDateField label="Start" value={startDate} min={yearStart} onChange={setStartDate} />
          <LeaveDateField label="End" value={endDate} min={startDate} onChange={setEndDate} />
          {/* A half-day is 0.5 days selected, not 1 — LeaveDateSelection.tsx:207-210
              substitutes the working-day figure whenever a half is chosen. */}
          <Stat
            label="Days selected"
            value={rangeValid ? String(portion === "full" ? days : (workingDays ?? days)) : "—"}
          />
          <Stat label="Working days" value={validating ? "…" : workingDays != null ? String(workingDays) : "—"} />
        </Box>
        <Box sx={{ mt: 1.25 }}>
          {!rangeValid ? (
            <Chip label="Select a valid date range" size="small" color="default" variant="outlined" sx={CHIP_SX} />
          ) : validating ? (
            <Chip label="Validating…" size="small" color="default" variant="outlined" sx={CHIP_SX} />
          ) : validationError ? (
            <Chip label={validationError} size="small" color="error" variant="outlined" sx={CHIP_SX} />
          ) : workingDays != null && workingDays <= 0 ? (
            <Chip label="No working days in this range" size="small" color="warning" variant="outlined" sx={CHIP_SX} />
          ) : (
            <Chip label="Valid selection" size="small" color="success" variant="outlined" sx={CHIP_SX} />
          )}
        </Box>
      </Card>

      {/* Leave type + portion */}
      <Card variant="outlined" sx={{ p: 2 }}>
        <FieldLabel>Leave type</FieldLabel>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2, alignItems: "flex-start" }}>
          {availableLeaveTypes.map((t) => {
            const active = t === leaveType;
            const info = leaveTypeInfo(location, t);
            const TypeIcon = LEAVE_TYPE_ICON[t];
            const button = (
              <Button
                size="small"
                variant={active ? "contained" : "outlined"}
                onClick={() => setLeaveType(t)}
                startIcon={<TypeIcon size={14} />}
                sx={{ fontSize: 12, fontWeight: 600, borderRadius: 1.25, textTransform: "none" }}
              >
                {leaveTypeLabel(location, t)}
              </Button>
            );
            const tooltip = LEAVE_TYPE_TOOLTIP[t];
            return (
              <Stack key={t} spacing={0.25} alignItems="center">
                {tooltip ? <Tooltip title={tooltip}>{button}</Tooltip> : button}
                {/* Eligibility caveat (e.g. "Maharashtra only") — always
                    visible, not a hover tooltip, since it affects whether
                    the employee can actually use this type. */}
                {info && (
                  <Typography sx={{ fontSize: 9.5, color: "text.disabled", fontStyle: "italic" }}>
                    {info}
                  </Typography>
                )}
              </Stack>
            );
          })}
        </Box>

        {hasQuotaTracking && (
          <Box sx={{ mb: 2 }}>
            <LeaveBalanceSummary
              types={quotaTrackedTypes}
              entitlement={entitlement}
              rttEntitlement={rttEntitlement}
              location={location}
              isLoading={entitlementQuery.isLoading}
            />
          </Box>
        )}

        <FieldLabel>Portion of the day</FieldLabel>
        <Stack direction="row" spacing={1}>
          {(["full", "first", "second"] as Portion[]).map((p) => {
            const active = p === portion;
            const disabled = p !== "full" && days !== 1;
            return (
              <Button
                key={p}
                size="small"
                variant={active ? "contained" : "outlined"}
                disabled={disabled}
                onClick={() => setPortion(p)}
                sx={{ fontSize: 12, fontWeight: 600, borderRadius: 1.25, textTransform: "none" }}
              >
                {p === "full" ? "Full day" : p === "first" ? "First half" : "Second half"}
              </Button>
            );
          })}
        </Stack>
        {days !== 1 && (
          <Typography sx={{ fontSize: 11, color: "text.disabled", mt: 0.75 }}>
            Half-day options apply to single-day requests only.
          </Typography>
        )}
      </Card>

      {/* Notify + comment */}
      <Card variant="outlined" sx={{ p: 2 }}>
        <FieldLabel>Notify people</FieldLabel>
        <Autocomplete
          multiple
          size="small"
          options={employeeOptions}
          // Mandatory recipients (lead + People Ops) are always shown as
          // chips ahead of whatever the user picked — matches leave-app's
          // NotifyPeople.tsx, which pre-populates them as fixed/non-removable
          // tags so the user can actually see who's auto-notified, instead
          // of leaving it to static copy text alone.
          value={[...mandatory, ...recipients.filter((r) => !mandatory.includes(r))]}
          onChange={(_e, v) => setRecipients((v as string[]).filter((r) => !mandatory.includes(r)))}
          loading={employees.isLoading}
          disabled={employees.isLoading}
          loadingText="Loading employees…"
          noOptionsText={employees.isError ? "Couldn't load employees" : "No employees found"}
          disableListWrap
          ListboxComponent={VirtualizedListbox}
          renderOption={(props, option) => {
            const employee = byEmail.get(option);
            return employee ? (
              <EmployeeOption key={option} employee={employee} props={props} />
            ) : (
              <li {...props} key={option}>
                {option}
              </li>
            );
          }}
          // Names are on screen now, so they have to be searchable — matching
          // the address alone would make a name you can see unfindable.
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
          // The chip carries the person's name and photo, not their address —
          // NotifyPeople.tsx:211-226. A cached recipient we have no employee
          // record for keeps its address, which is all the source has for one
          // too (it seeds displayName from the email).
          renderTags={(value, getTagProps) =>
            value.map((option, index) => {
              const isFixed = mandatory.includes(option);
              const { onDelete, ...tagProps } = getTagProps({ index });
              const employee = byEmail.get(option);
              return (
                <Chip
                  {...tagProps}
                  key={option}
                  label={employee ? employeeDisplayName(employee) : option}
                  avatar={
                    employee ? (
                      <EmployeeAvatar employee={employee} size={24} />
                    ) : undefined
                  }
                  size="small"
                  onDelete={isFixed ? undefined : onDelete}
                />
              );
            })
          }
          renderInput={(params) => (
            <TextField
              {...withLoadingAdornment(params, employees.isLoading)}
              // One placeholder, not two. While loading the field is disabled
              // and carries a spinner, so a third signal saying the same thing
              // just made the field flicker between two strings. The source
              // does swap it (NotifyPeople.tsx:193) — a deliberate deviation.
              placeholder="Add people to notify (optional)"
            />
          )}
        />
        <Typography sx={{ fontSize: 11, color: "text.disabled", mt: 0.75 }}>
          Your lead and People Ops are always notified.
        </Typography>

        <Box sx={{ mt: 2 }}>
          <FieldLabel>Comment</FieldLabel>
          <TextField
            fullWidth
            size="small"
            multiline
            minRows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment (optional)…"
          />
          {/* FormControlLabel, not a loose Switch beside a Typography — the
              source pairs them (AdditionalComment.tsx:52-65) and that is what
              gives the control an accessible name. */}
          <FormControlLabel
            sx={{ mt: 1 }}
            control={
              <Switch
                size="small"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
            }
            label={
              <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
                {PUBLIC_COMMENT_LABEL}
              </Typography>
            }
          />
        </Box>
      </Card>

      {submit.isError && <Alert severity="error">{describeError(submit.error)}</Alert>}

      <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 2 }}>
        {/* Who can read the comment — GeneralLeave.tsx:345-349 puts this next
            to Submit, where it is read just before sending. */}
        <Typography sx={{ fontSize: 11, color: "text.disabled", textAlign: "right" }}>
          {isPublic ? PUBLIC_COMMENT_NOTE.public : PUBLIC_COMMENT_NOTE.private}
        </Typography>
        <Button
          variant="contained"
          onClick={handleSubmit}
          // Enabled while a range is merely invalid or has no working days, so
          // pressing it produces the message rather than nothing at all.
            disabled={!canSubmit && !explainableBlock}
          sx={{ fontWeight: 600 }}
        >
          {submit.isPending ? "Submitting…" : validating ? "Validating…" : "Submit Leave"}
        </Button>
      </Box>
    
      {/* GeneralLeave.tsx:222-229. Naming the type, the days, the range and the
          portion lets the reader check what they are about to send, instead of
          confirming an unlabelled action. */}
      <Dialog open={confirming} onClose={() => setConfirming(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{SUBMIT_CONFIRMATION.title}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {confirmationBody}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirming(false)}>{SUBMIT_CONFIRMATION.cancelText}</Button>
          <Button variant="contained" onClick={executeSubmit} disabled={submit.isPending}>
            {SUBMIT_CONFIRMATION.okText}
          </Button>
        </DialogActions>
      </Dialog>
</Stack>
  );
}

const CHIP_SX = { height: 22, fontSize: 11, fontWeight: 600 } as const;

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "text.disabled", fontWeight: 600, mb: 1 }}
    >
      {children}
    </Typography>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        px: 1.5,
        py: 0.75,
        minWidth: 92,
        textAlign: "center",
      }}
    >
      <Typography sx={{ fontSize: 10, color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
    </Box>
  );
}
