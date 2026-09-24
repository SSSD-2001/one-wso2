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
import { ToggleButton, ToggleButtonGroup } from "@wso2/oxygen-ui";
import { isCcBackendConfigured } from "@config/apiConfig";
import { FINANCE_EYEBROW } from "@constants/financeApps";
import FinanceShell from "../../components/FinanceShell";
import { ApproveBody, type ApproveRole } from "./CcApproveBody";
import { useCcUserInfo } from "../useCc";
import { ccHasAccess } from "../ccTypes";

// approve-submissions/index.tsx:192-194 capitalises the role for the heading.
const ROLE_TITLE: Record<ApproveRole, string> = { lead: "Lead", finance: "Finance" };

/**
 * Credit Card Expenses' own approval queue. The one place this app's
 * submissions are decided on — approving is work done for other people, so
 * it sits under Finance rather than under Me with the things you do for
 * yourself.
 *
 * Approving is a mode, not a per-row decision.
 *
 * The source derives one `approveRole` from the user's own roles with finance
 * winning (index.tsx:83-87), names it in the heading, and offers a switcher
 * only to someone who holds both (index.tsx:198). The mode decides what the
 * queue contains, so the heading has to say which mode is in force — a merged
 * list under a role-named heading would claim a filter it had not applied.
 *
 * Derived-with-override rather than the source's effect: `approveRole` is null
 * until someone picks, and the default is computed. Same behaviour, without a
 * state write on first render.
 */
export default function CcApprovePage() {
  const userInfo = useCcUserInfo();
  const isFinance = ccHasAccess(userInfo.data, "finance");
  const isLead = ccHasAccess(userInfo.data, "lead");
  const [picked, setPicked] = useState<ApproveRole | null>(null);
  const role: ApproveRole | null = picked ?? (isFinance ? "finance" : isLead ? "lead" : null);
  // Owned here rather than inside ApproveBody: the row ticked a moment ago
  // may not even be actionable in the mode being switched to, so a role
  // change has to clear it at this same point, not react to it afterwards.
  const [checked, setChecked] = useState<Set<number>>(new Set());

  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.cc}
      // No suffix until the roles have loaded — the source renders no heading
      // at all until then, so there is nothing to be faithful to mid-flight.
      title={
        role ? `Approve Expense Submissions (${ROLE_TITLE[role]})` : "Approve Expense Submissions"
      }
      subtitle="Review and approve card transactions submitted by your team. Leads approve pending-lead items; finance gives the final approval."
      configured={isCcBackendConfigured()}
      configKey="ONE_WSO2_CC_EXPENSES_BACKEND_URL"
      fill
    >
      {/* index.tsx:198-210 — offered only to someone who holds both roles;
          everyone else has one mode and the heading already names it. */}
      {isLead && isFinance && role && (
        <ToggleButtonGroup
          size="small"
          exclusive
          value={role}
          onChange={(_e, v) => {
            if (!v) return;
            setChecked(new Set());
            setPicked(v as ApproveRole);
          }}
          sx={{ mb: 2, alignSelf: "flex-start" }}
        >
          <ToggleButton value="lead" sx={{ textTransform: "none" }}>
            As lead
          </ToggleButton>
          <ToggleButton value="finance" sx={{ textTransform: "none" }}>
            As finance
          </ToggleButton>
        </ToggleButtonGroup>
      )}
      <ApproveBody
        // Remounts on a role change, so ApproveBody's own filter state (user,
        // card, and finance's stage filter) resets with it — otherwise a
        // stage picked as finance silently narrows the queue again on
        // switching back to it, after a detour through lead.
        key={role}
        userInfo={userInfo}
        isLead={isLead}
        isFinance={isFinance}
        role={role}
        checked={checked}
        setChecked={setChecked}
      />
    </FinanceShell>
  );
}
