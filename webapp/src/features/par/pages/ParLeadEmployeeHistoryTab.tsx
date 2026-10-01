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
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  ComplexSelect,
  Divider,
  Grid,
  ListingTable,
  Skeleton,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { ArrowLeftIcon, ChevronDownIcon, ChevronRightIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useMeProfile } from "@features/my/api/useMeProfile";
import { useLeaveEmployees } from "@features/leave/api/useLeaveData";
import { useParRating } from "../api/useParData";
import {
  useAllClosedParCycles,
  useParEmployeeReviews,
  useParLeadEmployees,
  useParLegacyHistoryFanOut,
  useParRatingFanOut,
} from "../api/useLeadHistory";
import {
  ALL_EMPLOYEES_OPTION,
  buildMergedCycleOptions,
  filterEmployeesForCycle,
  filterOwnedByLead,
  resolveEmployeeCycleRating,
} from "../util/parEmployeeHistory";
import type { MergedCycleOption } from "../util/parEmployeeHistory";
import { deriveLegacyRatingFromScore, parseLegacyQuestionAnswers } from "../util/parLegacyHistory";
import { decodeParComment } from "../util/parComment";
import ParEmptyState from "../components/ParEmptyState";
import { ParCommentView } from "../components/ParContent";
import ParHistoryReviewSection from "../components/ParHistoryReviewSection";
import ParLegacyReviewSection from "../components/ParLegacyReviewSection";
import ParStatusChip from "../components/ParStatusChip";
import type { ParEmployee } from "../api/types";
import type { ParLegacyHistoryByEmail, ParRatingByEmail } from "../api/useLeadHistory";

type CycleSelection = { kind: "none" } | { kind: "real"; parCycleId: number } | { kind: "legacy"; cycleName: string };

function toCycleSelection(option: MergedCycleOption): CycleSelection {
  return option.isLegacy ? { kind: "legacy", cycleName: option.cycleName } : { kind: "real", parCycleId: option.parCycleId! };
}

function InfoItem({ label, value, secondaryValue }: { label: string; value: string; secondaryValue: string }) {
  return (
    <Grid size="grow">
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, mb: 0.25 }}
      >
        {label}
      </Typography>
      <Typography variant="body1" sx={{ fontWeight: 600 }}>
        {value || "—"}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {secondaryValue || "—"}
      </Typography>
    </Grid>
  );
}

/** Every in-scope employee for the selected cycle, shown by default —
 * click a row to drill into that person's full record below (the existing
 * single-employee detail view). */
