# Event Platform — functional specification

**Status:** written *ahead of* the port (phase 0). Nothing is built yet. This is the reference the
later phases are checked against, and the record of what is deliberately left out or changed.

**Source of truth for behaviour:** `digiops-marketing/apps/conference/agenda-organizer` —
`frontend/src` for the UI (`router.tsx`, `api/*.ts`, `types/api.ts`, `components/side-nav-bar/`,
`components/header/Header.tsx`), and `backend/cmd/server/main.go` plus `backend/openapi.yaml` for the
wire contract. Where the two backend files disagree, `main.go` wins: it is what actually routes.

**In One WSO2:** a collapsible **Event Platform** group under Marketing Ops, with **All Events** and
**Speakers** under `/marketing-ops/event-platform`. The source's top-level sidebar becomes those rail
items; its per-event sidebar becomes routed tabs inside an event, the same tab-plus-toggle pattern
Leave uses (`docs/ported-apps/leave-app.md`). Backend is the agenda-organizer Go service, unchanged in
shape, configured as `ONE_WSO2_EVENT_PLATFORM_BACKEND_URL`.

---

## 1. Purpose and users

Marketing builds conference agendas: events with days, tracks, sections and sessions placed on a
slot grid; a speaker library shared across events; rooms and venue activities; a static HTML/JSON
export for the conference site. A separate shop ("O2C") sells event merchandise for coins; its
operators manage inventory and fulfil orders.

Two capabilities, both from the Marketing Ops access map (§4):

| Capability | Replaces source role | Gets |
|---|---|---|
| `eventplatform` | admin | everything |
| `eventplatform-shop` | shop | the Shop tab of any event, and a read-only event list to reach it (§8, Q1) |

They are **siblings, not a hierarchy**: holding one does not imply the other. The Marketing Ops
admin master key (`isAdmin`) grants both, as it does every Marketing Ops feature.

Either capability also makes the caller a Marketing Ops user (§4), and every Marketing Ops user gets
the ungated Utilities (UTM Link Generator, Asset Name Generator). That is deliberate and the same as
for every other Marketing Ops feature group: the Utilities read and write no feature data. "Siblings"
is about the two Event Platform capabilities, not about Utilities. If shop operators must not have
them, Utilities need a capability of their own; that is a Marketing Ops change, out of scope here.

The source backend also knows a third, read-only `user` role. The source UI
never admits it — `RoleGuard` lets only admin or shop through — so it has no screen to port and is
dropped (§7).

---

## 2. Route map

All paths below are relative to `/marketing-ops/event-platform`. Config file:
`features/marketing-ops/event-platform/eventPlatformTabs.ts`, same shape and helpers as
`leaveTabs.ts` (`visibleTabs`, `visibleKinds`, `firstAllowedPath`, `parse…Path`, `…Path`), with two
tab sets and `:eventId` threaded into the path builders.

### 2.1 Top level

Picked from the rail, not a tab row.

| Rail item | Target | Source route | Source page | Access |
|---|---|---|---|---|
| All Events | `/events` | `/` | `EventsDashboard` | admin or shop (shop: read-only list, §8 Q1) |
| Speakers | `/speakers` | `/speakers` | `SpeakersPage` | admin |

`/marketing-ops/event-platform` → `firstAllowedPath`: `/events` for admin and shop alike.

### 2.2 Inside an event (`/events/:eventId`)

| Tab | Toggle kind | Target | Source route | Source page | Access |
|---|---|---|---|---|---|
| Sessions | Agenda | `/sessions/agenda` | `/events/:eventId` | `SessionEditorPage` | admin |
| | Speakers | `/sessions/speakers` | `/events/:eventId/speakers` | `EventSpeakersPage` | admin |
| | Rooms | `/sessions/rooms` | `/events/:eventId/rooms` | `RoomsPage` | admin |
| | Activities | `/sessions/activities` | `/events/:eventId/activities` | `ActivitiesPage` | admin |
| | Export | `/sessions/export` | `/events/:eventId/export` | `EventExportPage` | admin |
| Shop | Inventory | `/shop/inventory` | `/events/:eventId/shop-items` | `ShopInventoryPage` | admin or shop |
| | Orders | `/shop/orders` | `/events/:eventId/shop-orders` | `ShopOrdersPage` | admin or shop |
| Settings | — | `/settings` | `/events/:eventId/settings` | `EventSettingsPage` | admin |

