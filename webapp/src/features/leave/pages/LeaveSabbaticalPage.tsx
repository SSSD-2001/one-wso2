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
  AlertTitle,
  Box,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Link,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { useNotifications } from "@context/notifications/NotificationsContext";
import LeaveDateField from "../components/LeaveDateField";
import { useLeaveAppConfig, useLeaveUserInfo, useLeaves } from "../api/useLeaveData";
import { useSubmitLeave } from "../api/useLeaveMutations";
import { describeError } from "../util/leaveError";
import { SABBATICAL, SnackMessage } from "../util/leaveCopy";
import { formatNice, parseIso, todayIso } from "../util/leaveDates";
import {
  eligibilityGapDays,
  eligibilityYears,
  exceedsMaxDuration,
  maxDurationWeeks,
} from "../util/sabbatical";
import { useNavigate } from "react-router";
import { useLeaveGate } from "../api/useLeaveGate";
import { historyPathAfterSubmit } from "../leaveTabs";

// Sabbatical leave application — ported from view/SabbaticalLeave/ApplyTab.tsx
// (528 lines) and its wrapper SabbaticalLeave.tsx.
//
// Three things about this screen are easy to get wrong, so they are spelled out
// where they happen below: the last-sabbatical date is editable only when there
// isn't one; the eligibility warning is measured from whichever anchor applies
// and names it in the sentence; and the date the user types is appended to the
// free-text comment rather than sent as a field, because the submit goes
// through the ordinary POST /leaves.

// The Sabbatical tab of Apply (route.ts:72-78).
//
// Three things about this screen are easy to get wrong, so they are spelled out
// where they happen below: the last-sabbatical date is editable only when there
// isn't one; the eligibility warning is measured from whichever anchor applies
// and names it in the sentence; and the date the user types is appended to the
// free-text comment rather than sent as a field, because the submit goes
// through the ordinary POST /leaves.
export default function SabbaticalApplyTab() {
  return <SabbaticalApply />;
}

