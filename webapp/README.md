# One WSO2 Webapp

WSO2's internal cross-perspective portal: a React 19 + TypeScript + Vite single-page app. Sign-in is
Asgardeo, UI is Oxygen UI, and every environment is configured at runtime through `window.config`,
so one build serves them all.

## Tech stack

- **Core:** [React 19](https://react.dev/)
- **Build tool:** [Vite](https://vitejs.dev/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **UI library:** [Oxygen UI](https://github.com/wso2/oxygen-ui) (WSO2's MUI-based design system)
- **Data fetching:** [TanStack Query](https://tanstack.com/query/latest)
- **Authentication:** [Asgardeo](https://wso2.com/asgardeo/) via [`@asgardeo/react`](https://www.npmjs.com/package/@asgardeo/react)
- **Routing:** [React Router](https://reactrouter.com/) v7
- **Tests:** [Vitest](https://vitest.dev/) + Testing Library, in jsdom

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 22 (see `.nvmrc`; Vite 7 needs at least 20.19)
- npm — the checked-in lockfile is `package-lock.json`

### Installation

```bash
npm install
cp public/config.js.example public/config.js
```

Fill in `public/config.js`: the Asgardeo tenant and client ID from your Asgardeo application
registration, and the backend URL for each feature you want live (see [Configuration](#configuration)).

`public/config.js` is git-ignored — never commit environment-specific values. At deploy time the
host injects a fresh `config.js` per environment.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | dev server at http://localhost:3000 |
| `npm run build` | `tsc -b && vite build` → `dist/` |
| `npm run preview` | serve the production build |
| `npm test` | run the test suite once (`vitest run`) |
| `npm run test:watch` | tests in watch mode |
| `npm run lint` | ESLint |

Before opening a PR: `npx tsc -b && npm test && npm run lint`.

## Configuration

Runtime config is read from `window.config`, set by `public/config.js`.
[`public/config.js.example`](public/config.js.example) is the full, commented list of keys. Build-time
env vars use the `ONE_WSO2_` prefix (`vite.config.ts`).

### App-wide keys

| Key | Description | Example |
|---|---|---|
| `ONE_WSO2_AUTH_BASE_URL` | Asgardeo tenant base URL | `https://api.asgardeo.io/t/<your-org>` |
| `ONE_WSO2_AUTH_CLIENT_ID` | Asgardeo SPA application client ID | `<client-id>` |
| `ONE_WSO2_AUTH_SIGN_IN_REDIRECT_URL` | sign-in callback (must match the Asgardeo app) | `http://localhost:3000` |
| `ONE_WSO2_AUTH_SIGN_OUT_REDIRECT_URL` | sign-out callback | `http://localhost:3000` |
| `ONE_WSO2_ASGARDEO_MYACCOUNT_URL` | optional; defaults to the auth base URL with `api.` swapped for `myaccount.` | |
| `ONE_WSO2_THEME` | `wso2` (default), `acrylicOrange`, `acrylicPurple`, `classic`, `highContrast`, `paleIndigo`, `paleGray` | `wso2` |
| `ONE_WSO2_IDLE_AUTO_SIGN_OUT` | optional; `true` signs out 30 minutes after inactivity instead of waiting at the idle prompt | `false` |
| `ONE_WSO2_PREVIEW_FEATURES` | features built but not released; absent or `false` hides them | `{ umt: false, mis: false }` |

### Feature backends

Every key is optional. When a feature's key is unset, that feature shows a "not connected" notice
naming the key and makes no requests.

| Feature | Key(s) |
|---|---|
| Me profile, My Team, Org Chart, People Ops reports | `ONE_WSO2_PEOPLE_BACKEND_URL` |
| Leave | `ONE_WSO2_LEAVE_BACKEND_URL`, `ONE_WSO2_LEAVE_WEB_APP_URL` |
| Menu | `ONE_WSO2_MENU_BACKEND_URL` |
| Claims and claim approval | `ONE_WSO2_OPD_BACKEND_URL`, `ONE_WSO2_EXPENSE_CLAIMS_BACKEND_URL` |
| Credit card expenses | `ONE_WSO2_CC_EXPENSES_BACKEND_URL` |
| Banking | `ONE_WSO2_BANKING_BACKEND_URL` |
| Subscriptions | `ONE_WSO2_SUBSCRIPTION_BACKEND_URL` |
| Email groups | `ONE_WSO2_EMAIL_GROUPS_BACKEND_URL` |
| PAR | `ONE_WSO2_PAR_BACKEND_URL`, `ONE_WSO2_PAR_*` |
| Promotion | `ONE_WSO2_PROMOTION_BACKEND_URL` |
| Security: Risk Hub, Audit Hub, Admin Console | `ONE_WSO2_GRC_PLATFORM_BACKEND_URL` |
| Security: Evidence Portal | `ONE_WSO2_EVIDENCE_PORTAL_BACKEND_URL` |
| UMT | `ONE_WSO2_UMT_BACKEND_URL` |
| Sales meetings | `ONE_WSO2_REVOPS_BACKEND_URL` |
| Marketing Ops | `ONE_WSO2_MARKETINGOPS_BACKEND_URL`, `ONE_WSO2_MARKETINGOPS_ISAC_URL`, `ONE_WSO2_PARDOT_BASE_URL`, `ONE_WSO2_SALESFORCE_BASE_URL` |
| Due Diligence | `ONE_WSO2_DUE_DILIGENCE_BACKEND_URL` |
| Finance MIS | `ONE_WSO2_MIS_ARR_BACKEND_URL` (also needs `mis` in `ONE_WSO2_PREVIEW_FEATURES`) |
| Infra Portal | `ONE_WSO2_INFRA_BACKEND_URL` |
| CSM (separate app, opened in a new tab) | `ONE_WSO2_CSM_URL` |

## Import aliases

Use `@`-prefixed aliases instead of relative imports beyond one level (defined in `vite.config.ts`,
mirrored in `tsconfig.app.json`):

| Alias | Points to |
|---|---|
| `@` | `src` |
| `@api` | `src/api` |
| `@components` | `src/components` |
| `@config` | `src/config` |
| `@constants` | `src/constants` |
| `@context` | `src/context` |
| `@features` | `src/features` |
| `@hooks` | `src/hooks` |
| `@layouts` | `src/layouts` |
| `@utils` | `src/utils` |

## Directory layout

```
webapp/
├── public/
│   ├── config.js.example    → runtime config template (copy to config.js)
│   ├── favicon-*.svg        → WSO2 logomark, light and dark
│   └── wso2-logo-*.svg      → wordmarks for light and dark headers
├── src/
│   ├── main.tsx             → React root
│   ├── AppWithConfig.tsx    → provider tree (Asgardeo, Router, theme, Query)
│   ├── App.tsx              → routes
│   ├── api/                 → HTTP client, 401 handling, session renewal, errors
│   ├── config/              → runtime config (auth, API URLs, theme, preview flags, idle, landing)
│   ├── constants/           → perspective registry and per-perspective app menus
│   ├── context/             → perspective, theme, idle timeout, notifications
│   ├── layouts/             → AuthGuard, app shell
│   ├── components/          → shell chrome and shared UI (top bar, side rail, launcher, dialogs)
│   ├── hooks/               → shared hooks (access token, id_token claims, URL view state)
│   ├── utils/               → shared utilities
│   ├── test/                → test setup and helpers
│   └── features/            → one folder per feature
├── index.html
├── package.json
├── tsconfig*.json
└── vite.config.ts           → build, aliases, production CSP, Vitest
```

## Perspective model

A **perspective** is a role- or purpose-shaped area of the app. They are registered in
`src/constants/perspectives.ts` (`PERSPECTIVES`), and the launcher (the waffle, top right) lists
them in that order: People Ops, Finance, Legal, CSM, Sales, Infra Portal, Marketing Ops, Security
and Compliance, Me, and UMT. Infra Portal and UMT are behind preview flags; CSM is a separate app
opened in a new tab.

- **Me** is the default landing and a default favourite. Each person can choose a different landing
  perspective in Settings.
- **The left rail** is derived from the active perspective's `sections`, which are built from that
  perspective's app-menu registry in `src/constants/*Apps.ts`. The rail and the pages therefore
  can't drift.
- **Access** — `access` means the perspective is built. `requires` on an item hides it from people
  without the capability. Items gated by a backend's own roles go through that feature's gate hook.
  See [conventions](../docs/conventions.md#access-gates).

### Adding a feature to a perspective

1. Add its menu items (id, label, path, and `requires` if restricted) to the perspective's registry
   in `src/constants/`.
2. Add the routes in `src/App.tsx`, gated at the route as well as in the rail.
3. If a backend decides access, add or extend that feature's gate and keep restricted ids fail-closed.
4. Add its runtime config key, commented, to `public/config.js.example`.

## Auth flow

`<AuthGuard>` wraps every route. On mount:

1. If Asgardeo says signed in → render children.
2. If not → store the intended URL in `sessionStorage.one_wso2_post_login_redirect` and call
   `signIn()`. After the redirect completes, the guard restores the original URL.

The access token is attached as `Authorization: Bearer <accessToken>` on API calls
(`@api/http`, `@hooks/useAccessToken`); the API gateway forwards it to the backend as
`x-jwt-assertion`. The id_token is used for identity — backends check its `email` and `groups`
claims.

## Auth debug panel

In dev, a floating **auth** pill appears at the bottom right of every authenticated page. It decodes
the current id_token and access token and shows their claims, which helps when a backend rejects a
token. It isn't included in production builds (`import.meta.env.DEV`).

## Ask Novera palette

`⌘K` (or clicking the top-bar Ask Novera bar) opens the palette. Today it holds the pinned working
set; the Novera assistant is shown as coming soon.

## Branching

Work in a fork of `wso2-open-operations/one-wso2`. Branch off the latest `upstream/main` (never
commit to `main` directly), and rebase on `upstream/main` before opening a PR.
