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

// The employee-facing half of par-app, surfaced inside the Me perspective —
// completing and sharing your own PAR is something every employee does for
// themself, same rationale as Leave and Claims. The Lead Portal (reviewing
// and rating *other people's* PAR) stays under People Ops, the same split
// claim approval applies.

import { ClipboardCheckIcon } from "@wso2/oxygen-ui-icons-react";
import type { MenuApp } from "@constants/appMenu";

export const ME_PAR_APPS: readonly MenuApp[] = [
  {
    key: "par",
    name: "PAR",
    icon: ClipboardCheckIcon,
    purpose: "Complete and share your PAR for the current cycle.",
    items: [
      {
        id: "par-employee-feedback",
        label: "PAR",
        desc: "Complete and share your PAR for the current cycle.",
        path: "/me/performance",
      },
    ],
  },
];

/**
 * This item's own rail id, which the rail must route through
 * useParEmployeeItemVisible rather than through `requires`/`caps` — see the
 * comment on that hook. Same treatment as PAR_LEAD_PORTAL_ITEM_ID /
 * PAR_ADMIN_PORTAL_ITEM_ID in constants/perspectives.
 */
export const PAR_EMPLOYEE_ITEM_ID = "par-employee-feedback";
