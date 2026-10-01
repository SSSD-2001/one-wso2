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
import { Navigate } from "react-router";
import { Box, Card, Checkbox, FormControlLabel, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import { useDocumentTitle } from "@hooks/useDocumentTitle";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { misPaths } from "@constants/misApps";
import MisShell from "../components/MisShell";
import MisAnalysisFilters from "../components/MisAnalysisFilters";
import AnalysisAccountGrid from "../components/AnalysisAccountGrid";
import {
  analysisScrapedOptions,
  mergeScrapedOptions,
  EMPTY_SCRAPED_OPTIONS,
  type AnalysisScrapedOptions,
} from "../components/analysisAccountRows";
import { useMisAppConfigs } from "../api/useMisAppConfigs";
import { useAnalysisAccounts, useAnalysisHeadlineArr } from "../api/useAnalysisAccounts";
import {
  useAnalysisIndustries,
  useAnalysisPartnerModels,
} from "../api/useAnalysisBreakdowns";
import AnalysisPartnerModelChart from "../components/AnalysisPartnerModelChart";
import AnalysisIndustryChart from "../components/AnalysisIndustryChart";
import { useDebouncedValue } from "../util/useDebouncedValue";
import { analysisMenus } from "../util/misAnalysisMenus";
import {
  defaultAnalysisFilters,
  isoCivilDate,
  isSameCivilDate,
  type MisAnalysisFilters as Filters,
} from "../util/misAnalysisFilters";
import { pacificCivilDate, type MisCivilDate } from "../util/misPacificTime";
import {
  MIS_VALUE_TYPES,
  amountUnitCaption,
  formatMisValue,
  misHeadlineAmount,
} from "../util/misMoney";
import { useScalePreference } from "../util/ScalePreferenceContext";
import { MIS_SCALES, type MisScale } from "../util/misViewVocabulary";

// ARR Analysis — current ARR over an account-level table, behind a server-side
// flag.
//
// ---- two refusals that must not be confused with each other ----------------
//
//   `productsUsageEnabled` is false   the screen does not exist FOR ANYONE, so
//                                     the route redirects to ARR Build and the
//                                     rail carries no entry at all
//   no ARR privilege                  the screen exists and this reader may not
//                                     open it, so it says so where they are
//
// A redirect asserts a fact about the app; a locked panel asserts one about the
// reader. Which is why the flag is read HERE as well as inside `useMisGate`:
// the gate folds it into one boolean, which is the right shape for the rail,
// and loses the distinction this route needs.
//
// It also means the two states where the flag is simply UNKNOWN can be neither.
// Still in flight, a redirect would bounce a bookmarked link on every cold
// load; failed, it would relocate someone because of a gateway blip and tell
// them nothing. Both are held by `MisShell`'s prerequisite rung instead.
//
// ---- where the Build's screens have a URL and this one does not ------------
//
// Every filter here is component state, so a shared link opens on the defaults.
// Putting them in the query string would be a new contract: nothing on this
// screen is serialised today.

/** The screen's own name, in the rail, the tab title and the heading. */
const TITLE = "ARR Analysis";

export default function MisArrAnalysisPage() {
  useDocumentTitle(TITLE);
  const configs = useMisAppConfigs();

  // The redirect fires ONLY on a confirmed `false`. `analysisEnabled` is also
  // false while loading and after a failure, so the two guards above it are
  // what keep those from being read as an answer — see `useMisAppConfigs`.
  if (!configs.isLoading && !configs.isError && !configs.analysisEnabled) {
    // `replace`, so Back returns to wherever the reader came from rather than
    // to a URL that will bounce them here again.
    return <Navigate to={misPaths.arrBuild} replace />;
  }

  return (
    <MisShell
      gateId="mis-analysis"
      title={TITLE}
      subtitle="Current recurring revenue across the customer book, account by account."
      prerequisite={{
        isLoading: configs.isLoading,
        isError: configs.isError,
        errorMessage: configs.errorMessage,
        retry: configs.retry,
        describe: "whether ARR Analysis is available",
      }}
    >
      <ArrAnalysis />
    </MisShell>
  );
}

/** Inside the shell, so it is only mounted once the flag and the gate agree. */
function ArrAnalysis() {
  // Read once per mount, not per render: every request body resolves "no date
  // chosen" against it, and a value that moved mid-session would silently
  // re-key every query at midnight Pacific.
  const [today] = useState(pacificCivilDate);
  const [filters, setFilters] = useState<Filters>(() => defaultAnalysisFilters(today));

  const configs = useMisAppConfigs();

  // The reads are keyed on the SETTLED filters, the controls on the live ones.
  // Named `settled` rather than `applied`: an applied filter is one serialised
  // into the query string, and nothing on this screen is.
  // The charts take the reads to ten — one per industry, two for the partner
  // split — so a reader stepping through four Sales Regions would fire forty.
  // Debounced in ONE
  // place so all four reads move together: staggering them would leave the
  // table and the charts above it briefly answering different questions, which
  // is the one thing a screen built for comparing them must not do.
  const settled = useDebouncedValue(filters);

  const accounts = useAnalysisAccounts(settled, today);
  const headline = useAnalysisHeadlineArr(settled, today);
  const partnerModels = useAnalysisPartnerModels(settled, today);
  const industries = useAnalysisIndustries(settled, today, configs.options.industries);

  // The scraped fallback menus, widened by each fetch and never narrowed — see
  // `mergeScrapedOptions` for why that matters.
  const [scraped, setScraped] = useState<AnalysisScrapedOptions>(EMPTY_SCRAPED_OPTIONS);
  const arrived = analysisScrapedOptions(accounts.rows);
  if (mergeScrapedOptions(scraped, arrived) !== scraped) {
    // A render-phase setState, which React re-renders through immediately
    // rather than painting the stale menus first. The alternative is an effect,
    // which paints, then paints again — and this derives entirely from `rows`.
    setScraped((held) => mergeScrapedOptions(held, arrived));
  }

  const menus = useMemo(() => analysisMenus(configs.options, scraped), [configs.options, scraped]);

  // The stored preference DIRECTLY, not through `useMisScale`. That hook
  // reconciles a Scale carried in a link against the stored one, and this
  // screen's view reaches no link — so there is nothing to reconcile, and
  // asking it would mean inventing a view state for a screen that has none.
  // The preference is shared with every Build screen either way, which is the
  // half that matters: a reader who works in thousands keeps working in
  // thousands on the way here.
  const { preference: scale, setPreference: setScale } = useScalePreference();

  return (
    <Box>
      <MisAnalysisFilters
        filters={filters}
        today={today}
        menus={menus}
        menusLoading={configs.isLoading}
        // Only when the lists actually FAILED. A panel still loading them says
        // so in the menus themselves.
        menusErrorMessage={configs.isError ? configs.errorMessage : ""}
        onRetryMenus={configs.retry}
        onChange={setFilters}
      />

      <SummaryCards
        asOf={settled.asOf}
        today={today}
        arr={headline.arr}
        isLoading={headline.isLoading}
        isError={headline.isError}
        errorMessage={headline.errorMessage}
        retry={headline.retry}
        accountCount={accounts.rows.length}
        accountsLoading={accounts.isLoading}
        scale={scale}
      />

      {/* Always mounted, so the region exists before it has anything to say —
          one created at the moment its text appears is announced unreliably or
          not at all, which is the reason `MisFilterBar` keeps its own mounted.
          It matters MORE here than there: this panel has no Apply, so a filter
          takes effect with no button press to explain the table changing under
          a reader who cannot see it. */}
      <Typography
        role="status"
        variant="caption"
        component="p"
        color="text.secondary"
        sx={{ minHeight: 18, mb: 0.25 }}
      >
        {accounts.isLoading
          ? "Loading accounts…"
          : accounts.isError
            ? ""
            : `${accounts.rows.length} ${accounts.rows.length === 1 ? "account" : "accounts"}`}
      </Typography>

      {/* The two breakdowns, above the table they are cut from. Each ships a
          companion table beneath it, per the house convention — a chart alone is
          not an accessible presentation of a number someone has to act on. */}
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          mb: 1.5,
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 0.8fr) minmax(0, 1.2fr)" },
        }}
      >
        <AnalysisPartnerModelChart breakdown={partnerModels} scale={scale} />
        <AnalysisIndustryChart
          breakdown={industries}
          totalArr={headline.arr}
          scale={scale}
        />
      </Box>

      <Stack
        direction="row"
        sx={{ alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", mb: 0.75 }}
      >
        <Typography variant="subtitle2">Account performance detail</Typography>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          {/* The caption travels with the TABLE rather than with the control,
              because Finance's workflow is to crop a table into a deck — see
              `amountUnitCaption`. */}
          <Typography variant="caption" color="text.secondary">
            {amountUnitCaption(scale)}
          </Typography>
          {/* The same label and the same preference as the Build's bar, so
              switching screens does not switch units under the reader. */}
          <FormControlLabel
            sx={{ m: 0 }}
            control={
              <Checkbox
                size="small"
                checked={scale === MIS_SCALES.THOUSANDS}
                onChange={(event) =>
                  setScale(event.target.checked ? MIS_SCALES.THOUSANDS : MIS_SCALES.UNITS)
                }
              />
            }
            label={<Typography variant="body2">Values in &apos;000</Typography>}
          />
        </Stack>
      </Stack>

      {accounts.isError ? (
        <ErrorNotice onRetry={accounts.retry} sx={{ mt: 1.5 }}>
          Couldn&apos;t load the accounts. {accounts.errorMessage}
        </ErrorNotice>
      ) : (
        <AnalysisAccountGrid rows={accounts.rows} scale={scale} isLoading={accounts.isLoading} />
      )}
    </Box>
  );
}

