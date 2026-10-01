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

import type { ReactNode } from "react";
import { Alert, Box, Chip, CircularProgress, Stack, Typography } from "@wso2/oxygen-ui";
import { ChartNoAxesCombinedIcon } from "@wso2/oxygen-ui-icons-react";
import { isMisArrConfigured } from "@config/apiConfig";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useMisGate } from "../api/useMisGate";
import MisLocked from "./MisLocked";
import PacificTimeChip from "./PacificTimeChip";
import { ScalePreferenceProvider } from "../util/ScalePreferenceContext";

// Shared page frame for every Finance MIS screen: the app eyebrow, a title and
// subtitle, and — the reason this exists — ONE place that owns every degraded
// state, so no screen has to remember them and none of them differs:
//
//   1. ARR backend URL not set    → say which config key is missing
//   2. a prerequisite of THIS screen is still in flight → spinner
//   3. that prerequisite failed   → an error with a retry
//   4. /user-info still in flight → spinner, never a premature denial
//   5. /user-info failed          → an error with a retry, NOT a denial
//   6. cannot open THIS screen    → a locked door
//
// Rungs 5 and 6 are the pair worth keeping apart; see MisGate.isError.
//
// ---- what a `prerequisite` is, and why it is a rung rather than a caller's
//      early return --------------------------------------------------------
//
// One screen needs something answered BEFORE the gate's answer means anything:
// ARR Analysis exists only while `productsUsageEnabled` is true, and that
// arrives from GET /app-configs rather than from /user-info. Until it does,
// `canSee("mis-analysis")` is false for a reason that is not a refusal — so
// without this rung every cold load of that screen flashes a locked panel at
// someone who is about to be let in.
//
// It goes ABOVE the gate for that reason, and it lives here rather than in the
// page because this file exists to be the one place a degraded state is worded.
// A page handling it with early returns would render a spinner and an error
// with no heading above either, which is what the header below is for.
//
// ---- how this differs from MarketingOpsShell ------------------------------
//
// That shell asks one question — are you authorized for this perspective — and
// every screen behind it follows. This one takes a `gateId` and asks per screen,
// because one screen has a condition of its own: ARR Analysis exists only while
// its `productsUsageEnabled` flag is on. The Builds share the ARR privilege;
// Analysis is the screen with a condition of its own.
//
// ---- and why it checks the ARR key specifically ---------------------------
//
// /user-info lives on the ARR service, so an unset ARR URL means no MIS screen
// can establish who you are.
/**
 * Something ONE screen must resolve before its gate can be read — the shape
 * every MIS query hook already returns. Optional: most screens have none.
 */
export interface MisPrerequisite {
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  retry: () => void;
  /** What could not be established, for the error: "whether ARR Analysis…". */
  describe: string;
}

