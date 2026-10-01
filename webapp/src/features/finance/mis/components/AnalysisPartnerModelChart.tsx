/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import {
  Box,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useTheme,
} from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import {
  CHART_FILL_GAP,
  CHART_SERIES_1,
  CHART_SERIES_2,
  seriesColor,
} from "@components/charts/chartPalette";
import { MIS_VALUE_TYPES, formatMisValue, misHeadlineAmount } from "../util/misMoney";
import type { MisScale } from "../util/misViewVocabulary";
import { partnerModelSlices, type PartnerModelSlice } from "./analysisBreakdowns";
import type { PartnerModelBreakdown } from "../api/useAnalysisBreakdowns";

// ARR by partner model — how much of the book is sold through Channel and how
// much Direct.
//
// ---- this is a PROPORTION BAR, not a two-slice pie -------------------------
//
// Deliberate, and it is the one form decision on this screen. A pie of exactly
// two slices is something the `dataviz` skill names outright as not to draw
// ("Bad: a one-bar bar chart, or a 2-slice pie"), and its form table routes
// part-to-whole to a stacked bar. Two segments in a circle make the reader
// compare angles to answer a question a single bar answers by length.
//
// When one model holds all the ARR the bar is already the right shape, so the
// same form covers both the split and the single-model case.
//
// No figure moves. Parity protects the numbers Finance reconciles column by
// column, and those are in the companion table below, to the cent.
//
// ---- colour is by ENTITY, never by rank ------------------------------------
//
// Channel is always slot 1 and Direct always slot 2, whichever is larger. A
// view where Direct overtakes Channel must not repaint both of them — that is
// the one rule that makes two screenshots comparable. The slots come from
// `chartPalette`, validated against this app's own surfaces in both modes.

export interface AnalysisPartnerModelChartProps {
  breakdown: PartnerModelBreakdown;
  scale: MisScale;
}

