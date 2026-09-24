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

// Central perspective registry. The waffle switcher and left rail both read
// from this — one edit here changes every entry point.

import { csmUrl, isCsmConfigured, isIsacConfigured, isacUrl } from "@config/apiConfig";
import { isPreviewEnabled } from "@config/previewFeatures";
import {
  Box as BoxIcon,
  CheckCheckIcon,
  ClipboardCheckIcon,
  DatabaseIcon,
  HouseIcon,
  LifeBuoyIcon,
  LayoutDashboard,
  MegaphoneIcon,
  NetworkIcon,
  RefreshCcw,
  SatelliteDishIcon,
  ScaleIcon,
  ShieldIcon,
  TicketIcon,
  UserRoundIcon,
  UserRoundMinusIcon,
  UsersIcon,
  UsersRoundIcon,
  WalletIcon,
  ServerIcon,
  type LucideIcon,
} from "@wso2/oxygen-ui-icons-react";
import type { Capability, MenuApp } from "@constants/appMenu";
import {
  FINANCE_OVERVIEW_APPS,
  FINANCE_PERSPECTIVE_APPS,
  ME_FINANCE_APPS,
} from "@constants/financeApps";
import { CLAIM_APPROVAL_PATH } from "@features/finance/approvals/claimApprovalTabs";
import { MARKETING_OPS_APPS } from "@constants/marketingOpsApps";
import { DUE_DILIGENCE_APPS } from "@constants/dueDiligenceApps";
import { SECURITY_APPS } from "@constants/securityApps";
import { ME_APPS } from "@constants/meApps";
import { ME_PAR_APPS } from "@constants/parApps";
import { INFRA_APPS } from "@constants/infraApps";

export interface PerspectiveSection {
  id: string; // anchor id on the perspective's page (leaf sections)
  label: string;
  // App groups (Leave, Menu, Finance) carry an icon + nested children.
  // A section with `children` renders as a collapsible group in the rail; a
  // leaf section scrolls to its `id`.
  icon?: LucideIcon;
  // Visible when the caller has ANY of these capabilities (OR semantics).
  // Omitted = visible to everyone. Only app-menu registries (Leave, Finance,
  // Finance) use this.
  requires?: Capability[];
  children?: PerspectiveSection[];
  // When set, a leaf item is a route (rail navigates) rather than a
  // scroll-anchor. Used by the native Leave screens.
  path?: string;
  // Render as a group even with a single visible child — see MenuApp.alwaysGroup.
  alwaysGroup?: boolean;
  // When set, a leaf item leaves One WSO2 entirely: it renders as an anchor
  // that opens in a new tab, and is never route-highlighted because no route
  // of ours is active while the user is over there. Mutually exclusive with
  // `path` — a section is either somewhere we host or somewhere we don't.
  externalUrl?: string;
}

// Turn an App → items registry into rail sections: one collapsible group
// per app, each with its top-level menu items as children (scroll-anchor
// or route). Derived from the single-source-of-truth registries so the
// rail and the pages can't drift.
function appsToSections(apps: readonly MenuApp[]): PerspectiveSection[] {
  return apps.map((app) => ({
    id: `sec-app-${app.key}`,
    label: app.name,
    icon: app.icon,
    alwaysGroup: app.alwaysGroup,
    children: app.items.map((it) => ({
      id: it.id,
      label: it.label,
      requires: it.requires,
      path: it.path,
    })),
  }));
}

