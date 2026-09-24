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

import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Alert,
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  Typography,
} from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { isOpdBackendConfigured } from "@config/apiConfig";
import { money } from "../../util/financeFormat";
import { CLAIMS_PATH } from "../../claims/claimsTabs";
import { useOpdAppData, useOpdClaims, useOpdUserInfo } from "../useOpd";
import { OpdHistoryClaimDetails } from "../history/OpdHistoryClaimDetails";
import { OpdClaimActivityDrawer } from "../history/OpdClaimActivityDrawer";
import { OpdHistoryFilters } from "../history/OpdHistoryFilters";
import { OpdHistoryTable } from "../history/OpdHistoryTable";
import {
  emptyOpdHistoryFilters,
  hasActiveOpdFilters,
  toOpdSearchPayload,
  type OpdHistoryFilters as Filters,
} from "../history/opdHistoryTypes";
import { OPD_ROLE, opdHasRole, type OpdClaim } from "../opdTypes";

// The OPD tab of Claims. Reports its own backend's connectivity, since the
// screen spans two and either may be missing.
//
// Shares its filters, table and search payload with Finance → OPD Claims →
// Claim History — that screen read the same claims (ClaimDetails.tsx:same
// data, no submitter/finance split for OPD), so there was nothing left for it
// to do once this tab covered it, and consolidating means one implementation
// to keep right instead of two. What is added here, and absent there, is the
// allowance strip and the resubmit flow — Finance never resubmits someone
// else's claim on their behalf.
export default function OpdClaimsTab() {
  if (!isOpdBackendConfigured()) {
    return (
      <Alert severity="info">
        OPD claims aren&apos;t connected yet. Set <code>ONE_WSO2_OPD_BACKEND_URL</code> in{" "}
        <code>public/config.js</code> and reload.
      </Alert>
    );
  }
  return <OpdClaimsBody />;
}

function OpdClaimsBody() {
  const userInfo = useOpdUserInfo();
  // The OPD backend refuses the whole app to anyone holding neither of its
  // roles, so this is what tells an ineligible account why the screen is
  // empty rather than leaving them with a bare "no claims" — and it holds
  // back the allowance strip too, which would otherwise show a claim summary
  // nobody here can actually spend against.
  //
  // `isError` is excluded deliberately. A failed lookup leaves `data`
  // undefined, and `opdHasRole` reads that as "no role" — so without this
  // the screen would tell someone their account is ineligible when all that
  // happened is a request failed.
  if (!userInfo.isLoading && !userInfo.isError && !opdHasRole(userInfo.data, OPD_ROLE.CLAIM_SUBMITTER)) {
    return (
      <Alert severity="info">
        OPD claims aren&apos;t available for your account (they&apos;re limited to permanent
        employees at eligible locations).
      </Alert>
    );
  }

  // A fill column, not plain flow: the list below can run long, and without
  // this the whole page scrolled — carrying the tab switcher and the New
  // claim button away with it — instead of just the table.
  return (
    <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <AllowanceStrip />
      <HistoryBody />
    </Box>
  );
}

/**
 * What is left of this year's allowance.
 *
 * These figures used to appear only inside the new-claim form — after someone
 * had already decided to file one. Whether it is worth claiming is a question
 * you answer BEFORE opening the form, so the answer belongs on the tab you ask
 * it from. Same `/app-data` call the form makes, so it costs nothing extra.
 */
function AllowanceStrip() {
  const appData = useOpdAppData();
  const summary = appData.data?.claimSummary;

  if (appData.isLoading) {
    return <Skeleton variant="rectangular" height={64} sx={{ borderRadius: 1.5, mb: 2 }} />;
  }
  // Silently absent rather than showing dashes: the claims below are the point
  // of the screen, and a strip of "—" would read as something being broken.
  if (!summary) return null;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
        gap: 1.25,
        mb: 2,
        flexShrink: 0,
      }}
    >
      <Allowance label="Annual limit" value={money(summary.totalClaimLimit)} />
      <Allowance label="Already claimed" value={money(summary.totalClaimedAmount)} />
      {/* Three, not four: the summary carries exactly these. The form's fourth
          stat — what the claim being written comes to — has no meaning here. */}
      <Allowance label="Remaining" value={money(summary.totalRemaining)} highlight />
    </Box>
  );
}