export default function AnalysisPartnerModelChart({
  breakdown,
  scale,
}: AnalysisPartnerModelChartProps) {
  const { palette } = useTheme();
  const mode = palette.mode === "dark" ? "dark" : "light";
  const slices = partnerModelSlices({
    channel: breakdown.channel,
    direct: breakdown.direct,
    asked: breakdown.asked,
  });

  // A model was asked about and gave no figure — see `partnerModelSlices`.
  const unanswered =
    (breakdown.asked.has("Channel") && breakdown.channel == null) ||
    (breakdown.asked.has("Direct") && breakdown.direct == null);

  // Neither model was asked about, because the reader narrowed to a partner
  // type that is neither — the Partner Type menu offers whatever the accounts
  // report. There is no Channel/Direct split of such a view to show, and
  // saying "no ARR" would be false: the table below is full of accounts.
  const askedNeither = breakdown.asked.size === 0;

  // Same rule as the industry chart's: no table while there is nothing in it.
  // Reached on a failure even though the slices would be empty anyway, so the
  // two charts say the same thing the same way.
  const hasFigures = !breakdown.isLoading && !breakdown.isError && slices.length > 0;

  const colourOf = (slice: PartnerModelSlice) =>
    seriesColor(slice.slot === 1 ? CHART_SERIES_1 : CHART_SERIES_2, mode);

  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, p: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 0.25 }}>
        ARR by partner model
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
        How much of the book is sold through a partner, and how much direct.
      </Typography>

      {breakdown.isError ? (
        <ErrorNotice onRetry={breakdown.retry}>
          Couldn&apos;t load the partner split. {breakdown.errorMessage}
        </ErrorNotice>
      ) : breakdown.isLoading ? (
        <Box sx={{ height: 28, borderRadius: 0.5, bgcolor: "action.hover" }} />
      ) : unanswered ? (
        // A dead end without this. `isError` is false — one of the two reads
        // succeeded — so nothing upstream offers a way out, and the reader is
        // left with a blank card and no idea it is retryable.
        <ErrorNotice onRetry={breakdown.retry}>
          One partner model didn&apos;t load, so the split can&apos;t be shown.
        </ErrorNotice>
      ) : slices.length === 0 ? (
        // Rendered by the always-mounted region below, not here — see there.
        null
      ) : (
        <>
          {/* The bar. `role="img"` with the whole split as its label, because a
              row of divs is meaningless to a screen reader and the companion
              table below is the real accessible presentation. */}
          <Box
            role="img"
            aria-label={slices
              .map((slice) => `${slice.label} ${Math.round(slice.share)}%`)
              .join(", ")}
            sx={{ display: "flex", height: 28, borderRadius: 0.5, overflow: "hidden" }}
          >
            {slices.map((slice, index) => (
              <Tooltip
                key={slice.id}
                title={`${slice.label}: ${misHeadlineAmount(slice.amount)} · ${slice.share.toFixed(1)}%`}
              >
                <Box
                  sx={{
                    flexGrow: slice.share,
                    flexBasis: 0,
                    minWidth: 2,
                    bgcolor: colourOf(slice),
                    // A GAP of surface rather than a border: a stroke would add
                    // a third colour and thicken the shape where two pixels of
                    // background separate the fills using nothing at all.
                    ml: index === 0 ? 0 : `${CHART_FILL_GAP}px`,
                  }}
                />
              </Tooltip>
            ))}
          </Box>

          {/* Direct labels under the bar — two series, so the skill wants both
              a legend and direct labels, and at two segments one row does both
              jobs. The swatch carries identity; the text stays ink. */}
          <Stack direction="row" spacing={2} sx={{ mt: 1, flexWrap: "wrap" }}>
            {slices.map((slice) => (
              <Stack key={slice.id} direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                <Box
                  aria-hidden
                  sx={{ width: 10, height: 10, borderRadius: "2px", bgcolor: colourOf(slice) }}
                />
                <Typography variant="body2">
                  {slice.label} {Math.round(slice.share)}%
                </Typography>
              </Stack>
            ))}
          </Stack>
        </>
      )}

      {/* ONE always-mounted live region. Always mounted because a region
          created at the moment its text appears is announced unreliably or not
          at all — `MisFilterBar` states the rule and this repo follows it.
          Two ways to have no split and they are not the same thing: neither
          model was asked about (the reader narrowed to some third partner type
          the accounts report), or both answered zero. */}
      <Box role="status" sx={{ minHeight: 18, mt: 1 }}>
        {!breakdown.isLoading && !breakdown.isError && !unanswered && slices.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {askedNeither
              ? "Channel and Direct don't apply to the partner type this view is narrowed to."
              : "No ARR in this view."}
          </Typography>
        )}
      </Box>

      {/* The companion table, per the house convention — and the thing that
          makes the figures reconcilable. The chart shows the split; this shows
          the amounts, at the reader's Scale, the way every other MIS figure on
          the screen is written. */}
      {hasFigures && (
        <Table size="small" sx={{ mt: 1.5 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={HEAD_SX}>Partner model</TableCell>
              <TableCell align="right" sx={HEAD_SX}>
                ARR
              </TableCell>
              <TableCell align="right" sx={HEAD_SX}>
                Share
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {slices.map((slice) => (
              <TableRow key={slice.id}>
                <TableCell sx={CELL_SX}>
                  <Box
                    aria-hidden
                    component="span"
                    sx={{
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      borderRadius: "2px",
                      mr: 0.75,
                      bgcolor: colourOf(slice),
                    }}
                  />
                  {slice.label}
                </TableCell>
                <TableCell align="right" sx={CELL_SX}>
                  {formatMisValue(slice.amount, MIS_VALUE_TYPES.CURRENCY, { scale })}
                </TableCell>
                <TableCell align="right" sx={CELL_SX}>
                  {/* A PERCENTAGE, so Scale never touches it — the formatter's
                      job rather than this cell's. */}
                  {formatMisValue(slice.share, MIS_VALUE_TYPES.PERCENTAGE, { scale })}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}

/** `tabular-nums` so a column of figures lines up when scanned down. */
const CELL_SX = { fontSize: 12.5, fontVariantNumeric: "tabular-nums" } as const;
const HEAD_SX = { fontSize: 11, fontWeight: 700, color: "text.secondary" } as const;
