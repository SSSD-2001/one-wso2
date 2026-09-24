# Updates Manager (UMT) — functional specification

**Status:** written during a staged port, from the source implementation rather than from a prior
specification. Updated as the port has progressed: Updates (§2.2) and Product Management (§2.3) are
now routed and implemented. On the Dashboard, View updates and Create are live actions; View pending,
View released, and the admin-only release-chunk Create still intentionally show an
unavailable/maintenance notice, since Release Chunks itself is not yet ported. Release Chunks and
Statistics remain unrouted and unimplemented; their sections below define the behaviour to preserve
when the port continues.

**Source of truth for behaviour:** the Updates Manager service contract and verified backend
responses. Backend responses are authoritative where display code and response data disagree.

**In One WSO2:** the UMT perspective currently exposes only `/umt`. The existing Updates Manager
service is reused through `ONE_WSO2_UMT_BACKEND_URL`.

---

## 1. Purpose and users

UMT coordinates the creation, development, verification, and release of WSO2 product updates. It
also exposes product metadata, release-chunk build state, and update statistics.

The service returns numeric privileges from `GET /update/user-info`. They belong to UMT and are not
the app-wide People capabilities:

| Privilege | UMT role | Meaning in the source app |
|---|---|---|
| 444 | `UMT_USER` | Standard access to UMT workflows. |
| 555 | `UMT_ADMIN` | UMT administration and privileged release actions. |
| 666 | `PRODUCT_LEAD` | Product-lead access to update workflows. |

A signed-in person needs at least one of these privileges to enter UMT. Product Management is the
exception: it is restricted to `UMT_ADMIN` even when another UMT role grants access to the rest of
the perspective.

---

## 2. Screens and features

### 2.1 Dashboard — `/umt`

The dashboard is a summary and a set of entry points, not a second source of update data.

- **Updates** shows the total number of updates and four lifecycle summaries:
  - Active is the sum of `Development`, `Staging`, `UAT`, and `UATStaging`.
  - On Hold is `OnHold`.
  - Released is `Released`.
  - The lifecycle chart presents `Development`, `Staging`, `UAT`, and `UATStaging` as Development,
    Testing, Verifying, and Pending respectively.
- **Release chunks** shows the total number of created chunks and groups build states as:
  - Pending: `PENDING`.
  - Building: `BUILDING` plus `REBUILDING`.
  - Successful: `SUCCESS`.
  - Failed: `FAILURE`, `UNSTABLE`, `ABORTED`, `UNKNOWN`, `NOT_BUILT`, `CANCELLED`, and
    `NO_BUILD_JOB` combined.
- **View updates** navigates to `/umt/updates`. **Create** opens the update-creation dialog and
  submits to the real creation endpoint.
- **View pending** and **View released**, under Release chunks, still show an unavailable notice;
  they do not navigate to unported routes. The admin-only release-chunk **Create** shows the same
  notice.

While statistics are loading, the screen retains its structure and shows progress in place of
values. A failed statistics request produces a retryable error without hiding the rest of the UMT
shell.

### 2.2 Updates — `/umt/updates`

**Ported.** The screen is a server-paged list backed by `POST /update/search`.

The list exposes update identity, case and Jira references, internal issue, products, update type,
lifecycle state, assignee, estimates, issue type, security data, public issues, pull requests,
artifacts, release date, and row actions. Selecting an update opens its detail workflow.

Filters are drafted separately and take effect only when applied. Update id, ServiceNow case id,
Jira id, type, issue type, lifecycle state, lifecycle, product and version, internal issues, security
advisory, assignee, pull requests, artifacts, public-PR modification date,
released-without-public-PR, and released date are all supported. Clearing filters restores the
unfiltered search.

`/umt/updates/:id` is the detail route — a single page with View, Branch, Edit, and Lifecycle
History tabs, rather than separate routes per tab. The last-selected tab is persisted per update id.

The screen's pagination and filtering contract is server-side, not a client-side table over
`GET /update`.

### 2.3 Product Management — `/umt/products`

**Ported. Admin only.** The screen lists base products with name, version, active
state, creator, creation date, and deprecation date.

An administrator can add a product and deprecate an existing product after confirmation. Creating a
product requires its name, version, product-lead and engineering-director email addresses, and FTP
connection details. Credentials are operational data: never log them, cache them in browser
persistence, or expose them after submission.

The rail item and the route must both enforce the admin restriction. Hiding the item alone is not an
authorization boundary.

### 2.4 Release Chunks — future `/umt/release-chunks`

**Not yet ported.** The `status` query parameter selects the view. `released` opens released chunks;
`pending`, an absent value, or an unknown value opens pending chunks.

- **Pending** shows each chunk's update ids, update levels, product build status, test-grid build
  status, and customer-specific-testing build status. Administrators additionally receive the
  available build, retrigger, email, remove, and release actions. Destructive or externally visible
  actions require confirmation and must be disabled while their request is in flight.
