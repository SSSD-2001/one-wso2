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

import { GitHub, SettingsIcon, ShieldIcon } from "@wso2/oxygen-ui-icons-react";
import type { MenuApp } from "@constants/appMenu";

export const INFRA_APPS: readonly MenuApp[] = [
  {
    key: "github",
    name: "GitHub",
    icon: GitHub,
    alwaysGroup: true,
    purpose: "Connect GitHub, request repositories, and review those requests.",
    items: [
        {
            id: "infra-github-new-repository",
            label: "New Repository",
            desc: "Request a new GitHub repository.",
            path: "/infra/github/repository-requests",
            requires: ["admin"],
          },
        {
            id: "infra-github-repository-access",
            label: "Repository Access",
            desc: "Default org/team access and extra repos from approved requests.",
            requires: ["admin"],
        },
        {
            id: "infra-github-request-access",
            label: "Request Access",
            desc: "Request access to an existing repository.",
            requires: ["admin"],
        },
        {
            id: "infra-github-my-requests",
            label: "My Requests",
            desc: "Your creation and access requests.",
            requires: ["admin"],
        },
        {
            id: "infra-github-review-requests",
            label: "Review Requests",
            desc: "Approve or reject repository requests.",
            requires: ["admin"],
        },
    ],
  },
  {
    key: "security-dashboard",
    name: "Security Dashboard",
    icon: ShieldIcon,
    purpose: "Open the configured Looker Studio reports.",
    items: [
        {
            id: "infra-security-dashboard",
            label: "Security Dashboard",
            desc: "Device compliance, software compliancy, and security score.",
            requires: ["admin"],
        },
    ],
  },
  {
    key: "github-settings",
    name: "GitHub Settings",
    icon: SettingsIcon,
    purpose: "Admin tables the GitHub forms read.",
    items: [
        {
            id: "infra-github-settings",
            label: "GitHub Settings",
            desc: "Organizations, topics, leads, default teams, repo-team leads.",
            requires: ["admin"],
        },
    ],
  },
];

export const INFRA_ITEM_IDS: ReadonlySet<string> = new Set(
    INFRA_APPS.flatMap((app) => app.items.map((it) => it.id)),
);

function eyebrowFor(key: string): { icon: (typeof INFRA_APPS)[number]["icon"]; label: string } {
    const app = INFRA_APPS.find((a) => a.key === key)!;
    return { icon: app.icon, label: app.name };
  }
  export const INFRA_EYEBROW = {
    github: eyebrowFor("github"),
    securityDashboard: eyebrowFor("security-dashboard"),
    githubSettings: eyebrowFor("github-settings"),
  } as const;