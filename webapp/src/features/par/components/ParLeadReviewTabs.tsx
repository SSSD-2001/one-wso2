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
import { Avatar, Box, Breadcrumbs, Button, Chip, Divider, IconButton, Link, Stack, Tab, Tabs, Tooltip } from "@wso2/oxygen-ui";
import { ArrowLeftIcon } from "@wso2/oxygen-ui-icons-react";
import { useLeaveEmployees } from "@features/leave/api/useLeaveData";
import { useParRating } from "../api/useParData";
import ParLeadReviewPanel from "./ParLeadReviewPanel";
import ParLead360ReviewsTab from "./ParLead360ReviewsTab";
import ParLeadF2fPanel from "./ParLeadF2fPanel";
import ParLeadHistoryModal from "./ParLeadHistoryModal";
import ParUpdateStatusPanel from "./ParUpdateStatusPanel";
import type { ParCycle } from "../api/types";

// par-app's Review.tsx. In admin mode (isAdminAuditViewOn), source shows
// ONLY "Lead's Feedback" and "Update Status" — 360 Reviews, F2F and the Par
// History button are all hidden, not just de-emphasized.
export default function ParLeadReviewTabs({
  cycle,
  employeeEmail,
  onBack,
  isAdminView = false,
}: {
  cycle: ParCycle;
  employeeEmail: string;
  onBack: () => void;
  isAdminView?: boolean;
}) {
  const rating = useParRating(cycle.parCycleId, employeeEmail);
  const thumbnails = useLeaveEmployees();
  const [tab, setTab] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);

  const employeeName = rating.data?.parEmployeeName ?? employeeEmail;
  const thumbnail = thumbnails.data?.find((e) => e.workEmail === employeeEmail)?.employeeThumbnail;
  // The employee's own org path, not the list tab's drill-down trail.
  const orgPath = [rating.data?.parBusinessUnit, rating.data?.parDepartment, rating.data?.parTeam, rating.data?.parSubTeam]
    .filter(Boolean)
    .map((s) => s!.toUpperCase())
    .join(" / ");

  return (
    <Stack spacing={1.5}>
      <Box>
        <Breadcrumbs>
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton aria-label="back" color="primary" onClick={onBack}>
              <ArrowLeftIcon size={18} />
            </IconButton>
            {rating.isSuccess && orgPath && (
              <Tooltip title={orgPath} arrow>
                <Link
                  component="button"
                  underline="hover"
                  color="inherit"
                  onClick={onBack}
                  sx={{ maxWidth: "40rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {orgPath}
                </Link>
              </Tooltip>
            )}
            <Chip
              label={employeeName}
              avatar={<Avatar src={thumbnail} slotProps={{ img: { referrerPolicy: "no-referrer" } }} />}
            />
          </Stack>
        </Breadcrumbs>
        <Divider />
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
        <Tabs value={tab} onChange={(_e, value) => setTab(value)} aria-label="employee review sections">
          <Tab label="Lead's Feedback" />
          {isAdminView ? (
            <Tab label="Update Status" />
          ) : (
            [<Tab key="360" label="360 Reviews" />, <Tab key="f2f" label="F2F" />]
          )}
        </Tabs>
        {!isAdminView && (
          <Button variant="contained" size="small" onClick={() => setHistoryOpen(true)}>
            Par History
          </Button>
        )}
      </Box>

      <Box sx={{ p: "10px 10px 0px 10px" }}>
        {tab === 0 && <ParLeadReviewPanel cycle={cycle} employeeEmail={employeeEmail} isAdminView={isAdminView} />}
        {isAdminView
          ? tab === 1 && <ParUpdateStatusPanel cycle={cycle} employeeEmail={employeeEmail} />
          : tab === 1 && (
              <ParLead360ReviewsTab
                cycle={cycle}
                employeeEmail={employeeEmail}
                leadStatus={rating.data?.parLeadStatus}
                leadStatusKnown={rating.isSuccess}
              />
            )}
        {!isAdminView && tab === 2 && <ParLeadF2fPanel cycle={cycle} employeeEmail={employeeEmail} />}
      </Box>

      {!isAdminView && (
        <ParLeadHistoryModal
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          employeeEmail={employeeEmail}
          employeeName={employeeName}
        />
      )}
    </Stack>
  );
}