- **Released** is read-only. It shows chunk id, update ids, product update levels and their build
  status, release message, and release time, newest chunk first.
- Creating a release chunk is a separate workflow. It selects eligible `UATStaging` and `UAT`
  updates, creates the chunk, and then follows its build state. The source route is
  `/release-chunks/new`; the One WSO2 route must live beneath `/umt/release-chunks`. Both its
  Dashboard entry and route are restricted to `UMT_ADMIN`. The source route allowing `UMT_USER`
  and `PRODUCT_LEAD` is a permissions bug and must not be preserved.

Release-chunk status is not static. Any polling introduced during the port must stop when its page
unmounts and must not allow an older response to replace newer state.

### 2.5 Statistics — future `/umt/statistics`

Statistics presents a stacked monthly bar chart.

- The default platform is APIM and the default range is the previous six months through today.
- Platforms are APIM, IAM, Integration, Financial Services, and Healthcare.
- Optional breakdowns are Product, Version, Update origin, Update lifecycle, and Extended support.
- Product choices come from `GET /meta` and are limited to products belonging to the selected
  platform.
- Product selection is disabled when Product itself is the breakdown dimension.
- Changing the platform requests that platform immediately. Other filter edits remain drafts until
  **Apply**.
- **Reset** clears the breakdown and product, restores the default dates, and refreshes the current
  platform.
- Flat totals become one `Total` series. Dynamic response keys become stacked series. Version-wise
  entries use `<product> <version>` as the series name and repeated entries are summed.
- No matching rows produces an empty state; request failure produces a retryable error.

---

## 3. Business rules

1. **Backend state is authoritative.** Lifecycle and build status must come from the service; the
   client may group or relabel known states for presentation but must not infer state transitions.
2. **Role checks happen before feature requests.** A visit first resolves `/update/user-info`. No
   metadata, statistics, update, product, or release-chunk request is made for a denied user.
3. **Metadata is shared reference data.** `GET /meta` supplies products, versions, issue types,
   lifecycles, and user emails. It should use one subject-scoped query cache rather than duplicate
   copies in individual screens.
4. **Server data belongs in TanStack Query.** Queries and mutations replace the source app's Redux
   async slices. Local draft state—open dialogs, selected tabs, unapplied filters, and form values—
   remains component state.
5. **Mutations refresh their dependants.** A successful update or release-chunk mutation must
   invalidate the exact affected detail, list, dashboard-statistics, and chunk queries. Do not patch
   unrelated caches speculatively.
6. **Deep links remain valid.** Refreshing a detail or filtered release-chunk URL must reconstruct the
   same screen without relying on router state from the previous page.

---

## 4. Role matrix

| Screen or action | `UMT_USER` | `PRODUCT_LEAD` | `UMT_ADMIN` |
|---|---:|---:|---:|
| Enter UMT and view Dashboard | yes | yes | yes |
| View Updates and update details | yes | yes | yes |
| Create an update | yes | yes | yes |
| View Statistics | yes | yes | yes |
| View pending and released chunks | yes | yes | yes |
| Product Management | no | no | yes |
| Create a release chunk | no | no | yes |
| Run release/build administration actions | no | no | yes |

Update-lifecycle controls also contain action-level admin and product-lead checks in the source.
Those checks must be audited when each lifecycle stage is ported; access to the update detail route
does not imply permission to perform every action on it.

---

## 5. API contract

All calls use the shared authenticated request layer and the base URL
`ONE_WSO2_UMT_BACKEND_URL`. Endpoint paths are preserved from the existing service.

| Endpoint | Purpose | Port status |
|---|---|---|
| `GET /update/user-info` | Employee record and numeric UMT privileges. | Ported |
| `GET /meta` | Shared products, versions, issue types, lifecycles, and user emails. | Ported |
| `GET /update/stats` | Dashboard update and release-chunk totals. | Ported |
| `GET /update/platform-stats` | Monthly totals for a platform. | Not yet ported |
| `GET /update/platform-stats/{breakdown}` | Product-, version-, origin-, lifecycle-, or extended-support-wise monthly totals. | Not yet ported |
| `POST /update/search` | Paged, filtered update list and duplicate-case lookup. | Ported |
| `GET /update/{id}` | One update and its current workflow data. | Ported |
| `POST /update` | Create an update. | Ported |
| `POST /update/{id}/subscribe` / `DELETE /update/{id}/subscribe` | Subscribe to or unsubscribe from an update. | Ported |
| `GET /update/releaseChunk` | Pending release chunks. | Not yet ported |
| `GET /update/releaseChunk?states=released` | Released release chunks. | Not yet ported |
| `POST /update/releaseChunk` | Create chunks from selected update ids. | Not yet ported |
| `GET /update/releaseChunk/{id}` | One chunk and its status. | Not yet ported |
| `GET /update/base-product` | Base products. | Ported |
| `POST /update/product` | Add a base product. | Ported |
| `PUT /update/product/deprecate` | Deprecate a base product. | Ported |