function SabbaticalApply() {
  const navigate = useNavigate();
  const gate = useLeaveGate();

  const userInfo = useLeaveUserInfo();
  const appConfig = useLeaveAppConfig();
  const { showSuccess, showError } = useNotifications();
  const submit = useSubmitLeave();

  const workEmail = userInfo.data?.workEmail ?? undefined;
  const employmentStartDate = userInfo.data?.employmentStartDate ?? "";
  const leadEmail = userInfo.data?.leadEmail ?? null;

  // ApplyTab.tsx:113-132 — the most recent APPROVED sabbatical, one row. It is
  // fetched unconditionally: eligibility is measured against the requested
  // start date, not against today, so the answer matters even for someone who
  // is plainly not eligible yet.
  const history = useLeaves(
    {
      email: workEmail,
      leaveCategory: ["sabbatical"],
      statuses: ["APPROVED"],
      orderBy: "DESC",
      limit: 1,
    },
    Boolean(workEmail),
  );

  const lastApproved = history.data?.leaves?.[0]?.endDate?.substring(0, 10) ?? null;
  // ApplyTab.tsx:87,134-148 — `sabbaticalEndDateFieldEditable` starts false and
  // is only set true inside an effect guarded on `State.success`. So the field
  // unlocks when the fetch SUCCEEDED and returned nothing; if it failed it stays
  // locked, rather than letting someone with a hidden sabbatical history type a
  // favourable anchor for the eligibility check.
  const anchorEditable = history.isSuccess && !lastApproved;

  const [typedAnchor, setTypedAnchor] = useState("");
  const lastSabbaticalEnd = lastApproved ?? (typedAnchor || null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [comment, setComment] = useState("");

  const [ackLead, setAckLead] = useState(false);
  const [ackPolicy, setAckPolicy] = useState(false);
  const [ackResignation, setAckResignation] = useState(false);

  const [startMissing, setStartMissing] = useState(false);
  const [endMissing, setEndMissing] = useState(false);
  const [ackLeadError, setAckLeadError] = useState(false);
  const [ackPolicyError, setAckPolicyError] = useState(false);
  const [ackResignationError, setAckResignationError] = useState(false);

  const [confirming, setConfirming] = useState(false);

  const config = appConfig.data;
  const eligibilityDays = config?.sabbaticalLeaveEligibilityDuration ?? 0;
  const maxDays = config?.sabbaticalLeaveMaxApplicationDuration ?? 0;
  const years = eligibilityYears(eligibilityDays);
  const weeks = maxDurationWeeks(maxDays);

  // ApplyTab.tsx:158-184. The anchor is the last sabbatical's end date if there
  // is one, otherwise the employment start date — and the message names which
  // of the two it measured from.
  const eligibilityWarning = useMemo(() => {
    const anchorIso = lastSabbaticalEnd ?? (employmentStartDate || null);
    const anchor = parseIso(anchorIso);
    const start = parseIso(startDate);
    if (!anchor || !start) return "";
    if (eligibilityGapDays(anchor, start) >= eligibilityDays) return "";
    return SABBATICAL.apply.notEligible(
      years,
      lastSabbaticalEnd
        ? SABBATICAL.apply.anchorLastSabbatical
        : SABBATICAL.apply.anchorEmploymentStart,
    );
  }, [lastSabbaticalEnd, employmentStartDate, startDate, eligibilityDays, years]);

  // ApplyTab.tsx:187-202 — checked as you type, not only on submit, so the end
  // field turns red the moment the range is too long.
  const durationExceeds = useMemo(() => {
    const s = parseIso(startDate);
    const e = parseIso(endDate);
    if (!s || !e) return false;
    return exceedsMaxDuration(s, e, maxDays);
  }, [startDate, endDate, maxDays]);

  const resetErrors = () => {
    setStartMissing(false);
    setEndMissing(false);
    setAckLeadError(false);
    setAckPolicyError(false);
    setAckResignationError(false);
  };

  // ApplyTab.tsx:204-273. The order matters: each rule raises one message and
  // stops, so the user is told the first thing wrong rather than all of them.
  const handleApply = () => {
    resetErrors();

    if (!startDate) setStartMissing(true);
    if (!endDate) setEndMissing(true);
    if (!startDate || !endDate) {
      showError(SABBATICAL.apply.datesRequired);
      return;
    }

    if (endDate < startDate) {
      showError(SABBATICAL.apply.endBeforeStart);
      return;
    }

    if (durationExceeds) {
      setEndMissing(true);
      showError(SABBATICAL.apply.durationExceeded(weeks));
      return;
    }

    // Eligibility is a blocking error here even though it renders as a warning
    // above the form — ApplyTab.tsx:243-246.
    if (eligibilityWarning) {
      showError(eligibilityWarning);
      return;
    }

    if (!ackLead) setAckLeadError(true);
    if (!ackPolicy) setAckPolicyError(true);
    if (!ackResignation) setAckResignationError(true);
    if (!ackLead || !ackPolicy || !ackResignation) {
      showError(SABBATICAL.apply.acknowledgeAll);
      return;
    }

    setConfirming(true);
  };

  // ApplyTab.tsx:275-298. There is a typed `lastSabbaticalLeaveEndDate` field
  // on SabbaticalApplicationRequest (types.ts:275-280) but nothing sends it —
  // the submit is the ordinary POST /leaves, so the date rides along inside the
  // comment. Reproduced rather than corrected: the approver reads it there.
  const executeSubmit = () => {
    setConfirming(false);
    const commentWithDate = lastSabbaticalEnd
      ? `${comment} **** Last Sabbatical Leave End Date: ${lastSabbaticalEnd} ****`
      : comment;

    submit.mutate(
      { leaveType: "sabbatical", startDate, endDate, comment: commentWithDate },
      {
        onSuccess: () => {
          // leave.ts:150-156 — the sabbatical submit goes through the
          // submitLeave thunk, which raises this on fulfilment. The port says it
          // at the call site instead, this codebase's convention, and this call
          // site was not saying it at all.
          //
          // The thunk's wording, NOT the Apply form's: GeneralLeave.tsx:147
          // calls the API directly and hardcodes "…successfully!", while
          // everything going through the slice gets SnackMessage's "…successfully".
          // Same event, two strings, and the difference is the source's.
          showSuccess(SnackMessage.success.submitLeaveMessage);
          // :291-296 — dates, comment and the three boxes clear; the anchor the
          // user typed is left alone.
          setStartDate("");
          setEndDate("");
          setComment("");
          setAckLead(false);
          setAckPolicy(false);
          setAckResignation(false);
          // Same as the general form: show them what they just submitted.
          const landing = historyPathAfterSubmit("sabbatical", gate.canSee);
          if (landing) navigate(landing);
        },
        onError: (err) => showError(describeError(err)),
      },
    );
  };

  // `isLoading`, not `isPending`: the history query is enabled on
  // `Boolean(workEmail)`, and React Query leaves a disabled query pending for
  // good. Waiting on that meant a failed /user-info span forever instead of
  // falling through to the error below.
  if (userInfo.isLoading || appConfig.isLoading || history.isLoading) {
    return <Skeleton variant="rectangular" height={420} sx={{ borderRadius: 1.5 }} />;
  }

  if (userInfo.isError) {
    return (
      <Alert severity="error">Couldn&apos;t load your leave profile. {describeError(userInfo.error)}</Alert>
    );
  }

  // SabbaticalLeave.tsx:26-43 — the flag replaces the entire screen, and an
  // absent config counts as off: the source holds `config: null` when the fetch
  // fails (configSlice/config.ts:38,100) and `sabbaticalFeatureEnabled` never
  // leaves its initial false. That matters beyond fidelity — the policy numbers
  // default to 0, and a 0-day maximum rejects every range the user can pick.
  if (!config?.isSabbaticalLeaveEnabled) {
    return <Alert severity="info">{SABBATICAL.featureOff}</Alert>;
  }

  const guideUrl = config?.sabbaticalLeaveUserGuideUrl;
  const policyUrl = config?.sabbaticalLeavePolicyUrl;

  return (
    <Stack spacing={1.75} sx={{ maxWidth: 880 }}>
      <Card variant="outlined" sx={{ p: 2 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ sm: "center" }}
          sx={{ pb: 1.5, mb: 2, borderBottom: 1, borderColor: "divider", gap: 1 }}
        >
          <Typography sx={{ fontSize: 15, fontWeight: 700 }}>
            {SABBATICAL.apply.title}
          </Typography>
          {guideUrl && (
            <Link href={guideUrl} target="_blank" rel="noopener" underline="hover" sx={{ fontSize: 13 }}>
              {SABBATICAL.apply.userGuide}
            </Link>
          )}
        </Stack>

        {/* ApplyTab.tsx:328-334 — a hard block. Without a lead there is nobody
            to route the request to, so the form is not rendered at all. The
            header above stays, as it does in the source. */}
        {!leadEmail ? (
          <Alert severity="warning" variant="outlined">
            <AlertTitle>{SABBATICAL.apply.noLeadTitle}</AlertTitle>
            {SABBATICAL.apply.noLeadBody}
          </Alert>
        ) : (
          <Stack spacing={2}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <LeaveDateField
                label={SABBATICAL.apply.employmentStartDate}
                value={employmentStartDate.substring(0, 10)}
                disabled
              />
              <LeaveDateField
                label={SABBATICAL.apply.lastSabbaticalEndDate}
                value={lastSabbaticalEnd ?? ""}
                disabled={!anchorEditable}
                // :356-357 — never before they joined, and no future date while
                // the field is theirs to fill in.
                min={employmentStartDate.substring(0, 10) || undefined}
                max={anchorEditable ? todayIso() : undefined}
                onChange={anchorEditable ? setTypedAnchor : undefined}
              />
            </Box>

            {eligibilityWarning && (
              <Alert severity="warning" variant="outlined">
                {eligibilityWarning}
              </Alert>
            )}

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <LeaveDateField
                label={SABBATICAL.apply.startDate}
                value={startDate}
                min={todayIso()}
                error={startMissing}
                helperText={startMissing ? SABBATICAL.apply.startDateRequired : undefined}
                onChange={(v) => {
                  setStartDate(v);
                  setStartMissing(false);
                  // :378-380 — an end date that now precedes the start is
                  // cleared rather than left as an invalid range.
                  if (v && endDate && v > endDate) setEndDate("");
                }}
              />
              <LeaveDateField
                label={SABBATICAL.apply.endDate}
                value={endDate}
                min={startDate || todayIso()}
                error={endMissing || durationExceeds}
                // :406-410 — the length message wins over "required".
                helperText={
                  durationExceeds
                    ? SABBATICAL.apply.durationExceededField(weeks)
                    : endMissing
                      ? SABBATICAL.apply.endDateRequired
                      : undefined
                }
                onChange={(v) => {
                  setEndDate(v);
                  setEndMissing(false);
                }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: 13, mb: 0.75 }}>
                {SABBATICAL.apply.commentLabel}
              </Typography>
              <TextField
                fullWidth
                size="small"
                multiline
                minRows={1}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={SABBATICAL.apply.commentPlaceholder}
              />
            </Box>

            <Stack spacing={0.5}>
              <Acknowledgement
                checked={ackLead}
                error={ackLeadError}
                onChange={(v) => {
                  setAckLead(v);
                  setAckLeadError(false);
                }}
                label={SABBATICAL.apply.ackManagerApproval}
              />
              <Acknowledgement
                checked={ackPolicy}
                error={ackPolicyError}
                onChange={(v) => {
                  setAckPolicy(v);
                  setAckPolicyError(false);
                }}
                label={
                  <>
                    {SABBATICAL.apply.ackPolicyBefore}
                    {policyUrl ? (
                      <Link href={policyUrl} target="_blank" rel="noopener" underline="hover">
                        {SABBATICAL.apply.ackPolicyLink}
                      </Link>
                    ) : (
                      SABBATICAL.apply.ackPolicyLink
                    )}
                    {SABBATICAL.apply.ackPolicyAfter}
                  </>
                }
              />
              <Acknowledgement
                checked={ackResignation}
                error={ackResignationError}
                onChange={(v) => {
                  setAckResignation(v);
                  setAckResignationError(false);
                }}
                label={SABBATICAL.apply.ackResignation}
              />
            </Stack>

            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              {/* :518 — disabled only while the request is in flight. Every
                  other block raises a message, so pressing it always says
                  something. */}
              <Button
                variant="contained"
                onClick={handleApply}
                disabled={submit.isPending}
                sx={{ fontWeight: 600 }}
              >
                {submit.isPending ? "Submitting…" : SABBATICAL.apply.submit}
              </Button>
            </Box>
          </Stack>
        )}
      </Card>

      <Dialog open={confirming} onClose={() => setConfirming(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>
          {SABBATICAL.apply.confirmTitle}
        </DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontSize: 13.5 }}>
            {SABBATICAL.apply.confirmBody(
              `${formatNice(startDate)} to ${formatNice(endDate)}`,
              leadEmail,
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setConfirming(false)}>
            {SABBATICAL.apply.confirmCancel}
          </Button>
          <Button size="small" variant="contained" onClick={executeSubmit}>
            {SABBATICAL.apply.confirmOk}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

// ApplyTab.tsx:430-514 — an unchecked-but-required box turns the control and
// its label red, which is the only signal the source gives before submit.
function Acknowledgement({
  checked,
  error,
  onChange,
  label,
}: {
  checked: boolean;
  error: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
}) {
  return (
    <FormControlLabel
      control={
        <Checkbox
          size="small"
          color={error ? "error" : "primary"}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
      }
      label={
        <Typography sx={{ fontSize: 12.5, color: error ? "error.main" : "text.primary" }}>
          {label}
        </Typography>
      }
      sx={{ alignItems: "flex-start", "& .MuiCheckbox-root": { pt: 0.25 } }}
    />
  );
}