function Allowance({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card variant="outlined" sx={{ p: 1.25, ...(highlight && { borderColor: "primary.main" }) }}>
      <Typography sx={{ fontSize: 10, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </Typography>
    </Card>
  );
}

function HistoryBody() {
  const userInfo = useOpdUserInfo();
  const [filters, setFilters] = useState<Filters>(() => emptyOpdHistoryFilters());
  // The claim being read in full — the details panel takes over the page,
  // the same way Finance → OPD Claims → Claim History slides it over the
  // list.
  const [selected, setSelected] = useState<OpdClaim | null>(null);
  // Independent of `selected`: the activity trail opens straight from a
  // row's status chip, or from the detail view's own header button.
  const [activityClaim, setActivityClaim] = useState<OpdClaim | null>(null);
  const [resubmitting, setResubmitting] = useState<OpdClaim | null>(null);
  const navigate = useNavigate();

  const email = userInfo.data?.workEmail;
  const payload = useMemo(() => toOpdSearchPayload(filters, email), [filters, email]);
  // Gated on the role as well as the email — see OpdClaimHistoryScreen.tsx,
  // which this mirrors: once user-info lands, a non-submitter's visit would
  // otherwise fire a POST /search-claims the backend was always going to
  // refuse, before the alert below had a chance to render.
  const canViewClaims =
    !userInfo.isLoading &&
    !userInfo.isError &&
    Boolean(email) &&
    opdHasRole(userInfo.data, OPD_ROLE.CLAIM_SUBMITTER);
  const claims = useOpdClaims(payload, canViewClaims);

  // Same review screen Finance → OPD Claims → Claim History uses, taking
  // over this tab the same way it takes over that screen — bills in full,
  // and a rejected claim still offers Resubmit, not a shrunk-down copy in a
  // dialog.
  if (selected) {
    return (
      <>
        <OpdHistoryClaimDetails
          claim={selected}
          onBack={() => setSelected(null)}
          onShowActivity={() => setActivityClaim(selected)}
          onResubmit={(c) => setResubmitting(c)}
        />
        <OpdClaimActivityDrawer claim={activityClaim} onClose={() => setActivityClaim(null)} />

        {/* ClaimDetails.tsx:395-407. Resubmitting does not amend the rejected
            claim — it starts a fresh one from its bills, which replaces
            whatever draft was already saved, so that is said before it
            happens. */}
        <Dialog
          open={resubmitting !== null}
          onClose={() => setResubmitting(null)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>
            Claim Resubmission Confirmation
          </DialogTitle>
          <DialogContent dividers>
            <Typography sx={{ fontSize: 13.5 }}>
              Are you sure you want to resubmit this claim? This will create a new
              draft claim and <b>your existing draft will be cleared</b>.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button size="small" onClick={() => setResubmitting(null)}>
              Cancel
            </Button>
            <Button
              size="small"
              color="success"
              variant="contained"
              onClick={() => {
                // :187-192 — the bills are carried over locally and the New
                // Claim screen persists them as the draft, exactly as the
                // source does.
                const transactions = resubmitting?.transactions ?? [];
                setResubmitting(null);
                setSelected(null);
                navigate(`${CLAIMS_PATH}/opd/new`, {
                  state: { resubmitTransactions: transactions },
                });
              }}
            >
              Resubmit
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <OpdHistoryFilters filters={filters} onChange={setFilters} />

      {/* The scrolling region: the filters above stay fixed, only this —
          the skeleton, the empty state, or the table — scrolls when it
          runs long. */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {userInfo.isLoading || claims.isLoading ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} variant="rectangular" height={48} sx={{ borderRadius: 1 }} />
            ))}
          </Box>
        ) : userInfo.isError || claims.isError ? (
          <ErrorNotice
            error={userInfo.error ?? claims.error}
            // Retry whichever query actually failed: the claims search is
            // disabled until an email arrives, so retrying it alone would
            // leave a user-info failure permanently on screen with nothing
            // to re-run.
            onRetry={() => {
              if (userInfo.isError) void userInfo.refetch();
              if (claims.isError) void claims.refetch();
            }}
            retrying={userInfo.isFetching || claims.isFetching}
          >
            Couldn&apos;t load your claims.
          </ErrorNotice>
        ) : (claims.data?.length ?? 0) === 0 ? (
          <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>
            {hasActiveOpdFilters(filters)
              ? "No claims match these filters."
              : "You haven't submitted an OPD claim yet."}
          </Typography>
        ) : (
          <OpdHistoryTable claims={claims.data!} onView={setSelected} onShowActivity={setActivityClaim} />
        )}
      </Box>
      <OpdClaimActivityDrawer claim={activityClaim} onClose={() => setActivityClaim(null)} />
    </Box>
  );
}
