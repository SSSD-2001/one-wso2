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

// The employee-facing half of the promotion app, surfaced inside the Me
// perspective — viewing your own promotion history is something every
// employee does for themself, same rationale as PAR's ME_PAR_APPS (see
// parApps.ts) and Leave. The Lead/Functional Lead/Promotion Board/Admin
// portals are People Ops work and, once ported, will live there instead.

import { AwardIcon } from "@wso2/oxygen-ui-icons-react";
import type { MenuApp } from "@constants/appMenu";

export const ME_PROMOTION_APPS: readonly MenuApp[] = [
  {
    key: "promotion",
    name: "Promotion",
    icon: AwardIcon,
    purpose: "View your promotion history.",
    items: [
      {
        id: "promotion-history",
        label: "Promotion History",
        desc: "See every promotion cycle you've been approved for, since you joined.",
        path: "/me/promotion",
      },
    ],
  },
];
