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
  Alert,
  Box,
  Button,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import { ArrowLeftIcon, ChevronRightIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useMeProfile } from "@features/my/api/useMeProfile";
import { formatShortDate } from "../util/parDate";
import { sortClosedCyclesLatestFirst } from "../util/parEmployeeHistory";
import { useClosedParCycles, useParRating } from "../api/useParData";
import ParRatingSummary from "../components/ParRatingSummary";
import type { ParCycle } from "../api/types";

// People Ops → Performance → History: par-app's ParHistory.tsx "My History" tab
// (its lead-only "Report Chain" tab belongs with the Lead Portal work, not
// here). A row's own record is fetched
// only once opened, not one request per row on load.
export default function ParHistoryTab() {
  const profile = useMeProfile();
  const workEmail = profile.data?.userInfo.workEmail;
  const cycles = useClosedParCycles(workEmail, Boolean(workEmail));
  const [opened, setOpened] = useState<ParCycle | undefined>(undefined);

  if (profile.isLoading || cycles.isLoading) {
    return <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5, maxWidth: 880 }} />;
  }
  if (profile.isError) {
    return (
      <ErrorNotice error={profile.error} onRetry={() => profile.refetch()} retrying={profile.isFetching}>
        Couldn't load your profile.
      </ErrorNotice>
    );
  }
  if (cycles.isError) {
    return (
      <ErrorNotice error={cycles.error} onRetry={() => cycles.refetch()} retrying={cycles.isFetching}>
        Couldn't load your past PAR cycles.
      </ErrorNotice>
    );
  }

  const rows = sortClosedCyclesLatestFirst(cycles.data ?? []);

  return (
    <Box sx={{ maxWidth: 880 }}>
      {/* ParHistory.tsx's own notice — shown above both the list and the
          detail view, not just the list. */}
      <Alert severity="info" sx={{ mb: 2 }}>
        PAR history data is available only for PAR cycles from 2024 H2 onwards. Please refer to
        PeopleHR for the history data.
      </Alert>

      {opened ? (
        <>
          <Button
            size="small"
            startIcon={<ArrowLeftIcon size={14} />}
            onClick={() => setOpened(undefined)}
            sx={{ mb: 1.5 }}
          >
            History
          </Button>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
            {opened.parCycleName} review
          </Typography>
          <HistoryCycleDetail cycle={opened} workEmail={workEmail} />
        </>
      ) : rows.length === 0 ? (
        <Alert severity="info">No past PAR cycles on file.</Alert>
      ) : (
        <HistoryTable rows={rows} onOpen={setOpened} />
      )}
    </Box>
  );
}

function HistoryTable({ rows, onOpen }: { rows: ParCycle[]; onOpen: (cycle: ParCycle) => void }) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Cycle</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Start</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>End</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((cycle) => (
            <TableRow
              key={cycle.parCycleId}
              hover
              tabIndex={0}
              role="button"
              aria-label={`Open ${cycle.parCycleName} review`}
              sx={{ cursor: "pointer" }}
              onClick={() => onOpen(cycle)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(cycle);
                }
              }}
            >
              <TableCell>{cycle.parCycleName}</TableCell>
              <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>{formatShortDate(cycle.parCycleStartDate)}</TableCell>
              <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>{formatShortDate(cycle.parCycleEndDate)}</TableCell>
              <TableCell align="right">
                <ChevronRightIcon size={16} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function HistoryCycleDetail({ cycle, workEmail }: { cycle: ParCycle; workEmail: string | undefined }) {
  const rating = useParRating(cycle.parCycleId, workEmail);

  if (rating.isLoading) {
    return <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1.5 }} />;
  }
  if (rating.isError) {
    return (
      <ErrorNotice error={rating.error} onRetry={() => rating.refetch()} retrying={rating.isFetching}>
        Couldn't load your record for this cycle.
      </ErrorNotice>
    );
  }
  if (!rating.data) {
    return <Alert severity="info">No record was found for you in this cycle.</Alert>;
  }
  return <ParRatingSummary cycle={cycle} rating={rating.data} />;
}