export default function MisShell({
  gateId,
  title,
  subtitle,
  prerequisite,
  children,
}: {
  // Which MIS menu item this screen is. The gate answers per item because ARR
  // Analysis has a condition of its own — see useMisGate.
  gateId: string;
  title: string;
  subtitle?: string;
  prerequisite?: MisPrerequisite;
  children: ReactNode;
}) {
  const configured = isMisArrConfigured();
  // Only ask who we are once we know there is a backend to ask.
  const gate = useMisGate(configured);

  // The header changes on the locked state, so the shell has to know which
  // branch the body will take. This mirrors the LAST rung of the ladder below —
  // every earlier rung has to be excluded, or someone whose check is still in
  // flight (or failed) reads as refused for one render.
  const pending = Boolean(prerequisite?.isLoading || prerequisite?.isError);
  const isLocked =
    configured && !pending && !gate.isResolving && !gate.isError && !gate.canSee(gateId);

  return (
    // Scale is a cross-page preference, so it is provided once here rather than
    // by each screen — the same argument as the degraded states below. A screen
    // that forgot the provider would throw; one that carried its own would hold
    // a Scale the next MIS screen did not share.
    //
    // The session Years Back is NOT here, though it is the same kind of thing.
    // Every MIS screen renders its own shell, so a provider here is remounted on
    // every navigation between them — which Scale survives only because it reads
    // its value back out of `localStorage`. A value held in memory alone would
    // not, so `YearsBackSessionProvider` lives in `MisSession`, the layout
    // route that outlives each screen. Mounting that route is a later change;
    // nothing in this one is reachable from `App` yet.
    <ScalePreferenceProvider>
      <Box>
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ mb: 0.5, alignItems: "center", flexWrap: "wrap", rowGap: 0.75 }}
        >
          <Chip
            icon={<ChartNoAxesCombinedIcon size={14} />}
            label="MIS"
            color="primary"
            // Outlined, not filled: white-on-orange at chip text sizes is ~3.6:1
            // and fails WCAG AA. Outlined routes through the a11y overlay, which
            // shifts the label and border to primary.dark in light mode. Matches
            // the Finance, Leave and Marketing Ops shells.
            variant="outlined"
            size="small"
          />
          {/* Permanent, on every rung.
              Unconditional beats "only where there are figures": the reader who
              most needs to know which clock MIS runs on is the one who has just
              arrived, and a chip that comes and goes is one more thing on the
              page whose absence means something. */}
          <PacificTimeChip />
        </Stack>
        {/* An h1, not a styled div: it is the page's heading, and a screen-reader
            user navigating by headings needs something to land on. */}
        <Typography component="h1" variant="h5" sx={{ mb: 0.5, mt: 0 }}>
          {title}
        </Typography>
        {/* Dropped on the locked rung alone: a subtitle sells the screen, which is
            right on one you can use and wrong above a panel about to refuse you. */}
        {subtitle && !isLocked && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.25, maxWidth: "70ch" }}>
            {subtitle}
          </Typography>
        )}

        <MisBody
          configured={configured}
          gate={gate}
          gateId={gateId}
          prerequisite={prerequisite}
        >
          {children}
        </MisBody>
      </Box>
    </ScalePreferenceProvider>
  );
}

// Split out so the header stays readable — the ladder carries the logic, and it
// reads better as a sequence of guards than as nested ternaries inside JSX.
function MisBody({
  configured,
  gate,
  gateId,
  prerequisite,
  children,
}: {
  configured: boolean;
  gate: ReturnType<typeof useMisGate>;
  gateId: string;
  prerequisite?: MisPrerequisite;
  children: ReactNode;
}) {
  if (!configured) {
    return (
      <Alert severity="info" sx={{ mt: 1.5 }}>
        Finance MIS isn't connected yet. Set <code>ONE_WSO2_MIS_ARR_BACKEND_URL</code> in{" "}
        <code>public/config.js</code> (the backend URL) and reload.
      </Alert>
    );
  }

  // Above the gate, because the gate's answer depends on this one — see the
  // note at the top of the file.
  if (prerequisite?.isLoading) {
    return (
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mt: 2 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Checking {prerequisite.describe}…
        </Typography>
      </Stack>
    );
  }

  if (prerequisite?.isError) {
    return (
      <ErrorNotice onRetry={prerequisite.retry} sx={{ mt: 1.5 }}>
        Couldn&apos;t check {prerequisite.describe}. {prerequisite.errorMessage}
      </ErrorNotice>
    );
  }

  // Hold the page until the privilege decision lands.
  if (gate.isResolving) {
    return (
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mt: 2 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Checking your MIS access…
        </Typography>
      </Stack>
    );
  }

  // Before the locked rung, not after. A failed request also leaves us with no
  // privileges, so this order is what stops a gateway timeout being reported as
  // a missing permission.
  if (gate.isError) {
    return (
      <ErrorNotice onRetry={gate.retry} sx={{ mt: 1.5 }}>
        Couldn't check your MIS access. {gate.errorMessage}
      </ErrorNotice>
    );
  }

  if (!gate.canSee(gateId)) {
    // ARR Analysis can be closed by the backend while the reader still holds
    // the ARR privilege. That is not "you have no Finance MIS access".
    const unavailable = gateId === "mis-analysis" && gate.canSee("mis-arr-build");
    return <MisLocked unavailable={unavailable} />;
  }

  return <>{children}</>;
}
