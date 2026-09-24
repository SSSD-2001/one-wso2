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

import { useState, type ReactNode } from "react";
import {
  Alert,
  Autocomplete,
  AdapterDateFns,
  Box,
  Button,
  CircularProgress,
  DataGrid,
  DatePickers,
  Dialog,
  Divider,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Link,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { CheckIcon, HistoryIcon, PencilIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import type { UmtUpdateSummary, UmtWorstCaseEstimateLogEntry } from "../api/umtUpdates";
import type { UmtUpdateFieldChange } from "../api/useUmtUpdateFieldMutation";
import { useUmtWorstCaseEstimateLog } from "../api/useUmtWorstCaseEstimateLog";
import { formatCalendarDate, formatTimestamp } from "../lib/umtDates";

const { DatePicker, LocalizationProvider } = DatePickers;
const { DataGrid: DataGridComponent } = DataGrid;

// The Update Information detail grid — shared by the View tab (editable, per
// role/lifecycle rules) and the Edit tab's Verifying step (always read-only).
// canEdit gates whether the edit affordances render at all, so onSave never
// actually fires for a read-only caller; it's optional purely so such a
// caller doesn't have to fabricate a handler that's never called.
export default function UmtUpdateDetailsGrid({
  id,
  update,
  loading,
  canEdit,
  userEmails = [],
  userEmailsLoading = false,
  savingField,
  onSave = async () => {},
}: {
  id: string;
  update: UmtUpdateSummary | undefined;
  loading: boolean;
  canEdit: boolean;
  userEmails?: string[];
  userEmailsLoading?: boolean;
  savingField?: UmtUpdateFieldChange["field"];
  onSave?: (change: UmtUpdateFieldChange) => Promise<void>;
}) {
  return (
    <Stack divider={<Divider flexItem />} spacing={2.5}>
      <Grid container spacing={{ xs: 2, md: 3 }} alignItems="flex-start">
        <UpdateField label="ServiceNow Case ID" loading={loading} value={update?.caseId} />
        <UpdateField label="WSO2 Case ID" loading={loading} value={update?.wso2CaseId} />
        <UpdateField label="Internal GitHub Issue" loading={loading}>
          <GitHubIssueLink value={update?.internalGitIssue} />
        </UpdateField>
        <UpdateField label="Security Internal GitHub Issue" loading={loading}>
          <GitHubIssueLink value={update?.securityInternalGitIssue} />
        </UpdateField>
      </Grid>

      <Grid container spacing={{ xs: 2, md: 3 }} alignItems="flex-start">
        <UpdateField
          label="Report Timestamp"
          loading={loading}
          value={formatTimestamp(update?.reportedDate)}
        />
        <UpdateField label="Reporter" loading={loading} value={update?.reporter} />
        <EditableUserField
          field="developedBy"
          label="Developed By"
          loading={loading}
          value={update?.developedBy}
          canEdit={canEdit}
          options={userEmails}
          optionsLoading={userEmailsLoading}
          saving={savingField === "developedBy"}
          onSave={onSave}
        />
        <EditableUserField
          field="assignedTo"
          label="Assigned To"
          loading={loading}
          value={update?.assignedTo}
          canEdit={canEdit}
          options={userEmails}
          optionsLoading={userEmailsLoading}
          saving={savingField === "assignedTo"}
          onSave={onSave}
        />
      </Grid>

      <Grid container spacing={{ xs: 2, md: 3 }} alignItems="flex-start">
        <UpdateField
          label="Best Case Date"
          loading={loading}
          value={formatCalendarDate(update?.bestCaseEstimate)}
        />
        <UpdateField
          label="Most Likely Date"
          loading={loading}
          value={formatCalendarDate(update?.mostLikelyEstimate)}
        />
        <EditableWorstCaseDate
          id={id}
          label="Worst Case Date"
          loading={loading}
          value={update?.worstCaseEstimate}
          canEdit={canEdit}
          saving={savingField === "worstCaseEstimate"}
          onSave={onSave}
        />
      </Grid>

      <Grid container spacing={{ xs: 2, md: 3 }} alignItems="flex-start">
        <UpdateField
          label="Last Updated Timestamp"
          loading={loading}
          value={formatTimestamp(update?.lastUpdatedTimestamp)}
        />
        <UpdateField label="Last Updated User" loading={loading} value={update?.lastUpdatedUser} />
        <UpdateField
          label="Highlight Instructions"
          loading={loading}
          value={update?.highlightInstructions}
        />
        <UpdateField
          label="QA Artifacts Location"
          loading={loading}
          value={update?.qaArtifactsLocation}
        />
      </Grid>
    </Stack>
  );
}

function EditableUserField({
  field,
  label,
  value,
  loading,
  canEdit,
  options,
  optionsLoading,
  saving,
  onSave,
}: {
  field: "assignedTo" | "developedBy";
  label: string;
  value: string | null | undefined;
  loading: boolean;
  canEdit: boolean;
  options: string[];
  optionsLoading: boolean;
  saving: boolean;
  onSave: (change: UmtUpdateFieldChange) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string | null>(value ?? null);

  // The lifecycle state can move off Development (a background refetch, another
  // user's transition) while a field is open for editing. Close the editor
  // rather than leaving a Save that no longer reflects an allowed action.
  const [lastCanEdit, setLastCanEdit] = useState(canEdit);
  if (canEdit !== lastCanEdit) {
    setLastCanEdit(canEdit);
    if (!canEdit) {
      setEditing(false);
      setDraft(value ?? null);
    }
  }

  const cancel = () => {
    setDraft(value ?? null);
    setEditing(false);
  };

  const save = async () => {
    if (!draft?.trim()) return;
    try {
      await onSave({ field, value: draft.trim() });
      setEditing(false);
    } catch {
      // The page-level notification explains the backend error. Keep the
      // editor open so the user can correct the value or retry.
    }
  };

  return (
    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
      {!editing ? (
        <>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          {loading ? (
            <Skeleton width="70%" />
          ) : (
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", minWidth: 0 }}>
              <Typography variant="body1" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
                {displayValue(value)}
              </Typography>
              {canEdit && (
                <Tooltip title={`Edit ${label}`}>
                  <IconButton
                    aria-label={`Edit ${label}`}
                    size="small"
                    disabled={optionsLoading}
                    onClick={() => {
                      setDraft(value ?? null);
                      setEditing(true);
                    }}
                  >
                    <PencilIcon size={16} />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          )}
        </>
      ) : (
        <Stack spacing={1}>
          <Autocomplete<string, false, false, false>
            disablePortal
            loading={optionsLoading}
            options={options}
            value={draft}
            onChange={(_event, newValue) => setDraft(newValue)}
            renderInput={(params) => <TextField {...params} label={label} required size="small" />}
          />
          <EditActions
            label={label}
            saving={saving}
            saveDisabled={!draft?.trim()}
            onCancel={cancel}
            onSave={() => void save()}
          />
        </Stack>
      )}
    </Grid>
  );
}

function EditableWorstCaseDate({
  id,
  label,
  value,
  loading,
  canEdit,
  saving,
  onSave,
}: {
  id: string;
  label: string;
  value: string | null | undefined;
  loading: boolean;
  canEdit: boolean;
  saving: boolean;
  onSave: (change: UmtUpdateFieldChange) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [draft, setDraft] = useState<Date | null>(() => parseDate(value));
  const etaLog = useUmtWorstCaseEstimateLog(id, logOpen);

  // Same reasoning as EditableUserField above.
  const [lastCanEdit, setLastCanEdit] = useState(canEdit);
  if (canEdit !== lastCanEdit) {
    setLastCanEdit(canEdit);
    if (!canEdit) {
      setEditing(false);
      setDraft(parseDate(value));
    }
  }

  const cancel = () => {
    setDraft(parseDate(value));
    setEditing(false);
  };

  const save = async () => {
    if (!draft || Number.isNaN(draft.getTime())) return;
    try {
      await onSave({ field: "worstCaseEstimate", value: toDateInputValue(draft) });
      setEditing(false);
    } catch {
      // The page-level notification explains the backend error. Keep the
      // editor open so the user can correct the date or retry.
    }
  };

  return (
    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
      {!editing ? (
        <>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          {loading ? (
            <Skeleton width="70%" />
          ) : (
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {formatCalendarDate(value)}
              </Typography>
              {canEdit && (
                <Tooltip title={`Edit ${label}`}>
                  <IconButton
                    aria-label={`Edit ${label}`}
                    size="small"
                    onClick={() => {
                      setDraft(parseDate(value));
                      setEditing(true);
                    }}
                  >
                    <PencilIcon size={16} />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="ETA log">
                <IconButton
                  aria-label="View ETA log"
                  size="small"
                  onClick={() => setLogOpen(true)}
                >
                  <HistoryIcon size={16} />
                </IconButton>
              </Tooltip>
            </Stack>
          )}
        </>
      ) : (
        <Stack spacing={1}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label={label}
              value={draft}
              onChange={setDraft}
              minDate={parseDate(value) ?? new Date()}
              shouldDisableDate={(date) => date.getDay() !== 4}
              slotProps={{ textField: { required: true, size: "small" } }}
            />
          </LocalizationProvider>
          <EditActions
            label={label}
            saving={saving}
            saveDisabled={!draft || Number.isNaN(draft.getTime())}
            onCancel={cancel}
            onSave={() => void save()}
          />
        </Stack>
      )}
      <EtaLogDialog
        open={logOpen}
        entries={etaLog.data ?? []}
        loading={etaLog.isPending}
        error={etaLog.isError}
        onClose={() => setLogOpen(false)}
        onRetry={() => void etaLog.refetch()}
      />
    </Grid>
  );
}

function EtaLogDialog({
  open,
  entries,
  loading,
  error,
  onClose,
  onRetry,
}: {
  open: boolean;
  entries: UmtWorstCaseEstimateLogEntry[];
  loading: boolean;
  error: boolean;
  onClose: () => void;
  onRetry: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>ETA Log</DialogTitle>
      <DialogContent>
        {loading ? (
          <Stack sx={{ alignItems: "center", py: 5 }}>
            <CircularProgress size={24} />
          </Stack>
        ) : error ? (
          <Alert
            severity="error"
            action={<Button color="inherit" size="small" onClick={onRetry}>Retry</Button>}
          >
            Couldn&apos;t load the ETA log.
          </Alert>
        ) : (
          <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, maxHeight: 400, overflow: "auto" }}>
            <DataGridComponent
              autoHeight
              columnHeaderHeight={40}
              columns={etaLogColumns}
              disableRowSelectionOnClick
              getRowHeight={() => "auto"}
              hideFooter
              rows={entries.map((entry, index) => ({
                // `index` unconditionally, not just as a fallback: two log
                // entries can share a non-null timestamp (second-precision
                // collisions, a batch backfill), and duplicate DataGrid ids
                // silently drop a row.
                id: `${entry.updateId}-${entry.timestamp ?? "unknown"}-${index}`,
                ...entry,
              }))}
              slots={{ noRowsOverlay: EtaLogEmptyState }}
              sx={etaLogGridSx}
            />
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

const etaLogColumns: DataGrid.GridColDef[] = [
  etaLogColumn("oldDate", "Old Date", 140, formatCalendarDate),
  etaLogColumn("newDate", "New Date", 140, formatCalendarDate),
  etaLogColumn("timestamp", "Updated Timestamp", 200, formatTimestamp),
  etaLogColumn("changedBy", "Changed By", 180, displayValue),
];

function etaLogColumn(
  field: keyof UmtWorstCaseEstimateLogEntry,
  headerName: string,
  minWidth: number,
  format: (value: string | null | undefined) => string,
): DataGrid.GridColDef {
  return {
    field,
    flex: 1,
    headerName,
    minWidth,
    sortable: false,
    renderCell: (params) => (
      <Stack sx={{ justifyContent: "center", minHeight: "100%", py: 0.75, width: "100%" }}>
        {format(params.row[field] as string | null | undefined)}
      </Stack>
    ),
  };
}

function EtaLogEmptyState() {
  return <Typography color="text.secondary">No ETA changes recorded.</Typography>;
}

const etaLogGridSx = { border: 0, minHeight: 100 } as const;

function EditActions({
  label,
  saving,
  saveDisabled,
  onCancel,
  onSave,
}: {
  label: string;
  saving: boolean;
  saveDisabled: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
      <Tooltip title="Save">
        <span>
          <IconButton
            aria-label={`Save ${label}`}
            color="primary"
            disabled={saving || saveDisabled}
            size="small"
            onClick={onSave}
          >
            {saving ? <CircularProgress color="inherit" size={16} /> : <CheckIcon size={17} />}
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Cancel">
        <span>
          <IconButton
            aria-label={`Cancel editing ${label}`}
            disabled={saving}
            size="small"
            onClick={onCancel}
          >
            <XIcon size={17} />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );
}

function UpdateField({
  label,
  value,
  loading,
  children,
}: {
  label: string;
  value?: string | number | null;
  loading: boolean;
  children?: ReactNode;
}) {
  return (
    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      {loading ? (
        <Skeleton width="70%" />
      ) : (
        children ?? (
          <Typography variant="body1" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
            {displayValue(value)}
          </Typography>
        )
      )}
    </Grid>
  );
}

function GitHubIssueLink({ value }: { value: string | null | undefined }) {
  const url = displayValue(value);

  if (url === "N/A" || !url.includes("internal/")) {
    return (
      <Typography variant="body1" sx={{ fontWeight: 600 }}>
        {displayValue(undefined)}
      </Typography>
    );
  }

  const parts = url.split("/");
  const repository = parts[4];
  const issueNumber = parts.at(-1);

  return (
    <Link
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      underline="hover"
      sx={{ fontWeight: 600 }}
    >
      {repository && issueNumber ? `${repository}#${issueNumber}` : url}
    </Link>
  );
}

// Rebuild the UTC calendar day as a local-midnight Date: the DatePicker and
// `shouldDisableDate` both read local fields, so the day-of-week check and the
// displayed day have to agree with the UTC day the backend stored.
function parseDate(value: string | null | undefined): Date | null {
  const normalizedValue = displayValue(value);
  if (normalizedValue === "N/A") return null;
  const parsed = new Date(normalizedValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "N/A";
  const normalizedValue = String(value).trim();
  return normalizedValue || "N/A";
}
