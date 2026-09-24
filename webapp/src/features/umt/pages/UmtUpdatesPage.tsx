// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router";
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Chip,
  DataGrid,
  IconButton,
  LinearProgress,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Columns3Icon,
  DownloadIcon,
  EllipsisVertical,
  EyeIcon,
  FilterIcon,
  GitBranchIcon,
  InboxIcon,
  PencilIcon,
  PlusIcon,
} from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import {
  EMPTY_UMT_UPDATE_FILTERS,
  activeUmtFilterCount,
  createUmtUpdateSearchRequest,
  type UmtUpdateFilters,
  type UmtUpdateSummary,
} from "../api/umtUpdates";
import { useUmtUpdates } from "../api/useUmtUpdates";
import { formatCalendarDate, formatDate } from "../lib/umtDates";
import { gridCellContentSx } from "../lib/umtGrid";
import { writePersistedSelectedTab } from "../lib/umtLocalState";
import UmtCreateUpdateDialog from "../components/UmtCreateUpdateDialog";
import UmtShell from "../components/UmtShell";
import UmtUpdateFiltersDrawer from "../components/UmtUpdateFiltersDrawer";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

type ColumnKey =
  | "id" | "caseId" | "jiraId" | "internalGitIssue" | "products"
  | "isHotfix" | "lifecycleState" | "assignedTo" | "eta" | "issueType"
  | "securityInternalGitIssue" | "lifecycle" | "securityAdvisories"
  | "issues" | "pullRequests" | "artifacts" | "releasedDate";

type ColumnDefinition = { key: ColumnKey; label: string; minWidth: number };

const COLUMNS: ColumnDefinition[] = [
  { key: "id", label: "ID", minWidth: 90 },
  { key: "caseId", label: "Case ID", minWidth: 120 },
  { key: "jiraId", label: "Jira ID", minWidth: 220 },
  { key: "internalGitIssue", label: "Internal Git Issue", minWidth: 220 },
  { key: "products", label: "Products", minWidth: 260 },
  { key: "isHotfix", label: "Type", minWidth: 110 },
  { key: "lifecycleState", label: "Lifecycle State", minWidth: 170 },
  { key: "assignedTo", label: "Assignee", minWidth: 200 },
  { key: "eta", label: "ETAs", minWidth: 170 },
  { key: "issueType", label: "Issue Type", minWidth: 150 },
  { key: "securityInternalGitIssue", label: "Security Internal GitHub Issue", minWidth: 240 },
  { key: "lifecycle", label: "Lifecycle", minWidth: 190 },
  { key: "securityAdvisories", label: "Security Advisories", minWidth: 190 },
  { key: "issues", label: "Public GitHub Issues", minWidth: 230 },
  { key: "pullRequests", label: "Pull Requests", minWidth: 230 },
  { key: "artifacts", label: "Artifacts", minWidth: 360 },
  { key: "releasedDate", label: "Released Date", minWidth: 145 },
];

// The source hides Jira ID on first load but lets the user expose it.
const DEFAULT_COLUMNS = COLUMNS.map((column) => column.key).filter((key) => key !== "jiraId");

// UMT has more status meanings than Oxygen's semantic five-color palette can
// express. Keep this source-specific vocabulary local to the Updates table so
// it does not leak hardcoded colors into the application theme.
const STATUS_COLORS: Record<string, string> = {
  Bug: "#F64E60",
  Improvement: "#E0AB3C",
  "New Feature": "#63C3AC",
  "Cloud Support Lifecycle": "#00838F",
  UpdateLifecycle: "#989F3F",
  SecurityUpdateLifecycle: "#096CA4",
  HotFixLifecycle: "#B36B00",
  Update: "#409200",
  Hotfix: "#9a720a",
  Development: "#00ACC1",
  Staging: "#9C27B0",
  UAT: "#E74C3C",
  PRAnalyzed: "#1E88E5",
  ProductAnalyzed: "#7CB342",
  TestingEnvironmentRequested: "#F57C00",
  TestingEnvironmentCreated: "#3F51B5",
  TestingEnvironmentFailed: "#5E35B1",
  StagingRequested: "#B36B00",
  DemoteStagingRequested: "#9CCC65",
  WaitingFileApproval: "#FBC02D",
  UATStaging: "#FFAB40",
  UATRequested: "#43A047",
  Released: "#0288D1",
  OnHold: "#C2185B",
  Duplicate: "#757575",
};

