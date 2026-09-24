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

import type { ReactNode } from "react";
import { Box, LinearProgress, Paper, Typography, useTheme } from "@wso2/oxygen-ui";
import { completionPercent, completionSeverity } from "../util/parCompletionSeverity";

// Same icon-badge treatment as Security's KpiCards.tsx (GRC audit
// dashboard) — a real hex color is needed for the `${color}18` alpha
// suffix, hence useTheme() rather than the `success.main` string shorthand.
export default function ParCompletionKpiTile({
  icon,
  label,
  completed,
  total,
}: {
  icon: ReactNode;
  label: string;
  completed: number;
  total: number;
}) {
  const theme = useTheme();
  const percent = completionPercent(completed, total);
  const severity = completionSeverity(percent);
  const color = severity === "success" ? theme.palette.success.main : theme.palette[severity].main;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, p: 2.5, display: "flex", alignItems: "center", gap: 2 }}>
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: 1.5,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color,
          bgcolor: `${color}18`,
          "[data-color-scheme='dark'] &": { bgcolor: `${color}33` },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1 }}>
          {/* Severity lives in the icon badge and the bar below, the same
              restrained places the rest of the app puts it (small chips,
              icon avatars, a colored bar) — never a whole stat number in
              solid error/warning color, which read as much louder than any
              other severity indicator in this app. */}
          <Typography variant="h4" fontWeight={700} lineHeight={1.1}>
            {Math.round(percent)}%
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {completed} / {total}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" noWrap sx={{ mb: 1 }}>
          {label}
        </Typography>
        <LinearProgress variant="determinate" value={percent} color={severity} sx={{ height: 6, borderRadius: 3 }} />
      </Box>
    </Paper>
  );
}