// People Ops's prior app menu (People/Visitor/Careers) was retired per
// restructuring feedback. These are the reports being onboarded, ported from
// people-app. Every section here is live: each leaf carries the `path` the rail
// navigates to.
//
// `requires: ["admin"]` keeps the locked ones out of the rail for people who
// can't use them. It is NOT the access control: the people-app backend
// rejects non-admins on both /employees/search (org-wide) and
// /reports/employees/generate, and PeopleOpsShell turns that into an
// explanation. Someone who types the URL still gets a clear answer.
//
// Org Chart is the one section here WITHOUT `requires: ["admin"]` — same
// people-app backend as everything else here, but a different endpoint
// (/employees/basic-info) with its own access model: any employee in that
// endpoint's configured group, not a people-app admin privilege. See
// docs/ported-apps/org-chart.md.
export const PEOPLE_OPS_SECTIONS: PerspectiveSection[] = [
  {
    id: "people-org-chart",
    label: "Org Chart",
    icon: NetworkIcon,
    path: "/people-ops/org-chart",
  },
  // Subscriptions — PickMe Commute and LaaS, ported from the digiops-hr
  // subscription-app (previously a mobile microapp only). A group rather than
  // a leaf because the two screens answer to different people: everyone opts
  // themself in and out, and a much smaller set manages other employees.
  //
  // Note what is NOT here: `requires: ["admin"]`. The
  // capability vocabulary `requires` speaks is people-app privilege numbers,
  // and these screens gate on the SUBSCRIPTION service's own Asgardeo groups
  // (commuteAdminGroup / lunchAdminGroup, whose names it publishes on
  // /subscriptions/meta-info). The two are unrelated — a People Ops admin is
  // not a commute admin — so the rail asks useSubscriptionGate for these ids
  // instead, exactly as it does for Leave, Finance and Marketing Ops. See
  // SUBSCRIPTION_ITEM_IDS and the wiring in SideRail.
  // Managing other people's subscriptions is an HR action. The self-service
  // half moved to Me (see ME_SECTIONS) — a bare leaf now, not a group, since
  // only one screen is left here.
  {
    id: "people-subscriptions-manage",
    label: "Manage Subscriptions",
    icon: TicketIcon,
    path: "/people-ops/subscriptions/manage",
  },
  // par-app's Lead and Admin Portals — the halves of par-app that are about
  // your reports and the org-wide cycle, not yourself (the employee portal
  // moved to the Me perspective, see parApps.ts). `alwaysGroup` for the
  // same reason Master Data below carries it: a named group rather than a
  // bare leaf, since it has more than one child.
  {
    id: "people-par",
    label: "PAR",
    icon: ClipboardCheckIcon,
    alwaysGroup: true,
    children: [
      // Note what is NOT here: `requires: ["lead"]`. one-wso2's generic
      // "lead" capability is people-app privilege 993 — unrelated to
      // par-app's own PAR-cycle-scoped isTeamLead, and not guaranteed to
      // agree with it either way. SideRail asks useParIsTeamLead for
      // this one instead (PAR_LEAD_PORTAL_ITEM_ID below), the same
      // treatment Finance/Leave/Marketing Ops/Subscriptions already get
      // for the identical reason. ParRequiresTeamLeadRoute is what
      // actually enforces access at the route either way.
      {
        id: "par-lead-portal",
        label: "Lead Portal",
        path: "/people-ops/performance/lead",
      },
      // Same treatment as Lead Portal above: gated via
      // PAR_ADMIN_PORTAL_ITEM_ID / useParIsAdmin, not `requires`.
      {
        id: "par-admin-portal",
        label: "Admin Portal",
        path: "/people-ops/performance/admin",
      },
    ],
  },
  {
    id: "people-active-employee-report",
    label: "Active Employees",
    icon: UserRoundIcon,
    path: "/people-ops/reports/active-employees",
    requires: ["admin"],
  },
  {
    id: "people-resignation-report",
    label: "Resignations",
    icon: UserRoundMinusIcon,
    path: "/people-ops/reports/resignations",
    requires: ["admin"],
  },
  // A group, not a leaf: people-app's Master Data has several screens (org
  // structure, career functions, …) and Org Structure is the first ported.
  // Grouping now means the next one is a new child rather than a reshape of
  // the rail — see MenuApp.alwaysGroup for why a one-child group is right
  // when more are known to be coming.
  {
    id: "people-master-data",
    label: "Master Data",
    icon: DatabaseIcon,
    alwaysGroup: true,
    children: [
      {
        id: "people-master-data-org-structure",
        label: "Org Structure",
        path: "/people-ops/master-data/org-structure",
        requires: ["admin"],
      },
    ],
  },
];

