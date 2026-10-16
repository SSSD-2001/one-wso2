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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { useEffect, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  DataGrid,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { PencilIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { INFRA_EYEBROW } from "@constants/infraApps";
import InfraShell from "../components/InfraShell";
import InfraConfirmDialog from "../components/InfraConfirmDialog";
import { primaryBtnSx, secondaryBtnSx } from "../components/infraUi";
import { useInfraGate } from "../api/useInfraGate";
import { useInfraLeads, useInfraOrganizations, useInfraTopics } from "../api/useInfraDirectory";
import {
  useAddDefaultTeam,
  useAddLead,
  useAddOrganization,
  useAddTopic,
  useDeleteDefaultTeam,
  useDeleteLead,
  useDeleteOrganization,
  useDeleteTopic,
  useInfraDefaultTeams,
  useInfraOrganization,
  useSyncOrganization,
  useUpdateDefaultTeam,
  useUpdateLead,
  useUpdateOrganization,
  useUpdateTopic,
  type OrganizationWrite,
} from "../api/useInfraSettings";
import type { InfraDefaultTeam, InfraLead, InfraOrganization, InfraTopic } from "../api/infraTypes";

const PERMISSIONS = ["push", "pull", "triage", "admin"] as const;
const WSO2_EMAIL = /^[A-Za-z0-9._%+-]+@wso2\.com$/;

export default function InfraGitHubSettingsPage() {
  const gate = useInfraGate();
  return (
    <InfraShell
      eyebrow={INFRA_EYEBROW.githubSettings}
      title="GitHub Settings"
      subtitle="Organizations, topics, functional leads, and default teams used by the GitHub forms."
    >
      {gate.isAdmin ? (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr 1fr" },
          }}
        >
          <Box sx={{ gridColumn: { lg: "1 / -1" } }}>
            <OrganizationsCard />
          </Box>
          <LeadsCard />
          <TopicsCard />
          <DefaultTeamsCard />
        </Box>
      ) : (
        <Alert severity="warning">Only admins can manage GitHub settings.</Alert>
      )}
    </InfraShell>
  );
}

function OrganizationsCard() {
  const organizations = useInfraOrganizations();
  const teams = useInfraDefaultTeams();
  const add = useAddOrganization();
  const update = useUpdateOrganization();
  const remove = useDeleteOrganization();
  const sync = useSyncOrganization();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<InfraOrganization | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const editing = useInfraOrganization(editingId);
  const rows = organizations.data ?? [];

  const saveNew = async (values: OrganizationWrite) => {
    await add.mutateAsync(values);
    const refreshed = await organizations.refetch();
    const saved = (refreshed.data ?? []).find((org) => org.organizationName === values.organizationName);
    if (
      saved &&
      values.organizationVisibility === "Private" &&
      saved.organizationPlan === "Free" &&
      saved.organizationVisibility === "Public"
    ) {
      setNotice(`${saved.organizationName} is on the Free plan, so its visibility was set to Public.`);
    }
    setAdding(false);
  };

  return (
    <SettingsCard title="Organizations" onAdd={() => setAdding(true)} error={organizations.error}>
      {notice && (
        <Alert severity="success" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}
      {sync.error != null && (
        <Alert severity="error" onClose={() => sync.reset()}>
          {describeError(sync.error)}
        </Alert>
      )}
      <SettingsGrid
        rows={rows}
        loading={organizations.isFetching}
        getRowId={(row) => row.organizationId}
        columns={[
          { field: "organizationId", headerName: "ID", width: 70 },
          { field: "organizationName", headerName: "Organization Name", flex: 1, minWidth: 160 },
          { field: "organizationVisibility", headerName: "Visibility", width: 110 },
          { field: "organizationPlan", headerName: "Plan", width: 90 },
          { field: "defaultTeams", headerName: "Default Teams", flex: 1.2, minWidth: 160 },
          {
            field: "enableIssues",
            headerName: "Issues",
            width: 90,
            valueFormatter: (value) => (value === true || value === 1 ? "Yes" : "No"),
          },
          {
            field: "actions",
            headerName: "Actions",
            width: 130,
            sortable: false,
            renderCell: (params) => (
              <RowActions
                onEdit={() => setEditingId(params.row.organizationId)}
                onDelete={() => {
                  remove.reset();
                  setDeleting(params.row);
                }}
                onSync={() => sync.mutate(params.row.organizationName)}
              />
            ),
          },
        ]}
      />
      {adding && (
        <OrganizationDialog
          title="Add Organization"
          teams={teams.data ?? []}
          busy={add.isPending}
          error={add.error}
          onClose={() => setAdding(false)}
          onSave={saveNew}
        />
      )}
      {editingId !== null && (
        <OrganizationDialog
          title="Edit Organization"
          teams={teams.data ?? []}
          organization={editing.data}
          loading={editing.isLoading}
          busy={update.isPending}
          error={update.error ?? editing.error}
          onClose={() => setEditingId(null)}
          onSave={async (values) => {
            const current = editing.data;
            if (current?.organizationPlan === "Free" && values.organizationVisibility === "Private") {
              throw new Error("This organization is on the GitHub Free plan. Visibility cannot be Private.");
            }
            await update.mutateAsync({ ...values, organizationId: editingId });
            setEditingId(null);
          }}
        />
      )}
      <InfraConfirmDialog
        open={deleting !== null}
        title="Delete Organization"
        body={
          <>
            {`Delete ${deleting?.organizationName ?? "this organization"}?`}
            {remove.error != null && (
              <Alert severity="error" sx={{ mt: 1.5 }}>
                {describeError(remove.error)}
              </Alert>
            )}
          </>
        }
        confirmLabel="Delete"
        tone="danger"
        busy={remove.isPending}
        onCancel={() => {
          remove.reset();
          setDeleting(null);
        }}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.organizationId, { onSuccess: () => setDeleting(null) });
        }}
      />
    </SettingsCard>
  );
}

