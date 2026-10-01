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

import { Avatar, Box, Chip, IconButton, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@wso2/oxygen-ui";
import { ArrowRightLeftIcon, PencilIcon, Trash2Icon } from "@wso2/oxygen-ui-icons-react";
import { promotionRoleColor } from "../util/promotionRoleColors";
import type { PromotionUser } from "../api/types";

// Ports promotion-app's own component/user/userLine.tsx. The Access Levels
// viewer icon source itself keeps but has commented out ("Temporary Hide
// for not functioning") is not reproduced — unreachable UI in the real
// running app, same principle as every other dead-code omission in this
// port.
export default function UserRow({
  user,
  isSelf,
  onEdit,
  onTransfer,
  onDelete,
  onToggleActive,
  toggling,
}: {
  user: PromotionUser;
  isSelf: boolean;
  onEdit: () => void;
  onTransfer: () => void;
  onDelete: () => void;
  onToggleActive: (active: boolean) => void;
  toggling: boolean;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        py: 1.25,
        px: 1,
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Avatar src={user.employeeThumbnail ?? undefined} sx={{ width: 40, height: 40 }}>
        {user.firstName?.[0]}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 14, fontWeight: isSelf ? 700 : 500 }} noWrap>
          {user.firstName} {user.lastName} ({user.email})
        </Typography>
        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: "wrap" }}>
          {user.roles.map((role) => (
            <Chip key={role} label={role} size="small" sx={{ bgcolor: promotionRoleColor(role), color: "white" }} />
          ))}
        </Stack>
      </Box>
      <Tooltip title="Transfer access">
        <IconButton size="small" onClick={onTransfer}>
          <ArrowRightLeftIcon size={16} />
        </IconButton>
      </Tooltip>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={user.active ? "active" : "inactive"}
        disabled={toggling}
        onChange={(_e, value) => {
          if (value) onToggleActive(value === "active");
        }}
      >
        <ToggleButton value="active">Active</ToggleButton>
        <ToggleButton value="inactive">Inactive</ToggleButton>
      </ToggleButtonGroup>
      <Tooltip title="Delete">
        <IconButton size="small" onClick={onDelete}>
          <Trash2Icon size={16} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Edit">
        <IconButton size="small" onClick={onEdit}>
          <PencilIcon size={16} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