/**
 * The Subscriptions rail ids, which the rail must route through
 * `useSubscriptionGate` rather than through `requires`/`caps`.
 *
 * Same role as FINANCE_ITEM_IDS and LEAVE_ITEM_IDS, and here for the same
 * reason: these ids answer to a different backend's Asgardeo groups, so
 * reading them against people-app capabilities would show a People Ops admin
 * an admin screen the subscription service then 403s — and hide it from an
 * actual commute admin who is not a People Ops admin.
 *
 * Written out by hand, NOT derived from a section list. It used to be built by
 * scanning PEOPLE_OPS_SECTIONS for the "people-subscriptions" group, which tied
 * the gate to where the screens happened to sit in the rail: moving one to
 * another perspective dropped its id out of this set, and SideRail then fell
 * through to people-app capabilities — silently skipping the Sri Lanka check
 * and showing the screen to everyone. A gate must not depend on menu placement.
 *
 * Add an id here when a subscription screen is added.
 */
/**
 * Rail ids for screens behind a Colombo-office perk, hidden from everyone else.
 *
 * Location is ORTHOGONAL to role: it is not "which backend decides this", it is
 * "does this benefit exist where you work". So the rail applies it as an AND on
 * top of whichever gate otherwise owns the id, rather than as another branch in
 * that chain — a commute admin outside Sri Lanka still sees nothing.
 *
 * Both a section id and its child ids can appear here. `resolveVisible` runs
 * over sections and children alike, so listing only the parent would leave the
 * child reachable once the parent is expanded.
 *
 * This is the rail only. The backends refuse the calls regardless, and someone
 * who types a URL gets the page's own empty state — same treatment every other
 * rail gate in this file gets.
 */
export const SRI_LANKA_ONLY_ITEM_IDS: ReadonlySet<string> = new Set([
  // Cafeteria — the WSO2 Colombo canteen. Section and its single child.
  "sec-app-menu",
  "menu-home",
  // PickMe Commute and LaaS.
  "people-subscriptions-mine",
  "people-subscriptions-manage",
]);

export const SUBSCRIPTION_ITEM_IDS: ReadonlySet<string> = new Set([
  "people-subscriptions-mine",
  "people-subscriptions-manage",
]);

/**
 * The Lead Portal's own rail id, which the rail must route through
 * useParIsTeamLead rather than through `requires`/`caps` — see the comment
 * on the section itself, above.
 */
export const PAR_LEAD_PORTAL_ITEM_ID = "par-lead-portal";

/** Same idea, for the Admin Portal — gated via useParIsAdmin. */
export const PAR_ADMIN_PORTAL_ITEM_ID = "par-admin-portal";

// Marketing Ops. Built from the registry now so the rail is ready, but the
// perspective itself stays locked (`access: false` below) until Phase 1
// (Utilities) lands — see "My Findings Marketing Ops.md" in the repo root.
//
// Note the two-layer gating here, which differs from every other perspective:
// the `requires` values these sections carry speak One WSO2's capability
// vocabulary, but the real decision is made by useMarketingOpsGate against the
// Marketing Ops backend's own /api/me. Whatever renders these sections must ask
// that gate, not just read `requires`.
//
// ISAC leads the rail. It is NOT in MARKETING_OPS_APPS, deliberately: that
// registry is the set of operations this webapp implements, and every item in it
// resolves to a route we own. ISAC is a separate application that One WSO2 only
// points at, so it belongs here — where the rail is assembled — rather than in a
// registry that also feeds the overview page's cards and the capability gate.
//
// It is omitted entirely when its URL isn't configured. A rail item that goes
// nowhere is worse than one that isn't there.
const MARKETING_OPS_SECTIONS: PerspectiveSection[] = [
  ...(isIsacConfigured()
    ? [{ id: "mops-isac", label: "ISAC", icon: SatelliteDishIcon, externalUrl: isacUrl }]
    : []),
  ...appsToSections(MARKETING_OPS_APPS),
];

