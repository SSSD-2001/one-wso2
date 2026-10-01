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

import { useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@wso2/oxygen-ui";
import { ChevronDownIcon, ChevronUpIcon, EraserIcon, ListFilterIcon } from "@wso2/oxygen-ui-icons-react";
import type { MisCivilDate } from "../util/misPacificTime";
import {
  ANALYSIS_BUSINESS_UNITS,
  ANALYSIS_FIRST_SALE,
  ANALYSIS_LIFETIME_YEARS,
  ANALYSIS_ALL,
  analysisBusinessUnitsConflict,
  analysisFilterTags,
  analysisProductCountLabel,
  analysisProductCountOptions,
  analysisYearsLabel,
  defaultAnalysisFilters,
  isoCivilDate,
  withBusinessUnits,
  type MisAnalysisFilters as Filters,
  type MisAnalysisFirstSale,
} from "../util/misAnalysisFilters";
import type { AnalysisMenus } from "../util/misAnalysisMenus";

// ARR Analysis's filter panel: ten controls, the tags for whatever they have
// narrowed, and a way back to none of it.
//
// ---- no Apply, where the Build's bar has one -------------------------------
//
// `MisFilterBar` stages every change and commits on Apply, because applying one
// rewrites the query string — a URL that changed per keystroke would fill the
// reader's history with views they never asked for. Nothing here reaches the
// address (see `misAnalysisFilters.ts`), so there is nothing to stage and a
// change applies as it is made.
//
// The one place that is not true is the ARR Range, and for the same underlying
// reason turned inside out: a number field sets state per keystroke, and each
// change here is two network reads. Debouncing every filter would delay
// every deliberate click to smooth over two text boxes. Those two commit on
// blur or Enter instead, so a
// deliberate change costs one read and an in-progress one costs none — and no
// other control needs a debounce at all.
//
// ---- and no field named `products` -----------------------------------------
//
// A Business Unit is not a product. The control is labelled "Business Units"
// and the count beside it is "# Products In Use", which are two different
// things, so the state is not named `products`.
// Here a Business Unit is called a Business Unit, never `products`; see
// `misAnalysisFilters.ts`.

export interface MisAnalysisFiltersProps {
  filters: Filters;
  /** Pacific today — what "no date chosen" means, and what Clear all returns to. */
  today: MisCivilDate;
  menus: AnalysisMenus;
  menusLoading: boolean;
  /** Only when the lists actually FAILED; still loading is the menus' own business. */
  menusErrorMessage: string;
  onRetryMenus?: () => void;
  onChange: (filters: Filters) => void;
}

export default function MisAnalysisFilters({
  filters,
  today,
  menus,
  menusLoading,
  menusErrorMessage,
  onRetryMenus,
  onChange,
}: MisAnalysisFiltersProps) {
  const [open, setOpen] = useState(true);
  const [refusal, setRefusal] = useState("");
  const tags = analysisFilterTags(filters, today);
  const countOptions = analysisProductCountOptions(filters.businessUnits);

  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  /**
   * Business Units are the one control that can refuse a choice, and the one
   * whose change reaches another control — see `withBusinessUnits`.
   */
  const chooseBusinessUnits = (next: string[]) => {
    if (analysisBusinessUnitsConflict(next)) {
      setRefusal("Moesif is already included in the API Platform BU, so the two cannot be combined.");
      return;
    }
    onChange(withBusinessUnits(filters, next));
  };

  return (
    <Box sx={{ mb: 1.5, p: 1.5, borderRadius: 1.5, border: 1, borderColor: "divider" }}>
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap", mb: 1.25 }}
      >
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
          <ListFilterIcon size={16} />
          <Typography variant="subtitle2">Filters</Typography>
          {/* The count IS the number of narrowings, so an absent chip means an
              unnarrowed view. See `analysisFilterTags`.

              It reads "3 filters". "Active filter" is not used as a synonym
              for **Applied filter** — and "Applied" is no better here, because
              it is defined as a filter serialised into the query string and
              nothing on this screen is. The chip just counts. */}
          {tags.length > 0 && (
            <Chip
              size="small"
              variant="outlined"
              label={`${tags.length} ${tags.length === 1 ? "filter" : "filters"}`}
            />
          )}
        </Stack>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Button
            size="small"
            onClick={() => setOpen((shown) => !shown)}
            aria-expanded={open}
            aria-controls={PANEL_ID}
            startIcon={open ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
          >
            {open ? "Collapse" : "Expand"}
          </Button>
          {/* Offered only when there is something to clear. */}
          {tags.length > 0 && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<EraserIcon size={14} />}
              onClick={() => onChange(defaultAnalysisFilters(today))}
            >
              Clear All
            </Button>
          )}
        </Stack>
      </Stack>

      {menusErrorMessage && (
        <Alert
          severity="warning"
          sx={{ mb: 1.25 }}
          action={
            onRetryMenus && (
              <Button size="small" color="inherit" onClick={onRetryMenus}>
                Retry
              </Button>
            )
          }
        >
          Couldn&apos;t load the filter lists. {menusErrorMessage} The Sales Region, Sub Region
          and Country menus fall back to what the loaded accounts show; every other control still
          works.
        </Alert>
      )}

      {open && (
        <Box
          id={PANEL_ID}
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              md: "repeat(3, minmax(0, 1fr))",
              lg: "repeat(5, minmax(0, 1fr))",
            },
            gap: 1.5,
            alignItems: "start",
          }}
        >
          <ListControl
            label="Sales Region"
            options={menus.salesRegions}
            loading={menusLoading}
            value={filters.salesRegions}
            onChange={(salesRegions) => set({ salesRegions })}
          />
          <ListControl
            label="Sub Region"
            options={menus.subRegions}
            loading={menusLoading}
            value={filters.subRegions}
            onChange={(subRegions) => set({ subRegions })}
          />
          <ListControl
            label="Country"
            options={menus.countries}
            loading={menusLoading}
            value={filters.countries}
            onChange={(countries) => set({ countries })}
          />
          <ListControl
            label="Business Units"
            options={[...ANALYSIS_BUSINESS_UNITS]}
            loading={false}
            value={filters.businessUnits}
            onChange={chooseBusinessUnits}
          />
          <ListControl
            label="Lifetime"
            options={ANALYSIS_LIFETIME_YEARS}
            loading={false}
            value={filters.lifetimeYears}
            format={analysisYearsLabel}
            onChange={(lifetimeYears) => set({ lifetimeYears })}
          />

          {/* Single-choice, with All as a real segment: "every partner model"
              is an answer rather than the absence of one. */}
          <Segmented label="Partner Type">
            <ToggleButtonGroup
              exclusive
              size="small"
              aria-label="Partner Type"
              value={filters.partnerType}
              onChange={(_, next: string | null) => set({ partnerType: next ?? ANALYSIS_ALL })}
            >
              <ToggleButton value={ANALYSIS_ALL} sx={SEGMENT_SX}>
                All
              </ToggleButton>
              {menus.partnerTypes.map((model) => (
                <ToggleButton key={model} value={model} sx={SEGMENT_SX}>
                  {model}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Segmented>

          {/* Two segments and no All: pressing the pressed one clears it, which
              is how "neither" is reached. `exclusive` hands back `null` for
              exactly that, so it needs no special case. */}
          <Segmented label="First Sale">
            <ToggleButtonGroup
              exclusive
              size="small"
              aria-label="First Sale"
              value={filters.firstSale === ANALYSIS_FIRST_SALE.ALL ? null : filters.firstSale}
              onChange={(_, next: MisAnalysisFirstSale | null) =>
                set({ firstSale: next ?? ANALYSIS_FIRST_SALE.ALL })
              }
            >
              <ToggleButton value={ANALYSIS_FIRST_SALE.ONLY} sx={SEGMENT_SX}>
                Only
              </ToggleButton>
              <ToggleButton value={ANALYSIS_FIRST_SALE.EXCLUDE} sx={SEGMENT_SX}>
                Exclude
              </ToggleButton>
            </ToggleButtonGroup>
          </Segmented>

          <Segmented label="# Products In Use">
            <ToggleButtonGroup
              size="small"
              aria-label="# Products In Use"
              value={filters.productCounts}
              onChange={(_, next: number[]) => set({ productCounts: [...next].sort((a, b) => a - b) })}
            >
              {countOptions.map((count) => (
                <ToggleButton key={count} value={count} sx={SEGMENT_SX}>
                  {analysisProductCountLabel(count)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Segmented>

          <Segmented label="ARR Range">
            {/* A real group, not just a caption: the two fields are one filter,
                and each is independently labelled, so nothing otherwise ties
                them together for a reader who cannot see the caption. */}
            <Stack
              role="group"
              aria-label="ARR Range"
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", width: "100%" }}
            >
              <BoundaryField
                label="Minimum ARR"
                value={filters.arrRange.lower}
                onCommit={(lower) => set({ arrRange: { ...filters.arrRange, lower } })}
              />
              <Typography variant="body2" color="text.secondary">
                –
              </Typography>
              <BoundaryField
                label="Maximum ARR"
                value={filters.arrRange.upper}
                onCommit={(upper) => set({ arrRange: { ...filters.arrRange, upper } })}
              />
            </Stack>
          </Segmented>

          {/* A native date input rather than a picker component: MIS dates are
              civil dates with no zone, and `<input type="date">` is the one
              control that cannot introduce one. Every picker in this stack
              speaks `Date`, which would put the viewer's midnight into a
              Pacific-Time screen. */}
          {/* No `Segmented` wrapper: a TextField brings its own visible label,
              so a caption above it would print the words twice on screen and
              read them twice to a screen reader. */}
          <AsOfDateField
            value={filters.asOf}
            today={today}
            onCommit={(asOf) => set({ asOf })}
          />
        </Box>
      )}

      {/* Outside the collapse, deliberately. What is narrowed has to stay
          legible with the controls put away — that is most of what collapsing
          is for on a screen this tall. */}
      {tags.length > 0 && (
        <Stack
          direction="row"
          sx={{ flexWrap: "wrap", gap: 0.75, mt: 1.25, pt: 1.25, borderTop: 1, borderColor: "divider" }}
        >
          {tags.map((tag) => (
            <Chip
              key={tag.id}
              size="small"
              variant="outlined"
              label={tag.label}
              onDelete={() => set(tag.patch)}
              // Named by what dismissing it DOES rather than by what it says,
              // the same way `MisAppliedFilterChips` names the Build's.
              aria-label={`Remove ${tag.label}`}
            />
          ))}
        </Stack>
      )}

      <Snackbar
        open={Boolean(refusal)}
        autoHideDuration={4000}
        onClose={() => setRefusal("")}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {/* An Alert: this is a refusal the reader has to be able to read at
            leisure, and `role="alert"` is what announces it. */}
        <Alert severity="warning" onClose={() => setRefusal("")}>
          {refusal}
        </Alert>
      </Snackbar>
    </Box>
  );
}

const PANEL_ID = "mis-analysis-filters";

const SEGMENT_SX = { textTransform: "none", py: 0.35 } as const;

/**
 * A visible caption above a control that carries its own accessible name.
 *
 * `aria-hidden`, because each of these captions repeats a name the control
 * below it already has — the toggle groups carry the identical string as an
 * `aria-label`, and the ARR Range's own `role="group"` does. Without it a
 * screen reader reads every one of these twice. `MisSegmentedControl.tsx:52-57`
 * does the same, for the same reason.
 *
 * So this is for sighted readers only; a control that brings its own VISIBLE
 * label does not belong in it.
 */
function Segmented({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack spacing={0.5} sx={{ minWidth: 0 }}>
      <Typography aria-hidden variant="caption" color="text.secondary">
        {label}
      </Typography>
      {children}
    </Stack>
  );
}

/**
 * One multi-select. `limitTags` for the same reason `MisFilterBar` uses it: a
 * reader who has picked nine countries needs the control to stay the height of
 * a control, and the full list is in the tags below.
 */
function ListControl<T extends string | number>({
  label,
  options,
  loading,
  value,
  format,
  onChange,
}: {
  label: string;
  options: readonly T[];
  loading: boolean;
  value: T[];
  format?: (value: T) => string;
  onChange: (next: T[]) => void;
}) {
  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      limitTags={1}
      size="small"
      value={value}
      options={options as T[]}
      getOptionLabel={(option) => (format ? format(option) : String(option))}
      // So an empty menu says which of the two empties it is: still coming, or
      // genuinely nothing to choose from.
      loading={loading}
      noOptionsText={loading ? "Loading…" : "No options"}
      onChange={(_, next: T[]) => onChange(next)}
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  );
}

/**
 * One end of the ARR Range: held locally while it is being typed, reported when
 * it is left or entered.
 *
 * The local copy is what makes that possible, and the reconciliation below is
 * what keeps it honest — a boundary lifted by dismissing its tag, or by Clear
 * all, has to empty the box too, and neither of those passes through this
 * component's own handlers.
 *
 * Adjusted during the render that brings the new prop rather than in an effect.
 * An effect would paint the stale number first and then correct it, and React's
 * own guidance names this exact case ("You Might Not Need an Effect": adjusting
 * state when a prop changes).
 */
function BoundaryField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number | null;
  onCommit: (value: number | null) => void;
}) {
  const [typed, setTyped] = useState(() => asText(value));
  // The value this box was last reconciled against. Comparing against the prop
  // itself would fight the reader: `typed` legitimately differs from `value`
  // for as long as they are typing.
  const [reconciled, setReconciled] = useState(value);
  if (value !== reconciled) {
    setReconciled(value);
    setTyped(asText(value));
  }

  const commit = () => {
    const parsed = typed.trim() === "" ? null : Number(typed);
    const next = parsed != null && Number.isFinite(parsed) ? parsed : null;
    if (next !== value) onCommit(next);
  };

  return (
    <TextField
      type="number"
      size="small"
      fullWidth
      label={label}
      value={typed}
      onChange={(event) => setTyped(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
      }}
      slotProps={{ input: { startAdornment: <Adornment /> } }}
    />
  );
}

const asText = (value: number | null): string => (value == null ? "" : String(value));

const Adornment = () => (
  <Typography component="span" variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
    $
  </Typography>
);

/**
 * As Of Date, with a draft while the field is empty.
 *
 * Clearing a controlled date input fires `""`. Resolving that to today inside
 * `onChange` writes today back into `value` before the reader can type a
 * replacement. The empty draft stays until blur, and blur is what means "no
 * date", which is today.
 */
function AsOfDateField({
  value,
  today,
  onCommit,
}: {
  value: MisCivilDate | null;
  today: MisCivilDate;
  onCommit: (date: MisCivilDate) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <TextField
      type="date"
      size="small"
      fullWidth
      label="As Of Date"
      value={draft ?? (value ? isoCivilDate(value) : "")}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        const parsed = civilDateFrom(next);
        if (parsed) onCommit(parsed);
      }}
      onBlur={() => {
        if (draft != null && !civilDateFrom(draft)) onCommit(today);
        setDraft(null);
      }}
      slotProps={{ inputLabel: { shrink: true } }}
      sx={{ alignSelf: "end" }}
    />
  );
}

/**
 * `2026-09-21` → a civil date, or nothing.
 *
 * Deliberately not `new Date(value)`: that yields an instant, and the whole
 * point of `MisCivilDate` is that a MIS date has no zone to be shifted by.
 */
function civilDateFrom(value: string): MisCivilDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}
