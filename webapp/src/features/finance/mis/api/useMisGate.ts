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

import { describeError } from "@api/errors";
import type { VisibilityAnswer } from "@components/side-rail/visibilityFold";
import { isMisArrConfigured } from "@config/apiConfig";
import { useMisUserInfo } from "./useMisUserInfo";
import { useMisAppConfigs } from "./useMisAppConfigs";
import { MIS_PRIVILEGE, misHasPrivilege } from "./misTypes";

// The screens the ARR privilege opens, named one by one. The source app gates
// ARR Build, QRR, MRR and ARR Analysis on a single ARR_DASHBOARD number
// (Config.js:56), so this is a set rather than useMarketingOpsGate's per-item
// ITEM_CAPABILITY map: a map whose every value is the same number says nothing.
//
// Named rather than read off MIS_APPS, and that is the point: an
// entry joining the registry without a line here is HIDDEN, not opened to 987.
// Everything else fails closed too — MIS has no unrestricted screen, so unlike
// the sibling gates there is no open default for an unknown id to fall into.
// useMisGate.test.tsx turns red on a registry entry left out, which is the cue
// to decide who it is for and add it.
//
// ARR Analysis needs a second condition on top, and it is not a privilege —
// see ANALYSIS_ITEM_ID below.
/**
 * The one screen whose existence is a server-side decision as well as an
 * authorization one: `productsUsageEnabled` from `GET /app-configs`.
 *
 * The flag is folded in HERE rather than asked beside `canSee` at each call
 * site, and that is load-bearing. `SideRail` and `MisShell` both decide what to
 * show by asking this gate, so a separately-consulted flag is one either could
 * forget — and forgetting it fails OPEN, publishing a screen the backend has
 * turned off. One question, one answer, both conditions inside it.
 *
 * The route asks `useMisAppConfigs` for the flag directly as well, because it
 * needs something this boolean cannot carry: whether a `false` is the backend's
 * answer or merely the absence of one. See MisArrAnalysisPage.
 */
const ANALYSIS_ITEM_ID = "mis-analysis";

const ARR_SCREEN_IDS: ReadonlySet<string> = new Set([
  "mis-arr-build",
  "mis-qrr-build",
  "mis-mrr-build",
  ANALYSIS_ITEM_ID,
]);

export interface MisGate {
  // May this menu item be shown? Used by the rail and the pages alike, so a
  // visible item is always one whose screen the caller can actually open.
  canSee: (itemId: string) => boolean;
  // True while /user-info is in flight. Callers must hold off on rendering a
  // denial until this clears, or every cold load flashes one.
  isResolving: boolean;
  // The call itself failed — network, gateway, or identity. Distinct from
  // `canSee` answering false on purpose: both leave us without privileges and
  // it would be easy to collapse them, but "you're not in the MIS group" is a
  // reason to go and ask, while "the request failed" is a reason to retry.
  isError: boolean;
  errorMessage?: string;
  retry: () => void;
}

// Gates the Finance MIS menu against the MIS ARR backend's own privileges
// rather than the One WSO2 capabilities the rail normally reads.
//
// It has to be its own gate, not a `requires` rule, because MIS's privilege
// 987 and One WSO2's PRIVILEGE.EMPLOYEE 987 are the same number meaning
// opposite things — "may see company ARR" versus "is signed in". Reading one
// for the other publishes the revenue of the company to everybody. See
// misTypes.ts.
//
// `enabled` avoids firing /user-info while MIS isn't on screen.
export function useMisGate(enabled = true): MisGate {
  const userInfo = useMisUserInfo(enabled);
  // The same `enabled`, so a perspective with no MIS in it fetches neither.
  // React Query dedupes this with the copy every MIS screen already asks for.
  const { analysisEnabled } = useMisAppConfigs(enabled);

  // The backend answers with both of its numbers in one array; only the ARR one
  // means anything here — see misTypes.ts.
  const hasArr = misHasPrivilege(userInfo.data, MIS_PRIVILEGE.ARR_DASHBOARD);

  const canSee = (itemId: string): boolean => {
    // Not named above: refused, so a screen this gate has never been told
    // about is invisible rather than public — registered or not.
    if (!ARR_SCREEN_IDS.has(itemId)) return false;
    // The flag closes this screen whatever the reader holds, and reaches this
    // screen alone, never the Builds beside it.
    if (itemId === ANALYSIS_ITEM_ID) return hasArr && analysisEnabled;
    return hasArr;
  };

  return {
    canSee,
    // `isPending`, not `isLoading`: this query waits on the Asgardeo sub, and
    // during that window isLoading is already false. Callers reading it would
    // see a finished check with no privileges and flash a denial on every cold
    // load. Same choice as useMarketingOpsGate and useLeaveGate.
    //
    // And only while there is a backend to ask. Unconfigured, the query is
    // disabled, and a disabled query is `isPending` for ever — so this would
    // never clear, and `usePerspectiveVisibility` holds the Finance landing
    // until every gate has. useDueDiligenceGate has the same guard.
    isResolving: enabled && isMisArrConfigured() && userInfo.isPending,
    // `enabled` again: a disabled query asks nothing, but an identity failure is
    // folded into its result all the same (foldIdentityError), and reported it
    // would put MIS's failure on a screen with no MIS in it.
    isError: enabled && userInfo.isError,
    // describeError never surfaces the raw response body — see @api/errors.
    errorMessage: enabled && userInfo.isError ? describeError(userInfo.error) : undefined,
    retry: () => void userInfo.refetch(),
  };
}

/** Rail and landing facts. A failed read is retried; a refusal is not an error. */
export function misVisibility(gate: MisGate): VisibilityAnswer {
  return gate.isError
    ? { canSee: gate.canSee, resolving: gate.isResolving, error: gate.errorMessage, retry: gate.retry }
    : { canSee: gate.canSee, resolving: gate.isResolving, retry: () => undefined };
}
