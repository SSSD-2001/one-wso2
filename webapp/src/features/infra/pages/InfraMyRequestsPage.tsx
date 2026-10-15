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

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Card,
  Chip,
  CircularProgress,
  DataGrid,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
} from "@wso2/oxygen-ui";
import { ExternalLinkIcon, EyeIcon, PencilIcon, SearchIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { INFRA_EYEBROW } from "@constants/infraApps";
import InfraShell from "../components/InfraShell";
import { useInfraGate } from "../api/useInfraGate";
import { useInfraUserInfo } from "../api/useInfraUserInfo";
import { useMyAccessRequests, useMyCreationRequests } from "../api/useInfraRequests";
import type { InfraAccessRequest, InfraRepositoryRequest, InfraRequestState } from "../api/infraTypes";
import NewRepositoryForm from "../new-repository/NewRepositoryForm";
import CreationRequestDialog, { formatRequestDateTime } from "../my-requests/CreationRequestDialog";

const PAGE_SIZE = 10;

export default function InfraMyRequestsPage() {
  const gate = useInfraGate();
  const [tab, setTab] = useState(0);

  return (
    <InfraShell
      eyebrow={INFRA_EYEBROW.github}
      title="My Requests"
      subtitle="View, edit and resubmit your pending requests, and track their decisions."
    >
      {gate.isEmployee ? (
        <>
          <Tabs value={tab} onChange={(_event, next) => setTab(next)}>
            <Tab label="Creation" />
            <Tab label="Access" />
          </Tabs>
          <Box sx={{ mt: 2 }}>{tab === 0 ? <CreationTab /> : <AccessTab />}</Box>
        </>
      ) : (
        <Alert severity="warning">Only employees can view their requests.</Alert>
      )}
    </InfraShell>
  );
}

function CreationTab() {
  const queryClient = useQueryClient();
  const userInfo = useInfraUserInfo();
  const email = userInfo.data?.workEmail ?? "";
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [searchInput, setSearchInput] = useState("");
  const [repoName, setRepoName] = useState("");
  const [viewing, setViewing] = useState<InfraRepositoryRequest | null>(null);
  const [editing, setEditing] = useState<InfraRepositoryRequest | null>(null);
  const requests = useMyCreationRequests(email, { limit: pageSize, offset: page * pageSize, repoName });

  const applySearch = () => {
    setPage(0);
    setRepoName(searchInput.trim());
  };

  const rows = requests.data?.repositoryRequests ?? [];
  const columns = useMemo<DataGrid.GridColDef<InfraRepositoryRequest>[]>(
    () => [
      { field: "id", headerName: "Id", width: 70 },
      { field: "repoName", headerName: "Repository Name", flex: 1.4, minWidth: 160 },
      { field: "organizationName", headerName: "GitHub Organization", flex: 1, minWidth: 140 },
      { field: "repoType", headerName: "Visibility", width: 110 },
      { field: "requirement", headerName: "Requirement", flex: 1.4, minWidth: 160 },
      {
        field: "timestamp",
        headerName: "Created On",
        width: 170,
        valueFormatter: (value) => formatRequestDateTime(value as string),
      },
      {
        field: "updatedAt",
        headerName: "Updated On",
        width: 170,
        valueFormatter: (value) => formatRequestDateTime(value as string | null),
      },
      {
        field: "state",
        headerName: "Decision",
        width: 120,
        renderCell: (params) => <StateChip state={params.row.state} />,
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 130,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <RowActions
            onView={() => setViewing(params.row)}
            onEdit={params.row.state === "Pending" ? () => setEditing(params.row) : undefined}
            onVisit={
              params.row.state === "Approved"
                ? () => visitRepository(params.row.organizationName, params.row.repoName)
                : undefined
            }
          />
        ),
      },
    ],
    [],
  );

  if (userInfo.isLoading) return <CircularProgress size={24} />;
  if (userInfo.isError) return <Alert severity="error">{describeError(userInfo.error)}</Alert>;
  if (requests.isError && !requests.data) {
    return <Alert severity="error">{describeError(requests.error)}</Alert>;
  }

  const counts = requests.data;

  return (
    <Stack spacing={1.5}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", alignItems: "center" }}>
          <CountChip label="Total" count={counts?.totalCount ?? 0} color="info" />
          <CountChip label="Pending" count={counts?.pendingCount ?? 0} color="warning" />
          <CountChip label="Approved" count={counts?.approvedCount ?? 0} color="success" />
          <CountChip label="Rejected" count={counts?.rejectedCount ?? 0} color="error" />
        </Stack>
        <TextField
          size="small"
          label="Search by Repository Name"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") applySearch();
          }}
          sx={{ ml: "auto", width: 320, flexShrink: 0 }}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton aria-label="Search" onClick={applySearch} edge="end">
                    <SearchIcon size={16} />
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>
      {requests.isError && <Alert severity="error">{describeError(requests.error)}</Alert>}
      <Card variant="outlined">
        <DataGrid.DataGrid
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          loading={requests.isFetching}
          rowCount={counts?.totalCount ?? 0}
          paginationMode="server"
          paginationModel={{ page, pageSize }}
          onPaginationModelChange={(model) => {
            setPage(model.page);
            setPageSize(model.pageSize);
          }}
          pageSizeOptions={[10, 25, 50]}
          disableRowSelectionOnClick
          rowHeight={47}
          sx={{ border: "none", height: 560 }}
        />
      </Card>
      {viewing && <CreationRequestDialog request={viewing} onClose={() => setViewing(null)} />}
      {editing && (
        <Dialog open onClose={() => setEditing(null)} fullWidth maxWidth="md">
          <DialogTitle>Edit Repository Request</DialogTitle>
          <DialogContent>
            <NewRepositoryForm
              key={editing.id}
              request={editing}
              onSaved={() => {
                setEditing(null);
                void queryClient.invalidateQueries({ queryKey: ["infra-my-creation-requests"] });
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </Stack>
  );
}

function AccessTab() {
  const requests = useMyAccessRequests(true);
  const [searchInput, setSearchInput] = useState("");
  const [repoName, setRepoName] = useState("");
  const columns = useMemo<DataGrid.GridColDef<InfraAccessRequest>[]>(
    () => [
      { field: "id", headerName: "Id", width: 70 },
      { field: "repoName", headerName: "Repository Name", flex: 1.4, minWidth: 160 },
      { field: "organizationName", headerName: "GitHub Organization", flex: 1, minWidth: 140 },
      { field: "permission", headerName: "Permission", width: 120 },
      { field: "justification", headerName: "Justification", flex: 1.6, minWidth: 180 },
      {
        field: "state",
        headerName: "Decision",
        width: 120,
        renderCell: (params) => <StateChip state={params.row.state} />,
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 90,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <RowActions
            onVisit={
              params.row.state === "Approved"
                ? () => visitRepository(params.row.organizationName, params.row.repoName)
                : undefined
            }
          />
        ),
      },
    ],
    [],
  );

  if (requests.isLoading) return <CircularProgress size={24} />;
  if (requests.isError) return <Alert severity="error">{describeError(requests.error)}</Alert>;

  const allRows = requests.data ?? [];
  const needle = repoName.trim().toLowerCase();
  const rows = needle
    ? allRows.filter((row) => row.repoName.toLowerCase().includes(needle))
    : allRows;
  const count = (state: InfraRequestState) => allRows.filter((row) => row.state === state).length;

  return (
    <Stack spacing={1.5}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", alignItems: "center" }}>
          <CountChip label="Total" count={allRows.length} color="info" />
          <CountChip label="Pending" count={count("Pending")} color="warning" />
          <CountChip label="Approved" count={count("Approved")} color="success" />
          <CountChip label="Rejected" count={count("Rejected")} color="error" />
        </Stack>
        <TextField
          size="small"
          label="Search by Repository Name"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") setRepoName(searchInput.trim());
          }}
          sx={{ ml: "auto", width: 320, flexShrink: 0 }}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="Search"
                    onClick={() => setRepoName(searchInput.trim())}
                    edge="end"
                  >
                    <SearchIcon size={16} />
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>
      <Card variant="outlined">
        <DataGrid.DataGrid
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          initialState={{ pagination: { paginationModel: { pageSize: PAGE_SIZE } } }}
          pageSizeOptions={[10, 25, 50]}
          disableRowSelectionOnClick
          rowHeight={47}
          sx={{ border: "none", height: 560 }}
        />
      </Card>
    </Stack>
  );
}

