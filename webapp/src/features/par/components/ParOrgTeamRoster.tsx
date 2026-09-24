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
import { Avatar, Box, Card, DataGrid, IconButton, InputAdornment, Link, Skeleton, Stack, TextField, Tooltip, Typography } from "@wso2/oxygen-ui";
import { HistoryIcon, PencilIcon, SearchIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useLeaveEmployees } from "@features/leave/api/useLeaveData";
import { useParTeamDetails } from "../api/useLeadTeams";
import ParStatusChip from "./ParStatusChip";
import ParLeadHistoryModal from "./ParLeadHistoryModal";
import type { ParCycle, ParRatingMinimal, ParTeamSummary } from "../api/types";

// Admin Portal's Team View drill-in — same roster grid as
// ParLeadTeamRoster.tsx, minus the lead-only bulk actions (Copy Emails/
// Share/Send 360° Reminder) and the Cycle Dates icon. Adds a per-row History
// icon so an admin browsing by team can reach PAR history too.
export default function ParOrgTeamRoster({
  cycle,
  team,
  onBack,
  onOpenReview,
}: {
  cycle: ParCycle;
  team: ParTeamSummary;
  onBack: () => void;
  onOpenReview: (employeeEmail: string) => void;
}) {
  const details = useParTeamDetails(cycle.parCycleId, team.parTeamId);
  // No org-wide employee directory of our own — reuses Leave's for avatars,
  // same deviation ParLeadTeamRoster.tsx already makes.
  const employees = useLeaveEmployees();
  const thumbnailByEmail = useMemo(
    () => new Map(employees.data?.map((e) => [e.workEmail, e.employeeThumbnail]) ?? []),
    [employees.data],
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [historyTarget, setHistoryTarget] = useState<{ email: string; name: string } | undefined>(undefined);

  if (details.isLoading) {
    return <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1.5 }} />;
  }
  if (details.isError) {
    return (
      <ErrorNotice error={details.error} onRetry={() => details.refetch()} retrying={details.isFetching}>
        Couldn't load this team's roster.
      </ErrorNotice>
    );
  }

  const members = details.data?.details ?? [];
  const filteredMembers = members
    .filter((member) =>
      `${member.parEmployeeName.toLowerCase()}${member.parEmployeeEmail.toLowerCase()}`.includes(searchTerm.toLowerCase()),
    )
    .sort((a, b) => a.parEmployeeName.localeCompare(b.parEmployeeName));

  const columns: DataGrid.GridColDef<ParRatingMinimal>[] = [
    {
      field: "parEmployeeName",
      headerName: "Team Member",
      flex: 1.5,
      renderCell: (params) => (
        <Box
          role="button"
          tabIndex={0}
          onClick={() => onOpenReview(params.row.parEmployeeEmail)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpenReview(params.row.parEmployeeEmail);
            }
          }}
          sx={{ cursor: "pointer", display: "flex", alignItems: "center", height: "100%" }}
        >
          <Avatar
            src={thumbnailByEmail.get(params.row.parEmployeeEmail) || undefined}
            slotProps={{ img: { referrerPolicy: "no-referrer" } }}
            sx={{ mr: 1.5, height: "2.2rem", width: "2.2rem" }}
          />
          <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {params.row.parEmployeeName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {params.row.parEmployeeEmail}
            </Typography>
          </Box>
        </Box>
      ),
    },
    {
      field: "parEmployeeStatus",
      headerName: "Employee PAR",
      flex: 0.8,
      renderCell: (params) => <ParStatusChip content={params.row.parEmployeeStatus} />,
    },
    {
      field: "par360ReviewStatus",
      headerName: "360° Feedback",
      flex: 0.9,
      renderCell: (params) => (
        <ParStatusChip
          content={params.row.par360ReviewStatus}
          countDetails={{
            completed: params.row.par360ReviewCounts.sharedReviewCount,
            total: params.row.par360ReviewCounts.requestedReviewCount,
          }}
        />
      ),
    },
    {
      field: "parLeadStatus",
      headerName: "Lead's PAR",
      flex: 0.8,
      renderCell: (params) => <ParStatusChip content={params.row.parLeadStatus} />,
    },
    {
      field: "parRating",
      headerName: "Rating",
      flex: 0.8,
      renderCell: (params) => <ParStatusChip content={params.row.parRating ?? ""} />,
    },
    {
      field: "parSpecialRating",
      headerName: "Top 5%/20% Rating",
      flex: 0.9,
      renderCell: (params) => <ParStatusChip content={params.row.parSpecialRating ?? ""} />,
    },
    {
      field: "parF2fStatus",
      headerName: "F2F",
      flex: 0.6,
      renderCell: (params) => <ParStatusChip content={params.row.parF2fStatus} />,
    },
    {
      field: "actions",
      headerName: "",
      sortable: false,
      flex: 0.6,
      renderCell: (params) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Review" arrow>
            <IconButton onClick={() => onOpenReview(params.row.parEmployeeEmail)}>
              <PencilIcon size={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="View summary of PAR history" arrow>
            <IconButton
              onClick={() => setHistoryTarget({ email: params.row.parEmployeeEmail, name: params.row.parEmployeeName })}
            >
              <HistoryIcon size={18} />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <Stack spacing={2}>
      <Box>
        <Link component="button" underline="hover" onClick={onBack} sx={{ mr: 0.5 }}>
          All Teams
        </Link>
        <Typography component="span" sx={{ mx: 0.5 }}>
          /
        </Typography>
        <Typography component="span" variant="h5">
          {[team.parBusinessUnit, team.parDepartment, team.parTeam, team.parSubTeam].filter(Boolean).join(" / ")}
        </Typography>
      </Box>

      <Card variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 1.5 }}>
          <Typography variant="h6">Members</Typography>
          <TextField
            size="small"
            placeholder="Search Members"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon size={16} />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Stack>

        <DataGrid.DataGrid
          rows={filteredMembers}
          columns={columns}
          getRowId={(row) => row.parRatingId}
          rowHeight={56}
          disableRowSelectionOnClick
          sx={{ border: "none" }}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          pageSizeOptions={[10, 20, 25]}
        />
      </Card>

      {historyTarget && (
        <ParLeadHistoryModal
          open
          onClose={() => setHistoryTarget(undefined)}
          employeeEmail={historyTarget.email}
          employeeName={historyTarget.name}
        />
      )}
    </Stack>
  );
}
