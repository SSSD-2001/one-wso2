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

import { Chip, alpha, useTheme } from "@wso2/oxygen-ui";

// Only the "isHeading" variant is ported — AssignQuota.tsx always passes
// isHeading={true}, so the unused standalone-chip branch is dropped.
export default function ParQuotaStatusChip({
  type,
  available,
  allocated,
}: {
  type: string;
  available: number;
  allocated: number;
}) {
  const theme = useTheme();
  const isUnderServed = allocated < available;
  const label = available !== 0 ? `${type} Slots : ${allocated} / ${available}` : `${type} Slots : N/A`;

  return (
    <Chip
      label={label}
      sx={{
        bgcolor: isUnderServed ? alpha(theme.palette.warning.main, theme.palette.mode === "light" ? 0.35 : 0.45) : undefined,
      }}
    />
  );
}
