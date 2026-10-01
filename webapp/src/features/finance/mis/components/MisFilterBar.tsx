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

import { useEffect, useState, type ReactElement } from "react";
import { useNavigate } from "react-router";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { ChevronDownIcon, ChevronUpIcon, EraserIcon, ListFilterIcon } from "@wso2/oxygen-ui-icons-react";
import { MIS_BUILD_PATH_BY_PERIOD } from "@constants/misApps";
import { describeAppliedFilters } from "../util/misAppliedFilterChips";
import { useYearsBackSession } from "../util/YearsBackSessionContext";
import {
  MIS_COLLAPSED_CONTROL_COUNT,
  MIS_PERIOD_CHOICE_LABELS,
  MIS_PERIOD_CHOICE_ORDER,
  MIS_CONFIDENCE_OPTIONS,
  MIS_FILTER_CONTROL_ORDER,
  appliedFromPending,
  confidenceLabel,
  controlLabel,
  defaultPending,
  filterResetNotice,
  misFilterBarControls,
  normalisePending,
  pendingFromApplied,
  periodChoiceOf,
  periodChoiceTarget,
  samePending,
  typeLabel,
  yearsBackToRemember,
  type MisFilterView,
  type MisPendingFilters,
  type MisPeriodChoice,
} from "../util/misFilterBarModel";
import { allowedTypeValues, unavailableFilters } from "../util/misViewState";
import {
  ENDING_MONTH_VALUES,
  MIS_CHANNEL_DIRECT,
  MIS_SCALES,
  MIS_TABLE_LABELS,
  MIS_VIEW_TYPES,
  MIS_WINDOWS,
  YEARS_BACK_RANGE,
  type MisFilterControl,
} from "../util/misViewVocabulary";
import type { MisViewState } from "../util/useMisViewState";
import type { MisScaleState } from "../util/useMisScale";
import type { MisFilterOptions } from "../api/misAppConfigs";
import MisAppliedFilterChips from "./MisAppliedFilterChips";
import MisUnitTabs, { type MisUnitSelection } from "./MisUnitTabs";

// The whole filter surface above a Build.
//
// Four things that look like one control each but are not the same KIND of
// control, and the difference is the thing to hold on to:
//
//   the Period      navigates. Calendar ↔ TTM is a different cut of the same
//                   Build, and `view.setWindow` owns everything that implies.
//   the unit tabs   commit on click. A different business unit is a different
//                   report, not a narrowing of this one.
//   the filters     are PENDING until APPLY. Narrowing is a sentence you finish
//                   before anyone acts on it — and every filter change costs a
//                   fetch per column, so a bar that applied as you typed would
//                   ask the backend five times to set one filter.
//   the Scale       is neither: it changes how the figures are written, not
//                   which figures they are, so it takes effect at once and is
//                   remembered across screens.
//
// Everything here writes through `useMisViewState`. There is no
// second copy of the view: what APPLY does is put a filter set in the address,
// and what the bar shows next comes back out of it.

/** Which option list each list filter draws on. */
const OPTION_SOURCE: Partial<Record<MisFilterControl, keyof MisFilterOptions>> = {
  salesRegion: "salesRegions",
  subRegion: "subRegions",
  // Both country controls read ONE list, which is `shippingCountries`. The
  // backend sends `billingCountries` as well and this bar does not read it —
  // see `misAppConfigs.ts` for why that substitution stands.
  billingCountry: "countries",
  shippingCountry: "countries",
  industry: "industries",
  subIndustry: "subIndustries",
  accountOwner: "accountOwners",
  technicalOwner: "technicalOwners",
  channelManager: "channelManagers",
};

const YEARS_BACK_OPTIONS = Array.from(
  { length: YEARS_BACK_RANGE.max - YEARS_BACK_RANGE.min + 1 },
  (_, index) => YEARS_BACK_RANGE.min + index,
);

const CHANGE_MESSAGE = "Filters changed — apply to refresh";