// The Me home landing. The landing page itself already is the ported
// people-app "Me" profile view (General/Personal/Emergency/Connected, see
// features/my/pages/MyProfilePage) — no separate "Profile" rail entry
// needed for it. My Team mirrors people-app's lead-only nav item; it's a
// placeholder page for now (see MyTeamComingSoonPage). Then the apps that
// live here — things an employee does (and, for a lead/finance-approver
// subset of items, approves) for themself or their team, as opposed to
// People Ops' HR-team tools: Leave, then the digiops-finance claim apps
// (OPD/credit-card/expense — moved in from the retired Finance persona).
const ME_SECTIONS: PerspectiveSection[] = [
  { id: "me-my-team", label: "My Team", icon: UsersRoundIcon, path: "/me/my-team", requires: ["lead"] },
  // Opting yourself in and out is something you do for yourself, so it sits
  // under Me. Managing it on someone else's behalf is an HR action and stays
  // under People Ops.
  //
  // Still gated by SUBSCRIPTION_ITEM_IDS below — that set is written out by
  // hand precisely so an item can move between perspectives without losing its
  // gate. Sri-Lanka-only, like the manage screen: both services are a Colombo
  // office perk.
  {
    id: "people-subscriptions-mine",
    label: "My Subscriptions",
    icon: TicketIcon,
    path: "/me/subscriptions",
  },
  ...appsToSections(ME_APPS),
  ...appsToSections(ME_FINANCE_APPS),
  // par-app's employee portal — see docs/ported-apps/par-app.md.
  ...appsToSections(ME_PAR_APPS),
];

const UMT_SECTIONS: PerspectiveSection[] = [
  { id: "umt-updates", label: "Updates", icon: RefreshCcw, path: "/umt/updates" },
  // Admin-only. `requires` speaks the people-app capability vocabulary, which
  // UMT's own numeric roles have nothing to do with — this is filtered by
  // UMT_ADMIN_ITEM_IDS below instead, the same way Finance/Leave/Subscriptions
  // items are (see the comment above SUBSCRIPTION_ITEM_IDS).
  { id: "umt-products", label: "Product Management", icon: BoxIcon, path: "/umt/products" },
];

/**
 * UMT rail ids whose visibility must be decided by UMT's own /update/user-info
 * roles, not the people-app capability vocabulary `requires` speaks — the same
 * shape of problem as SUBSCRIPTION_ITEM_IDS/FINANCE_ITEM_IDS/LEAVE_ITEM_IDS
 * above. Product Management is UMT_ADMIN-only; reading that against people-app
 * capabilities would show it to a people-app admin who isn't a UMT admin, and
 * hide it from a UMT admin who isn't one. Whatever renders these sections must
 * ask useUmtGate directly rather than reading `requires` for them.
 */
export const UMT_ADMIN_ITEM_IDS: ReadonlySet<string> = new Set(["umt-products"]);

export interface PerspectiveDef {
  key: string;
  label: string;
  icon: LucideIcon;
  access: boolean;
  path?: string; // route path (undefined for locked perspectives)
  /**
   * True when the contents are gated by a backend OUTSIDE this app's capability
   * model, so `access: true` does not mean "every signed-in user can use this".
   *
   * `access` answers "is it built"; this answers "is it usable by whoever is
   * looking". The distinction matters wherever a user is sent somewhere WITHOUT
   * clicking it — the landing page. Choosing to open a perspective and finding
   * an authorization notice is legible; being dropped on one at login is not.
   * Surfaces the user drives (the rail, the launcher, favourites) keep showing
   * these, because the gate's own message is the right answer there.
   */
  externallyGated?: boolean;
  /**
   * Set when the perspective is a separate application this webapp only points
   * at. Its launcher tile opens the URL in a new tab instead of routing, and it
   * carries no `path` — so `reachablePerspectives` excludes it, and it can be
   * neither a landing choice nor a favourite. Both would be shortcuts to
   * somewhere this app cannot take you.
   */
  externalUrl?: string;
  /**
   * True when this perspective has no overview of its own worth stopping on,
   * so its landing route forwards you to the first rail item you can actually
   * see. Someone who can see none is told so there, in a sentence.
   *
   * These perspectives' overviews had become a tile per rail item — a second,
   * hand-maintained copy of the menu two feet to its right, which the rail says
   * better and which drifted out of step with the registry every time an item
   * was added. So the Overview row is dropped from the rail for these too: a
   * row that only bounces you somewhere else is not a destination.
   *
   * The ROUTE stays either way. Switching perspective navigates to `path`, and
   * it is the one place someone with nothing here can be told that.
   *
   * Me is the one perspective that does not carry this: its landing is the
   * person's own profile, which is a page someone stops and reads.
   */
  forwardsToFirstItem?: boolean;
  sections?: PerspectiveSection[];
}

