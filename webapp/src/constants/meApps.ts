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

// Registry of apps surfaced under the "Me" perspective — things every
// employee does for themselves, as opposed to People Ops' HR-team tools.
// Same App → items shape as @constants/financeApps; see
// that file's header for the general rationale.

import { MailsIcon, SignatureIcon, TreePalmIcon, UtensilsIcon } from "@wso2/oxygen-ui-icons-react";
import type { MenuApp } from "@constants/appMenu";

export const ME_APPS: readonly MenuApp[] = [
  {
    key: "leave",
    name: "Leave",
    icon: TreePalmIcon,
    purpose: "Apply for and track leave; leads and people-ops approve and report.",
    items: [
      // ONE entry. It used to be two, split by kind of leave, which put a
      // sabbatical — a once-in-years thing — level with the leave people book
      // every month, and repeated three tab names across the pair. The kind is
      // now a toggle inside the tabs that offer both; see leaveTabs.ts.
      //
      // Roles are decided by features/leave/api/useLeaveGate, not by `requires`,
      // because the leave backend has its own privilege vocabulary. The entry
      // appears when any tab inside it does.
      { id: "leave-home", label: "Leave", desc: "Apply for leave, track your own, approve sabbaticals, and report on your team.", path: "/me/leave" },
    ],
  },
  // Moved out of its own Workspace perspective, which existed for this one
  // screen: a waffle tile, a rail entry and a landing option, all to reach a
  // single page. It sits with Leave and the finance apps because it is the same
  // kind of thing — an everyday app any employee uses. If more office apps
  // arrive (room booking, IT requests), Workspace can come back with something
  // in it; reinstating it is the same size of change as removing it was.
  {
    key: "menu",
    // "Cafeteria", not "Menu": the screen has always called itself Cafeteria
    // while the registry called it Menu, so the rail and the page disagreed on
    // the app's name. `key` stays "menu" — it is the id in paths, gates and
    // favourites, and renaming it would migrate stored favourites for a label.
    name: "Cafeteria",
    icon: UtensilsIcon,
    purpose: "Cafeteria menu, feedback, and dinner orders.",
    items: [
      {
        id: "menu-home",
        label: "Home",
        desc: "View the cafeteria menu, submit feedback, order dinner.",
        path: "/me/menu",
      },
    ],
  },
  // Ported from the standalone Email Group Manager app
  // (digiops-infra/apps/email-group-manager) — the mailing-list subscription
  // half. One screen, so — like Menu above — this collapses to a single rail
  // leaf rather than an expandable group. The same source app's second tab,
  // an email-signature generator, is its own separate app below rather than
  // a tab here: the two share no data and no backend.
  {
    key: "email-groups",
    name: "Email Groups",
    icon: MailsIcon,
    purpose: "Subscribe to and manage Google Groups mailing lists.",
    items: [
      {
        id: "email-groups-home",
        label: "Home",
        desc: "Browse the group directory and manage your subscriptions.",
        path: "/me/email-groups",
      },
    ],
  },
  // The other half of the same source app. No backend of its own — it's a
  // pure client-side HTML generator, prefilled from the people-app profile
  // this webapp already fetches for every "Me" page.
  {
    key: "email-signature",
    name: "Email Signature",
    icon: SignatureIcon,
    purpose: "Build a WSO2 email signature and copy it into your mail client.",
    items: [
      {
        id: "email-signature-home",
        label: "Home",
        desc: "Fill in your details and copy the signature into your mail client.",
        path: "/me/email-signature",
      },
    ],
  },
];

// Item ids the rail must route to Leave's OWN gate rather than resolving
// `requires` against people-app capabilities — the leave backend has its own
// privilege vocabulary. See features/leave/api/useLeaveGate.
export const LEAVE_ITEM_IDS: ReadonlySet<string> = new Set(
  (ME_APPS.find((app) => app.key === "leave")?.items ?? []).map((it) => it.id),
);
