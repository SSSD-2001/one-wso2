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
import { Box, IconButton, Skeleton, TextField, Tooltip, InputAdornment } from "@wso2/oxygen-ui";
import { RefreshCwIcon, SearchIcon } from "@wso2/oxygen-ui-icons-react";
import { humanizeHttpError } from "@api/http";
import { usePromotionTeam } from "../api/usePromotionTeam";
import PromotionEmptyState from "./PromotionEmptyState";
import PromotionEmployeeCard from "./PromotionEmployeeCard";
import PromotionEmployeeHistoryDialog from "./PromotionEmployeeHistoryDialog";
import { TriangleAlertIcon, InboxIcon } from "@wso2/oxygen-ui-icons-react";

// Ports source's own employeesHistory.tsx / indirectReports.tsx — identical
// screens bar which relationship they query, so one shared component
// parameterized by `kind` rather than two near-duplicate files. Search
// matches work email only, same narrower scope source's own
// filteredEmployees uses (not name).
export default function PromotionTeamRoster({ kind, email }: { kind: "direct" | "indirect"; email: string | undefined }) {
  const team = usePromotionTeam(kind, email);
  const [searchKey, setSearchKey] = useState("");
  const [viewingEmail, setViewingEmail] = useState<string | null>(null);

  const employees = team.data?.employees ?? [];
  const filtered = useMemo(
    () =>
      searchKey === ""
        ? (team.data?.employees ?? [])
        : (team.data?.employees ?? []).filter((e) => e.workEmail.toLowerCase().includes(searchKey.toLowerCase())),
    [team.data, searchKey],
  );

  return (
    <>
      <PromotionEmployeeHistoryDialog workEmail={viewingEmail} onClose={() => setViewingEmail(null)} />

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Tooltip title="Refresh">
          <IconButton
            size="small"
            onClick={() => {
              setSearchKey("");
              void team.refetch();
            }}
          >
            <RefreshCwIcon size={16} />
          </IconButton>
        </Tooltip>
        <TextField
          size="small"
          placeholder="Search"
          value={searchKey}
          onChange={(e) => setSearchKey(e.target.value)}
          sx={{ width: 280 }}
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
      </Box>

      {team.isPending ? (
        <Box>
          <Skeleton variant="rectangular" height={92} sx={{ borderRadius: 1, mb: 1.5 }} />
          <Skeleton variant="rectangular" height={92} sx={{ borderRadius: 1 }} />
        </Box>
      ) : team.isError ? (
        <PromotionEmptyState
          icon={<TriangleAlertIcon size={28} />}
          tone="error"
          message={`Unable to load employees. ${humanizeHttpError(team.error)}`}
        />
      ) : employees.length === 0 ? (
        <PromotionEmptyState icon={<InboxIcon size={28} />} message="There are no employees assigned to you" />
      ) : filtered.length === 0 ? (
        <PromotionEmptyState icon={<SearchIcon size={28} />} message="No employees found" />
      ) : (
        filtered.map((emp) => (
          <PromotionEmployeeCard key={emp.workEmail} employee={emp} onView={() => setViewingEmail(emp.workEmail)} />
        ))
      )}
    </>
  );
}
