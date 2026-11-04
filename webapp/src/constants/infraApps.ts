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

import { GitHub, SettingsIcon } from "@wso2/oxygen-ui-icons-react";
import type { MenuApp } from "@constants/appMenu";

export const INFRA_APPS: readonly MenuApp[] = [
  {
    key: "github",
    name: "Repository Management",
    icon: GitHub,
    alwaysGroup: true,
    purpose: "Connect GitHub, request repositories, and review those requests.",
    items: [
      {
        id: "infra-github-connection",
        label: "GitHub Connection",
        desc: "Connect your GitHub account.",
        path: "/infra/github/connection",
        requires: ["admin"],
      },
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
        path: "/infra/github/repository-access-requests",
        requires: ["admin"],
      },
      {
        id: "infra-github-my-requests",
        label: "My Requests",
        desc: "Your repository creation requests.",
        path: "/infra/github/my-requests",
        requires: ["admin"],
      },
      {
        id: "infra-github-review-requests",
        label: "Review Requests",
        desc: "Approve or reject repository requests.",
        path: "/infra/github/review-repository-requests",
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
        desc: "Organizations, topics, functional leads, and default teams.",
        path: "/infra/admin/github-settings",
        requires: ["admin"],
      },
    ],
  },
];

export const INFRA_ITEM_IDS: ReadonlySet<string> = new Set(
  INFRA_APPS.flatMap((app) => app.items.map((it) => it.id)),
);