function AllEmployeesTable({
  employees,
  thumbnailByEmail,
  isRealCycle,
  legacyCycleName,
  legacyByEmail,
  ratingByEmail,
  isRatingLoadingByEmail,
  isRatingErrorByEmail,
  onRetryRating,
  onSelect,
}: {
  employees: ParEmployee[];
  thumbnailByEmail: Map<string, string | null>;
  isRealCycle: boolean;
  legacyCycleName: string | undefined;
  legacyByEmail: ParLegacyHistoryByEmail;
  ratingByEmail: ParRatingByEmail;
  isRatingLoadingByEmail: Record<string, boolean>;
  isRatingErrorByEmail: Record<string, boolean>;
  onRetryRating: (workEmail: string) => void;
  onSelect: (employee: ParEmployee) => void;
}) {
  if (employees.length === 0) {
    return <ParEmptyState text="None of your reports have a record for this cycle." />;
  }
  return (
    <ListingTable.Container>
      <ListingTable density="compact">
        <ListingTable.Head>
          <ListingTable.Row>
            <ListingTable.Cell sx={{ fontWeight: 700 }}>Employee</ListingTable.Cell>
            <ListingTable.Cell sx={{ fontWeight: 700 }}>Rating</ListingTable.Cell>
            <ListingTable.Cell />
          </ListingTable.Row>
        </ListingTable.Head>
        <ListingTable.Body>
          {employees.map((employee) => {
            const { rating, special, hasRecord, isLoading, isError } = resolveEmployeeCycleRating(
              employee,
              isRealCycle,
              legacyCycleName,
              legacyByEmail,
              ratingByEmail,
              isRatingLoadingByEmail,
              isRatingErrorByEmail,
            );
            return (
              <ListingTable.Row
                key={employee.workEmail}
                clickable
                hover
                tabIndex={0}
                role="button"
                aria-label={`View ${employee.employeeName}'s PAR history`}
                onClick={() => onSelect(employee)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(employee);
                  }
                }}
              >
                <ListingTable.Cell>
                  <Box display="flex" alignItems="center" gap={1.5}>
                    <Avatar
                      src={thumbnailByEmail.get(employee.workEmail) || undefined}
                      alt={employee.employeeName}
                      sx={{ height: "2rem", width: "2rem" }}
                    />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {employee.employeeName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {employee.workEmail}
                      </Typography>
                    </Box>
                  </Box>
                </ListingTable.Cell>
                <ListingTable.Cell>
                  {isLoading ? (
                    <Skeleton variant="text" width={80} />
                  ) : isError ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" color="error.main">
                        Couldn't load
                      </Typography>
                      <Button
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRetryRating(employee.workEmail);
                        }}
                      >
                        Retry
                      </Button>
                    </Stack>
                  ) : (
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" alignItems="center">
                      {special && <ParStatusChip content={special} />}
                      {rating && <ParStatusChip content={rating} />}
                      {!special && !rating && (
                        <Typography variant="body2" color="text.secondary">
                          {hasRecord ? "—" : "No record"}
                        </Typography>
                      )}
                    </Stack>
                  )}
                </ListingTable.Cell>
                <ListingTable.Cell align="right">
                  <ChevronRightIcon size={16} />
                </ListingTable.Cell>
              </ListingTable.Row>
            );
          })}
        </ListingTable.Body>
      </ListingTable>
    </ListingTable.Container>
  );
}

