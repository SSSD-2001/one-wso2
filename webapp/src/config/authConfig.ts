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

// Asgardeo OAuth config. Read at runtime from window.config (injected by
// public/config.js) so a single static bundle can serve any environment.
// Same pattern as customer-portal — every WSO2 internal webapp follows this.

declare global {
  interface Window {
    config: {
      ONE_WSO2_AUTH_BASE_URL: string;
      ONE_WSO2_AUTH_CLIENT_ID: string;
      ONE_WSO2_AUTH_SIGN_IN_REDIRECT_URL: string;
      ONE_WSO2_AUTH_SIGN_OUT_REDIRECT_URL: string;
      ONE_WSO2_THEME?: string;
    // Perspective key the app opens on ("me", "people", "finance", ...).
    // Optional — defaults to "me". Deployment-wide, so it must name a
    // perspective every user in the tenant can actually use; see landingConfig.
      // Whether an idle session is signed out automatically. Optional —
      // defaults to false, which is dialog-only: the "still there?" dialog
      // still appears after 25 minutes of inactivity, but ignoring it leaves
      // the session open. Set true to also sign out at the 30-minute deadline,
      // which is what the security checklist (ONEWSO2-R1) wants.
      ONE_WSO2_IDLE_AUTO_SIGN_OUT?: boolean;
      // Base URL for the people-ops-suite people-app backend (the same
      // SERVICE_BASE_URL people-app's own webapp reads). Used to fetch the
      // current user's Employee + EmployeePersonalInfo records on the
      // My profile page. Optional — when absent, the My page still loads
      // but the profile sections show a "not configured" state.
      ONE_WSO2_PEOPLE_BACKEND_URL?: string;
      // Cafeteria menu backend (daily menu, lunch feedback, dinner orders).
      // Optional — when absent the Menu screen shows a not-connected state.
      ONE_WSO2_MENU_BACKEND_URL?: string;
      // Base URL for the digiops-hr subscription-app backend (PickMe Commute
      // and LaaS opt-in/opt-out). Optional — when absent the Subscriptions
      // screens show a not-connected state.
      ONE_WSO2_SUBSCRIPTION_BACKEND_URL?: string;
      // Base URL for the digiops-infra email-group-manager backend (Google
      // Groups mailing-list subscriptions). Optional — when absent the Email
      // Groups screen shows a not-connected state.
      ONE_WSO2_EMAIL_GROUPS_BACKEND_URL?: string;
      // Base URL for the digiops-hr promotion-app backend. Optional — when
      // absent, ConnectedServices' "Last promoted date" row falls back to a
      // "not configured" state and doesn't fire a request.
      ONE_WSO2_PROMOTION_BACKEND_URL?: string;
      // Base URL for the digiops-hr par-app backend. Optional — when
      // absent, the Performance & growth review row falls back to a
      // "not configured" state.
      ONE_WSO2_PAR_BACKEND_URL?: string;
      // OAuth client ID for the Lead Portal's "attach from Google Drive"
      // evidence picker (scope: drive.readonly). Optional — when absent,
      // the picker button still renders but the token request fails, same
      // as par-app's own GOOGLE_OAUTH_CLIENT_ID behavior.
      ONE_WSO2_PAR_GOOGLE_OAUTH_CLIENT_ID?: string;
      // Browser API key for the same picker. Optional — see apiConfig.ts's
      // googlePickerApiKey for why it's unset by default.
      ONE_WSO2_PAR_GOOGLE_PICKER_API_KEY?: string;
      // The PAR rating names that trigger the Top 5%/20% checkbox and the
      // evidence-attachment requirement. Optional — see apiConfig.ts's
      // top5p20pEnabledRating/evidenceEnabledRating for why.
      ONE_WSO2_PAR_TOP5P20P_ENABLED_RATING?: string;
      ONE_WSO2_PAR_EVIDENCE_ENABLED_RATING?: string;
      // Base URL for the digiops-hr banking-app backend. Optional — when
      // absent, the Bank accounts card in Connected apps shows a
      // "not configured" state.
      ONE_WSO2_BANKING_BACKEND_URL?: string;
      // Base URL for the people-ops-suite leave-app backend. Optional —
      // when absent, the People Ops → Leave screens show a
      // "not configured" state. Leave-app has its own /user-info +
      // privileges, distinct from people-app.
      ONE_WSO2_LEAVE_BACKEND_URL?: string;
      // Base URLs for the three digiops-finance backends surfaced in the
      // Finance perspective. Each is its own service with its own
      // /user-info + role scheme. Optional — when a URL is absent, that
      // app's screens show a "not connected" state instead of firing
      // broken requests.
      ONE_WSO2_OPD_BACKEND_URL?: string; // opd-claims
      ONE_WSO2_CC_EXPENSES_BACKEND_URL?: string; // cc-expenses
      ONE_WSO2_EXPENSE_CLAIMS_BACKEND_URL?: string; // expense-claims
      // Base URL for the digiops-finance due_diligence backend — the Due
      // Diligence app, surfaced under both the Finance and Legal
      // perspectives. Same optional/"not connected" contract as the three
      // above.
      ONE_WSO2_DUE_DILIGENCE_BACKEND_URL?: string;
      // Base URL for the grc-tools grc-platform backend — the Security
      // perspective. Optional/"not connected" like the others, but that backend
      // must accept this app's Asgardeo client id as an audience first. Keeps
      // the SOURCE's key name rather than an ONE_WSO2_* one, because those
      // screens are lifted rather than rewritten and a GRC deployment already
      // publishes this exact key. See apiConfig.ts.
      ONE_WSO2_GRC_PLATFORM_BACKEND_URL?: string;
      // Base URL for the standalone Updates Manager service. Optional — when
      // absent, UmtShell shows a not-connected state and makes no UMT requests.
      // Its /update/user-info roles are local to UMT, not People capabilities.
      ONE_WSO2_UMT_BACKEND_URL?: string;
      // Base URL of the leave-app frontend itself (not its backend) —
      // used to deep-link into flows this webapp doesn't replicate, like
      // sabbatical requests. Optional — when absent, that link is hidden.
      ONE_WSO2_LEAVE_WEB_APP_URL?: string;
      // Base URL for the digiops-marketing marketing-ops backend — the
      // Marketing Ops perspective. A Python/FastAPI service (not Ballerina
      // like the others) whose routes live under /api/*. Optional — when
      // absent, MarketingOpsShell shows a "not connected" state.
      ONE_WSO2_MARKETINGOPS_BACKEND_URL?: string;
      // ISAC's own base URL — a separate marketing application, linked to
      // from the top of the Marketing Ops rail and opened in a new tab.
      // Nothing here calls it as an API. Optional — when absent, the rail
      // item is omitted rather than rendered as a dead link.
      ONE_WSO2_MARKETINGOPS_ISAC_URL?: string;
      ONE_WSO2_CSM_URL?: string;
      // Base URL for the infra-portal Ballerina backend. Optional — when
      // absent, Infra Portal shows a "not connected" state and makes no
      // requests. Privileges on this service (987 / 762 / 123) are not
      // people-app's.
      ONE_WSO2_INFRA_BACKEND_URL?: string;
      // Base URL of the Pardot UI, used to deep-link to an email template
      // after Email Workbench pushes it. Not an API — a link target.
      // Optional; defaults to https://pi.pardot.com, which is correct for
      // every WSO2 environment today.
      ONE_WSO2_PARDOT_BASE_URL?: string;
      // Base URL of the Salesforce Lightning UI, used to deep-link to the
      // record an incoming one collided with from the CRM Upload review
      // queue. Not an API — a link target. Optional; defaults to
      // https://wso2.lightning.force.com, correct for every WSO2
      // environment today. Set it only for a sandbox org.
      ONE_WSO2_SALESFORCE_BASE_URL?: string;
      // Override for the Asgardeo My Account portal URL that the top-bar
      // "Profile" menu item opens. Only set this on non-standard tenants
      // (self-hosted / custom domain); on Asgardeo Cloud we derive it from
      // ONE_WSO2_AUTH_BASE_URL by swapping the api. subdomain for
      // myaccount. (e.g. api.asgardeo.io/t/wso2 → myaccount.asgardeo.io/t/wso2).
      ONE_WSO2_ASGARDEO_MYACCOUNT_URL?: string;
      // Dev-only escape hatch — when true AND the bundle is a Vite dev
      // build, AuthGuard treats the user as signed in without ever calling
      // Asgardeo. Ignored in production builds (see devBypassAuth below),
      // so a stray true in a prod config.js can't disable auth.
      ONE_WSO2_DEV_BYPASS_AUTH?: boolean;
      // Features built but not yet released — see @config/previewFeatures.
      // Absent or false hides the feature, so a deployment that says nothing
      // shows nothing. Typed loosely here and narrowed by `PreviewFeature` at
      // the read, so this declaration does not have to be edited for each flag.
      ONE_WSO2_PREVIEW_FEATURES?: Record<string, boolean | undefined>;
    };
  }
}

