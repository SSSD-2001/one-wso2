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

import { useEffect, useRef, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  Link,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { ChevronDownIcon, ExternalLinkIcon, FileDownIcon, Google, PencilIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { describeError } from "@api/errors";
import {
  evidenceEnabledRating as defaultEvidenceEnabledRating,
  top5p20pEnabledRating as defaultTop5p20pEnabledRating,
} from "@config/apiConfig";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useParRating } from "../api/useParData";
import { useLeadRatingUpdate } from "../api/useLeadRatingUpdate";
import { useParEmployeeReviews } from "../api/useLeadHistory";
import { useGoogleDrivePicker } from "../hooks/useGoogleDrivePicker";
import { decodeParComment, encodeParComment, isEmptyHtml } from "../util/parComment";
import { isDeadlinePassed } from "../util/parDeadline";
import { formatShortDate } from "../util/parDate";
import { downloadParPdf } from "../util/parPdf";
import { parseSavedUrls, type DriveFile } from "../util/parDriveFile";
import ParRichTextField from "./ParRichTextField";
import { ParCommentView } from "./ParContent";
import ParDriveFileChip from "./ParDriveFileChip";
import ParEmptyState from "./ParEmptyState";
import ParHistoryReviewSection from "./ParHistoryReviewSection";
import type { ParCycle } from "../api/types";

// Ports LeadReviewPanel.tsx's lead-only path, plus (via `isAdminView`) its
// isAdminAuditViewOn branch used from the Admin Portal's Employee View/Team
// View "Review" action. Not ported even in admin mode: editing the
// employee's own comment on their behalf — the "Update Status" tab is a
// sibling tab (ParUpdateStatusPanel), not part of this panel.
export default function ParLeadReviewPanel({
  cycle,
  employeeEmail,
  isAdminView = false,
}: {
  cycle: ParCycle;
  employeeEmail: string;
  isAdminView?: boolean;
}) {
  const rating = useParRating(cycle.parCycleId, employeeEmail);
  const ratingUpdate = useLeadRatingUpdate(cycle.parCycleId);
  const reviews = useParEmployeeReviews(cycle.parCycleId, employeeEmail);
  const { showSuccess, showError } = useNotifications();

  // Cycle-scoped value first (not on the wire yet — always undefined until
  // the backend ships it, see the field's own comment in api/types.ts),
  // falling back to the deploy-wide window.config value.
  const top5p20pEnabledRating = cycle.parCycleConfigurations?.top5p20pEnabledRating ?? defaultTop5p20pEnabledRating;
  const evidenceEnabledRating = cycle.parCycleConfigurations?.evidenceEnabledRating ?? defaultEvidenceEnabledRating;

  const [leadComment, setLeadComment] = useState("");
  const [adminComment, setAdminComment] = useState("");
  const [parRatingValue, setParRatingValue] = useState("");
  const [specialRating, setSpecialRating] = useState<"NONE" | "TOP5P" | "TOP20P">("NONE");
  const [specialRatingConfirmed, setSpecialRatingConfirmed] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [evidenceConfirmed, setEvidenceConfirmed] = useState(false);
  const [seededForId, setSeededForId] = useState<number | undefined>(undefined);
  const [autoSaved, setAutoSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // An admin lands on this panel read-only by default — even for a
  // still-in-progress DRAFT/PENDING record — and must explicitly unlock
  // editing via the pencil icon below.
  const [adminForceEdit, setAdminForceEdit] = useState(false);
  const [adminEditConfirmOpen, setAdminEditConfirmOpen] = useState(false);
  const autoSaveTokenRef = useRef(0);

  const parRatingData = rating.data;

  // Seed once per record, so a background refetch doesn't overwrite mid-typing.
  if (parRatingData && parRatingData.parRatingId !== seededForId) {
    setSeededForId(parRatingData.parRatingId);
    setLeadComment(decodeParComment(parRatingData.parLeadComment));
    setAdminComment(decodeParComment(parRatingData.parAdminComment));
    setParRatingValue(parRatingData.parRating && parRatingData.parRating !== "NOT_ASSIGNED" ? parRatingData.parRating : "");
    setSpecialRating((parRatingData.parSpecialRating as "TOP5P" | "TOP20P" | undefined) ?? "NONE");
    setSpecialRatingConfirmed(
      parRatingData.parRating === top5p20pEnabledRating &&
        Boolean(parRatingData.parSpecialRating) &&
        parRatingData.parSpecialRating !== "NONE",
    );
    setDriveFiles(parseSavedUrls(parRatingData.parPerformanceNoticeAck ?? ""));
    // par-app never persists the checkbox itself, only its effect (the
    // attached files) — always seeds unchecked, same as legacy's own
    // initialValues.isEvidenceDiscussionConfirmed: false.
    setEvidenceConfirmed(false);
  }

  useEffect(() => {
    if (parRatingValue !== top5p20pEnabledRating) {
      setSpecialRating("NONE");
      setSpecialRatingConfirmed(false);
    }
    if (parRatingValue !== evidenceEnabledRating) {
      setDriveFiles([]);
      setEvidenceConfirmed(false);
    }
  }, [parRatingValue, top5p20pEnabledRating, evidenceEnabledRating]);

  const { openPicker, isLoading: isPickerLoading, error: pickerError } = useGoogleDrivePicker();

  const handleFilesSelected = (newFiles: DriveFile[]) => {
    setDriveFiles((prev) => {
      const existingIds = new Set(prev.map((f) => f.id));
      return [...prev, ...newFiles.filter((f) => !existingIds.has(f.id))];
    });
  };

  const handleRemoveFile = (fileId: string) => {
    setDriveFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  // Every value below is derived with parRatingData possibly still
  // undefined (loading/error/not-found are handled further down, but hooks
  // must stay unconditional), so the submit/autosave logic guards on it
  // itself rather than relying on an early return to have already happened.
  // Admin edits are gated by the cycle's own closing date rather than the
  // lead's feedback deadline.
  const deadlineDate = isAdminView ? cycle.parCycleEndDate : cycle.parLeadDeadline;
  const deadlinePassed = isDeadlinePassed(deadlineDate);
  const shared = parRatingData?.parLeadStatus === "SHARED";
  const readOnly = isAdminView ? !adminForceEdit : shared || deadlinePassed;
  const savedLeadComment = decodeParComment(parRatingData?.parLeadComment);
  const savedAdminComment = decodeParComment(parRatingData?.parAdminComment);

  const submit = (
    status: "DRAFT" | "SHARED",
    opts?: { silent?: boolean; onSuccess?: () => void; commentOnly?: boolean },
  ) => {
    if (!parRatingData) return;
    ratingUpdate.mutate(
      {
        employeeEmail,
        parRatingId: parRatingData.parRatingId,
        payload: {
          parLeadStatus: status,
          parLeadComment: encodeParComment(leadComment),
          // The autosave fires purely off comment typing and must not also
          // commit whatever the rating dropdowns currently hold — source's
          // own updateParRatingAutoSave has this same bug (parSpecialRating
          // sent unconditionally, clobbering a saved Top 5%/20% allocation
          // the moment someone types a character), so this is a deliberate
          // deviation, not a port gap.
          ...(opts?.commentOnly
            ? {}
            : {
                ...(parRatingValue ? { parRating: parRatingValue } : {}),
                parSpecialRating: specialRating,
                // Omitted entirely rather than sent as "" when there's no
                // evidence — the backend's ParRatingModify constrains this
                // field to a non-empty string whenever it's present at all
                // (types.bal's own [\s\S]*\S[\s\S]* pattern), so an explicit
                // empty string 400s. Source's own updateEmployeeParRating
                // has this same conditional-include for the same reason.
                //
                // One consequence neither side works around: there is no way
                // to CLEAR a saved attachment through this endpoint at all.
                // manager.bal's own isUpdatedString guard
                // (`newValue.trim() != ""`) refuses to apply an empty value
                // as an update even if one got past the constraint above, so
                // removing every file and saving leaves the old URLs on the
                // record — they reappear on the next fetch. Source has this
                // identical gap; fixing it needs a backend change (a real
                // clear operation), not a frontend one.
                ...(driveFiles.length > 0 ? { parPerformanceNoticeAck: driveFiles.map((f) => f.url).join("\n") } : {}),
              }),
          // Only an admin caller may set this field — the backend rejects a
          // non-empty value from anyone else, per checkForModifiableFields-
          // ForLead/-ForSelf.
          ...(isAdminView ? { parAdminComment: encodeParComment(adminComment) } : {}),
        },
      },
      {
        onSuccess: () => {
          if (!opts?.silent) showSuccess(status === "SHARED" ? "Successfully shared" : "Draft saved");
          opts?.onSuccess?.();
        },
        onError: (err) => {
          if (!opts?.silent) showError(describeError(err));
        },
      },
    );
  };

  useEffect(() => {
    // No autosave in admin mode.
    if (!parRatingData || readOnly || isAdminView) return;
    if (isEmptyHtml(leadComment) || leadComment.trim() === savedLeadComment.trim()) return;
    if (ratingUpdate.isPending) return;
    const timer = window.setTimeout(() => {
      const token = ++autoSaveTokenRef.current;
      submit("DRAFT", {
        silent: true,
        commentOnly: true,
        onSuccess: () => {
          if (token !== autoSaveTokenRef.current) return;
          setAutoSaved(true);
          window.setTimeout(() => setAutoSaved(false), 2000);
        },
      });
    }, 5000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadComment, readOnly, ratingUpdate.isPending, parRatingData]);

  if (rating.isLoading) {
    return <Skeleton variant="rectangular" height={360} sx={{ borderRadius: 1.5 }} />;
  }
  if (rating.isError) {
    return (
      <ErrorNotice error={rating.error} onRetry={() => rating.refetch()} retrying={rating.isFetching}>
        Couldn't load this employee's PAR record.
      </ErrorNotice>
    );
  }
  if (!parRatingData) {
    return <Alert severity="info">This employee's record for this cycle isn't ready yet.</Alert>;
  }

  const employeeComment = decodeParComment(parRatingData.parEmployeeComment);

  const dirty =
    leadComment.trim() !== savedLeadComment.trim() ||
    (isAdminView && adminComment.trim() !== savedAdminComment.trim()) ||
    (parRatingValue !== (parRatingData.parRating ?? "") && parRatingValue !== "") ||
    specialRating !== (parRatingData.parSpecialRating ?? "NONE") ||
    driveFiles.map((f) => f.url).join("\n") !== (parRatingData.parPerformanceNoticeAck ?? "");

  const statusAlert = readOnly ? (
    <Alert severity={shared ? "success" : "info"}>
      {shared ? "Lead's feedback is shared with the employee" : "Lead's feedback is not shared with the employee"}
    </Alert>
  ) : parRatingData.parLeadStatus === "DRAFT" ? (
    <Alert severity="warning">
      You have saved your PAR as a draft.{" "}
      {isAdminView
        ? `Please share before the cycle ends: ${formatShortDate(deadlineDate)}.`
        : `Please share on or before the deadline: ${formatShortDate(deadlineDate)}.`}
    </Alert>
  ) : (
    <Alert severity="info">
      {isAdminView
        ? `Please share the lead's feedback before the cycle ends: ${formatShortDate(deadlineDate)}.`
        : `Please share the lead's feedback before the deadline: ${formatShortDate(deadlineDate)}.`}
    </Alert>
  );

  // Save Draft only enables once something has actually changed; Share
  // additionally waits for the employee to have at least started their own
  // side (LeadReviewPanel.tsx:1572-1574 — parEmployeeStatus !== PENDING),
  // and — per its own yup validationSchema (parRating/parLeadComment both
  // "Required" for a non-admin caller) — for a rating to be picked and the
  // comment to be non-empty. The backend doesn't enforce either, so this is
  // the only place that does.
  // In admin mode, the "employee hasn't started yet" gate on Share is
  // removed — an admin can force a rating through regardless of where the
  // employee's own side is.
  const employeeHasStarted = isAdminView || parRatingData.parEmployeeStatus !== "PENDING";
  const canSaveDraft = !readOnly && !deadlinePassed && !ratingUpdate.isPending && dirty;
  const canShare =
    !readOnly &&
    !deadlinePassed &&
    !ratingUpdate.isPending &&
    employeeHasStarted &&
    Boolean(parRatingValue) &&
    !isEmptyHtml(leadComment) &&
    !(parRatingValue === evidenceEnabledRating && (!evidenceConfirmed || driveFiles.length === 0));

  return (
    <Grid container spacing={2}>
      <Grid size={12}>
        <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
          <Box flex={1}>
            {statusAlert}
            {deadlinePassed && !shared && (
              <Alert severity="error" sx={{ mt: 1.5 }}>
                {isAdminView ? "The cycle ended on" : "Lead's feedback deadline is passed on"}:{" "}
                {formatShortDate(deadlineDate)}.
              </Alert>
            )}
          </Box>
          {isAdminView && readOnly && (
            <Tooltip title="Edit PAR details">
              <IconButton aria-label="edit" onClick={() => setAdminEditConfirmOpen(true)}>
                <PencilIcon size={18} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={reviews.isSuccess ? "Download PAR details" : "360° reviews are still loading"}>
            <span>
              <IconButton
                aria-label="download"
                disabled={!reviews.isSuccess}
                onClick={() => downloadParPdf(parRatingData, employeeComment, savedLeadComment, reviews.data)}
              >
                <FileDownIcon size={18} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Card variant="outlined" sx={{ height: "100%" }}>
          <CardHeader title={<Typography variant="h6">Lead's Feedback</Typography>} />
          <CardContent>
            <Stack spacing={2.5}>
              <Box sx={{ position: "relative" }}>
                {readOnly ? (
                  shared ? (
                    <ParCommentView html={savedLeadComment} />
                  ) : (
                    <ParEmptyState
                      text={
                        parRatingData.parLeadStatus === "DRAFT"
                          ? "Lead's feedback has not been shared"
                          : "Lead's feedback is pending"
                      }
                    />
                  )
                ) : (
                  <ParRichTextField value={leadComment} onChange={setLeadComment} placeholder="Enter your comment here" />
                )}
                {autoSaved && (
                  <Typography variant="caption" color="text.secondary" sx={{ position: "absolute", bottom: -20, left: 0 }}>
                    Draft Saved
                  </Typography>
                )}
              </Box>

              {/* Rating + special-rating + who-shared, grouped in one shaded
                  block rather than loose rows — these three are all "the
                  verdict", distinct from the comment above and the actions
                  below. */}
              <Stack spacing={1.5} sx={{ p: 1.75, borderRadius: 1.5, bgcolor: "action.hover" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Typography variant="body2" sx={{ flexShrink: 0, minWidth: 96 }} color="text.secondary">
                    Rating
                  </Typography>
                  {readOnly ? (
                    parRatingData.parRating ? (
                      <Chip size="small" label={parRatingData.parRating} />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        N/A
                      </Typography>
                    )
                  ) : (
                    <TextField
                      select
                      label="Select Rating"
                      size="small"
                      fullWidth
                      value={parRatingValue}
                      onChange={(e) => setParRatingValue(e.target.value)}
                      disabled={ratingUpdate.isPending}
                    >
                      {(cycle.parCycleConfigurations?.parRatings ?? []).map((r) => (
                        <MenuItem key={r} value={r}>
                          {r}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                </Box>

                {parRatingValue === top5p20pEnabledRating && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Typography variant="body2" sx={{ flexShrink: 0, minWidth: 96 }} color="text.secondary">
                      Top 5%/20%
                    </Typography>
                    {readOnly ? (
                      <Chip size="small" label={specialRating} />
                    ) : (
                      <TextField
                        select
                        label="Select Top 5%/20% Rating"
                        size="small"
                        fullWidth
                        value={specialRating}
                        onChange={(e) => setSpecialRating(e.target.value as typeof specialRating)}
                        disabled={!specialRatingConfirmed || ratingUpdate.isPending}
                      >
                        <MenuItem value="NONE">N/A</MenuItem>
                        <MenuItem value="TOP5P">Top 5%</MenuItem>
                        <MenuItem value="TOP20P">Top 20%</MenuItem>
                      </TextField>
                    )}
                  </Box>
                )}

                {!readOnly && parRatingValue === top5p20pEnabledRating && (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={specialRatingConfirmed}
                        onChange={(e) => setSpecialRatingConfirmed(e.target.checked)}
                        disabled={ratingUpdate.isPending}
                      />
                    }
                    label="The Top 5% / 20% rating decision was discussed and finalized with the functional lead"
                    sx={{ "& .MuiFormControlLabel-label": { fontSize: "0.8rem" } }}
                  />
                )}

                {!readOnly && parRatingValue === evidenceEnabledRating && (
                  <Box>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={evidenceConfirmed}
                          onChange={(e) => setEvidenceConfirmed(e.target.checked)}
                          disabled={ratingUpdate.isPending}
                        />
                      }
                      label={`Performance gaps were discussed, and the employee has been informed of the "${evidenceEnabledRating}" rating, and at least two discussions were held.`}
                      sx={{ "& .MuiFormControlLabel-label": { fontSize: "0.8rem" } }}
                    />

                    {pickerError === "ACCESS_DENIED" && (
                      <Alert severity="warning" sx={{ my: 1 }}>
                        Google Drive access was denied. Please try again and grant access when prompted.
                      </Alert>
                    )}
                    {pickerError && pickerError !== "ACCESS_DENIED" && (
                      <Alert severity="warning" sx={{ my: 1 }}>
                        Google sign-in popup was blocked, or the picker couldn't load. Please allow popups for this site and try again.
                      </Alert>
                    )}

                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Google size={16} />}
                      disabled={!evidenceConfirmed || ratingUpdate.isPending || isPickerLoading}
                      onClick={() => openPicker(handleFilesSelected)}
                      sx={{ mt: 1, mb: driveFiles.length > 0 ? 1 : 0 }}
                    >
                      {isPickerLoading ? "Opening…" : driveFiles.length > 0 ? "Attach more files" : "Attach from Google Drive"}
                    </Button>

                    {driveFiles.length > 0 && (
                      <Stack spacing={1}>
                        {driveFiles.map((file) => (
                          <ParDriveFileChip key={file.id} file={file} onRemove={() => handleRemoveFile(file.id)} disabled={ratingUpdate.isPending} />
                        ))}
                      </Stack>
                    )}

                    {evidenceConfirmed && driveFiles.length === 0 && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, display: "block" }}>
                        At least one attached file is required before sharing.
                      </Typography>
                    )}
                  </Box>
                )}

                {readOnly && parRatingData.parPerformanceNoticeAck && parRatingData.parRating === evidenceEnabledRating && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      Performance gaps were discussed, and the employee has been informed of the "{evidenceEnabledRating}" rating, and at least
                      two discussions were held.
                    </Typography>
                    <Stack spacing={0.5}>
                      {parRatingData.parPerformanceNoticeAck
                        .split(/\r?\n/)
                        .filter((line) => line.trim() !== "")
                        .map((line) => (
                          <Link
                            key={line}
                            component="button"
                            variant="body2"
                            onClick={() => window.open(line.trim(), "_blank", "noopener,noreferrer")}
                            sx={{ display: "flex", alignItems: "center", gap: 1, textAlign: "left" }}
                          >
                            <ExternalLinkIcon size={14} />
                            {line}
                          </Link>
                        ))}
                    </Stack>
                  </Box>
                )}

                {readOnly && parRatingData.parRatingSharedBy && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Typography variant="body2" sx={{ flexShrink: 0, minWidth: 96 }} color="text.secondary">
                      Shared by
                    </Typography>
                    <Chip size="small" label={parRatingData.parRatingSharedBy} />
                  </Box>
                )}
              </Stack>

              {!readOnly && (
                <>
                  {!employeeHasStarted && (
                    <Alert severity="warning" sx={{ py: 0.25 }}>
                      Sharing is disabled until the employee's own PAR is started.
                    </Alert>
                  )}
                  <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5, pt: 1, borderTop: 1, borderColor: "divider" }}>
                    <Button variant="outlined" disabled={!canSaveDraft} onClick={() => submit("DRAFT")}>
                      Save draft
                    </Button>
                    <Button variant="contained" disabled={!canShare} onClick={() => setConfirming(true)}>
                      {isAdminView ? "Save and Share" : "Share"}
                    </Button>
                  </Box>
                </>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Card variant="outlined" sx={{ height: "100%" }}>
          <CardHeader title={<Typography variant="h6">Employee PAR</Typography>} />
          <CardContent>
            {employeeComment ? (
              <ParCommentView html={employeeComment} />
            ) : (
              <ParEmptyState text="Employee PAR hasn't been shared" />
            )}
          </CardContent>
        </Card>
      </Grid>

      {isAdminView && (
        <Grid size={12}>
          <Accordion defaultExpanded={Boolean(savedAdminComment)}>
            <AccordionSummary expandIcon={<ChevronDownIcon size={18} />}>
              <Typography variant="h6">Admin Comment</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {readOnly ? (
                savedAdminComment ? (
                  <ParCommentView html={savedAdminComment} />
                ) : (
                  <ParEmptyState text="Admin comment unavailable" />
                )
              ) : (
                <ParRichTextField value={adminComment} onChange={setAdminComment} placeholder="Enter your comment here" />
              )}
            </AccordionDetails>
          </Accordion>
        </Grid>
      )}

      <Grid size={12}>
        {reviews.isLoading ? (
          <Skeleton variant="rectangular" height={72} sx={{ borderRadius: 1.5 }} />
        ) : reviews.isError ? (
          <ErrorNotice error={reviews.error} onRetry={() => reviews.refetch()} retrying={reviews.isFetching}>
            Couldn't load 360° feedback.
          </ErrorNotice>
        ) : (
          <ParHistoryReviewSection reviews={reviews.data ?? []} />
        )}
      </Grid>

      <Dialog open={confirming} onClose={() => setConfirming(false)} maxWidth="md" fullWidth>
        <DialogTitle>Share Lead's Feedback?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This action will share your review with the employee. You can't undo this action.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirming(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={ratingUpdate.isPending}
            onClick={() => submit("SHARED", { onSuccess: () => setConfirming(false) })}
          >
            {ratingUpdate.isPending ? "Sharing…" : "Share"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Warns before an admin force-unlocks editing, worded differently
          when the record is already shared. */}
      <Dialog open={adminEditConfirmOpen} onClose={() => setAdminEditConfirmOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{shared ? "Edit a Shared Review?" : "Edit PAR Details?"}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {shared
              ? "This review has already been shared with the employee. Editing it will change what they see. Do you want to continue?"
              : "This will let you edit the lead's feedback and rating on this employee's behalf. Do you want to continue?"}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAdminEditConfirmOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color={shared ? "warning" : "primary"}
            onClick={() => {
              setAdminForceEdit(true);
              setAdminEditConfirmOpen(false);
            }}
          >
            Edit
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}