function LeadsCard() {
  const leads = useInfraLeads();
  const add = useAddLead();
  const update = useUpdateLead();
  const remove = useDeleteLead();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<InfraLead | null>(null);
  const [deleting, setDeleting] = useState<InfraLead | null>(null);
  return (
    <SettingsCard title="Functional Leads" onAdd={() => setAdding(true)} error={leads.error}>
      <SettingsGrid
        rows={leads.data ?? []}
        loading={leads.isFetching}
        getRowId={(row) => row.leadId}
        columns={[
          { field: "leadEmail", headerName: "Lead Email", flex: 1.2, minWidth: 160 },
          { field: "teamName", headerName: "Team Name", flex: 1, minWidth: 120 },
          actionColumn<InfraLead>((row) => (
            <RowActions
              onEdit={() => setEditing(row)}
              onDelete={() => {
                remove.reset();
                setDeleting(row);
              }}
            />
          )),
        ]}
      />
      {(adding || editing) && (
        <LeadDialog
          lead={editing}
          busy={add.isPending || update.isPending}
          error={add.error ?? update.error}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSave={async (values) => {
            if (!WSO2_EMAIL.test(values.leadEmail)) {
              throw new Error("Email must be a wso2.com address.");
            }
            if (editing) await update.mutateAsync({ ...values, leadId: editing.leadId });
            else await add.mutateAsync(values);
            setAdding(false);
            setEditing(null);
          }}
        />
      )}
      <InfraConfirmDialog
        open={deleting !== null}
        title="Delete Functional Lead"
        body={
          <>
            {`Delete ${deleting?.leadEmail ?? "this lead"}?`}
            {remove.error != null && (
              <Alert severity="error" sx={{ mt: 1.5 }}>
                {describeError(remove.error)}
              </Alert>
            )}
          </>
        }
        confirmLabel="Delete"
        tone="danger"
        busy={remove.isPending}
        onCancel={() => {
          remove.reset();
          setDeleting(null);
        }}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.leadId, { onSuccess: () => setDeleting(null) });
        }}
      />
    </SettingsCard>
  );
}

function TopicsCard() {
  const topics = useInfraTopics();
  const add = useAddTopic();
  const update = useUpdateTopic();
  const remove = useDeleteTopic();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<InfraTopic | null>(null);
  const [deleting, setDeleting] = useState<InfraTopic | null>(null);
  return (
    <SettingsCard title="Repository Topics" onAdd={() => setAdding(true)} error={topics.error}>
      <SettingsGrid
        rows={topics.data ?? []}
        loading={topics.isFetching}
        getRowId={(row) => row.topicId}
        columns={[
          { field: "topicName", headerName: "Topic Name", flex: 1, minWidth: 140 },
          actionColumn<InfraTopic>((row) => (
            <RowActions
              onEdit={() => setEditing(row)}
              onDelete={() => {
                remove.reset();
                setDeleting(row);
              }}
            />
          )),
        ]}
      />
      {(adding || editing) && (
        <NameDialog
          title={editing ? "Edit Topic" : "Add Topic"}
          label="Topic Name"
          initial={editing?.topicName ?? ""}
          busy={add.isPending || update.isPending}
          error={add.error ?? update.error}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSave={async (topicName) => {
            if (editing) await update.mutateAsync({ topicId: editing.topicId, topicName });
            else await add.mutateAsync({ topicName });
            setAdding(false);
            setEditing(null);
          }}
        />
      )}
      <InfraConfirmDialog
        open={deleting !== null}
        title="Delete Topic"
        body={
          <>
            {`Delete ${deleting?.topicName ?? "this topic"}?`}
            {remove.error != null && (
              <Alert severity="error" sx={{ mt: 1.5 }}>
                {describeError(remove.error)}
              </Alert>
            )}
          </>
        }
        confirmLabel="Delete"
        tone="danger"
        busy={remove.isPending}
        onCancel={() => {
          remove.reset();
          setDeleting(null);
        }}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.topicId, { onSuccess: () => setDeleting(null) });
        }}
      />
    </SettingsCard>
  );
}

