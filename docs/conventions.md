# Conventions shared by every feature

The rules below apply across One WSO2's features.

## Backends and configuration

- **Every backend has its own runtime config key** in `public/config.js` (template:
  [`webapp/public/config.js.example`](../webapp/public/config.js.example)). The same static build
  serves every environment; nothing environment-specific is compiled in.
- **An unset key is a state, not an error.** The feature renders an informational "not connected"
  notice that names the missing key, and makes **no requests at all** — no identity call, no data
  call.
- **Base URLs include their version segment.** Environments differ in both host and path, so the
  client never appends a version.
- **Service URLs are built in one place per feature** (`src/config/apiConfig.ts` and the feature's
  own service map). Components never concatenate a base URL themselves.

## Authentication on the wire

- Every request carries the signed-in user's **access token** as `Authorization: Bearer …`. The API
  gateway turns it into `x-jwt-assertion` for the backend.
- Identity claims that backends check (`email`, `groups`) are **id_token** claims. Read them from the
  decoded id_token (`@hooks/useAsgardeoUser`, `@hooks/useAsgardeoGroups`), not from the access token.
- `@api/http`'s `fetchWithReauth` handles a 401 by renewing the session once and **replaying GETs
  only** — a POST is never replayed, so a write cannot be sent twice.

## Access gates

- **Privilege numbers belong to the backend that issued them.** Each backend's `/user-info` has its
  own scheme, and the same number means different things in different backends (`987` is "every
  employee" to one service and "may see ARR reporting" to another). Never read one backend's
  privileges from another's array, and never compare them against the app-wide capability set.
- **Where a backend offers a `/me` or `/user-info` answer, use it.** A server-computed answer
  cannot drift from what the server will allow. Only when a backend publishes group *names* and
  leaves the comparison to the client (Subscriptions) is the `groups` claim compared client-side.
- **Client-side gating is presentation only.** Every endpoint re-checks the caller; hiding an item
  just avoids offering a screen whose every call would fail.
- **Every gated screen is gated at its route, not just hidden from the rail or tab bar.** A URL can
  be typed, pasted, or bookmarked from when the person held the role. A refused route redirects to
  one the person may see, or explains when there is none.
- **A rail item that declares a restriction but has no case in its gate is hidden** (fail-closed).
  A gate's open default applies only to unrestricted items; each gate keeps the restricted ones in
  its `RESTRICTED_IDS`.

### The gate ladder

Every feature shell resolves access in the same order, and each rung renders differently:

1. **Not configured** — backend key unset → "not connected" notice naming the key. No requests.
2. **Resolving** — spinner. Never a premature denial, and **nothing is redirected** while resolving:
   a redirect decided on an unresolved gate bounces a deep link, and is not undone when the answer
   arrives.
3. **Failed** — the access check itself errored (5xx, timeout, gateway) → an error **with Retry**.
   Never presented as "you don't have access".
4. **Denied** — the backend answered and the person holds no qualifying role → say plainly what the
   screen is for and who to ask.
5. **Allowed** — render.

Rungs 3 and 4 stay distinct deliberately: both leave the client holding no roles, and collapsing
them tells someone whose gateway timed out that they lack a permission they already have.

## Routing

- **Tabs are routes.** A tab is linkable, survives a refresh, and works with the back button. The
  tab bar is filtered by the same gate as the route, so it never offers a tab the route would
  refuse.
- **Deep links rebuild the whole screen from the URL** — never from router state carried from the
  previous page.

## Data fetching

- **Server state lives in TanStack Query**; drafts, open dialogs, selected tabs and unapplied
  filters stay component state.
- **Client errors (4xx) are not retried, and mutations are not retried.** A closed window (400) or a
  missing role (403) is a final answer; retrying only delays the message.
- **A successful mutation invalidates exactly what it affects** — the detail, the list, and any
  summary built from them. Write into the cache by hand only for a deliberate immediate update (an
  edit shown before it is saved, a cancelled item removed on the click), and say why beside it.
- **A query that fails blanks only its own part of the screen.** When a screen reads two backends,
  one failing shows a notice above whatever did load; an empty result from a failed request is never
  presented as "nothing to do".
- **Bulk actions over a backend with no bulk endpoint loop one item at a time**, collect failures,
  and report them without aborting the rest.

## Presenting errors

- **Show the server's own message** where the response carries one (`@api/errors`'s
  `describeError`). Raw response bodies are never surfaced.
- **Confirm before anything irreversible or externally visible** (submit, share, decline, send,
  close a cycle), and **disable the confirming button while its request is in flight** so it cannot
  fire twice.

## Rich text, links and files

- **Rich text is sanitized with DOMPurify on both write and read.** A field one person writes and
  another person reads is never trusted just because the editor sanitized it.
- **Generated HTML escapes every user-supplied value**, and only `https?://` URLs are written into
  links.
- **Blob previews use a MIME allowlist** (PDF, JPEG, PNG, and a few more where needed). Anything
  else is re-typed as `application/octet-stream` and downloaded, because a `blob:` HTML document
  runs with the app's origin.
- Links that open a new tab carry `rel="noopener noreferrer"`.

## Time

- **Business windows are evaluated in the business's own timezone**, not the viewer's: the
  cafeteria's windows in IST, revenue reporting periods in Pacific Time, banking cutoffs in UTC.
- **Calendar arithmetic is done on civil dates** (`{year, month, day}`), not on `Date` instants, so
  a boundary does not move with the reader's location.
- **A window that updates while the page is open updates at the boundary** rather than on a slow
  poll.

## Preview features

Features that are built and merged but not released are hidden behind
`ONE_WSO2_PREVIEW_FEATURES` (`src/config/previewFeatures.ts`). An absent or `false` entry hides the
feature — rail entries, routes, and its backend calls — so a deployment that says nothing shows
nothing. An entry is deleted when its feature ships.
