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

import type { VisibilityAnswer } from "@components/side-rail/visibilityFold";
import { describeError } from "@api/errors";
import { MARKETING_OPS_APPS } from "@constants/marketingOpsApps";
import { useMarketingOpsMe } from "./useMarketingOpsMe";
import {
  hasMarketingOpsCapability,
  type MarketingOpsCapability,
} from "./marketingOpsTypes";

// Items that declare `requires` in the registry but aren't explicitly mapped
// below must fail CLOSED — otherwise a renamed or newly-added restricted item
// would silently become visible to everyone. Items with no `requires` are the
// open ones (the utilities) and stay visible to any authorized caller.
//
// Same pattern as useFinanceGate. It matters more here: the registry is
// deliberately ahead of the implementation (items are listed for phases not yet
// built), so the window in which an id exists without a mapping is the normal
// state of this file rather than a rare mistake.
const RESTRICTED_IDS = new Set(
  MARKETING_OPS_APPS.flatMap((app) => app.items)
    .filter((it) => it.requires && it.requires.length > 0)
    .map((it) => it.id),
);

// Which Marketing Ops capability each restricted menu item needs.
//
// This is the ONLY place a One WSO2 menu id is tied to a Marketing Ops
// capability token. The registry's own `requires` field speaks One WSO2's
// capability vocabulary (people-app privileges), which is a different scheme
// entirely — see the note in marketingOpsApps.ts. This map is the real gate.
//
// Keep it in step with the backend's shared/access_map.yaml, which is that
// scheme's single source of truth. Add a line here in the same phase that
// uncomments the item's `path` in the registry.
const ITEM_CAPABILITY: Record<string, MarketingOpsCapability> = {
  // Phase 2
  "mops-ad-analytics": "adcampaigns",
  "mops-campaign-tracker": "adcampaigns",
  // Phase 3
  "mops-email-create": "emailworkbench",
  "mops-email-history": "emailworkbench",
  "mops-email-manage": "emailworkbench",
  // Moved out of Marketing Admin, so it is no longer covered by the isAdmin
  // branch — without this line the lookup returns undefined and the item hides
  // from everyone, admins included.
  "mops-email-blocks": "emailworkbench",
  // Phase 4 — `events` and `events-review` are siblings, not a hierarchy:
  // holding one does not imply the other.
  "mops-events-mine": "events",
  "mops-events-review": "events-review",
  // Phase 5
  "mops-crm-pipelines": "crmupload",
  "mops-crm-review": "crmupload",
  "mops-crm-records": "crmupload",
  "mops-crm-runs": "crmupload",
  // Design Studio — backend/shared/access_map.yaml gates its router on the
  // `designstudio` group.
  "mops-design-studio-post-builder": "designstudio",
};

// Menu ids belonging to the Marketing Admin app. Gated on `isAdmin` alone
// rather than a capability, because the Marketing Ops admin group is the only
// thing that grants Settings — there is no per-panel capability to check.
// Derived from the registry so it can't fall out of step as panels are added
// phase by phase.
const ADMIN_APP_ITEM_IDS = new Set(
  (MARKETING_OPS_APPS.find((app) => app.key === "admin")?.items ?? []).map((it) => it.id),
);

export interface MarketingOpsGate {
  // May this menu item be shown? Used by the rail and the overview alike, so a
  // visible item is always one whose page the caller can actually use.
  canSee: (itemId: string) => boolean;
  // Does the caller hold any Marketing Ops access at all. False for an
  // authenticated WSO2 employee who simply isn't in a marketing group — the
  // perspective should say so plainly rather than render an empty rail.
  isAuthorized: boolean;
  isAdmin: boolean;
  // True while /api/me is in flight. Callers should hold off on rendering an
  // "unauthorized" state until this clears, or every load flashes a denial.
  isResolving: boolean;
  // /api/me itself failed — the network, the gateway, or the identity lookup.
  //
  // This has to be distinguishable from `isAuthorized === false`, because both
  // leave us without capabilities and it would be easy to collapse them. They
  // mean opposite things to the person reading the screen: "you're not in the
  // right Asgardeo group" is a request to go ask an admin, while "the request
  // failed" is a reason to retry. Telling someone they lack access when in fact
  // the gateway timed out sends them chasing a permission they already have.
  isError: boolean;
  errorMessage?: string;
  retry: () => void;
}

// Gates the Marketing Ops menu against THIS backend's own capabilities rather
// than the coarse One WSO2 capabilities derived from people-app. The rail and
// the pages both use it, so a menu item only appears for someone who can
// actually use it — exactly what the backend's own guard() would allow.
//
// `enabled` avoids firing /api/me when the Marketing Ops perspective isn't
// active (the rail asks for a gate on every perspective it renders).
export function useMarketingOpsGate(enabled = true): MarketingOpsGate {
  const me = useMarketingOpsMe(enabled);

  const isAuthorized = Boolean(me.data?.authorized);
  const isAdmin = Boolean(me.data?.isAdmin);

  const canSee = (itemId: string): boolean => {
    // Nothing in this perspective is visible to a caller the backend hasn't
    // authorized — including the "open" utilities, which still require the
    // marketing baseline group. Checked before anything else so an
    // unauthorized caller can't see a single item.
    if (!isAuthorized) return false;

    // Marketing Admin: the admin group is the only key.
    if (ADMIN_APP_ITEM_IDS.has(itemId)) return isAdmin;

    const capability = ITEM_CAPABILITY[itemId];
    // hasMarketingOpsCapability applies the isAdmin master key, so an admin
    // sees every feature despite holding no feature capabilities of their own.
    if (capability) return hasMarketingOpsCapability(me.data, capability);

    // Unrestricted item (the utilities) → visible to any authorized caller.
    // Anything that declares `requires` but reached here has no mapping above,
    // so it fails closed rather than leaking.
    return !RESTRICTED_IDS.has(itemId);
  };

  return {
    canSee,
    isAuthorized,
    isAdmin,
    // `isPending` rather than `isLoading`, so the window in which the Asgardeo sub
    // hasn't resolved yet counts as resolving too. With `isLoading` the query was
    // merely "not fetching" during that window, which read as a finished check with
    // no capabilities — a flash of "you don't have access" on a cold load, at every
    // caller that trusts this flag.
    isResolving: enabled && me.isPending,
    isError: me.isError,
    // describeError never surfaces the raw response body — see @api/errors.
    errorMessage: me.isError ? describeError(me.error) : undefined,
    retry: () => void me.refetch(),
  };
}

export function marketingVisibility(gate: MarketingOpsGate): VisibilityAnswer {
  return gate.isError
    ? { canSee: gate.canSee, resolving: gate.isResolving, error: gate.errorMessage, retry: gate.retry }
    : { canSee: gate.canSee, resolving: gate.isResolving, retry: () => undefined };
}