// Gate on import.meta.env.DEV so this constant folds to `false` in the
// production bundle no matter what config.js says. Vite/esbuild replaces
// import.meta.env.DEV with a literal `false` at build time and dead-code
// eliminates the whole branch, so ONE_WSO2_DEV_BYPASS_AUTH becomes inert
// in shipped code even if an operator accidentally sets it to true.
export const devBypassAuth =
  import.meta.env.DEV && window.config?.ONE_WSO2_DEV_BYPASS_AUTH === true;

function readConfig(key: keyof Window["config"], fallback = ""): string {
  const value = window.config?.[key];
  if (typeof value === "string" && value) return value;
  if (devBypassAuth) return fallback;
  throw new Error(
    `Missing runtime config: window.config.${key}. Populate public/config.js from public/config.js.example.`,
  );
}

const baseUrl = readConfig("ONE_WSO2_AUTH_BASE_URL", "https://dev.local/asgardeo");

// Derive Asgardeo's hosted My Account portal URL from the tenant base URL.
// Standard Asgardeo Cloud shape: api.asgardeo.io/t/<tenant> → myaccount.asgardeo.io/t/<tenant>.
// Operators can override via ONE_WSO2_ASGARDEO_MYACCOUNT_URL for non-standard deployments.
function deriveMyAccountUrl(base: string): string {
  const override = window.config?.ONE_WSO2_ASGARDEO_MYACCOUNT_URL;
  if (typeof override === "string" && override) return override;
  return base.replace(/(^https?:\/\/)api\./, "$1myaccount.");
}

export const authConfig = {
  baseUrl,
  clientId: readConfig("ONE_WSO2_AUTH_CLIENT_ID", "dev-mode-client"),
  afterSignInUrl: readConfig("ONE_WSO2_AUTH_SIGN_IN_REDIRECT_URL", "http://localhost:3000"),
  afterSignOutUrl: readConfig("ONE_WSO2_AUTH_SIGN_OUT_REDIRECT_URL", "http://localhost:3000"),
  // Asgardeo's hosted My Account portal — opened from the top-bar profile menu.
  myAccountUrl: deriveMyAccountUrl(baseUrl),
  // Same scope set as Novera and the leave/menu backends — groups is
  // required for role-based checks in downstream experience APIs.
  scopes: ["openid", "email", "groups", "profile"] as const,
};
