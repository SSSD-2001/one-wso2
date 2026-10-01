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
  AdapterDateFns,
  Box,
  Button,
  DatePickers,
  Grid,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import ConfirmationDialog, { type ConfirmationContent } from "@components/confirmation-dialog/ConfirmationDialog";
import type { PromotionCycleCreatePayload } from "../api/useAdminPromotionCycle";

const { DatePicker, LocalizationProvider } = DatePickers;

const YEARS = Array.from({ length: 8 }, (_, i) => String(2023 + i));
const HALVES = ["H1", "H2"];

function toDateOnly(d: Date | null): string {
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

// The DatePickers' own minDate/maxDate only constrain what a NEW pick can
// be — they don't retroactively invalidate a value already sitting in
// state when a dependency (startDate, functionalLeadDeadline) changes
// later, so canSubmit re-checks the same ordering explicitly.
function withinRange(date: Date, min: Date, max: Date): boolean {
  return date >= min && date <= max;
}

// Ports promotion-app's own component/forms/promotionCycleForm.tsx
// ("NewCycleForm") — creates a new promotion cycle with three deadlines
// nested inside the cycle's own date range. `name` is built client-side as
// `{year}-{half}` (e.g. "2026-H1"), matching source exactly rather than
// taking a free-text cycle name.
export default function PromotionCycleCreateForm({
  creating,
  onCreate,
}: {
  creating: boolean;
  onCreate: (payload: PromotionCycleCreatePayload) => void;
}) {
  const today = new Date();
  const [year, setYear] = useState("");
  const [half, setHalf] = useState("");
  const [startDate, setStartDate] = useState<Date | null>(today);
  const [endDate, setEndDate] = useState<Date | null>(addDays(today, 4));
  const [leadDeadline, setLeadDeadline] = useState<Date | null>(addDays(today, 1));
  const [functionalLeadDeadline, setFunctionalLeadDeadline] = useState<Date | null>(addDays(today, 2));
  const [promotionBoardDeadline, setPromotionBoardDeadline] = useState<Date | null>(addDays(today, 3));
  const [confirm, setConfirm] = useState<ConfirmationContent | null>(null);

  const canSubmit =
    Boolean(year) &&
    Boolean(half) &&
    Boolean(startDate) &&
    Boolean(endDate) &&
    Boolean(leadDeadline) &&
    Boolean(functionalLeadDeadline) &&
    Boolean(promotionBoardDeadline) &&
    startDate! <= endDate! &&
    withinRange(leadDeadline!, startDate!, endDate!) &&
    withinRange(functionalLeadDeadline!, startDate!, endDate!) &&
    withinRange(promotionBoardDeadline!, functionalLeadDeadline!, endDate!) &&
    !creating;

  const handleSubmit = () => {
    setConfirm({
      title: "Do you want to create a promotion cycle?",
      text: "Please note that creating a promotion cycle, allowing eligible employees to apply for a promotion.",
      confirmLabel: "create",
      confirmAction: () => {
        onCreate({
          name: `${year}-${half}`,
          startDate: toDateOnly(startDate),
          endDate: toDateOnly(endDate),
          leadDeadline: toDateOnly(leadDeadline),
          functionalLeadDeadline: toDateOnly(functionalLeadDeadline),
          promotionBoardDeadline: toDateOnly(promotionBoardDeadline),
        });
      },
    });
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <ConfirmationDialog content={confirm} onClose={() => setConfirm(null)} />
      <Stack spacing={2}>
        <Grid container spacing={2}>
          <Grid size={6}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>Year</Typography>
            <Select fullWidth size="small" value={year} onChange={(e) => setYear(e.target.value as string)} displayEmpty>
              <MenuItem value="" disabled>
                Select year
              </MenuItem>
              {YEARS.map((y) => (
                <MenuItem key={y} value={y}>
                  {y}
                </MenuItem>
              ))}
            </Select>
          </Grid>
          <Grid size={6}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>Cycle</Typography>
            <Select fullWidth size="small" value={half} onChange={(e) => setHalf(e.target.value as string)} displayEmpty>
              <MenuItem value="" disabled>
                Select cycle
              </MenuItem>
              {HALVES.map((h) => (
                <MenuItem key={h} value={h}>
                  {h}
                </MenuItem>
              ))}
            </Select>
          </Grid>
          <Grid size={6}>
            <DatePicker
              label="Start Date"
              value={startDate}
              minDate={today}
              onChange={(d: Date | null) => {
                setStartDate(d);
                setEndDate(null);
              }}
              slotProps={{ textField: { fullWidth: true, size: "small" } }}
            />
          </Grid>
          <Grid size={6}>
            <DatePicker
              label="End Date"
              value={endDate}
              minDate={startDate ?? today}
              onChange={(d: Date | null) => setEndDate(d)}
              slotProps={{ textField: { fullWidth: true, size: "small" } }}
            />
          </Grid>
          <Grid size={6}>
            <DatePicker
              label="Lead Deadline Date"
              value={leadDeadline}
              minDate={startDate ?? today}
              maxDate={endDate ?? undefined}
              onChange={(d: Date | null) => setLeadDeadline(d)}
              slotProps={{ textField: { fullWidth: true, size: "small" } }}
            />
          </Grid>
          <Grid size={6}>
            <DatePicker
              label="Functional Lead Deadline Date"
              value={functionalLeadDeadline}
              minDate={startDate ?? today}
              maxDate={endDate ?? undefined}
              onChange={(d: Date | null) => setFunctionalLeadDeadline(d)}
              slotProps={{ textField: { fullWidth: true, size: "small" } }}
            />
          </Grid>
          <Grid size={6}>
            <DatePicker
              label="Promotion Board Deadline Date"
              value={promotionBoardDeadline}
              minDate={functionalLeadDeadline ?? startDate ?? today}
              maxDate={endDate ?? undefined}
              onChange={(d: Date | null) => setPromotionBoardDeadline(d)}
              slotProps={{ textField: { fullWidth: true, size: "small" } }}
            />
          </Grid>
        </Grid>
        <Box>
          <Button variant="contained" color="success" fullWidth disabled={!canSubmit} onClick={handleSubmit}>
            Submit
          </Button>
        </Box>
      </Stack>
    </LocalizationProvider>
  );
}