function DefaultTeamsCard() {
  const teams = useInfraDefaultTeams();
  const add = useAddDefaultTeam();
  const update = useUpdateDefaultTeam();
  const remove = useDeleteDefaultTeam();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<InfraDefaultTeam | null>(null);
  const [deleting, setDeleting] = useState<InfraDefaultTeam | null>(null);
  return (
    <SettingsCard title="Default Teams" onAdd={() => setAdding(true)} error={teams.error}>
      <SettingsGrid
        rows={teams.data ?? []}
        loading={teams.isFetching}
        getRowId={(row) => row.teamId}
        columns={[
          { field: "teamName", headerName: "Team Name", flex: 1, minWidth: 140 },
          { field: "permissionLevel", headerName: "Permission", width: 120 },
          actionColumn<InfraDefaultTeam>((row) => (
            <RowActions
              onEdit={() => setEditing(row)}
              onDelete={() => {
                remove.reset();
                setDeleting(row);
              }}
            />
          )),
        ]}
      />
      {(adding || editing) && (
        <TeamDialog
          team={editing}
          busy={add.isPending || update.isPending}
          error={add.error ?? update.error}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSave={async (values) => {
            if (editing) await update.mutateAsync({ ...values, teamId: editing.teamId });
            else await add.mutateAsync(values);
            setAdding(false);
            setEditing(null);
          }}
        />
      )}
      <InfraConfirmDialog
        open={deleting !== null}
        title="Delete Default Team"
        body={
          <>
            {`Delete ${deleting?.teamName ?? "this team"}?`}
            {remove.error != null && (
              <Alert severity="error" sx={{ mt: 1.5 }}>
                {describeError(remove.error)}
              </Alert>
            )}
          </>
        }
        confirmLabel="Delete"
        tone="danger"
        busy={remove.isPending}
        onCancel={() => {
          remove.reset();
          setDeleting(null);
        }}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.teamId, { onSuccess: () => setDeleting(null) });
        }}
      />
    </SettingsCard>
  );
}

function teamIdsFrom(organization?: InfraOrganization): number[] {
  return (organization?.teamIds ?? "")
    .split(",")
    .map((id) => Number(id.trim()))
    .filter((id) => Number.isFinite(id) && id > 0);
}

