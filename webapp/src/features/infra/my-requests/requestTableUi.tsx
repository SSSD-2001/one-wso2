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

import { Chip, IconButton, Stack, Tooltip } from "@wso2/oxygen-ui";
import {
  ExternalLinkIcon,
  EyeIcon,
  GavelIcon,
  PencilIcon,
} from "@wso2/oxygen-ui-icons-react";
import type { InfraRequestState } from "../api/infraTypes";

export function stateChipColor(state: InfraRequestState): "success" | "error" | "warning" {
  if (state === "Approved") return "success";
  if (state === "Rejected") return "error";
  return "warning";
}

export function CountChip({
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

export function StateChip({ state }: { state: InfraRequestState }) {
  return <Chip size="small" variant="outlined" color={stateChipColor(state)} label={state} />;
}

export function RequestRowActions({
  onView,
  onEdit,
  onDecide,
  onVisit,
}: {
  onView?: () => void;
  onEdit?: () => void;
  onDecide?: () => void;
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
      {onDecide && (
        <Tooltip title="Take Decision">
          <IconButton aria-label="Take Decision" size="small" color="primary" onClick={onDecide}>
            <GavelIcon size={16} />
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

export function visitRepository(organizationName: string, repoName: string) {
  window.open(
    `https://github.com/${organizationName}/${repoName}`,
    "_blank",
    "noopener,noreferrer",
  );
}
