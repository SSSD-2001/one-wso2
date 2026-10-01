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

// Registry of the digiops-finance apps and their top-level menu items,
// surfaced inside the Me perspective — claims/expenses are something an
// employee submits and tracks for themself, same rationale as Leave. Every
// item is a native route (built under src/features/finance/*), so each
// carries a `path` — the left rail navigates straight to it.
//
// Transcribed from each app's own webapp nav (routes.tsx / route.ts /
// Sidebar). Finance app roles (USER / EMPLOYEE / LEAD / FINANCE) map onto
// One WSO2 capabilities as: USER/EMPLOYEE/all → everyone, LEAD → lead,
// FINANCE → admin (One WSO2 has no dedicated Finance privilege number).
// Each app's own backend still enforces its real role scheme; these
// capability gates just decide what shows in the rail.

import {
  CreditCardIcon,
  DatabaseIcon,
  LayoutDashboardIcon,
  ReceiptTextIcon,
  StethoscopeIcon,
} from "@wso2/oxygen-ui-icons-react";
import { CC_PATH } from "@features/finance/cc/ccPaths";
import { FINANCE_OVERVIEW_PATH } from "@features/finance/overview/financeOverviewPaths";
import { masterDataPaths } from "@features/finance/masterdata/masterDataPaths";
import type { MenuApp } from "@constants/appMenu";

/**
 * Claims — under **Me**. Filing and tracking your own is something every
 * employee does.
 */
export const ME_FINANCE_APPS: readonly MenuApp[] = [
  {
    // Approving moved to Finance → Claim approval: it is work done for other
    // people, and this menu is for what you do for yourself.
    //
    // One app where there were two. Expense and OPD claims are both things you
    // file for yourself and track, and their histories are the same shape, so
    // they are one entry with a tab each rather than four entries between them.
    // The forms differ enough that adding a claim asks which type first.
    key: "claims",
    name: "Claims",
    icon: ReceiptTextIcon,
    purpose: "Expense and OPD claims — file one and track what you have filed.",
    items: [
      { id: "claims", label: "Claims", desc: "Expense and OPD claims you have filed.", path: "/me/claims" },
    ],
  },
];

// Every item id across the three apps — lets the rail dispatch gating to
// useFinanceGate (each app's OWN backend roles) instead of the coarse
// people-app capabilities, regardless of which perspective section it's
// rendered under.
/**
 * Credit card — under **Finance**. Unlike claims, a corporate card is not
 * something everyone has, so the app is not part of the set every employee
 * needs; it sits with the other finance operations instead.
 */
/**
 * Overview — under **Finance**, above the apps.
 *
 * Reading how money is being spent is a different job from spending it. These
 * screens report across everyone rather than showing you your own work, and the
 * people who read them are finance. Kept inside the app it reports on, a
 * dashboard sits behind a group you open to file or reconcile something, which
 * is not what you came for when you wanted the numbers.
 *
 * One rail entry, not a group of two. It used to expand into "Credit Card
 * Expenses" / "OPD Claims" as separate rows — a second click just to see
 * which dashboard you wanted. `FinanceOverviewPage` now holds both behind a
 * tab switcher of its own, so the rail only ever needs to get you to the one
 * page; neither dashboard screen changed underneath it.
 */
export const FINANCE_OVERVIEW_APPS: readonly MenuApp[] = [
  {
    key: "finance-overview",
    name: "Overview",
    icon: LayoutDashboardIcon,
    purpose: "How the company's card spend and claim allowances are being used.",
    // A single item collapses to a plain leaf on its own (SideRail.tsx's
    // `visible.length === 1 && !section.alwaysGroup`) — exactly the shape
    // wanted here, so `alwaysGroup` is left unset.
    items: [
      {
        id: "finance-overview",
        label: "Overview",
        desc: "Unsubmitted card spend and OPD claim usage, one tab each.",
        // Not a coarse capability: forces useFinanceGate to answer for the
        // id — see its `finance-overview` case, which hides the whole entry
        // for a reader with no card of their own and no OPD role — neither
        // tab would have anything to show them.
        requires: ["employee"],
        path: FINANCE_OVERVIEW_PATH,
      },
    ],
  },
];