function OrganizationDialog({
  title,
  teams,
  organization,
  loading,
  busy,
  error,
  onClose,
  onSave,
}: {
  title: string;
  teams: InfraDefaultTeam[];
  organization?: InfraOrganization;
  loading?: boolean;
  busy: boolean;
  error: unknown;
  onClose: () => void;
  onSave: (values: OrganizationWrite) => Promise<void>;
}) {
  const [name, setName] = useState(organization?.organizationName ?? "");
  const [visibility, setVisibility] = useState(organization?.organizationVisibility ?? "Public");
  const [issues, setIssues] = useState(
    organization ? organization.enableIssues === true || organization.enableIssues === 1 : true,
  );
  const [teamIds, setTeamIds] = useState<number[]>(teamIdsFrom(organization));
  const [formError, setFormError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const freePlan = organization?.organizationPlan === "Free";

  useEffect(() => {
    if (!organization) return;
    setName(organization.organizationName);
    setVisibility(organization.organizationVisibility || "Public");
    setIssues(organization.enableIssues === true || organization.enableIssues === 1);
    setTeamIds(teamIdsFrom(organization));
  }, [organization]);

  const submit = async () => {
    if (!name.trim() || !visibility) {
      setFormError("Organization name and visibility are required.");
      return;
    }
    setFormError(null);
    try {
      await onSave({
        organizationName: name.trim(),
        organizationVisibility: visibility,
        enableIssues: issues,
        teamIds,
      });
    } catch (caught) {
      setFormError(describeError(caught));
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {loading ? (
          <CircularProgress size={22} />
        ) : (
          <Stack spacing={2} sx={{ pt: 1 }}>
            {freePlan && (
              <Alert severity="info">
                This organization is on the GitHub Free plan. Only Public visibility is allowed.
              </Alert>
            )}
            {!organization && visibility === "Private" && (
              <Alert severity="warning">
                This organization may be on the GitHub Free plan. If so, its visibility will be changed to Public during sync.
              </Alert>
            )}
            <TextField
              label="Organization Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              size="small"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Visibility</InputLabel>
              <Select label="Visibility" value={visibility} onChange={(event) => setVisibility(event.target.value)}>
                <MenuItem value="Public">Public</MenuItem>
                <MenuItem value="Private">Private</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel shrink>Default Teams</InputLabel>
              <Select
                label="Default Teams"
                multiple
                displayEmpty
                value={teamIds}
                onChange={(event) => {
                  const value = event.target.value;
                  setTeamIds(typeof value === "string" ? value.split(",").map(Number) : value);
                }}
              >
                {teams.map((team) => (
                  <MenuItem key={team.teamId} value={team.teamId}>
                    {team.teamName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Allow Issues</InputLabel>
              <Select
                label="Allow Issues"
                value={issues ? "true" : "false"}
                onChange={(event) => setIssues(event.target.value === "true")}
              >
                <MenuItem value="true">Yes</MenuItem>
                <MenuItem value="false">No</MenuItem>
              </Select>
            </FormControl>
            {(formError || error != null) && (
              <Alert severity="error">{formError ?? describeError(error)}</Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={secondaryBtnSx}>
          Cancel
        </Button>
        <Button variant="outlined" sx={primaryBtnSx} disabled={busy || loading} onClick={() => setConfirming(true)}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
      <InfraConfirmDialog
        open={confirming}
        title={title}
        body={`Save ${name.trim() || "this organization"}?`}
        confirmLabel="Save"
        busy={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void submit();
        }}
      />
    </Dialog>
  );
}

function LeadDialog({
  lead,
  busy,
  error,
  onClose,
  onSave,
}: {
  lead: InfraLead | null;
  busy: boolean;
  error: unknown;
  onClose: () => void;
  onSave: (values: { leadEmail: string; teamName: string }) => Promise<void>;
}) {
  const [leadEmail, setLeadEmail] = useState(lead?.leadEmail ?? "");
  const [teamName, setTeamName] = useState(lead?.teamName ?? "");
  const [formError, setFormError] = useState<string | null>(null);
  return (
    <FieldDialog
      title={lead ? "Edit Functional Lead" : "Add Functional Lead"}
      busy={busy}
      errorText={formError ?? (error ? describeError(error) : null)}
      onClose={onClose}
      onSave={async () => {
        if (!leadEmail.trim() || !teamName.trim()) {
          setFormError("Lead email and team name are required.");
          return;
        }
        setFormError(null);
        try {
          await onSave({ leadEmail: leadEmail.trim(), teamName: teamName.trim() });
        } catch (caught) {
          setFormError(describeError(caught));
        }
      }}
    >
      <TextField
        label="Lead Email"
        value={leadEmail}
        onChange={(event) => setLeadEmail(event.target.value)}
        size="small"
        fullWidth
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <TextField
        label="Team Name"
        value={teamName}
        onChange={(event) => setTeamName(event.target.value)}
        size="small"
        fullWidth
        slotProps={{ inputLabel: { shrink: true } }}
      />
    </FieldDialog>
  );
}

function TeamDialog({
  team,
  busy,
  error,
  onClose,
  onSave,
}: {
  team: InfraDefaultTeam | null;
  busy: boolean;
  error: unknown;
  onClose: () => void;
  onSave: (values: { teamName: string; permissionLevel: string }) => Promise<void>;
}) {
  const [teamName, setTeamName] = useState(team?.teamName ?? "");
  const [permissionLevel, setPermissionLevel] = useState(team?.permissionLevel ?? "push");
  const [formError, setFormError] = useState<string | null>(null);
  return (
    <FieldDialog
      title={team ? "Edit Default Team" : "Add Default Team"}
      busy={busy}
      errorText={formError ?? (error ? describeError(error) : null)}
      onClose={onClose}
      onSave={async () => {
        if (!teamName.trim() || !permissionLevel) {
          setFormError("Team name and permission are required.");
          return;
        }
        setFormError(null);
        await onSave({ teamName: teamName.trim(), permissionLevel });
      }}
    >
      <TextField
        label="Team Name"
        value={teamName}
        onChange={(event) => setTeamName(event.target.value)}
        size="small"
        fullWidth
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <FormControl size="small" fullWidth>
        <InputLabel>Permission Level</InputLabel>
        <Select
          label="Permission Level"
          value={permissionLevel}
          onChange={(event) => setPermissionLevel(event.target.value)}
        >
          {PERMISSIONS.map((level) => (
            <MenuItem key={level} value={level}>
              {level}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </FieldDialog>
  );
}

function NameDialog({
  title,
  label,
  initial,
  busy,
  error,
  onClose,
  onSave,
}: {
  title: string;
  label: string;
  initial: string;
  busy: boolean;
  error: unknown;
  onClose: () => void;
  onSave: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [formError, setFormError] = useState<string | null>(null);
  return (
    <FieldDialog
      title={title}
      busy={busy}
      errorText={formError ?? (error ? describeError(error) : null)}
      onClose={onClose}
      onSave={async () => {
        if (!value.trim()) {
          setFormError(`${label} is required.`);
          return;
        }
        setFormError(null);
        await onSave(value.trim());
      }}
    >
      <TextField 
        label={label} 
        value={value} 
        onChange={(event) => setValue(event.target.value)} 
        size="small" 
        fullWidth 
        slotProps={{ inputLabel: { shrink: true } }} 
      />
    </FieldDialog>
  );
}

function FieldDialog({
  title,
  busy,
  errorText,
  onClose,
  onSave,
  children,
}: {
  title: string;
  busy: boolean;
  errorText: string | null;
  onClose: () => void;
  onSave: () => Promise<void>;
  children: ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {children}
          {errorText && <Alert severity="error">{errorText}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={secondaryBtnSx}>
          Cancel
        </Button>
        <Button variant="outlined" sx={primaryBtnSx} disabled={busy} onClick={() => setConfirming(true)}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
      <InfraConfirmDialog
        open={confirming}
        title={title}
        body="Save this change?"
        confirmLabel="Save"
        busy={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void onSave();
        }}
      />
    </Dialog>
  );
}

function SettingsCard({
  title,
  onAdd,
  error,
  children,
}: {
  title: string;
  onAdd: () => void;
  error: unknown;
  children: ReactNode;
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" sx={{ alignItems: "center", mb: 1.5 }}>
          <Typography sx={{ fontWeight: 700, flex: 1 }}>{title}</Typography>
          <Button size="small" variant="outlined" startIcon={<PlusIcon size={14} />} sx={primaryBtnSx} onClick={onAdd}>
            Add
          </Button>
        </Stack>
        {error ? <Alert severity="error">{describeError(error)}</Alert> : children}
      </CardContent>
    </Card>
  );
}

function SettingsGrid<T extends DataGrid.GridValidRowModel>({
  rows,
  columns,
  loading,
  getRowId,
}: {
  rows: T[];
  columns: DataGrid.GridColDef<T>[];
  loading: boolean;
  getRowId: (row: T) => number;
}) {
  return (
    <DataGrid.DataGrid
      rows={rows}
      columns={columns}
      getRowId={getRowId}
      loading={loading}
      disableRowSelectionOnClick
      pageSizeOptions={[5, 10, 25]}
      initialState={{ pagination: { paginationModel: { pageSize: 5 } } }}
      sx={{ border: "none", height: 360 }}
    />
  );
}

function actionColumn<T extends DataGrid.GridValidRowModel>(
  render: (row: T) => ReactNode,
): DataGrid.GridColDef<T> {
  return {
    field: "actions",
    headerName: "Actions",
    width: 100,
    sortable: false,
    renderCell: (params) => render(params.row),
  };
}

function RowActions({
  onEdit,
  onDelete,
  onSync,
}: {
  onEdit: () => void;
  onDelete: () => void;
  onSync?: () => void;
}) {
  return (
    <Stack direction="row" sx={{ alignItems: "center", height: "100%" }}>
      <Tooltip title="Edit">
        <IconButton aria-label="Edit" size="small" color="primary" onClick={onEdit}>
          <PencilIcon size={16} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Delete">
        <IconButton aria-label="Delete" size="small" color="error" onClick={onDelete}>
          <Trash2Icon size={16} />
        </IconButton>
      </Tooltip>
      {onSync && (
        <Tooltip title="Sync plan">
          <IconButton aria-label="Sync plan" size="small" color="info" onClick={onSync}>
            <RefreshCwIcon size={16} />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );
}