Toggle labels are shortened from the source sidebar ("Session Editor", "Session Speakers", "Shop
Inventory", "Orders & Checkouts") because the tab already names the group. The source's "O2C" group
label becomes **Shop**, which is what its routes and backend already call it.

### 2.3 Routing rules

- `/events/:eventId` → that event's `firstAllowedPath`; a shop-only user lands on `shop/inventory`.
- A multi-kind tab with no kind (`/events/42/sessions`) → its first allowed kind.
- Every leaf is wrapped in `EventPlatformRoute gateId=…`, same contract as `LeaveKindRoute`: wait
  for `isResolving`, then render, redirect to an allowed leaf, or say "not available for your role".
  A hidden tab must be refused at its URL too; hiding is not access control.
- The toggle row is drawn only when the tab has two or more kinds the visitor may open.
- Inside an event the shell header carries the event switcher (from source `Header.tsx`) and a
  "← All events" link.
- Heavy leaves (Agenda, Export) are lazy with a `Skeleton` fallback.
- Code lives in `features/marketing-ops/event-platform/`, routes exported as an
  `eventPlatformRoutes` fragment spread into `App.tsx`. Menu ids use `mops-event-platform-*` so they
  cannot clash with the existing, unrelated `features/marketing-ops/events` (`mops-events-*`).

---

## 3. Screens (scope summary)

Behaviour is ported as-is unless §7 says otherwise. One line each, to fix scope per phase:

- **Events** — card list and create. Card opens the event. (Delete lives in Settings.) A shop-only
  user gets the same list read-only, without create; a card opens that event's `shop/inventory`.
- **Speakers** — global library shared by all events; create, edit, delete, visibility toggle, CSV
  import (row-by-row create/update).
- **Agenda** — day picker, tracks per day, track and keynote sections, footnotes, unscheduled
  palette, native HTML5 drag and drop onto the slot grid, session dialog (speakers, room, topic,
  artifacts, rich text), session CSV import, track-topic management.
- **Event speakers** — speakers derived from this event's sessions, with their roles.
- **Rooms** — room CRUD, `RoomMappingTree` (day → track → section room mapping, keynote room),
  "reapply rooms".
- **Activities** — venue activities with per-day open windows, saved as one whole-schedule PUT.
- **Export** — JSON previews and downloads for agenda and speakers, plus a static HTML agenda built
  client-side from `public/agenda-template.html` and `utils/staticAgenda/runtime.js?raw`. The page
  is published to the public conference site, so the port keeps the source's output hygiene: rich
  text (session titles and descriptions) goes through DOMPurify with the source's tag allow-list
  before it reaches the DOM, every other admin-entered string is HTML-escaped, and URLs are checked
  for a safe scheme. That holds both where the data is written into the template and in the `?raw`
  runtime; the backend's own sanitising on write is not relied on.
- **Inventory** — shop item CRUD (`ItemFormDialog`), stock and sold counts from orders.
- **Orders** — order table, `ShopOrderDrawer`, status changes.
- **Settings** — event fields (name, dates, timezone, venue, shop closing time, artifact labels,
  link toggles) and its days, saved as one `PUT /api/events/{id}`; delete event (confirm).

---

## 4. RBAC

one-wso2 has no backend; the UI mirrors what each backend enforces. Event Platform reuses the
Marketing Ops gate rather than adding its own `/api/me`. That gate only decides what the UI offers.
The agenda-organizer backend enforces admin and shop itself, on every route (the Access column in
§5), and must keep doing so against one-wso2's token (§6):

- **Source of truth:** `digiops-marketing/agents/marketing-ops/backend/shared/access_map.yaml` gains
  an `eventplatform` feature — `general` → group `eventplatform`, `shop` → group
  `eventplatform-shop`. Groups resolve to `app-marketingops-eventplatform[-shop][-<env>]`. Holding
  either makes the caller `authorized` on Marketing Ops `/api/me` (`rbac.can_login`).
- **Frontend:** `useMarketingOpsGate` + `ITEM_CAPABILITY`. Add `"eventplatform" |
  "eventplatform-shop"` to `MarketingOpsCapability`. `hasMarketingOpsCapability` keeps `isAdmin` as
  the master key.
- **Gate ids** (in `ITEM_CAPABILITY`):

  | Id | Capability | Used by |
  |---|---|---|
  | `mops-event-platform-events` | `eventplatform` **or** `eventplatform-shop` | All Events rail item **and** the Events route |
  | `mops-event-platform-speakers` | `eventplatform` | Speakers rail item |
  | `mops-event-platform-admin` | `eventplatform` | Speakers route, Sessions/*, Settings, and create on Events |
  | `mops-event-platform-shop` | `eventplatform` **or** `eventplatform-shop` | Shop/* |

  The All Events rail item and the route it opens share one id, so the rail never offers a shop
  user an entry that the route then refuses (§8, Q1).

  `ITEM_CAPABILITY` maps one id to one capability today. "Admin or shop" needs any-of, so phase 1
  widens the value to `MarketingOpsCapability | readonly MarketingOpsCapability[]` (any-of). The
  alternative — `canSee(a) || canSee(b)` at each call site — would let the rail, the tab bar and the
  route guard drift apart, which is the failure the single map exists to prevent.
- **Fail closed:** a registry item with `requires` and no `ITEM_CAPABILITY` line is hidden from
  everyone, admins included. Add the lines in the same PR as the registry entry.

---

## 5. API contract

Base: `ONE_WSO2_EVENT_PLATFORM_BACKEND_URL` (e.g. `https://api.example.com/event-platform`), trailing
slashes stripped as `marketingOpsBackendUrl` does. All calls use `authedGet/Post/Put/Patch/Delete`
(Bearer access token). JSON bodies are bound strictly, so an extra key is a 400 — send exactly the
fields listed.

Access column: **R** = any app member (admin, shop or user role), **A** = admin, **S** = admin or
shop. Types are those in source `types/api.ts`.

### 5.1 Events, days, export

| Method | Path | Body → Response | Access |
|---|---|---|---|
| GET | `/api/events` | → `ConferenceConfig[]` | R |
| POST | `/api/events` | `{name, startDate, …}` → `ConferenceConfig` (201) | A |
| GET | `/api/events/{id}` | → `ConferenceConfig` (includes `days`) | R |
| PUT | `/api/events/{id}` | event fields **and the full `days` array** → `ConferenceConfig` (upsert; this is how days are edited) | A |
| DELETE | `/api/events/{id}` | → 204 | A |
| GET | `/api/event/days` | → `ConferenceDay[]` — **every event's days**; filter by `configId` client-side (`RoomMappingTree`) | R |
| GET | `/api/events/{id}/export/agenda` | → `AgendaExport`, `Content-Disposition` filename | R |
| GET | `/api/events/{id}/export/speakers?roles=` | `roles` comma list, default `internal,external` → `SpeakersExport` | R |

### 5.2 Tracks, sections, footnotes, topics

| Method | Path | Body → Response | Access |
|---|---|---|---|
| GET | `/api/event/tracks` | → `Track[]` — every event's; used by `RoomMappingTree` | R |
| GET | `/api/event/days/{dayId}/tracks` | → `Track[]` | R |
| POST | `/api/event/days/{dayId}/tracks` | `{colorToken, roomId}` → `Track` | A |
| PATCH | `/api/tracks/{id}` | `{colorToken, roomId}` → `Track` | A |
| DELETE | `/api/tracks/{id}` | → 204 (client then unplaces its sessions, §5.3) | A |
| GET | `/api/tracks/{id}/sections` | → `TrackSection[]` (one call per track) | R |
| POST | `/api/tracks/{id}/sections` | `{label, startSlot, durationSlots, roomId, topicId}` → `TrackSection` | A |
| GET | `/api/event/days/{dayId}/keynote-sections` | → `TrackSection[]` | R |
| POST | `/api/event/days/{dayId}/keynote-sections` | as above → `TrackSection` | A |
| PATCH | `/api/track-sections/{id}` | partial → `TrackSection` | A |
| DELETE | `/api/track-sections/{id}` | → 204 (clears its sessions' track and slot; client then unplaces them, §5.3) | A |
| GET | `/api/event/days/{dayId}/footnotes` | → `TimeslotFootnote[]` | R |
| POST | `/api/event/days/{dayId}/footnotes` | `{slotIndex, text}` → `TimeslotFootnote` | A |
| PATCH | `/api/footnotes/{id}` | partial → `TimeslotFootnote` | A |
| DELETE | `/api/footnotes/{id}` | → 204 | A |
| GET | `/api/events/{id}/track-topics` | → `TrackTopic[]` | R |
| POST | `/api/events/{id}/track-topics` | `{name, slug, showInFilter}` → `TrackTopic`; 409 on duplicate slug | A |
| **PUT** | `/api/track-topics/{id}` | `UpdateTrackTopicInput` → `TrackTopic`; 409 on duplicate slug | A |
| DELETE | `/api/track-topics/{id}` | → 204; references nulled server-side | A |

### 5.3 Sessions and speakers

| Method | Path | Body → Response | Access |
|---|---|---|---|
| GET | `/api/sessions?configId=&dayId=&scheduled=` | → `Session[]`; `scheduled=false` requires `configId` | R |
| POST | `/api/sessions` | session fields + `speakerAssignments[{speakerId, role}]` → `Session` | A |
| PATCH | `/api/sessions/{id}` | every editable field (title is required, so not partial) + `speakerAssignments` → `Session` | A |
| PUT | `/api/sessions/{id}/placement` | `{dayId, trackId, slotIndex, sectionId}` (all null = unschedule) → `Session` | A |
| PATCH | `/api/sessions/{id}/artifacts` | `{artifacts: SessionArtifact[]}` → `Session` | A |
| DELETE | `/api/sessions/{id}` | → 204 | A |
| GET | `/api/speakers` | → `Speaker[]` (global) | R |
| POST | `/api/speakers` | speaker fields → `Speaker` | A |
| PUT | `/api/speakers/{id}` | speaker fields → `Speaker` | A |
| PATCH | `/api/speakers/{id}` | `{visible}` → `Speaker` | A |
| DELETE | `/api/speakers/{id}` | → 204 | A |

### 5.4 Rooms and activities

| Method | Path | Body → Response | Access |
|---|---|---|---|
| GET | `/api/event/rooms?configId=` | → `Room[]` | R |
| POST | `/api/event/rooms` | `{configId, name, colorToken}` → `Room` | A |
| PATCH | `/api/rooms/{id}` | partial → `Room` | A |
| DELETE | `/api/rooms/{id}` | → 204 | A |
| GET | `/api/event/room-mappings?configId=` | → `RoomMappings` | R |
| PUT | `/api/event/room-mappings` | `{configId, keynoteRoomId}` → `RoomMappings` | A |
| POST | `/api/event/rooms/reapply` | `{configId}` → `{sessionsUpdated}` | A |
| GET | `/api/events/{id}/activities` | → `Activity[]` | R |
| POST | `/api/events/{id}/activities` | `{name, description, position}` → `Activity` (hours are set with the hours `PUT`) | A |
| PUT | `/api/activities/{id}` | `{name, description, position}` → `Activity` | A |
| DELETE | `/api/activities/{id}` | → 204 | A |
| PUT | `/api/activities/{id}/hours` | `{hours: [{dayId, startMinute, endMinute}]}` → `ActivityHours[]` (replace) | A |

### 5.5 Shop

| Method | Path | Body → Response | Access |
|---|---|---|---|
| GET | `/api/events/{id}/shop/items` | → `ShopItem[]` | S |
| POST | `/api/events/{id}/shop/items` | item fields → `ShopItem` | S |
| PUT | `/api/events/{id}/shop/items/{itemId}` | `{name, description, price, imageUrl, availableStock, category, maxPerUser, visibility}` → `ShopItem` | S |
| DELETE | `/api/events/{id}/shop/items/{itemId}` | → 204 | S |
| GET | `/api/events/{id}/shop/orders` | → `ShopOrder[]` (contains shipping PII) | S |
| PATCH | `/api/events/{id}/shop/orders/{orderId}/status` | `{status}` → empty 200 | S |

**Not ported:** `POST /api/auth/logout` (the shell owns sign-out), and `POST /api/event/days`,
`PATCH`/`DELETE /api/event/days/{id}` — the source wraps them in `api/days.ts` but no screen calls
them; Settings edits days through the event upsert.

Query keys: `["marketing-ops", "event-platform", <domain>, …]`, one shared `QueryClient`.

---

## 6. Backend prerequisites

Out of scope for the frontend PRs; tracked with the backend owners.

1. **Access map:** add the `eventplatform` feature (§4) to the Marketing Ops access map, and create
   its groups per environment.
2. **Same groups on the agenda-organizer backend,** with the Marketing Ops admin group counted as an
   admin there too — otherwise the frontend's master key shows admins tabs whose calls 403.
3. **Token and gateway.** The UI roles move to the Marketing Ops gate (§7), but the backend still
   decides admin, shop and member on its own, from the token it verifies. In the source that token
   was minted for the source app's own client. one-wso2's is minted for a different client, so the
   audience and the claims differ. Four things have to be settled before the data layer goes live:
   1. **Which credential the backend verifies.** one-wso2 sends `Authorization: Bearer <access
      token>` from its IdP. The backend either verifies that token (the IdP's keys and issuer, with
      one-wso2's client as the audience), or a gateway-minted assertion, which has its own signer
      and keys and is only present where the gateway is set to add it, per endpoint and per
      environment. The source verifies the gateway assertion. Pick one per deployment, and verify
      exactly that one; never accept whichever of the two happens to arrive.
   2. **Where the roles come from.** The groups claim on the verified token, or a lookup on the
      server by subject. Either way the result must include the groups in §4 and the Marketing Ops
      admin group (item 2).
   3. **No `email` on an access token.** An access token carries `sub`, `aud`, `iss` and scopes,
      not `email`. The source requires an `email` claim, so as it stands it refuses every one-wso2
      call. Key on `sub`, or look the email up.
   4. **CORS.** The gateway must allow one-wso2's origin and the `Authorization` header, and expose
      `Content-Disposition` for export filenames. A browser cannot add the gateway assertion header
      itself, so that header is never a client-side workaround.

---

## 7. Deliberate differences from the source

- **Navigation.** No in-app sidebars. `DashboardSideBar` → the rail's All Events and Speakers items;
  `EventSidebar` groups → event tabs, items → toggle (§2).
- **Theme.** Drop `AcrylicOrangeTheme` and hard-coded colours; theme tokens and
  `theme.applyStyles`, light and dark. `config/colorTokens.ts` names are kept (the backend enforces
  them with a CHECK constraint); their hexes are re-checked against both schemes.
- **Auth.** Remove `AuthProvider`, `AuthGuard`, `RoleGuard`, `AdminGuard`, `useUserRole`,
  `useSignOut`, `useAuthApiClient`, `IdleTimeoutProvider` + `SessionWarningDialog`, and the dev-only
  token shim. The shell owns sign-in, refresh, idle timeout and sign-out. Roles come from
  the Marketing Ops gate, not a decoded `roles` claim.
- **Roles.** The read-only `user` role is dropped; the source UI already denied it.
- **Mock mode removed.** Every `isMocking()` branch and `api/mock/` go; there is no offline mode.
- **HTTP and errors.** `createApiClient` → `authedGet/…`; `ApiError` → `HttpError`;
  `useNotify` → `useNotifications`; messages via `humanizeHttpError` / `describeError`, never the
  raw body. `api.download` becomes a blob helper over `fetchWithReauth`.
- **Shared components.** `ConfirmationDialog` for `ConfirmDialog`, `ErrorNotice` for errors,
  `MarketingOpsShell` for the frame. Orders stay a plain MUI `Table`.
- **Forms.** Hand-written `useState` forms → `react-hook-form`.
- **Rich text.** `quill` 2 → the repo's `react-quill-new`; `dompurify` kept for render and for the
  static export (§3, Export).
- **Config.** The source `public/config.js` is not copied (it holds a real client id); one new key,
  placeholder only, in `config.js.example`.
- **Fixed, not reproduced:**
  - Track-topic rename sends `PATCH /api/track-topics/{id}`, but the backend routes only `PUT`; in
    the source the rename fails. The port sends `PUT`.
  - The agenda palette lists unscheduled sessions with `dayId === null` from **every** event,
    because `useListSessions()` is called unscoped. The port passes `configId`, which the backend
    already supports. Same for Event speakers, which filters client-side today.
  - The source unplaced a section's sessions *before* deleting it, so a failure partway left
    sessions unscheduled on the server under a "changes reverted" toast. The port deletes first,
    then unplaces, as it does for tracks; an unplace that fails after a successful delete is
    reported as such, not as a revert.
  - Request bodies the backend would reject are trimmed to the fields it accepts (for example the
    order-status `transactionHash`), and the event upsert always sends `keynoteRoomId` so Settings
    no longer clears it. Settings does not own that field: the keynote room is edited in Rooms
    (`PUT /api/event/room-mappings`), and the upsert re-places keynote sessions from whatever it
    receives. So Settings takes `keynoteRoomId` at submit time from the current
    `["marketing-ops", "event-platform", "room-mappings", …]` cache (fetching it if absent), never
    from the form's initial values; and the room-mappings mutation also invalidates
    `["marketing-ops", "event-platform", "events", id]`. Otherwise saving Settings after a Rooms
    change writes the old room back and silently moves every keynote session on the public agenda.
    Phase 4 carries a test that saves Settings after a mapping change and asserts the new room is
    sent.

---

## 8. Open questions

**Q1. Shop-only users have no event list.** *Decided: (b).* The Events dashboard is admin-only in
the source, so a shop user opening All Events had nowhere to pick an event.

- (a) Open the event switcher to shop users only — still leaves the landing page empty.
- (b) **Adopted:** open the Events tab to shop users as a read-only list (no create, no delete);
  a card opens that event's `firstAllowedPath`, i.e. `shop/inventory`. It needs no backend change:
  `GET /api/events` and `GET /api/events/{id}` are already open to any app member (§5, **R**). The
  rail item and the Events route are both gated on the any-of `mops-event-platform-events` (§4);
  create is checked against `mops-event-platform-admin`. The skeleton opens the route to both
  capabilities; phase 3 builds the page's two faces.

**Q2. `DataGrid` for orders?** Plain `Table` unless asked for.

---

## 9. Phases

One PR per phase, stacked.

| # | Phase | Lands |
|---|---|---|
| 0 | Spec | this document |
| 1 | Skeleton | rail group, capability union + `ITEM_CAPABILITY` any-of, config key + `isEventPlatformConfigured()` + `eventPlatformServiceUrls`, `config.js.example`, `eventPlatformTabs.ts` + tests, `EventPlatformRoute`, route fragment, shell with tab and toggle rows, placeholder leaves |
| 2 | Data layer | the 15 `api/*.ts` files and `types/` on `authedGet/…`, no mocks |
| 3 | Top-level tabs | Events dashboard, speaker library incl. CSV import |
| 4 | Simple event tabs | Event speakers, rooms (`RoomMappingTree`), activities, settings |
| 5 | Agenda | `AgendaBoard`, `useDragDrop`, `useAgendaEditor`, tracks, sections, footnotes, topics, rich text, session CSV import |
| 6 | Shop | inventory (`ItemFormDialog`), orders + `ShopOrderDrawer` |
| 7 | Export + polish | static HTML export (`?raw` runtime, `public/` template), dark-mode pass, Vitest for pure logic |

Phases 3, 4 and 6 can run in parallel once 2 merges.

---

## 10. Risks

- **Token path** (§6.3): if the backend does not accept one-wso2's token, or requires a claim
  that token lacks, every call 401s.
- **Admin master key vs backend** (§6.2): a Marketing Ops admin sees every tab; unless the backend
  counts that group as admin, those calls 403.
- **Fail-closed gate:** a missing `ITEM_CAPABILITY` line hides the item from everyone.
- **Request fan-out:** track and section deletes unplace sessions with parallel `PUT …/placement`;
  sections load one call per track; CSV imports post row by row.
- **Unscoped lists:** `/api/event/days` and `/api/event/tracks` return every event's rows and grow
  with history; there is no server filter to use.
- **Static export:** depends on the `?raw` import and `public/agenda-template.html` surviving the
  move to one-wso2's Vite build and base path.
- **Oxygen 0.10 → 0.13.1:** `Sidebar` is dropped anyway; check every other `@wso2/oxygen-ui` import
  for API drift.
- **Shipping PII** in orders: keep it out of logs and error messages.