The update-detail and release-build workflows use additional subresources. Add each URL to the
central UMT service map as its screen is ported; do not scatter base-URL concatenation through
components or copy the source slice wholesale.

---

## 6. Page-level states

| Condition | What the user sees |
|---|---|
| `ONE_WSO2_UMT_BACKEND_URL` is absent | An informational not-connected notice. No UMT requests are made. |
| Identity or user-info is loading | A single access-check progress state. |
| User-info request fails | A retryable error, distinct from denied access. |
| No recognised UMT privilege | The UMT locked-access card; feature children never mount. |
| A feature query is loading | Progress local to that feature; the perspective shell remains stable. |
| A feature query fails | A local error with Retry where retrying is safe. |
| A query succeeds with no rows | A specific empty state, not a loading indicator or generic failure. |

---

## 7. Test checklist

### Access and navigation

- [ ] Each of privileges 444, 555, and 666 independently grants entry to UMT.
- [ ] An unrelated privilege grants no access and causes no feature request.
- [ ] A failed user-info call shows Retry and is not presented as an authorization denial.
- [ ] Product Management is absent and inaccessible for non-admin UMT users.
- [ ] Dashboard, Updates, Release Chunks, and Statistics remain highlighted correctly on deep routes.
- [ ] With the backend URL unset, the connection notice appears and the network tab shows no UMT
      requests.

### Dashboard

- [ ] Total, Active, On Hold, and Released agree with `/update/stats`.
- [ ] Active sums exactly Development, Staging, UAT, and UATStaging.
- [ ] Every known failed build state contributes to the Failed chunk total.
- [ ] Pending and released actions preserve the requested `status` in the destination URL.
- [ ] A failed statistics request can be retried without reloading the perspective.

### Updates and products

- [ ] Update paging and filtering are performed by `/update/search`, and filter edits do not apply
      before confirmation.
- [ ] Opening an update directly by URL loads the same data as opening it from the table.
- [ ] Successful create and edit operations refresh the list, detail, and dashboard totals.
- [ ] Product add and deprecate actions are admin-only and refresh the product list on success.
- [ ] Product FTP credentials never appear in logs, notifications, URLs, or persistent browser
      storage.

### Release chunks

- [ ] Missing, invalid, and `pending` status values show pending chunks; `released` shows released
      chunks.
- [ ] Released chunks are sorted newest first and remain read-only.
- [ ] Non-admin users can inspect chunks but cannot invoke administrative build or release actions.
- [ ] Confirmed actions submit once, stay disabled in flight, and refresh the affected chunk state.
- [ ] Leaving the screen stops polling and prevents stale responses from overwriting current data.

### Statistics

- [ ] Initial load requests APIM for the default six-month range.
- [ ] Product options follow the selected platform and come from `/meta`.
- [ ] Applying each breakdown calls its matching endpoint and renders all returned series.
- [ ] Version-wise duplicate product/version entries are combined per month.
- [ ] Reset restores the default dates without changing the selected platform.
- [ ] Loading, error, and no-data states are visually distinct in both colour modes.

---

## 8. Deviations from the source app

These are structural porting decisions. Unless a functional difference is recorded here, behaviour
should remain equivalent to the source.

| # | Change | Why |
|---|---|---|
| 1 | The standalone header, drawer, theme provider, authentication provider, and router are not ported. | One WSO2 owns those application-wide concerns. |
| 2 | MUI components and bespoke presentation assets are replaced by Oxygen UI components, icons, charts, and theme tokens. | House convention and consistent light/dark behaviour. |
| 3 | Redux async slices are replaced by subject-scoped TanStack Query hooks. | The data is remote server state; this repository's feature convention already provides caching, request state, and invalidation. |
| 4 | UMT has one shared shell and one role gate, with an optional admin-only requirement. | Missing configuration, loading, failure, and denial must behave consistently on every UMT route; Product Management opts into the stricter check rather than inventing a second shell. |
| 5 | Product Management is admin-only, enforced at both the rail item and the route. | This preserves the source route policy; hiding the rail item alone is not an authorization boundary. |
| 6 | Future Release Chunks will use a query parameter beneath one route. | This preserves refreshable pending/released links without creating duplicate rail entries. |
| 7 | Source routes are namespaced beneath `/umt`. | UMT is one perspective inside One WSO2, not a standalone root application. |

Do not port source-only Redux plumbing, Axios cancellation singletons, layout components, hard-coded
theme colours, or absolute standalone routes. Preserve the behaviour they supported through the
current repository's shared facilities.