// The Period control's four buttons. Three navigate, TTM sets a window — see
// `periodChoiceTarget`, which is where that difference is written down.

export default function MisFilterBar({
  view,
  scale,
  options,
  optionsLoading = false,
  optionsErrorMessage = "",
  onRetryOptions,
}: {
  view: MisViewState;
  scale: MisScaleState;
  options: MisFilterOptions;
  /** While true the list menus are empty because they have not arrived, not because they are empty. */
  optionsLoading?: boolean;
  /** Non-empty when `/app-configs` failed; the written-down controls still work. */
  optionsErrorMessage?: string;
  onRetryOptions?: () => void;
}) {
  const { period, table, viewWindow, filters } = view;
  // The three that every rule in `misFilterBarModel` is a question about.
  const filterView: MisFilterView = { period, table, viewWindow };
  const navigate = useNavigate();

  /**
   * The Period control, which is the one control here that can leave the
   * screen.
   *
   * A Period is a ROUTE, so picking one navigates — and to the BARE path, with
   * no query string carried over. That is not laziness about preserving the
   * view: the three Builds do not agree about what their filters mean (a
   * `Total QRR` is not a type Annually has, and Years Back defaults to 1 off
   * Annually and 5 on it), so carrying the old query across would hand the
   * arriving screen values it has to discard anyway. It hydrates from its own
   * defaults instead, and the bar's mount effect seeds Years Back back out of
   * the session — which is the whole reason that session exists.
   *
   * TTM is the exception, and stays: it is Annually cut differently rather than
   * a fourth Period, so it sets a Window on the route already showing.
   */
  const choosePeriod = (choice: MisPeriodChoice) => {
    const target = periodChoiceTarget(choice);
    if (target.period === period) {
      view.setWindow(target.viewWindow ?? MIS_WINDOWS.CALENDAR);
      return;
    }
    navigate(MIS_BUILD_PATH_BY_PERIOD[target.period]);
  };
  const applied = pendingFromApplied(filters, period);

  const session = useYearsBackSession();

  const [pending, setPending] = useState<MisPendingFilters>(applied);
  // What the bar said about the last Table or Period switch, until the reader
  // applies filters again. Held here rather than passed in because this is the
  // component with a line to say it in, and because "cleared by the next Apply"
  // then sits beside Apply.
  const [resetNotice, setResetNotice] = useState("");
  // Reseed when the view itself changes underneath the controls — a Window
  // switch coerces the type and resets YTD, and a Table switch resets the
  // filters outright, so the bar has to show what the grid is now showing
  // rather than what the reader had chosen for the view they have left.
  const [seededFor, setSeededFor] = useState<MisFilterView>(filterView);
  if (
    seededFor.table !== table ||
    seededFor.period !== period ||
    seededFor.viewWindow !== viewWindow
  ) {
    // The controls as they stand are what the switch is about to throw away —
    // including an edit the reader had not applied yet. `filters` is no use
    // here: the switch already replaced it, in the same navigation.
    setResetNotice(filterResetNotice(pending, seededFor, filterView));
    setSeededFor(filterView);
    setPending(applied);
  }

  const [expanded, setExpanded] = useState(false);

  const shown = misFilterBarControls(pending, filterView);
  const visible = MIS_FILTER_CONTROL_ORDER.filter((control) => shown.has(control));
  // On screen but not usable. Kept in `visible` deliberately: a filter a Table
  // does not offer stays where the reader last saw it, greyed and saying which
  // Table took it, rather than vanishing between one tab and the next.
  const unavailable: ReadonlySet<MisFilterControl> = unavailableFilters(period, table);
  const hasPendingChanges = !samePending(pending, applied);

  const update = (patch: Partial<MisPendingFilters>) =>
    setPending((current) =>
      // A Customers type drags Years Back with it, but only when the reader
      // CHANGED it — a value they arrived with is theirs to keep.
      normalisePending({ ...current, ...patch }, filterView, { typeChanged: "typeValue" in patch }),
    );

  const commit = (next: MisPendingFilters) => {
    // A Years Back the reader changed becomes the session's, so the next Table
    // starts where they left off; back at this Table's own default it is
    // forgotten, because opening a Build is not choosing five years.
    if (next.yearsBack !== applied.yearsBack) {
      session.setYearsBack(yearsBackToRemember(next.yearsBack, filterView));
    }
    // Any notice describes a view the reader has now moved on from.
    setResetNotice("");
    view.setView({ filters: appliedFromPending(next, filters, period) });
  };

  const apply = () => commit(pending);

  const clearAll = () => {
    // Everything the BAR owns goes back to this Table's defaults. The unit
    // selection is not among them: it belongs to the tabs above, which commit
    // on their own, and clearing filters is not the same as changing report.
    //
    // The session Years Back goes too — Clear All is the reader saying they are
    // done with the narrowing, and a Years Back that outlived it would follow
    // them to the next Table as the one thing they could not clear.
    const defaults = defaultPending(filterView);
    // Unconditionally, and not only when the value on screen changes: a reader
    // sitting on a Table whose default happens to equal their session value
    // still means it when they press this.
    session.setYearsBack(null);
    setPending(defaults);
    commit(defaults);
  };

  // Dismissing a chip is an APPLY of exactly one change, and it leaves any OTHER
  // edit the reader has not applied still pending — which is why the applied set
  // and the pending set are each patched from themselves rather than from a
  // single merged one.
  const removeChip = (key: MisFilterControl) => {
    const defaults = defaultPending(filterView);
    const one = { [key]: defaults[key] } as Partial<MisPendingFilters>;
    const changed = { typeChanged: key === "typeValue" };
    setPending((current) => normalisePending({ ...current, ...one }, filterView, changed));
    commit(normalisePending({ ...applied, ...one }, filterView, changed));
  };

  const changeUnits = (next: MisUnitSelection) => view.setView({ filters: { ...filters, ...next } });

  // Once, on mount, and it goes one way or the other:
  //
  //   arrived on a LINK   adopt the Years Back its author chose, so it survives
  //                       the reader's next switch the way one they set would.
  //   arrived CLEAN       put the session's Years Back on the grid, so coming
  //                       back to a Build mid-session shows the years they were
  //                       working in rather than the Table's default.
  //
  // Both happen on mount, and the branch is whether the link carried a view
  // at all.
  useEffect(() => {
    if (view.hasViewState) {
      const adopted = yearsBackToRemember(filters.yearsBack, filterView);
      if (adopted !== null) session.setYearsBack(adopted);
    } else if (session.yearsBack !== null) {
      // Both, as Clear All does: the grid is what the address says, and the
      // controls have to agree with it or APPLY reads as having work to do.
      const seeded = { ...applied, yearsBack: session.yearsBack };
      setPending(seeded);
      commit(seeded);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box sx={{ mb: 1.5 }}>
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", gap: 1.5, flexWrap: "wrap", mb: 1.5 }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={periodChoiceOf(period, viewWindow)}
          aria-label="Period"
          onChange={(_, next: MisPeriodChoice | null) => next && choosePeriod(next)}
        >
          {MIS_PERIOD_CHOICE_ORDER.map((choice) => (
            <ToggleButton key={choice} value={choice} sx={{ textTransform: "none" }}>
              {MIS_PERIOD_CHOICE_LABELS[choice]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {/* "Values in '000" is the label Finance reconciles against. */}
        <FormControlLabel
          sx={{ m: 0 }}
          control={
            <Checkbox
              size="small"
              checked={scale.scale === MIS_SCALES.THOUSANDS}
              onChange={(event) =>
                scale.setScale(event.target.checked ? MIS_SCALES.THOUSANDS : MIS_SCALES.UNITS)
              }
            />
          }
          label={<Typography variant="body2">Values in &apos;000</Typography>}
        />
      </Stack>

      <MisUnitTabs
        selection={{
          buProductSelection: filters.buProductSelection,
          customBusinessUnits: filters.customBusinessUnits,
          customProductUnits: filters.customProductUnits,
        }}
        businessUnitOptions={options.businessUnits}
        productUnitOptions={options.productUnits}
        onChange={changeUnits}
      />

      <Box sx={{ p: 1.5, borderRadius: 1.5, border: 1, borderColor: "divider" }}>
        <Stack
          direction="row"
          sx={{ alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap", mb: 1.25 }}
        >
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
            <ListFilterIcon size={16} />
            <Typography variant="subtitle2">Filters</Typography>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            {visible.length > MIS_COLLAPSED_CONTROL_COUNT && (
              <Button
                size="small"
                onClick={() => setExpanded((open) => !open)}
                startIcon={expanded ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
              >
                {expanded ? "Less" : "More"}
              </Button>
            )}
            <Button
              size="small"
              variant="contained"
              disabled={!hasPendingChanges}
              onClick={apply}
            >
              Apply
            </Button>
            <Button size="small" variant="outlined" startIcon={<EraserIcon size={14} />} onClick={clearAll}>
              Clear All
            </Button>
          </Stack>
        </Stack>

        {optionsErrorMessage && (
          <Alert
            severity="warning"
            sx={{ mb: 1.25 }}
            action={
              onRetryOptions && (
                <Button size="small" color="inherit" onClick={onRetryOptions}>
                  Retry
                </Button>
              )
            }
          >
            Couldn&apos;t load the filter lists. {optionsErrorMessage} Everything except the
            region, country, industry and owner menus still works.
          </Alert>
        )}

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25 }}>
          {(expanded ? visible : visible.slice(0, MIS_COLLAPSED_CONTROL_COUNT)).map((control) => (
            <Unavailable key={control} on={unavailable.has(control) ? MIS_TABLE_LABELS[table] : ""}>
              <Control
                control={control}
                pending={pending}
                view={filterView}
                options={options}
                optionsLoading={optionsLoading}
                disabled={unavailable.has(control)}
                onChange={update}
              />
            </Unavailable>
          ))}
        </Box>

        {/* Always mounted, so the live region exists before it has anything to
            say. A region created at the moment its text appears is announced
            unreliably, or not at all. */}
        <Typography
          role="status"
          variant="caption"
          component="p"
          color="text.secondary"
          sx={{ mt: 1, minHeight: 18 }}
        >
          {hasPendingChanges ? CHANGE_MESSAGE : resetNotice}
        </Typography>

        <MisAppliedFilterChips
          chips={describeAppliedFilters(filters, filterView)}
          onRemove={removeChip}
        />
      </Box>
    </Box>
  );
}

const CONTROL_WIDTH = { minWidth: 190, flex: "0 1 190px" } as const;

/**
 * One control, greyed out and wearing its reason when this Table does not offer
 * it.
 *
 * The tooltip goes on a WRAPPING SPAN rather than on the control, because a
 * disabled input fires no pointer events — a tooltip attached to it would never
 * open, and the reason for the greying would be unreachable. The span takes
 * focus for the same reason: a reader who does not use a mouse needs it too.
 */
function Unavailable({ on, children }: { on: string; children: ReactElement }) {
  if (!on) return children;
  return (
    <Tooltip title={`Not available for ${on}`} describeChild>
      {/* A real box, not `display: contents`: a span with no box of its own
          receives no pointer events either, which is the thing being worked
          around. It becomes the flex item in the control row, so it carries the
          control's width. */}
      <Box component="span" tabIndex={0} sx={{ ...CONTROL_WIDTH, display: "inline-flex" }}>
        {children}
      </Box>
    </Tooltip>
  );
}

function Control({
  control,
  pending,
  view,
  options,
  optionsLoading,
  disabled,
  onChange,
}: {
  control: MisFilterControl;
  pending: MisPendingFilters;
  view: MisFilterView;
  options: MisFilterOptions;
  optionsLoading: boolean;
  /** True where this Table does not offer the filter; `Unavailable` says why. */
  disabled: boolean;
  onChange: (patch: Partial<MisPendingFilters>) => void;
}) {
  if (control === "isYtd" || control === "cumulative") {
    const label = controlLabel(control, view.period);
    return (
      <FormControlLabel
        disabled={disabled}
        sx={{ ...CONTROL_WIDTH, m: 0 }}
        control={
          <Checkbox
            size="small"
            checked={pending[control]}
            onChange={(event) => onChange({ [control]: event.target.checked })}
          />
        }
        label={<Typography variant="body2">{label}</Typography>}
      />
    );
  }

  const listSource = OPTION_SOURCE[control];
  if (listSource) {
    const value = pending[control] as string[];
    return (
      <Autocomplete
        multiple
        disabled={disabled}
        disableCloseOnSelect
        // One chip plus a count, rather than one chip per value: a reader who
        // has picked nine countries needs the control to stay the height of a
        // control. The full list is in the chip strip below.
        limitTags={1}
        size="small"
        sx={CONTROL_WIDTH}
        value={value}
        options={options[listSource] as string[]}
        // So an empty menu says which of the two empties it is: still coming,
        // or genuinely nothing to choose from.
        loading={optionsLoading}
        noOptionsText={optionsLoading ? "Loading…" : "No options"}
        onChange={(_, next: string[]) => onChange({ [control]: next })}
        renderInput={(params) => <TextField {...params} label={controlLabel(control, view.period)} />}
      />
    );
  }

  if (control === "yearsBack") {
    return (
      <Autocomplete
        disableClearable
        disabled={disabled}
        size="small"
        sx={CONTROL_WIDTH}
        value={pending.yearsBack}
        options={YEARS_BACK_OPTIONS}
        getOptionLabel={(option) => String(option)}
        onChange={(_, next: number) => onChange({ yearsBack: next })}
        renderInput={(params) => <TextField {...params} label={controlLabel(control, view.period)} />}
      />
    );
  }

  // Everything left is a single-select over a list this app writes down: the
  // Type a Table and Window allow, and the four closed vocabularies.
  const { values, format } = singleSelect(control, view);
  return (
    <Autocomplete
      disableClearable
      disabled={disabled}
      size="small"
      sx={CONTROL_WIDTH}
      value={pending[control] as string}
      options={values as string[]}
      getOptionLabel={format}
      onChange={(_, next: string) => onChange({ [control]: next })}
      renderInput={(params) => <TextField {...params} label={controlLabel(control, view.period)} />}
    />
  );
}

const IDENTITY = (value: string) => value;

function singleSelect(
  control: MisFilterControl,
  { period, table, viewWindow = MIS_WINDOWS.CALENDAR }: MisFilterView,
): { values: readonly string[]; format: (value: string) => string } {
  switch (control) {
    case "typeValue":
      // The SAME function the URL contract validates against, so the menu can
      // never offer a type the address would drop — see `allowedTypeValues`.
      return { values: allowedTypeValues(period, table, viewWindow), format: typeLabel };
    case "confidenceLevel":
      return { values: MIS_CONFIDENCE_OPTIONS, format: confidenceLabel };
    case "viewType":
      return { values: MIS_VIEW_TYPES, format: IDENTITY };
    case "channelDirect":
      return { values: MIS_CHANNEL_DIRECT, format: IDENTITY };
    case "endingMonth":
      return { values: ENDING_MONTH_VALUES, format: IDENTITY };
    // Named rather than defaulted. A `default` here would render the next
    // single-select control anyone adds as an Ending Month — silently, and
    // bound to the right field, so it would look like a styling bug.
    default:
      throw new Error(`MisFilterBar: no single-select options for "${control}"`);
  }
}