export const FINANCE_PERSPECTIVE_APPS: readonly MenuApp[] = [
  // Expense Claims used to have its own Finance front door here — New Claim,
  // Claim History, and both Approvals stages. Retired item by item as each
  // moved elsewhere (Approvals to Claim Approval, New Claim and Claim History
  // to Me → Claims, on-behalf filing included) until nothing was left of it.
  //
  // OPD Claims used to have its own Finance front door here too, with Claim
  // History as its one item. Retired once Me → Claims → OPD covered the same
  // queue, filters and all — there was nothing left for a second entry point
  // to do.
  {
    key: "cc",
    name: "Credit Card Expenses",
    icon: CreditCardIcon,
    purpose: "Reconcile and submit corporate credit-card transactions for approval.",
    items: [
      // Each of these three is the SUBMITTER's own view — their own unsubmitted
      // transactions, their own pending-approval status, their own history —
      // so none of it exists to read without a card. `requires` here is
      // documentation plus a fail-closed backstop; the actual check is
      // `ccHasOwnCard` in useFinanceGate's explicit case for each id, not this
      // coarse capability.
      { id: "cc-new", label: "Pending Submissions", desc: "Unsubmitted card transactions to categorise and submit.", requires: ["employee"], path: `${CC_PATH}/new` },
      { id: "cc-pending", label: "Pending Approvals", desc: "Submissions awaiting approval.", requires: ["employee"], path: `${CC_PATH}/pending` },
      { id: "cc-approve", label: "Approve Submissions", desc: "Review and approve your team's submitted card transactions.", requires: ["lead", "admin"], path: `${CC_PATH}/approve` },
      { id: "cc-history", label: "History", desc: "Your submitted past card transactions.", requires: ["employee"], path: `${CC_PATH}/history` },
      { id: "cc-settings", label: "Settings", desc: "Upload and reconcile bank statements (finance).", requires: ["admin"], path: `${CC_PATH}/settings` },
    ],
  },
  {
    // The reference data the other finance apps are keyed against. Its own
    // entry rather than a Settings tab inside one of them: all four tables
    // are shared — an expense type is used by both Expense Claims and Credit
    // Card Expenses — so filing it under either one would be arbitrary.
    key: "finance-master-data",
    name: "Master Data",
    icon: DatabaseIcon,
    purpose: "Maintain the subsidiaries, departments, expense types and cards the finance apps refer to.",
    // `requires: ["admin"]` on all four: this is finance-maintained reference
    // data, same gate as cc Settings. It only forces useFinanceGate to answer
    // for the id — see its master-data case, which also checks the
    // "finance-master-data" preview flag (previewFeatures.ts) before `admin`,
    // so this stays hidden in an environment until that flag is turned on
    // there.
    items: [
      { id: "master-data-subsidiaries", label: "Subsidiaries", desc: "WSO2 legal entities and their tax codes.", requires: ["admin"], path: masterDataPaths.subsidiaries },
      { id: "master-data-departments", label: "Departments", desc: "Departments, engagement codes and their GL codes.", requires: ["admin"], path: masterDataPaths.departments },
      { id: "master-data-expense-types", label: "Expense Types", desc: "The expense catalogue and the engagements each type is valid for.", requires: ["admin"], path: masterDataPaths.expenseTypes },
      { id: "master-data-credit-cards", label: "Credit Cards", desc: "The corporate card register and who approves each card's spend.", requires: ["admin"], path: masterDataPaths.creditCards },
    ],
  },
];

/** Every finance-domain app, wherever it is surfaced. */
export const FINANCE_APPS: readonly MenuApp[] = [
  ...ME_FINANCE_APPS,
  ...FINANCE_OVERVIEW_APPS,
  ...FINANCE_PERSPECTIVE_APPS,
];

export const FINANCE_ITEM_IDS: ReadonlySet<string> = new Set([
  ...FINANCE_APPS.flatMap((app) => app.items.map((it) => it.id)),
  // Claim approval is not an item of any one app — it spans two of them — so it
  // is named here rather than derived. Without it the rail would fall back to
  // the people-app capabilities, which have no word for "expense finance
  // approver" and would show the entry to the wrong people.
  "claim-approval",
]);

// Eyebrow descriptors for FinanceShell, derived from the registry above so the
// chip on every finance screen can't drift from the app's own name and icon.
function eyebrowFor(key: string): { icon: MenuApp["icon"]; label: string } {
  // No `!` here. An app can legitimately be absent from the registry — a
  // preview feature whose flag is off is not in the list at all — and this
  // runs at module load, so asserting would take the whole app down with a
  // TypeError before anything rendered, not just lose a chip.
  //
  // The fallback is never seen in practice: if an app is hidden, the screens
  // that wear its eyebrow are unreachable too.
  const app = FINANCE_APPS.find((a) => a.key === key);
  return app
    ? { icon: app.icon, label: app.name }
    : { icon: ReceiptTextIcon, label: "Finance" };
}

export const FINANCE_EYEBROW = {
  // Both claim forms wear the Claims eyebrow: they are two ways into one app
  // now, and their own titles say which type is being filed.
  claims: eyebrowFor("claims"),
  cc: eyebrowFor("cc"),
  masterData: eyebrowFor("finance-master-data"),
  // A literal rather than eyebrowFor(...): the OPD dashboard sits behind a
  // preview flag, and with it off the lookup would fall back to the generic
  // "Finance" chip — wrong for a route still reachable directly by URL.
  opd: { icon: StethoscopeIcon, label: "OPD Claims" },
} as const;