function CountChip({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: "info" | "warning" | "success" | "error";
}) {
  return <Chip size="small" variant="outlined" color={color} label={`${label}: ${count}`} />;
}

function StateChip({ state }: { state: InfraRequestState }) {
  const color = state === "Approved" ? "success" : state === "Rejected" ? "error" : "warning";
  return <Chip size="small" variant="outlined" color={color} label={state} />;
}

function RowActions({
  onView,
  onEdit,
  onVisit,
}: {
  onView?: () => void;
  onEdit?: () => void;
  onVisit?: () => void;
}) {
  return (
    <Stack direction="row" sx={{ alignItems: "center", height: "100%" }}>
      {onView && (
        <Tooltip title="View more">
          <IconButton aria-label="View more" size="small" color="info" onClick={onView}>
            <EyeIcon size={16} />
          </IconButton>
        </Tooltip>
      )}
      {onEdit && (
        <Tooltip title="Edit request">
          <IconButton aria-label="Edit request" size="small" color="primary" onClick={onEdit}>
            <PencilIcon size={16} />
          </IconButton>
        </Tooltip>
      )}
      {onVisit && (
        <Tooltip title="Visit Repository">
          <IconButton aria-label="Visit Repository" size="small" color="success" onClick={onVisit}>
            <ExternalLinkIcon size={16} />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );
}

function visitRepository(organizationName: string, repoName: string) {
  window.open(
    `https://github.com/${organizationName}/${repoName}`,
    "_blank",
    "noopener,noreferrer",
  );
}