const { DataGrid: DataGridComponent } = DataGrid;

// The open-menu row id lives in context rather than being closed over by the
// column definitions: new GridColDef objects read to DataGrid as a columns
// change and re-run its column pipeline, which can drop the user's resizing and
// horizontal scroll on what is deliberately a wide table.
const OpenActionsRowContext = createContext<number | null>(null);

function UmtUpdateActionsCell({
  row,
  onOpen,
}: {
  row: UmtUpdateSummary;
  onOpen: (event: MouseEvent<HTMLElement>, row: UmtUpdateSummary) => void;
}) {
  const isOpen = useContext(OpenActionsRowContext) === row.id;
  return (
    <Box sx={{ ...gridCellContentSx, justifyContent: "center" }}>
      <Tooltip title={`Actions for update ${row.id}`}>
        <IconButton
          aria-controls={isOpen ? "umt-update-actions" : undefined}
          aria-expanded={isOpen ? true : undefined}
          aria-haspopup="menu"
          aria-label={`Actions for update ${row.id}`}
          onClick={(event) => onOpen(event, row)}
          size="small"
        >
          <EllipsisVertical size={18} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

export default function UmtUpdatesPage() {
  return (
    <UmtShell title="Updates">
      <UmtUpdatesBody />
    </UmtShell>
  );
}

function UmtUpdatesBody() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [filters, setFilters] = useState<UmtUpdateFilters>(EMPTY_UMT_UPDATE_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_COLUMNS);
  const [columnAnchor, setColumnAnchor] = useState<HTMLElement | null>(null);
  const [actionAnchor, setActionAnchor] = useState<HTMLElement | null>(null);
  const [actionRow, setActionRow] = useState<UmtUpdateSummary | null>(null);

  const request = useMemo(
    () => createUmtUpdateSearchRequest(page, pageSize, filters),
    [filters, page, pageSize],
  );
  const search = useUmtUpdates(request);
  const rows = search.data?.updates ?? [];
  const totalPages = search.data?.totalPages ?? 0;
  const activeFilters = activeUmtFilterCount(filters);
  const displayedColumns = useMemo(
    () => COLUMNS.filter((column) => visibleColumns.includes(column.key)),
    [visibleColumns],
  );

  const applyFilters = (next: UmtUpdateFilters) => {
    setFilters(next);
    setPage(0);
    setFilterOpen(false);
  };

  const openActions = useCallback((event: MouseEvent<HTMLElement>, row: UmtUpdateSummary) => {
    event.stopPropagation();
    setActionAnchor(event.currentTarget);
    setActionRow(row);
  }, []);

  const closeActions = () => {
    setActionAnchor(null);
    setActionRow(null);
  };

  const viewUpdate = (id: number) => {
    closeActions();
    navigate(`/umt/updates/${id}`);
  };

  // "View"/"Edit"/"Branch" are one detail page with three tabs, not three
  // routes — the detail page reads a per-update persisted tab on mount
  // (readPersistedSelectedTab), so writing it here before navigating opens
  // the right tab, the same way the tab strip itself persists a switch.
  const openUpdateOnTab = (id: number, tab: string) => {
    closeActions();
    writePersistedSelectedTab(String(id), tab);
    navigate(`/umt/updates/${id}`);
  };

  const gridColumns = useMemo<DataGrid.GridColDef<UmtUpdateSummary>[]>(
    () => [
      ...displayedColumns.map((column) => ({
        field: column.key,
        headerName: column.label,
        minWidth: column.minWidth,
        width: column.minWidth,
        renderCell: (params: DataGrid.GridRenderCellParams<UmtUpdateSummary>) => (
          <Box sx={gridCellContentSx}>{renderCell(params.row, column.key)}</Box>
        ),
      })),
      {
        field: "actions",
        filterable: false,
        headerName: "Actions",
        headerAlign: "center",
        align: "center",
        minWidth: 80,
        resizable: false,
        sortable: false,
        width: 80,
        renderCell: (params: DataGrid.GridRenderCellParams<UmtUpdateSummary>) => (
          <UmtUpdateActionsCell row={params.row} onOpen={openActions} />
        ),
      },
    ],
    [displayedColumns, openActions],
  );

  const exportCurrentPage = () => {
    const headings = displayedColumns.map((column) => column.label);
    const lines = rows.map((row) => displayedColumns.map((column) => csvValue(row, column.key)));
    const csv = [headings, ...lines].map((line) => line.map(escapeCsv).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `umt-updates-page-${page + 1}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Stack spacing={2} sx={{ minWidth: 0, width: "100%" }}>
      <Box sx={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 1.25 }}>
        <Badge badgeContent={activeFilters} color="primary">
          <Button variant="outlined" startIcon={<FilterIcon size={16} />} onClick={() => setFilterOpen(true)}>
            Filters
          </Button>
        </Badge>
        {activeFilters > 0 && (
          <Button variant="text" onClick={() => applyFilters(EMPTY_UMT_UPDATE_FILTERS)}>Clear filters</Button>
        )}
        <Button
          variant="outlined"
          startIcon={<Columns3Icon size={16} />}
          onClick={(event) => setColumnAnchor(event.currentTarget)}
        >
          Columns
        </Button>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon size={16} />}
          disabled={rows.length === 0 || displayedColumns.length === 0}
          onClick={exportCurrentPage}
        >
          Export page
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<PlusIcon size={16} />} onClick={() => setCreateOpen(true)}>
          Create
        </Button>
      </Box>

      {search.isError && (
        <ErrorNotice error={search.error} onRetry={() => void search.refetch()} retrying={search.isFetching}>
          Couldn&apos;t load updates.
        </ErrorNotice>
      )}

      <Paper variant="outlined" sx={{ minWidth: 0, overflow: "hidden", position: "relative" }}>
        {search.isFetching && !search.isPending && <LinearProgress sx={{ left: 0, position: "absolute", right: 0, top: 0, zIndex: 4 }} />}
        <Box sx={{ height: { xs: "calc(100dvh - 360px)", md: "calc(100dvh - 310px)" }, minHeight: 240 }}>
          <OpenActionsRowContext.Provider value={actionAnchor ? (actionRow?.id ?? null) : null}>
            <DataGridComponent
              columnHeaderHeight={40}
              columns={gridColumns}
              disableRowSelectionOnClick
              getRowHeight={() => "auto"}
              hideFooter
              loading={search.isPending}
              onRowClick={(params) => navigate(`/umt/updates/${params.row.id}`)}
              rows={rows}
              slots={{ noRowsOverlay: UpdatesEmptyState }}
              sx={updatesGridSx}
            />
          </OpenActionsRowContext.Provider>
        </Box>

        <Box sx={{ alignItems: "center", borderTop: 1, borderColor: "divider", display: "flex", flexWrap: "wrap", gap: 1.5, justifyContent: "space-between", px: 2, py: 1.25 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Typography color="text.secondary" variant="body2">Rows per page</Typography>
            <Select
              aria-label="Rows per page"
              size="small"
              value={pageSize}
              onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }}
            >
              {PAGE_SIZE_OPTIONS.map((size) => <MenuItem key={size} value={size}>{size}</MenuItem>)}
            </Select>
          </Stack>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <Typography color="text.secondary" variant="body2" sx={{ fontVariantNumeric: "tabular-nums", mr: 0.5 }}>
              {search.isPending ? "Loading…" : totalPages > 0 ? `Page ${page + 1} of ${totalPages}` : "No results"}
            </Typography>
            <IconButton aria-label="Previous page" disabled={page === 0 || search.isFetching} onClick={() => setPage((current) => Math.max(0, current - 1))} size="small">
              <ChevronLeftIcon size={17} />
            </IconButton>
            <IconButton aria-label="Next page" disabled={page + 1 >= totalPages || search.isFetching} onClick={() => setPage((current) => current + 1)} size="small">
              <ChevronRightIcon size={17} />
            </IconButton>
          </Stack>
        </Box>
      </Paper>

      <Menu anchorEl={columnAnchor} open={Boolean(columnAnchor)} onClose={() => setColumnAnchor(null)}>
        {COLUMNS.map((column) => (
          <MenuItem
            dense
            key={column.key}
            onClick={() => setVisibleColumns((current) => current.includes(column.key) ? current.filter((key) => key !== column.key) : [...current, column.key])}
          >
            <Checkbox checked={visibleColumns.includes(column.key)} size="small" />
            <ListItemText>{column.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>

      <Menu anchorEl={actionAnchor} id="umt-update-actions" open={Boolean(actionAnchor)} onClose={closeActions}>
        <MenuItem onClick={() => actionRow && viewUpdate(actionRow.id)}><EyeIcon size={16} />&nbsp; View</MenuItem>
        <MenuItem onClick={() => actionRow && openUpdateOnTab(actionRow.id, "edit")}><PencilIcon size={16} />&nbsp; Edit</MenuItem>
        <MenuItem onClick={() => actionRow && openUpdateOnTab(actionRow.id, "branch")}><GitBranchIcon size={16} />&nbsp; Branch</MenuItem>
      </Menu>

      <UmtUpdateFiltersDrawer open={filterOpen} filters={filters} onApply={applyFilters} onClose={() => setFilterOpen(false)} />
      <UmtCreateUpdateDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </Stack>
  );
}

function UpdatesEmptyState() {
  return (
    <Stack sx={{ alignItems: "center", color: "text.disabled", height: "100%", justifyContent: "center" }} spacing={1}>
      <InboxIcon size={36} />
      <Typography variant="body2">No updates match these filters</Typography>
    </Stack>
  );
}

// Community DataGrid has no real column-pinning prop, so this uses sticky
// positioning on the actions cell/header instead. Uses theme-aware colors
// so it still looks right in dark mode.
const updatesGridSx = {
  border: 0,
  '& .MuiDataGrid-cell[data-field="actions"]': {
    position: "sticky",
    right: 0,
    backgroundColor: "background.paper",
    zIndex: 2,
    boxShadow: "-2px 0 4px rgba(0, 0, 0, 0.15)",
  },
  '& .MuiDataGrid-columnHeader[data-field="actions"]': {
    position: "sticky",
    right: 0,
    backgroundColor: "background.paper",
    zIndex: 2,
    boxShadow: "-2px 0 4px rgba(0, 0, 0, 0.15)",
  },
} as const;
function renderCell(row: UmtUpdateSummary, key: ColumnKey): ReactNode {
  switch (key) {
    case "id": return <Typography variant="body2" sx={{ fontWeight: 700 }}>{row.id}</Typography>;
    case "caseId": return valueOr(row.caseId, "Internal");
    case "jiraId": return <IssueLink value={row.jiraId} />;
    case "internalGitIssue": return <IssueLink value={row.internalGitIssue} />;
    case "products": return <ValueList values={(row.products ?? []).map((item) => `${item.product?.name ?? "N/A"} - ${item.product?.version ?? "N/A"}`)} />;
    case "isHotfix": return <StatusChip value={row.isHotfix ? "Hotfix" : "Update"} />;
    case "lifecycleState": return <StatusChip value={row.lifecycleState} />;
    case "assignedTo": return valueOr(row.assignedTo);
    case "eta": return <EtaCell row={row} />;
    case "issueType": return <StatusChip value={row.issueType} />;
    case "securityInternalGitIssue": return <IssueLink value={row.securityInternalGitIssue} />;
    case "lifecycle": return <StatusChip value={row.lifecycle} />;
    case "securityAdvisories": return <ValueList values={(row.securityAdvisories ?? []).map((item) => item.securityAdvisoryName ?? "N/A")} />;
    case "issues": return <LinkList values={row.issues} />;
    case "pullRequests": return <LinkList values={row.pullRequests} />;
    case "artifacts": return <Artifacts values={row.artifacts ?? []} />;
    case "releasedDate": return row.lifecycleState === "Released" ? formatDate(row.lastUpdatedTimestamp) : <NA />;
  }
}

function valueOr(value: string | number | null | undefined, fallback = "N/A"): ReactNode {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function StatusChip({ value }: { value?: string | null }) {
  if (!value) return <NA />;
  const displayValue = humanize(value);
  const paletteKey = STATUS_COLORS[value] ? value : displayValue;
  return (
    <Chip
      label={displayValue}
      size="small"
      variant="outlined"
      sx={{
        borderColor: STATUS_COLORS[paletteKey] ?? "#989898",
        color: STATUS_COLORS[paletteKey] ?? "#989898",
        fontSize: 12,
        fontWeight: 600,
      }}
    />
  );
}

function NA() {
  return <Chip label="N/A" size="small" variant="outlined" sx={{ color: "text.secondary", fontSize: 12 }} />;
}

function EtaCell({ row }: { row: UmtUpdateSummary }) {
  const estimates = [
    ["Best case estimate", row.bestCaseEstimate, "success.main"],
    ["Most likely estimate", row.mostLikelyEstimate, "warning.main"],
    ["Worst case estimate", row.worstCaseEstimate, "error.main"],
  ] as const;
  return (
    <Stack spacing={0.5}>
      {estimates.map(([label, date, color]) => (
        <Tooltip title={label} key={label}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", whiteSpace: "nowrap" }}>
            <Box sx={{ bgcolor: color, borderRadius: "50%", height: 8, width: 8 }} />
            <Typography variant="body2">{formatCalendarDate(date)}</Typography>
          </Stack>
        </Tooltip>
      ))}
    </Stack>
  );
}

function IssueLink({ value }: { value?: string | null }) {
  if (!value || value == "N/A") return <NA />;
  return (
    <Typography
      component="a"
      href={value}
      onClick={(event) => event.stopPropagation()}
      rel="noreferrer"
      target="_blank"
      variant="body2"
      sx={{ color: "primary.main", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
    >
      {linkLabel(value)}
    </Typography>
  );
}

function LinkList({ values }: { values?: string[] | null }) {
  if (!values?.length) return <NA />;
  return <Stack spacing={0.5}>{values.map((value) => <IssueLink key={value} value={value} />)}</Stack>;
}

function ValueList({ values }: { values: string[] }) {
  if (values.length === 0) return <NA />;
  return <Stack spacing={0.25}>{values.map((value, index) => <Typography key={`${value}-${index}`} variant="body2">{value}</Typography>)}</Stack>;
}

function Artifacts({ values }: { values: string[] }) {
  const [expanded, setExpanded] = useState(false);
  if (values.length === 0) return <NA />;
  const shown = expanded ? values : values.slice(0, 3);
  return (
    <Stack spacing={0.25} onClick={(event) => event.stopPropagation()}>
      {shown.map((value, index) => <Typography key={`${value}-${index}`} variant="body2" sx={{ overflowWrap: "anywhere" }}>{value}</Typography>)}
      {values.length > 3 && (
        <Button size="small" variant="text" onClick={() => setExpanded((current) => !current)} sx={{ alignSelf: "flex-start", minWidth: 0, px: 0 }}>
          {expanded ? "Show less" : `… and ${values.length - 3} more`}
        </Button>
      )}
    </Stack>
  );
}

function humanize(value: string): string {
  return value.replaceAll("_", " ").replace(/([a-z])([A-Z])/g, "$1 $2");
}

function linkLabel(value: string): string {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.length >= 2 ? `${parts.at(-2)}#${parts.at(-1)}` : value;
  } catch {
    return value;
  }
}

function csvValue(row: UmtUpdateSummary, key: ColumnKey): string {
  switch (key) {
    case "id": return String(row.id);
    case "caseId": return String(valueOr(row.caseId, "Internal"));
    case "jiraId": return row.jiraId ?? "";
    case "internalGitIssue": return row.internalGitIssue ?? "";
    case "products": return (row.products ?? []).map((item) => `${item.product?.name ?? "N/A"} - ${item.product?.version ?? "N/A"}`).join("; ");
    case "isHotfix": return row.isHotfix ? "Hotfix" : "Update";
    case "lifecycleState": return row.lifecycleState ?? "";
    case "assignedTo": return row.assignedTo ?? "";
    case "eta": return [row.bestCaseEstimate, row.mostLikelyEstimate, row.worstCaseEstimate].map(formatCalendarDate).join("; ");
    case "issueType": return row.issueType ?? "";
    case "securityInternalGitIssue": return row.securityInternalGitIssue ?? "";
    case "lifecycle": return row.lifecycle ?? "";
    case "securityAdvisories": return (row.securityAdvisories ?? []).map((item) => item.securityAdvisoryName ?? "").join("; ");
    case "issues": return (row.issues ?? []).join("; ");
    case "pullRequests": return (row.pullRequests ?? []).join("; ");
    case "artifacts": return (row.artifacts ?? []).join("; ");
    case "releasedDate": return row.lifecycleState === "Released" ? formatDate(row.lastUpdatedTimestamp) : "";
  }
}

// Quoting alone only satisfies CSV syntax — Excel/Sheets/LibreOffice decide
// whether to evaluate a cell as a formula from its first character regardless
// of quoting, so a value an authorized user set (assignedTo,
// securityAdvisoryName, ...) starting with =, +, -, or @ would run as a
// formula for whoever later opens the exported file. Prefixing with `'`
// forces it to render as inert text instead.
function escapeCsv(value: string): string {
  const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
}