// Lead Portal → Employee History: par-app's EmployeeHistoryView.tsx
// (lead-facing side only). Defaults to the most recent cycle (merged real
// closed and legacy options, latest first) and shows every
// in-scope report's rating in a table; picking one employee drills into
// their full record.
export default function ParLeadEmployeeHistoryTab() {
  const profile = useMeProfile();
  const workEmail = profile.data?.userInfo.workEmail;
  const employees = useParLeadEmployees(workEmail);
  const realCycles = useAllClosedParCycles();
  const legacyFanOut = useParLegacyHistoryFanOut((employees.data ?? []).map((e) => e.workEmail));
  // No org-wide employee directory of our own — reuses Leave's for avatars.
  const thumbnails = useLeaveEmployees();
  const thumbnailByEmail = useMemo(
    () => new Map(thumbnails.data?.map((e) => [e.workEmail, e.employeeThumbnail]) ?? []),
    [thumbnails.data],
  );

  const [rawCycleSelection, setRawCycleSelection] = useState<CycleSelection>({ kind: "none" });
  const [selectedEmployee, setSelectedEmployee] = useState<ParEmployee | null>(null);
  const [inputValue, setInputValue] = useState(ALL_EMPLOYEES_OPTION.employeeName);
  // Only true for a table-row selection — the Employee field is already
  // visible and already clears back to All employees, so only a table
  // click (which has no field of its own) needs the extra back button.
  const [selectedFromTable, setSelectedFromTable] = useState(false);
  // True once the lead has explicitly changed the cycle — including
  // clearing it back to "none". Until then, `cycleSelection` below
  // defaults to the most recent cycle instead. Derived at render time
  // rather than an effect+setState.
  const [userChangedCycle, setUserChangedCycle] = useState(false);

  const cycleOptions = buildMergedCycleOptions(realCycles.data ?? [], legacyFanOut.byEmail);
  // cycleOptions[0] isn't stable until every source feeding it has settled
  // — picking it earlier risks swapping the cycle under an already-selected employee.
  const cycleDataReady = employees.isSuccess && realCycles.isSuccess && !legacyFanOut.isLoading;
  const cycleSelection: CycleSelection =
    !userChangedCycle && rawCycleSelection.kind === "none" && cycleDataReady && cycleOptions.length > 0
      ? toCycleSelection(cycleOptions[0])
      : rawCycleSelection;

  const isRealCycle = cycleSelection.kind === "real";
  const isLegacyCycle = cycleSelection.kind === "legacy";
  const realCycleId = isRealCycle ? cycleSelection.parCycleId : undefined;
  const selectedEmployeeEmail = selectedEmployee?.workEmail;

  const rating = useParRating(realCycleId, selectedEmployeeEmail, isRealCycle && Boolean(selectedEmployeeEmail));
  const reviews = useParEmployeeReviews(realCycleId, isRealCycle ? selectedEmployeeEmail : undefined);
  // Powers the "all employees" table; picking one employee afterwards
  // reuses this cache (same query key as useParRating).
  const ratingFanOut = useParRatingFanOut(realCycleId, (employees.data ?? []).map((e) => e.workEmail));

  if (profile.isLoading) {
    return <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1.5 }} />;
  }
  if (profile.isError) {
    return (
      <ErrorNotice error={profile.error} onRetry={() => profile.refetch()} retrying={profile.isFetching}>
        Couldn't load your profile.
      </ErrorNotice>
    );
  }
  if (employees.isError) {
    return (
      <ErrorNotice error={employees.error} onRetry={() => employees.refetch()} retrying={employees.isFetching}>
        Couldn't load your direct reports.
      </ErrorNotice>
    );
  }
  if (realCycles.isError) {
    return (
      <ErrorNotice error={realCycles.error} onRetry={() => realCycles.refetch()} retrying={realCycles.isFetching}>
        Couldn't load past PAR cycles.
      </ErrorNotice>
    );
  }

  const employeeList = employees.data ?? [];

  // Real cycles show every direct report unscoped — resolveEmployeeCycleRating's
  // "No record" fallback communicates who wasn't actually a participant,
  // without waiting on a separate participants fetch first. Legacy still
  // scopes by cycle name since legacyFanOut is already fetched unconditionally.
  const scope = isLegacyCycle
    ? { legacyCycleName: cycleSelection.cycleName, legacyHistoryByEmail: legacyFanOut.byEmail }
    : null;
  const scopedEmployees = filterEmployeesForCycle(employeeList, inputValue, workEmail, scope, selectedEmployee);
  const filteredEmployees = isRealCycle
    ? filterOwnedByLead(scopedEmployees, ratingFanOut.byEmail, workEmail)
    : scopedEmployees;

  const cyclePickerValue = isLegacyCycle ? `legacy-${cycleSelection.cycleName}` : isRealCycle ? String(cycleSelection.parCycleId) : "none";

  const handleCycleChange = (value: string) => {
    setUserChangedCycle(true);
    if (value === "none") {
      setRawCycleSelection({ kind: "none" });
    } else if (value.startsWith("legacy-")) {
      setRawCycleSelection({ kind: "legacy", cycleName: value.slice("legacy-".length) });
    } else {
      setRawCycleSelection({ kind: "real", parCycleId: Number(value) });
    }
    setSelectedEmployee(null);
    setInputValue(ALL_EMPLOYEES_OPTION.employeeName);
    setSelectedFromTable(false);
  };

  const legacyRecords = selectedEmployeeEmail ? (legacyFanOut.byEmail[selectedEmployeeEmail] ?? []) : [];
  const selectedLegacyRecord = isLegacyCycle
    ? legacyRecords.find((record) => record.cycleName === cycleSelection.cycleName)
    : undefined;

  // Legacy feedback is split into per-question rubric segments
  // (questionAnswers replaces the old fixed segment1/segment2 fields); only
  // the employee's own answers get concatenated. The lead's side stays a
  // single overall comment — per-question managerFeedback entries aren't
  // the lead's actual feedback.
  const isMeaningfulLegacyText = (text: string | null | undefined): text is string =>
    Boolean(text) && text!.trim() !== "" && text!.trim() !== "N/A";
  const legacyEmployeeContent = parseLegacyQuestionAnswers(selectedLegacyRecord?.questionAnswers ?? null)
    .map((qa) => qa.employeeAnswer)
    .filter(isMeaningfulLegacyText)
    .join("\n\n");
  const legacyLeadContent = isMeaningfulLegacyText(selectedLegacyRecord?.overallCommentManager)
    ? selectedLegacyRecord!.overallCommentManager!
    : "";

  // Scoped to the selected employee's own fan-out fetch, not whether any of
  // the lead's other reports still has one in flight.
  const legacyIsLoadingForSelected = selectedEmployeeEmail ? (legacyFanOut.isLoadingByEmail[selectedEmployeeEmail] ?? false) : false;

  // Belt-and-suspenders for a table row clicked before filterOwnedByLead
  // could filter it out (see filteredEmployees above).
  const isOwnRecord = !rating.data || rating.data.parLeadEmail === workEmail;

  // "No record" wording stays deliberately vague: the backend can't tell "no
  // rating exists for this cycle" apart from a genuine fetch error here.
  const realCycleNotAvailable =
    isRealCycle &&
    Boolean(selectedEmployeeEmail) &&
    (rating.isError || reviews.isError || (rating.isSuccess && (!rating.data || !isOwnRecord)));
  const legacyCycleNotAvailable =
    isLegacyCycle && Boolean(selectedEmployeeEmail) && !legacyIsLoadingForSelected && !selectedLegacyRecord;

  // Both the rating AND the reviews fetch must succeed, not just the rating
  // — otherwise the details section and the loading skeleton can render at
  // once if the rating resolves first.
  const showRealDetails =
    isRealCycle && Boolean(selectedEmployeeEmail) && rating.isSuccess && Boolean(rating.data) && isOwnRecord && reviews.isSuccess;
  const showLegacyDetails = isLegacyCycle && Boolean(selectedLegacyRecord);

  const isLoadingSelection =
    (isRealCycle && Boolean(selectedEmployeeEmail) && (rating.isLoading || reviews.isLoading)) ||
    (isLegacyCycle && Boolean(selectedEmployeeEmail) && legacyIsLoadingForSelected);

  return (
    <Stack spacing={2}>
      {/* Plain flexbox with flex: 1 on both sides — not MUI Grid's own
          size={{xs,sm}} split, which wasn't holding the two at an equal
          width here. flex: 1 + minWidth: 0 guarantees an even split
          regardless of either field's own content. */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <ComplexSelect
            fullWidth
            disabled={employees.isLoading || realCycles.isLoading || cycleOptions.length === 0}
            value={cyclePickerValue}
            onChange={(e) => handleCycleChange(e.target.value as string)}
          >
            <ComplexSelect.MenuItem value="none">
              {cycleOptions.length === 0 ? "No previous PAR cycles found" : "Please select a PAR cycle"}
            </ComplexSelect.MenuItem>
            {cycleOptions.map((option) => (
              <ComplexSelect.MenuItem
                key={option.key}
                value={option.isLegacy ? `legacy-${option.cycleName}` : String(option.parCycleId)}
              >
                {option.label}
              </ComplexSelect.MenuItem>
            ))}
          </ComplexSelect>
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <ComplexSelect
            fullWidth
            disabled={employees.isLoading || cycleSelection.kind === "none"}
            value={selectedEmployee?.workEmail ?? ALL_EMPLOYEES_OPTION.workEmail}
            onChange={(e) => {
              const value = e.target.value as string;
              if (value === ALL_EMPLOYEES_OPTION.workEmail) {
                setSelectedEmployee(null);
                setInputValue(ALL_EMPLOYEES_OPTION.employeeName);
                setSelectedFromTable(false);
                return;
              }
              const picked = filteredEmployees.find((employee) => employee.workEmail === value);
              if (picked) {
                setSelectedEmployee(picked);
                setInputValue(`${picked.employeeName} (${picked.workEmail})`);
                setSelectedFromTable(false);
              }
            }}
            renderValue={(value) => {
              if (value === ALL_EMPLOYEES_OPTION.workEmail) return ALL_EMPLOYEES_OPTION.employeeName;
              const picked = filteredEmployees.find((employee) => employee.workEmail === value) ?? selectedEmployee;
              return picked ? `${picked.employeeName} (${picked.workEmail})` : "";
            }}
            MenuProps={{ slotProps: { paper: { style: { maxHeight: 400 } } } }}
          >
            <ComplexSelect.MenuItem value={ALL_EMPLOYEES_OPTION.workEmail}>
              <ComplexSelect.MenuItem.Text primary={ALL_EMPLOYEES_OPTION.employeeName} />
            </ComplexSelect.MenuItem>
            {filteredEmployees.map((employee) => (
              <ComplexSelect.MenuItem key={employee.workEmail} value={employee.workEmail}>
                <ComplexSelect.MenuItem.Avatar
                  src={thumbnailByEmail.get(employee.workEmail) || undefined}
                  alt={employee.employeeName}
                />
                <ComplexSelect.MenuItem.Text primary={employee.employeeName} secondary={employee.workEmail} />
              </ComplexSelect.MenuItem>
            ))}
          </ComplexSelect>
        </Box>
      </Stack>

      {/* Not yet cycleDataReady reads as "none" too — a skeleton, not a
          "choose a cycle" prompt implying the lead needs to act. */}
      {cycleSelection.kind === "none" && !cycleDataReady && (
        <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />
      )}

      {cycleSelection.kind === "none" && cycleDataReady && (
        <ParEmptyState text="Choose a PAR cycle to view your team's PAR history." />
      )}

      {cycleSelection.kind !== "none" && !selectedEmployeeEmail && (
        <AllEmployeesTable
          employees={filteredEmployees}
          thumbnailByEmail={thumbnailByEmail}
          isRealCycle={isRealCycle}
          legacyCycleName={isLegacyCycle ? cycleSelection.cycleName : undefined}
          legacyByEmail={legacyFanOut.byEmail}
          ratingByEmail={ratingFanOut.byEmail}
          isRatingLoadingByEmail={ratingFanOut.isLoadingByEmail}
          isRatingErrorByEmail={ratingFanOut.isErrorByEmail}
          onRetryRating={(workEmail) => ratingFanOut.refetchByEmail[workEmail]?.()}
          onSelect={(employee) => {
            setSelectedEmployee(employee);
            setInputValue(`${employee.employeeName} (${employee.workEmail})`);
            setSelectedFromTable(true);
          }}
        />
      )}

      {selectedEmployeeEmail && selectedFromTable && (
        <Button
          size="small"
          startIcon={<ArrowLeftIcon size={14} />}
          onClick={() => {
            setSelectedEmployee(null);
            setInputValue(ALL_EMPLOYEES_OPTION.employeeName);
            setSelectedFromTable(false);
          }}
          sx={{ alignSelf: "flex-start" }}
        >
          All employees
        </Button>
      )}

      {isLoadingSelection && <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />}

      {legacyCycleNotAvailable && (
        <ParEmptyState text="Not Available -- this employee has no PAR record for the selected cycle." />
      )}
      {realCycleNotAvailable && (
        <ParEmptyState text="No PAR record found for the selected cycle, or it could not be loaded right now. Try again, or check back later if this seems wrong." />
      )}

      {showLegacyDetails && selectedLegacyRecord && (
        <Stack spacing={2}>
          <Card variant="outlined" sx={{ p: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid size="auto">
                {/* Legacy records carry no thumbnail — matches source's own
                    Avatar here, which never passes a src for this branch. */}
                <Avatar variant="rounded" alt="Employee Thumbnail" sx={{ width: 100, height: 100 }} />
              </Grid>
              {(() => {
                const derived = deriveLegacyRatingFromScore(selectedLegacyRecord.managerScoreCode);
                const rating2 = selectedLegacyRecord.overallRating ?? derived.rating;
                const special = selectedLegacyRecord.overallSpecialRating ?? derived.special;
                return (
                  <Grid size="grow">
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {special && special !== "NOT_ASSIGNED" && <ParStatusChip content={special} />}
                      {rating2 && rating2 !== "NOT_ASSIGNED" && <ParStatusChip content={rating2} />}
                    </Stack>
                    {(selectedLegacyRecord.reviewerEmail || selectedLegacyRecord.reviewerName) && (
                      <Chip
                        size="small"
                        variant="outlined"
                        sx={{ mt: 1 }}
                        label={`PAR shared by: ${selectedLegacyRecord.reviewerEmail ?? selectedLegacyRecord.reviewerName}`}
                      />
                    )}
                  </Grid>
                );
              })()}
              <InfoItem
                label="Employee"
                value={selectedEmployee?.employeeName ?? selectedLegacyRecord.employeeEmail}
                secondaryValue={selectedLegacyRecord.employeeEmail}
              />
              <InfoItem
                label="Lead"
                value={selectedLegacyRecord.reviewerName ?? selectedLegacyRecord.reviewerEmail ?? ""}
                secondaryValue={selectedLegacyRecord.reviewerEmail ?? ""}
              />
              <InfoItem
                label="Team"
                value={selectedLegacyRecord.team ?? ""}
                secondaryValue={selectedLegacyRecord.department ?? ""}
              />
            </Grid>
          </Card>

          <Accordion variant="outlined" disabled={!legacyEmployeeContent}>
            <AccordionSummary expandIcon={<ChevronDownIcon size={18} />}>Employee PAR</AccordionSummary>
            <AccordionDetails>
              <Divider sx={{ my: 1 }} />
              <ParCommentView html={legacyEmployeeContent} />
            </AccordionDetails>
          </Accordion>
          <Accordion variant="outlined" disabled={!legacyLeadContent}>
            <AccordionSummary expandIcon={<ChevronDownIcon size={18} />}>Lead's Feedback</AccordionSummary>
            <AccordionDetails>
              <Divider sx={{ my: 1 }} />
              <ParCommentView html={legacyLeadContent} />
            </AccordionDetails>
          </Accordion>

          <ParLegacyReviewSection feedback360={selectedLegacyRecord.feedback360} />
        </Stack>
      )}

      {showRealDetails && rating.data && (
        <Stack spacing={2}>
          <Card variant="outlined" sx={{ p: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid size="auto">
                <Avatar
                  variant="rounded"
                  src={selectedEmployeeEmail ? thumbnailByEmail.get(selectedEmployeeEmail) : undefined}
                  alt="Employee Thumbnail"
                  sx={{ width: 100, height: 100 }}
                />
              </Grid>
              <Grid size="grow">
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {rating.data.parSpecialRating && rating.data.parSpecialRating !== "NOT_ASSIGNED" && (
                    <ParStatusChip content={rating.data.parSpecialRating} />
                  )}
                  {rating.data.parRating && rating.data.parRating !== "NOT_ASSIGNED" && (
                    <ParStatusChip content={rating.data.parRating} />
                  )}
                </Stack>
                {rating.data.parRatingSharedBy && (
                  <Chip
                    size="small"
                    variant="outlined"
                    sx={{ mt: 1 }}
                    label={`PAR shared by: ${rating.data.parRatingSharedBy}`}
                  />
                )}
              </Grid>
              <InfoItem
                label="Employee"
                value={selectedEmployee?.employeeName ?? selectedEmployeeEmail ?? ""}
                secondaryValue={selectedEmployeeEmail ?? ""}
              />
              <InfoItem label="Lead" value={rating.data.parLeadEmail ?? ""} secondaryValue={rating.data.parLeadEmail ?? ""} />
              <InfoItem label="Team" value={rating.data.parTeam ?? ""} secondaryValue={rating.data.parDepartment ?? ""} />
            </Grid>
          </Card>

          <Accordion variant="outlined" disabled={!rating.data.parEmployeeComment?.trim()}>
            <AccordionSummary expandIcon={<ChevronDownIcon size={18} />}>Employee PAR</AccordionSummary>
            <AccordionDetails>
              <Divider sx={{ my: 1 }} />
              <ParCommentView html={decodeParComment(rating.data.parEmployeeComment)} />
            </AccordionDetails>
          </Accordion>
          <Accordion variant="outlined" disabled={!rating.data.parLeadComment?.trim()}>
            <AccordionSummary expandIcon={<ChevronDownIcon size={18} />}>Lead's Feedback</AccordionSummary>
            <AccordionDetails>
              <Divider sx={{ my: 1 }} />
              <ParCommentView html={decodeParComment(rating.data.parLeadComment)} />
            </AccordionDetails>
          </Accordion>

          <ParHistoryReviewSection reviews={reviews.data ?? []} />
        </Stack>
      )}
    </Stack>
  );
}