export const PERSPECTIVES: readonly PerspectiveDef[] = [
  // "Apps" (persona areas, locked or unlocked). Order here is the order
  // shown in the waffle's Apps group.
  {
    key: "people",
    label: "People Ops",
    icon: UsersIcon,
    access: true,
    path: "/people-ops",
    forwardsToFirstItem: true,
    sections: PEOPLE_OPS_SECTIONS,
  },
  // Submitting a claim and looking up your own stay under Me (see ME_SECTIONS)
  // — those are things you do for yourself. Deciding other people's claims is
  // not, so it lives here. Its rail entry is gated by the three claim backends'
  // own rules, not by `requires`; see features/finance/api/useFinanceGate.
  {
    key: "finance",
    label: "Finance",
    icon: WalletIcon,
    access: true,
    path: "/finance",
    forwardsToFirstItem: true,
    sections: [
      // Overview first: what the numbers say comes before the work of acting on
      // them, and it is the screen finance opens the perspective to read.
      ...appsToSections(FINANCE_OVERVIEW_APPS),
      {
        id: "claim-approval",
        label: "Claim Approval",
        icon: CheckCheckIcon,
        path: CLAIM_APPROVAL_PATH,
      },
      // Credit card lives here rather than under Me because a corporate card is
      // not something everyone has — unlike leave or claims, it is not part of
      // the set every employee needs.
      ...appsToSections(FINANCE_PERSPECTIVE_APPS),
      // Due Diligence — also surfaced under Legal (see the `legal` perspective
      // below). ONE registry (DUE_DILIGENCE_APPS), included in both places, so
      // the two rails can't drift. Gated on the due-diligence backend's own
      // roles, not the coarse capability model — see useDueDiligenceGate and
      // its dispatch in SideRail.
      ...appsToSections(DUE_DILIGENCE_APPS),
    ],
  },
  // Legal. Currently just a second entry point into Due Diligence (see the
  // `finance` perspective above) — the same registry, included here too, so
  // both rails show the identical set of screens and can't drift apart.
  // `externallyGated: true` for the same reason Marketing Ops carries it:
  // `access: true` only means the perspective is built, not that everyone who
  // opens it can use what's inside — see useDueDiligenceGate.
  {
    key: "legal",
    label: "Legal",
    icon: ScaleIcon,
    externallyGated: true,
    access: true,
    path: "/legal",
    forwardsToFirstItem: true,
    sections: [...appsToSections(DUE_DILIGENCE_APPS)],
  },
  // A separate application, opened in a new tab. `access` follows the URL being
  // configured: without one the tile stays in its unbuilt state rather than
  // becoming a link to nowhere.
  {
    key: "csm",
    label: "CSM",
    icon: LifeBuoyIcon,
    access: isCsmConfigured(),
    externalUrl: csmUrl || undefined,
  },
  // Held behind a preview flag, whole perspective and all, until it's ready
  // for production. With the flag off the entry does not exist, so the waffle,
  // landing options, and favourites stay clean. Same shape as UMT above.
  ...(isPreviewEnabled("infra")
  ? [
      {
        key: "infra",
        label: "Infra Portal",
        icon: ServerIcon,
        access: true,
        path: "/infra",
        externallyGated: true,
        sections: appsToSections(INFRA_APPS),
      },
    ]
  : []),
  // Marketing Ops — UNLOCKED. Ported so far: Utilities (UTM + Asset Name
  // generators and their Marketing Admin panels) and Ad Campaigns → Analytics.
  // Still in Marketing Ops itself: Email Workbench, Events, CRM Upload — those
  // show on the overview as cards marked "not here yet".
  //
  // Two non-obvious things about this entry:
  //  - `access` controls whether the WAFFLE offers the perspective; `path` is
  //    what lets PerspectiveProvider recognise the route and give the perspective
  //    its own rail. BOTH are needed — `access` without `path` yields a tile that
  //    looks clickable and does nothing (WaffleOverlay bails on the click), and
  //    `path` without `access` makes it reachable by URL but unadvertised.
  //  - Its rail gates on the MARKETING OPS backend's own Asgardeo groups, not on
  //    people-app privileges — see useMarketingOpsGate and the wiring in
  //    SideRail. The `requires` on these sections is a coarse hint only.
  {
    key: "marketing",
    label: "Marketing Ops",
    // Gated on the Marketing Ops backend's own Asgardeo groups, not on
    // people-app privileges — see useMarketingOpsGate.
    externallyGated: true,
    icon: MegaphoneIcon,
    access: true,
    path: "/marketing-ops",
    forwardsToFirstItem: true,
    sections: MARKETING_OPS_SECTIONS,
  },
  // Security and Compliance — the GRC platform's Risk Hub, Audit Hub and Admin
  // Console, lifted from grc-tools rather than rewritten. Its own perspective:
  // a different function, and an authorization model no other perspective
  // shares.
  //
  // `externallyGated` for the same reason as Legal and Marketing Ops: `access`
  // only says the perspective is built, not that whoever opens it can use it.
  // Here the gate is the GRC backend's own privilege set — someone holding no
  // grant sees the perspective and is told plainly that they have none, which
  // is the right answer for a surface people are told exists.
  {
    // The key and path stay "security" while the LABEL is "Security and
    // Compliance". They are not the same thing: the key threads through the
    // route prefix, every item id, the privilege map, the hue and the app mark,
    // and renaming it would churn all of that plus the 16 navigation paths
    // inside the lifted tree, for no change a user could see.
    key: "security",
    label: "Security and Compliance",
    // The plain shield, not ShieldCheck — that one is Audit Hub's, transcribed
    // from the GRC source's nav.ts, and the two rendered identically one rail
    // row apart. Plain is the right glyph for the container anyway: Risk Hub
    // adds an exclamation, Audit Hub a tick, and this holds both. It also
    // matches the banded-shield launcher mark.
    icon: ShieldIcon,
    externallyGated: true,
    access: true,
    path: "/security",
    forwardsToFirstItem: true,
    sections: [...appsToSections(SECURITY_APPS)],
  },
  // "Me" is the Home landing: the person's own profile plus everyday apps —
  // Leave, Menu, and the finance claims.
  //
  // It is also a default favourite. It appears in the launcher either way —
  // removing the favourite must not leave a user with no route back to it.
  {
    key: "me",
    label: "Me",
    icon: HouseIcon,
    access: true,
    path: "/me",
    sections: ME_SECTIONS,
  },
  // UmtShell performs the service-owned role check for all UMT pages.
  //
  // Held behind a preview flag, whole perspective and all, until it's ready for
  // production — not just `access: false`, because that would still leave a
  // disabled "not available yet" tile in the waffle (see FUNCTIONAL_PERSPECTIVES
  // below, which is unfiltered). Spread in exactly like FINANCE_PERSPECTIVE_APPS
  // does for the expense app, so with the flag off the entry does not exist at
  // all, and every surface that reads PERSPECTIVES stays clean.
  ...(isPreviewEnabled("umt")
    ? [
        {
          key: "umt",
          label: "UMT",
          icon: LayoutDashboard,
          externallyGated: true,
          access: true,
          path: "/umt",
          sections: UMT_SECTIONS,
        },
      ]
    : []),
];