/**
 * The two figures above the table: total ARR, and how many accounts are behind
 * it.
 *
 * The logo count is the number of rows on screen, so it always matches the
 * table beneath it.
 */
function SummaryCards({
  asOf,
  today,
  arr,
  isLoading,
  isError,
  errorMessage,
  retry,
  accountCount,
  accountsLoading,
  scale,
}: {
  asOf: Filters["asOf"];
  today: MisCivilDate;
  arr?: number;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  retry: () => void;
  accountCount: number;
  accountsLoading: boolean;
  scale: MisScale;
}) {
  const on = asOf ?? today;
  const label = isSameCivilDate(on, today) ? "today" : isoCivilDate(on);

  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.5,
        mb: 1.5,
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
        maxWidth: 640,
      }}
    >
      {/* Not Oxygen's StatCard. The ARR tile replaces its figure with an
          error that offers a retry, or with a skeleton, and StatCard only
          takes a label and a value. The Accounts tile beside it stays in the
          same shape. */}
      <Card variant="outlined" sx={{ p: 2 }}>
        <Typography variant="overline" color="text.secondary">
          ARR as of {label}
        </Typography>
        {isError ? (
          <ErrorNotice onRetry={retry} sx={{ mt: 1 }}>
            Couldn&apos;t load this figure. {errorMessage}
          </ErrorNotice>
        ) : isLoading ? (
          <Skeleton variant="text" width={160} height={44} />
        ) : (
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {/* A HEADLINE, so it is compact, in dollars, and NOT scaled —
                `misHeadlineAmount` has no Scale parameter to break it with. An
                em dash rather than a zero when the figure never arrived: `$0`
                would state something. */}
            {arr == null ? "—" : misHeadlineAmount(arr)}
          </Typography>
        )}
      </Card>

      <Card variant="outlined" sx={{ p: 2 }}>
        <Typography variant="overline" color="text.secondary">
          Accounts
        </Typography>
        {accountsLoading ? (
          <Skeleton variant="text" width={80} height={44} />
        ) : (
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {/* The reader's Scale IS handed over here, and makes no
                difference: `formatMisValue` reads it in the currency branch
                and nowhere else, so a count cannot be divided by a thousand
                however it is called. That is why this component still takes
                `scale` now that the figure above is a headline. */}
            {formatMisValue(accountCount, MIS_VALUE_TYPES.COUNT, { scale })}
          </Typography>
        )}
      </Card>
    </Box>
  );
}
