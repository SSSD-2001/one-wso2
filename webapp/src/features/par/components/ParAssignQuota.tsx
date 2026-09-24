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

import { useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Collapse,
  DataGrid,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { ChevronDownIcon, FilterIcon, MoreVerticalIcon, PencilIcon, RotateCcwIcon, Trash2Icon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import ConfirmationDialog, { type ConfirmationContent } from "@components/confirmation-dialog/ConfirmationDialog";
import { formatShortDate } from "../util/parDate";
import { resolveGridSelectedIds } from "../util/parGridSelection";
import {
  calculateDefaultQuotaValues,
  calculateTotalHeadCount,
  formatGroupsToQuotaPayload,
  getUnderServedGroupNames,
  titleCaseWords,
  validateGroup,
  validateQuotaPayload,
  type ParQuotaGroup,
} from "../util/parQuotaGrouping";
import { useParAdminSpecialRatingGroups } from "../api/useParAdmin";
import { usePostAdminQuotaGroups, useSetParCycleStatus } from "../api/useParMutations";
import ParEditQuotaDialog from "./ParEditQuotaDialog";
import ParEmptyState from "./ParEmptyState";
import ParGroupNameInputDialog from "./ParGroupNameInputDialog";
import ParQuotaStatusChip from "./ParQuotaStatusChip";
import { ParGridToolbarWithExport } from "./parGridToolbar";
import type { ParCycle, ParSpecialRatingGroupWithHeadCount } from "../api/types";

const EMPTY_FILTERS = { businessUnit: "", department: "", team: "", subTeam: "" };

// The screen shown while a freshly-created cycle sits in PENDING_QUOTA:
// group every ungrouped team into a named quota group, review/edit its
// 5%/20% slot allocation and assigned leads, then "SAVE QUOTA VALUES" posts
// the whole grouping and opens the cycle. Nothing is persisted until that
// POST, so all grouping/selection/editing state lives here; the
// ungrouped-teams list is derived each render (`allTeams` minus what
// `groups` claims) rather than mirrored into its own state, avoiding a
// useEffect to keep the two in sync.
export default function ParAssignQuota({ cycle }: { cycle: ParCycle }) {
  const teamsQuery = useParAdminSpecialRatingGroups(cycle.parCycleId);
  const postQuota = usePostAdminQuotaGroups(cycle.parCycleId);
  const setStatus = useSetParCycleStatus(cycle.parCycleId);
  const { showSuccess, showError } = useNotifications();

  const [groups, setGroups] = useState<ParQuotaGroup[]>([]);
  const [groupIdCounter, setGroupIdCounter] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [quotaDialogGroup, setQuotaDialogGroup] = useState<ParQuotaGroup | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<number | false>(false);
  const [menuState, setMenuState] = useState<{ anchorEl: HTMLElement | null; group: ParQuotaGroup | null }>({
    anchorEl: null,
    group: null,
  });
  const [confirmContent, setConfirmContent] = useState<ConfirmationContent | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Set once the quota POST has succeeded, so a retry after only the status
  // update fails doesn't re-POST the same grouping a second time.
  const [quotaPosted, setQuotaPosted] = useState(false);

  if (teamsQuery.isLoading) {
    return <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1.5 }} />;
  }
  if (teamsQuery.isError) {
    return (
      <ErrorNotice error={teamsQuery.error} onRetry={() => teamsQuery.refetch()} retrying={teamsQuery.isFetching}>
        Couldn't load teams for quota assignment.
      </ErrorNotice>
    );
  }

  const allTeams = teamsQuery.data ?? [];
  const totalEmployees = calculateTotalHeadCount(allTeams);

  const groupedTeamIds = new Set(groups.flatMap((g) => g.teams.map((t) => t.specialRatingGroupId)));
  const ungroupedTeams: ParSpecialRatingGroupWithHeadCount[] = allTeams
    .filter((t) => !groupedTeamIds.has(t.specialRatingGroupId))
    .map((t) => ({ ...t, department: titleCaseWords(t.department) }));

  const displayedTeams = ungroupedTeams.filter((t) => {
    const bu = filters.businessUnit.trim().toLowerCase();
    const dept = filters.department.trim().toLowerCase();
    const team = filters.team.trim().toLowerCase();
    const sub = filters.subTeam.trim().toLowerCase();
    return (
      (!bu || t.businessUnit.toLowerCase().includes(bu)) &&
      (!dept || t.department.toLowerCase().includes(dept)) &&
      (!team || t.team.toLowerCase().includes(team)) &&
      (!sub || (t.subTeam ?? "").toLowerCase().includes(sub))
    );
  });
  const activeFilterCount = Object.values(filters).filter((v) => v.trim() !== "").length;

  const selectedHeadCount = ungroupedTeams
    .filter((t) => selectedIds.includes(t.specialRatingGroupId))
    .reduce((sum, t) => sum + (t.headCount || 0), 0);

  const top5Available = groups.reduce((sum, g) => sum + g.default5Slots, 0);
  const top20Available = groups.reduce((sum, g) => sum + g.default20Slots, 0);
  const top5Allocated = groups.reduce((sum, g) => sum + g.allocated5Slots, 0);
  const top20Allocated = groups.reduce((sum, g) => sum + g.allocated20Slots, 0);

  const isGroupMapEmpty = groups.length === 0;
  const isTeamsTableEmpty = ungroupedTeams.length === 0;
  const isSaving = postQuota.isPending || setStatus.isPending;

  const closeMenu = () => setMenuState({ anchorEl: null, group: null });

  const handleGroupCreation = (name: string) => {
    if (selectedIds.length === 0) return;
    const selectedTeams = ungroupedTeams.filter((t) => selectedIds.includes(t.specialRatingGroupId));
    const totalHeadCount = calculateTotalHeadCount(selectedTeams);
    const { default5Slots, default20Slots } = calculateDefaultQuotaValues(totalHeadCount);

    const newGroup: ParQuotaGroup = {
      id: groupIdCounter,
      name,
      teams: selectedTeams,
      totalHeadCount,
      default5Slots,
      default20Slots,
      allocated5Slots: default5Slots,
      allocated20Slots: default20Slots,
      allocatedLeads: [],
    };

    setGroups((prev) => [...prev, newGroup]);
    setSelectedIds([]);
    setGroupIdCounter((c) => c + 1);
    showSuccess("Group created successfully");
  };

  const handleAssignQuotaValues = (updated: ParQuotaGroup) => {
    setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
  };

  const resetGroupQuota = (groupId: number) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, allocated5Slots: g.default5Slots, allocated20Slots: g.default20Slots } : g,
      ),
    );
  };

  const confirmRemoveGroup = (group: ParQuotaGroup) => {
    setConfirmContent({
      title: "Remove a Group",
      text: "Are you sure you want to remove the selected group? This action cannot be undone.",
      confirmAction: () => {
        setGroups((prev) => prev.filter((g) => g.id !== group.id));
        showSuccess("Group removed successfully");
      },
    });
  };

  const confirmRemoveTeam = (groupId: number, teamId: number) => {
    setConfirmContent({
      title: "Remove a Team",
      text: "Are you sure you want to remove the selected team? This action cannot be undone.",
      confirmAction: () => {
        // A group emptied out by removing its last team disappears entirely
        // rather than sticking around as a zero-team quota bucket.
        setGroups((prev) =>
          prev
            .map((g) => {
              if (g.id !== groupId) return g;
              const teams = g.teams.filter((t) => t.specialRatingGroupId !== teamId);
              const totalHeadCount = calculateTotalHeadCount(teams);
              const { default5Slots, default20Slots } = calculateDefaultQuotaValues(totalHeadCount);
              return {
                ...g,
                teams,
                totalHeadCount,
                default5Slots,
                default20Slots,
                allocated5Slots: Math.min(g.allocated5Slots, default5Slots),
                allocated20Slots: Math.min(g.allocated20Slots, default20Slots),
              };
            })
            .filter((g) => g.teams.length > 0),
        );
        showSuccess("Team removed successfully");
      },
    });
  };

  const handleSaveConfirmed = () => {
    setSaveError(null);

    // A prior attempt already got the grouping saved — only the status flip
    // failed, so retry just that instead of re-POSTing the same groups.
    if (quotaPosted) {
      setStatus.mutate("OPEN", { onError: (err) => setSaveError(describeError(err)) });
      return;
    }

    const payload = formatGroupsToQuotaPayload(groups, cycle.parCycleId);
    const payloadErrors = validateQuotaPayload(payload);
    if (payloadErrors.length > 0) {
      showError("Error while validating quota values");
      payloadErrors.forEach((msg) => showError(msg));
      return;
    }

    postQuota.mutate(payload, {
      onSuccess: () => {
        setQuotaPosted(true);
        setStatus.mutate("OPEN", { onError: (err) => setSaveError(describeError(err)) });
      },
      onError: (err) => setSaveError(describeError(err)),
    });
  };

  const handleSaveClick = () => {
    // Every ungrouped team must end up in exactly one group before the
    // backend will accept the payload — checked up front so the admin gets
    // one clear message instead of a rejected POST.
    if (!isTeamsTableEmpty) {
      showError("There are still teams waiting to be assigned");
      return;
    }
    const groupErrors = groups.flatMap((g) => validateGroup(g));
    if (groupErrors.length > 0) {
      showError("Group validation failed");
      groupErrors.forEach((msg) => showError(msg));
      return;
    }

    const underServed = getUnderServedGroupNames(groups);
    const text =
      "Are you sure you want to finish and save the quota allocation? This action cannot be undone." +
      (underServed.length > 0 ? ` Under Served Groups : ${underServed.join(", ")}` : "");
    setConfirmContent({ title: "Confirm Quota Choices", text, confirmAction: handleSaveConfirmed });
  };

  const columns: DataGrid.GridColDef<ParSpecialRatingGroupWithHeadCount>[] = [
    { field: "businessUnit", headerName: "BU", flex: 1 },
    { field: "department", headerName: "Department", flex: 1.2 },
    { field: "team", headerName: "Team", flex: 1.2 },
    { field: "subTeam", headerName: "Sub Team", flex: 1 },
    { field: "headCount", headerName: "Head Count", flex: 0.7 },
  ];

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="h5" component="span">
            {cycle.parCycleName}{" "}
          </Typography>
          <Typography component="span" color="text.secondary">
            ({formatShortDate(cycle.parCycleStartDate)} - {formatShortDate(cycle.parCycleEndDate)})
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Typography variant="body2">Eligible Employees:</Typography>
            <Chip label={totalEmployees} size="small" />
          </Stack>
          <ParQuotaStatusChip type="Top 5%" available={top5Available} allocated={top5Allocated} />
          <ParQuotaStatusChip type="Top 20%" available={top20Available} allocated={top20Allocated} />
          {!isGroupMapEmpty && isTeamsTableEmpty ? (
            <Tooltip arrow title="Confirm and save all the slot allocations for groups">
              <span>
                <Button variant="contained" onClick={handleSaveClick} disabled={isSaving}>
                  {isSaving ? "Saving…" : "SAVE QUOTA VALUES"}
                </Button>
              </span>
            </Tooltip>
          ) : (
            <Tooltip
              arrow
              title={selectedIds.length === 0 ? "Select relevant teams to create a group" : "Create a new group using selected teams"}
            >
              <span>
                <Button variant="contained" disabled={selectedIds.length === 0} onClick={() => setNameDialogOpen(true)}>
                  CREATE A GROUP
                </Button>
              </span>
            </Tooltip>
          )}
        </Stack>
      </Stack>

      {saveError && <Alert severity="error">{saveError}</Alert>}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          {isGroupMapEmpty ? (
            <Card variant="outlined" sx={{ p: 2 }}>
              <ParEmptyState text="Select teams to start creating groups and allocating quotas" />
            </Card>
          ) : (
            <Stack spacing={1}>
              {groups.map((group) => (
                <Accordion
                  key={group.id}
                  expanded={expandedGroupId === group.id}
                  onChange={(_e, isExpanded) => setExpandedGroupId(isExpanded ? group.id : false)}
                >
                  <AccordionSummary expandIcon={<ChevronDownIcon size={18} />}>
                    <Grid container alignItems="center" spacing={1} sx={{ width: "100%" }}>
                      <Grid size="grow">
                        <Typography variant="body2">{group.name}</Typography>
                      </Grid>
                      <Grid>
                        <Chip label={`Head Count : ${group.totalHeadCount}`} size="small" />
                      </Grid>
                      <Grid>
                        <ParQuotaStatusChip type="5%" available={group.default5Slots} allocated={group.allocated5Slots} />
                      </Grid>
                      <Grid>
                        <ParQuotaStatusChip type="20%" available={group.default20Slots} allocated={group.allocated20Slots} />
                      </Grid>
                      <Grid>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={
                            group.allocatedLeads.length > 0
                              ? `${group.allocatedLeads.length} Lead${group.allocatedLeads.length !== 1 ? "s" : ""} Assigned`
                              : "No Leads Assigned"
                          }
                          color={group.allocatedLeads.length > 0 ? "primary" : "error"}
                        />
                      </Grid>
                      <Grid>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuState({ anchorEl: e.currentTarget, group });
                          }}
                        >
                          <MoreVerticalIcon size={18} />
                        </IconButton>
                      </Grid>
                    </Grid>
                  </AccordionSummary>
                  <AccordionDetails>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>BU</TableCell>
                            <TableCell>Department</TableCell>
                            <TableCell>Team</TableCell>
                            <TableCell align="center">Head Count</TableCell>
                            <TableCell align="center">Action</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {group.teams.map((team) => (
                            <TableRow key={team.specialRatingGroupId}>
                              <TableCell>{team.businessUnit || "No Data"}</TableCell>
                              <TableCell>{team.department}</TableCell>
                              <TableCell>{team.team}</TableCell>
                              <TableCell align="center">{team.headCount}</TableCell>
                              <TableCell align="center">
                                <Tooltip arrow title="Remove the team from the group">
                                  <IconButton
                                    size="small"
                                    onClick={() => confirmRemoveTeam(group.id, team.specialRatingGroupId)}
                                  >
                                    <Trash2Icon size={16} />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Stack>
          )}
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          {isTeamsTableEmpty ? (
            <Card variant="outlined" sx={{ p: 2 }}>
              <ParEmptyState text="All the teams have been grouped" />
            </Card>
          ) : (
            <>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                {selectedIds.length > 0 ? (
                  <Chip size="small" color="primary" variant="outlined" label={`${selectedIds.length} selected · ${selectedHeadCount} heads`} />
                ) : (
                  <Box />
                )}
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Button
                    size="small"
                    startIcon={<FilterIcon size={16} />}
                    onClick={() => setFiltersOpen((o) => !o)}
                    color={activeFilterCount > 0 ? "primary" : "inherit"}
                    variant={activeFilterCount > 0 ? "contained" : "text"}
                  >
                    Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                  </Button>
                  {activeFilterCount > 0 && (
                    <Button size="small" color="inherit" onClick={() => setFilters(EMPTY_FILTERS)}>
                      Clear
                    </Button>
                  )}
                </Stack>
              </Stack>
              <Collapse in={filtersOpen}>
                <Grid container spacing={1} sx={{ mb: 1 }}>
                  <Grid size={6}>
                    <TextField
                      size="small"
                      fullWidth
                      label="BU"
                      value={filters.businessUnit}
                      onChange={(e) => setFilters((f) => ({ ...f, businessUnit: e.target.value }))}
                    />
                  </Grid>
                  <Grid size={6}>
                    <TextField
                      size="small"
                      fullWidth
                      label="Department"
                      value={filters.department}
                      onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}
                    />
                  </Grid>
                  <Grid size={6}>
                    <TextField
                      size="small"
                      fullWidth
                      label="Team"
                      value={filters.team}
                      onChange={(e) => setFilters((f) => ({ ...f, team: e.target.value }))}
                    />
                  </Grid>
                  <Grid size={6}>
                    <TextField
                      size="small"
                      fullWidth
                      label="Sub Team"
                      value={filters.subTeam}
                      onChange={(e) => setFilters((f) => ({ ...f, subTeam: e.target.value }))}
                    />
                  </Grid>
                </Grid>
              </Collapse>
              <DataGrid.DataGrid
                rows={displayedTeams}
                columns={columns}
                getRowId={(row) => row.specialRatingGroupId}
                rowHeight={52}
                checkboxSelection
                rowSelectionModel={{ type: "include", ids: new Set(selectedIds) }}
                onRowSelectionModelChange={(model) =>
                  setSelectedIds(resolveGridSelectedIds(model, displayedTeams.map((t) => ({ id: t.specialRatingGroupId }))))
                }
                showToolbar
                slots={{ toolbar: ParGridToolbarWithExport }}
                sx={{ border: "none" }}
                initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
                pageSizeOptions={[10, 20, 25]}
              />
            </>
          )}
        </Grid>
      </Grid>

      <ParGroupNameInputDialog
        open={nameDialogOpen}
        onClose={() => setNameDialogOpen(false)}
        groupNames={groups.map((g) => g.name)}
        onSave={handleGroupCreation}
      />

      {quotaDialogGroup && (
        <ParEditQuotaDialog
          open={Boolean(quotaDialogGroup)}
          onClose={() => setQuotaDialogGroup(null)}
          onSave={handleAssignQuotaValues}
          groupData={quotaDialogGroup}
          parCycleId={cycle.parCycleId}
        />
      )}

      {/* Edit / Reset / Remove for whichever group's overflow menu is open. */}
      <Menu anchorEl={menuState.anchorEl} open={Boolean(menuState.anchorEl)} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            if (menuState.group) setQuotaDialogGroup(menuState.group);
            closeMenu();
          }}
        >
          <PencilIcon size={16} style={{ marginRight: 8 }} />
          Edit Group Settings
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuState.group) resetGroupQuota(menuState.group.id);
            closeMenu();
          }}
        >
          <RotateCcwIcon size={16} style={{ marginRight: 8 }} />
          Reset Quota
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuState.group) confirmRemoveGroup(menuState.group);
            closeMenu();
          }}
        >
          <Trash2Icon size={16} style={{ marginRight: 8 }} />
          Remove Group
        </MenuItem>
      </Menu>

      <ConfirmationDialog content={confirmContent} onClose={() => setConfirmContent(null)} />
    </Stack>
  );
}