/**
 * Perspectives a user can actually be sent to: built (`access`) and routable
 * (`path`). Both are required — a locked perspective with a path is reachable by
 * URL but deliberately unadvertised.
 *
 * Shared because three surfaces need the same notion: the rail's cross-links,
 * the landing-page setting, and launcher favourites.
 */
export function reachablePerspectives(): PerspectiveDef[] {
  return PERSPECTIVES.filter((p) => p.access && typeof p.path === "string" && p.path.length > 0);
}

/**
 * Every perspective, for the launcher's "Apps" group.
 *
 * There used to be a `group` field splitting these from a "cross" set rendered
 * under "For you" in both the rail and the launcher. Both of those surfaces are
 * gone (the rail does not duplicate the launcher, and Me is a default
 * favourite), so the field ended up on every entry with nothing reading the
 * distinction. An alias rather than a second exported array, so there is one
 * list to keep in order.
 */
export const FUNCTIONAL_PERSPECTIVES = PERSPECTIVES;

export function findPerspectiveByPath(pathname: string): PerspectiveDef | undefined {
  return PERSPECTIVES.find((p) => p.path && pathname.startsWith(p.path));
}

export function findPerspectiveByKey(key: string): PerspectiveDef | undefined {
  return PERSPECTIVES.find((p) => p.key === key);
}
