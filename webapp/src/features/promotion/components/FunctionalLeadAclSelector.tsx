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
import { Box, Checkbox, Collapse, IconButton, Typography } from "@wso2/oxygen-ui";
import { ChevronRightIcon } from "@wso2/oxygen-ui-icons-react";
import {
  buState,
  deptState,
  toggleBu,
  toggleDept,
  toggleTeam,
  type PromotionAclSelection,
} from "../util/promotionAcl";
import type { PromotionBusinessUnitAccess, PromotionDepartmentAccess } from "../api/types";

// Ports promotion-app's own component/forms/components/functionalLeadACLSelector.tsx
// — which businessUnit/department/team scope a FUNCTIONAL_LEAD system user
// gets. Source lays this out as three parallel columns (BU list | Department
// list | Team list) that narrow as you click across; this ports the same
// tri-state selection semantics (checking a parent selects every
// descendant, a partially-selected parent shows indeterminate) as a single
// expandable tree instead — simpler to get right for a picker this deep,
// and no less capable.
export default function FunctionalLeadAclSelector({
  businessUnits,
  selection,
  onChange,
}: {
  businessUnits: PromotionBusinessUnitAccess[];
  selection: PromotionAclSelection;
  onChange: (next: PromotionAclSelection) => void;
}) {
  return (
    <Box sx={{ maxHeight: 320, overflow: "auto", border: 1, borderColor: "divider", borderRadius: 1, p: 1 }}>
      {businessUnits.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary", p: 1 }}>No business units found.</Typography>
      ) : (
        businessUnits.map((bu) => <BuNode key={bu.id} bu={bu} selection={selection} onChange={onChange} />)
      )}
    </Box>
  );
}

function BuNode({
  bu,
  selection,
  onChange,
}: {
  bu: PromotionBusinessUnitAccess;
  selection: PromotionAclSelection;
  onChange: (next: PromotionAclSelection) => void;
}) {
  const [open, setOpen] = useState(false);
  const depts = bu.departments ?? [];
  const state = buState(selection, bu);

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center" }}>
        {depts.length > 0 ? (
          <IconButton size="small" onClick={() => setOpen((v) => !v)}>
            <ChevronRightIcon size={16} style={{ transform: open ? "rotate(90deg)" : undefined }} />
          </IconButton>
        ) : (
          <Box sx={{ width: 32 }} />
        )}
        <Checkbox
          size="small"
          checked={state === "checked"}
          indeterminate={state === "indeterminate"}
          onChange={(_e, checked) => onChange(toggleBu(selection, bu, checked))}
        />
        <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{bu.name}</Typography>
      </Box>
      {depts.length > 0 && (
        <Collapse in={open}>
          <Box sx={{ ml: 4 }}>
            {depts.map((dept) => (
              <DeptNode key={dept.id} dept={dept} selection={selection} onChange={onChange} />
            ))}
          </Box>
        </Collapse>
      )}
    </Box>
  );
}

function DeptNode({
  dept,
  selection,
  onChange,
}: {
  dept: PromotionDepartmentAccess;
  selection: PromotionAclSelection;
  onChange: (next: PromotionAclSelection) => void;
}) {
  const [open, setOpen] = useState(false);
  const teams = dept.teams ?? [];
  const state = deptState(selection, dept);

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center" }}>
        {teams.length > 0 ? (
          <IconButton size="small" onClick={() => setOpen((v) => !v)}>
            <ChevronRightIcon size={16} style={{ transform: open ? "rotate(90deg)" : undefined }} />
          </IconButton>
        ) : (
          <Box sx={{ width: 32 }} />
        )}
        <Checkbox
          size="small"
          checked={state === "checked"}
          indeterminate={state === "indeterminate"}
          onChange={(_e, checked) => onChange(toggleDept(selection, dept, checked))}
        />
        <Typography sx={{ fontSize: 13 }}>{dept.name}</Typography>
      </Box>
      {teams.length > 0 && (
        <Collapse in={open}>
          <Box sx={{ ml: 4 }}>
            {teams.map((team) => (
              <Box key={team.id} sx={{ display: "flex", alignItems: "center" }}>
                <Box sx={{ width: 32 }} />
                <Checkbox
                  size="small"
                  checked={selection.has(`team:${team.id}`)}
                  onChange={(_e, checked) => onChange(toggleTeam(selection, team.id, checked))}
                />
                <Typography sx={{ fontSize: 12.5 }}>{team.name}</Typography>
              </Box>
            ))}
          </Box>
        </Collapse>
      )}
    </Box>
  );
}
