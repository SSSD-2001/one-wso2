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

import { useMemo, useState, type ReactNode } from "react";
import { Box, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import { useDocumentTitle } from "@hooks/useDocumentTitle";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import MisShell from "../components/MisShell";
import BuildTable, { type BuildCellFor } from "../components/BuildTable";
import {
  ARR_BUILD_SECTION_IDS,
  arrBuildFieldFor,
  arrBuildRows,
  type ArrSummaryResponse,
} from "../components/arrBuildRows";
import { useArrSummary, type ArrSummaryColumn } from "../api/useArrSummary";
import {
  buildColumnLabel,
  buildColumnRanges,
  customerColumnRanges,
  pacificColumnRanges,
} from "../util/misPeriods";
import {
  MIS_VALUE_TYPES,
  amountUnitCaption,
  formatMisValue,
  misValueTypeForRow,
} from "../util/misMoney";
import type { MisViewState } from "../util/useMisViewState";
import type { MisDateRange, MisScale } from "../util/misViewVocabulary";
import type { BuildColumnGroup, BuildRow } from "../components/buildTableModel";
import { useMisViewState } from "../util/useMisViewState";
import { useMisScale } from "../util/useMisScale";
import { useYearsBackSession } from "../util/YearsBackSessionContext";
import { filtersAfterSwitch, periodInitials } from "../util/misFilterBarModel";
import {
  MIS_PERIODS,
  type MisPeriod,
  MIS_TABLES,
  MIS_TABLE_LABELS,
  typeValueOf,
  type MisTable,
} from "../util/misViewVocabulary";
import { useCustomerAccounts } from "../api/useCustomerAccounts";
import {
  CUSTOMER_BU_SUB_COLUMNS,
  CUSTOMER_BU_SUB_COLUMN_BY_KEY,
  CUSTOMER_SUB_COLUMNS,
  CUSTOMER_SUB_COLUMN_BY_KEY,
  CUSTOMER_TOTAL_ROW_ID,
  customerAccountRows,
  customerFigure,
  customerIdentityText,
  customerLeadColumns,
  customerTotal,
  type AccountsResponse,
  type CustomerLeadColumn,
} from "../components/customerAccountRows";
import { useMisAppConfigs } from "../api/useMisAppConfigs";
import MisFilterBar from "../components/MisFilterBar";
import MisTableTabs from "../components/MisTableTabs";
import MisCustomerDrillDown from "../components/MisCustomerDrillDown";
import MisOpportunities from "../components/MisOpportunities";
import { opportunitiesRequest, useOpportunities } from "../api/useOpportunities";
import MisCustomerBreakdownTabs from "../components/MisCustomerBreakdownTabs";
import MisRegionTypeTabs from "../components/MisRegionTypeTabs";
import MisRegionSummaryTabs, {
  MIS_REGION_SUMMARY_VIEWS,
  MIS_REGION_SUMMARY_VIEW_LABELS,
  type MisRegionSummaryView,
} from "../components/MisRegionSummaryTabs";
import { useExitArrByBU, useExitArrByRegion, useRegionMetrics } from "../api/useExitArr";
import {
  REGION_METRICS_SUB_COLUMNS,
  REGION_METRICS_SUB_COLUMN_BY_KEY,
  regionMetricsTable,
} from "../components/regionMetricsRows";
import {
  BU_EXIT_ROWS,
  REGION_EXIT_SUB_COLUMNS,
  REGION_EXIT_SUB_COLUMN_BY_KEY,
  buExitFigure,
  regionExitTable,
} from "../components/exitArrRows";
import { drillDownRequest, DRILLABLE_ROW_IDS } from "../api/misDrillDownRequest";
import { useDrillDownCustomers } from "../api/useDrillDownCustomers";
import { describeAppliedFilters } from "../util/misAppliedFilterChips";
import MisExportButton from "../components/MisExportButton";
import {
  misBuildSheet,
  type MisBuildSheetInput,
  type MisLeadColumn,
} from "../export/misBuildWorkbook";
import type { MisWorkbookSpec } from "../export/misWorkbook";
import { misExportFilename, misFilenameWord } from "../export/misExportFilename";

// ARR Build — annual recurring revenue, on live figures.
//
// Everything on screen is assembled from parts that were built and tested on
// their own:
//
//   the view      `useMisViewState` reads the Period from the route and
//                 everything else from the query string
//   the columns   `pacificColumnRanges` cuts them in Pacific Time
//   the rows      `arrBuildRows` names them and says which field each reads
//   the figures   `useArrSummary` fetches one column per query
//   the money     `formatMisValue` decides what Scale may touch
//   the table     `BuildTable` renders it
//   the filters   `MisFilterBar` writes every one of them through the
//                 SAME `useMisViewState` instance, so there is one view and not
//                 a bar's copy of it beside the grid's
//
//   the drill-down `useDrillDownCustomers` fetches the customers behind one
//                 figure and `MisCustomerDrillDown` shows them
//   the summaries `useExitArrByRegion` and `useExitArrByBU` read Exit ARR as at
//                 one date, and `exitArrRows` says what their rows are
//
// Windowing is `BuildTable`'s.

/**
 * What each Build screen calls itself, and which rail entry gates it.
 *
 * One `MisArrBuildPage` serves all three routes because they ARE one screen —
 * the Period is what varies, not a second Build. What differs is the
 * name and the gate id, so that is what this map holds; everything else reads
 * the Period out of `view`.
 */
const BUILD_SCREENS: Readonly<
  Record<MisPeriod, { gateId: string; sentence: string }>
> = {
  [MIS_PERIODS.ANNUALLY]: {
    gateId: "mis-arr-build",
    sentence: "Annual recurring revenue from an opening balance to a closing balance, one column per period.",
  },
  [MIS_PERIODS.QUARTERLY]: {
    gateId: "mis-qrr-build",
    sentence: "Quarterly recurring revenue from an opening balance to a closing balance, one column per quarter.",
  },
  [MIS_PERIODS.MONTHLY]: {
    gateId: "mis-mrr-build",
    sentence: "Monthly recurring revenue from an opening balance to a closing balance, one column per month.",
  },
};

export default function MisArrBuildPage({ period }: { period: MisPeriod }) {
  const { gateId, sentence } = BUILD_SCREENS[period];
  const title = `${periodInitials(period)} Build`;
  useDocumentTitle(title);

  return (
    <MisShell gateId={gateId} title={title} subtitle={sentence}>
      <ArrBuild period={period} />
    </MisShell>
  );
}

/** Inside the shell, so it is only mounted once the gate has said yes. */
function ArrBuild({ period }: { period: MisPeriod }) {
  const view = useMisViewState(period, { columnRangesFor: pacificColumnRanges });
  const scale = useMisScale(view);
  // The menus for the nine list filters. Fetched here rather than inside the
  // bar so the bar stays a function of its props, and so a screen that grows a
  // second filtered surface asks once.
  const configs = useMisAppConfigs();
  const session = useYearsBackSession();

  // A different Table is a different report, so the filters that narrowed the
  // last one do not travel with the reader — `filtersAfterSwitch` says exactly
  // what survives, and the bar says what was dropped. The tabs commit on click,
  // so this is one navigation: the new Table and its filters together, which is
  // also what lets the bar tell a switch from an Apply.
  const changeTable = (table: MisTable) =>
    view.setView({
      table,
      filters: filtersAfterSwitch(view.filters, { period: view.period, table }, session.yearsBack),
    });

  return (
    <Box>
      <MisFilterBar
        view={view}
        scale={scale}
        options={configs.options}
        optionsLoading={configs.isLoading}
        // Only when the lists actually FAILED. A bar still loading them says so
        // in the menus themselves, which is not worth a warning above the bar.
        optionsErrorMessage={configs.isError ? configs.errorMessage : ""}
        onRetryOptions={configs.retry}
      />
      <MisTableTabs table={view.table} onChange={changeTable} />
      <BuildForTable view={view} scale={scale.scale} />
    </Box>
  );
}

/**
 * Whichever of the four tables the address names.
 *
 * Subscription is the fall-through and has to be: an UNRECOGNISED `?table=`
 * degrades to it, which `parseViewState` guarantees and tests. That works because
 * `parseViewState` has already validated the parameter by the time it is read
 * here, so nothing unrecognised survives as anything but Subscription.
 *
 * All four are built, so there is no longer a branch saying otherwise. The one
 * that used to be here mattered while two were missing: `region-summary` is a
 * RECOGNISED Table, so showing the Subscription Build instead would have handed
 * the reader a different report than the one they asked for, under a heading
 * saying Subscription and an address saying Region Summary.
 */
function BuildForTable({ view, scale }: { view: MisViewState; scale: MisScale }) {
  if (view.table === MIS_TABLES.SOFTWARE_CLOUD_CUSTOMERS) {
    return <CustomersGrid view={view} scale={scale} />;
  }
  if (view.table === MIS_TABLES.EXIT_ARR_BY_REGION) {
    return <RegionSummaryGrid view={view} scale={scale} />;
  }
  if (view.table === MIS_TABLES.EXIT_ARR_BY_BU) {
    return <BuSummaryGrid view={view} scale={scale} />;
  }
  return <ArrBuildGrid view={view} scale={scale} />;
}

/**
 * The figures, below the bar.
 *
 * Split from the bar's own component so the bar survives every state this part
 * can be in — loading, failed, empty. A reader whose filters returned nothing
 * has to be able to change them, and a bar inside the early return below would
 * have vanished with the grid.
 */
function ArrBuildGrid({ view, scale }: { view: MisViewState; scale: MisScale }) {

  // Drawn from the ranges the URL contract already hydrated into the Applied
  // set, so the columns and the filters cannot disagree about which Periods are
  // on screen. Sliced, because on a Calendar Window this particular table shows
  // one fewer than the Applied set carries — see buildColumnRanges.
  const ranges = useMemo(
    () => buildColumnRanges(view.period, view.viewWindow, view.filters),
    [view.period, view.viewWindow, view.filters],
  );
  const summary = useArrSummary(ranges, view.filters, view.period);

  const rows = useMemo(
    () => arrBuildRows(view.filters.channelDirect),
    [view.filters.channelDirect],
  );

  // Which figure the reader opened, if any. It holds the RANGE, not an index
  // into `ranges` — the Applied set can shrink under an open dialog (a smaller
  // Years Back arriving from a history back/forward), and a stored index would
  // then point past the end and throw on `range.end` during render. Holding the
  // range removes the class rather than clamping the index.
  const [opened, setOpened] = useState<{
    rowId: string;
    rowLabel: string;
    range: MisDateRange;
    isFirstColumn: boolean;
  } | null>(null);
  const request = opened
    ? drillDownRequest(opened.rowId, opened.range, view.filters, {
        isFirstColumn: opened.isFirstColumn,
      })
    : null;
  const drillDown = useDrillDownCustomers(request);
  // Not memoised, deliberately: `summary.columns` is rebuilt on every render,
  // so a useMemo over it would never hit — and babel-plugin-react-compiler
  // already handles what genuinely can be.
  const byColumn = responsesByColumn(summary.columns);
  const rangeByLabel = useMemo(
    () => new Map(ranges.map((range) => [buildColumnLabel(range), range])),
    [ranges],
  );
  const columnGroups = summary.columns.map(({ label }) => ({ key: label, label }));
  // The figure ITSELF, before the formatter. Shared by the cell below and by
  // the export, so the sheet cannot read a different number from the screen —
  // and so that the export never reaches for `BuildCell.text`, which is already
  // scaled. See `misBuildWorkbook.ts`.
  const rawFigure = (row: BuildRow, group: BuildColumnGroup) => {
    const field = arrBuildFieldFor(row.id);
    return field ? byColumn.get(group.key)?.[field] : undefined;
  };
  const cell: BuildCellFor = (row, group) => {
    const raw = rawFigure(row, group);
    // The RANGE behind this column, by its label. `useArrSummary` builds its
    // columns from these very ranges, so the lookup always resolves — but the
    // dates the drill-down sends come from the range itself, so it is taken
    // from there rather than from the response.
    const range = rangeByLabel.get(group.key);
    return {
      text: formatMisValue(raw, misValueTypeForRow(row.label), { scale }),
      negative: typeof raw === "number" && raw < 0,
      // Only the fourteen rows that ARE a set of customers. A y/y growth, a
      // retention ratio or a percentage is arithmetic over other rows, so there
      // is nothing to open and the cell stays plain text — which is two thirds
      // of the Build.
      onActivate:
        DRILLABLE_ROW_IDS.has(row.id) && range
          ? () =>
              setOpened({
                rowId: row.id,
                rowLabel: row.label,
                range,
                isFirstColumn: ranges[0] === range,
              })
          : undefined,
    };
  };

  if (summary.isLoading) {
    return <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 1.5, mt: 1.5 }} />;
  }

  // Only when EVERY column failed. One bad column blanks itself and the Build
  // still reads — see useArrSummary.
  if (summary.isError) {
    return (
      <ErrorNotice onRetry={summary.retry} sx={{ mt: 1.5 }}>
        Couldn't load the Build. {summary.errorMessage}
      </ErrorNotice>
    );
  }

  if (!summary.columns.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
        No periods to show. Widen Years Back, or choose at least one business unit.
      </Typography>
    );
  }

  return (
    <Box>
      {/* Above the grid rather than beside the control, because Finance's
          workflow is to crop a table into a slide deck: a figure that has left
          the screen it was set on has to carry its own units. */}
      <GridCaptionBar
        scale={scale}
        exportButton={
          <MisExportButton
            workbook={() =>
              oneSheet({
                name: MIS_TABLE_LABELS[MIS_TABLES.SUBSCRIPTION],
                rowLabelHeader: "Summary",
              // The SAME variables the table below is given, so the sheet and
              // the screen cannot disagree about which rows or which Periods
              // were exported.
                columnGroups,
                subColumns: SUB_COLUMNS,
                rows,
                value: rawFigure,
              })
            }
            filename={() => exportFilenameFor(MIS_TABLES.SUBSCRIPTION)}
          />
        }
      />
      {/* Mounted only while open. MUI would otherwise keep it in the document
          through its exit transition with the row and Period already cleared,
          so the title reads as a bare separator on the way out — `drillDownTitle`
          runs unguarded on every render. */}
      {opened !== null && (
      <MisCustomerDrillDown
        open
        onClose={() => setOpened(null)}
        rowId={opened.rowId}
        rowLabel={opened.rowLabel}
        periodColumn={buildColumnLabel(opened.range)}
        // The Build's own Applied filters, shown but not editable — the list
        // describes a figure computed under exactly these.
        chips={describeAppliedFilters(view.filters, { period: view.period, table: view.table })}
        state={drillDown}
      />
      )}
      <BuildTable
        label="ARR Build — Subscription"
        rowLabelHeader="Summary"
        columnGroups={columnGroups}
        subColumns={SUB_COLUMNS}
        rows={rows}
        cell={cell}
        // All five open. A Subscription Build IS the summary — there are no
        // customer lines under it to hold back — so opening it collapsed would
        // hide the whole table behind five clicks.
        defaultExpandedIds={ARR_BUILD_SECTION_IDS}
      />
    </Box>
  );
}

/**
 * The Software/Cloud Customers table.
 *
 * The same shell as the Build above — loading, every-column-failed, no columns
 * — over a table that is the Build's opposite shape. There the rows are the
 * fixed metric lines and the figures arrive as columns; here every row is a
 * customer and there are hundreds of them, which is why this is the first
 * screen where `BuildTable`'s row windowing actually runs.
 *
 * Its columns are `buildColumnRanges`, the same slice the Subscription Build
 * takes. The fetch asks for one year more than those columns render
 * (`generateFullYearRanges(-yearsBack, 0)` versus `-(yearsBack - 1)`), so
 * reading the fetch as the column list would put six Periods on screen where
 * five belong.
 */
function CustomersGrid({ view, scale }: { view: MisViewState; scale: MisScale }) {
  // The business-unit split is the default, so it starts on. Both breakdowns
  // read the same response, so this
  // switches columns and fires no request.
  const [buOnly, setBuOnly] = useState(true);
  // `customerColumnRanges`, not `buildColumnRanges`: this is the one table with
  // ranges of its own, and only on a Delayed type, where the columns are a
  // recent run plus today rather than the whole Period. See misPeriods.ts.
  const ranges = useMemo(
    () => customerColumnRanges(view.period, view.viewWindow, view.filters),
    [view.period, view.viewWindow, view.filters],
  );
  const book = useCustomerAccounts(ranges, view.filters);

  // Which account's opportunities the reader opened, if any. The RANGE is held
  // rather than an index into `ranges`, for the same reason the Build's
  // drill-down holds one: the Applied set can shrink under an open dialog and a
  // stored index would then point past the end.
  const [openedAccount, setOpenedAccount] = useState<{
    account: { id: string; name: string };
    range: MisDateRange;
  } | null>(null);
  const opportunities = useOpportunities(
    openedAccount ? opportunitiesRequest(openedAccount.account.id, openedAccount.range) : null,
  );
  const rangeByLabel = useMemo(
    () => new Map(ranges.map((range) => [buildColumnLabel(range), range])),
    [ranges],
  );
  // Seventeen identity columns, or eighteen on a Delayed type — Delayed Day
  // Count is spread in only there.
  const leadColumns = customerLeadColumns(typeValueOf(view.filters));

  // Not memoised, for the same reason the Build's `byColumn` is not:
  // `book.columns` is rebuilt every render, so a useMemo over it never hits.
  const { rows, accountById } = customerAccountRows(
    book.columns.map((column) => column.accounts ?? []),
  );
  const byColumn = new Map<string, ReadonlyMap<string, AccountsResponse>>(
    book.columns.map((column) => [
      column.label,
      new Map((column.accounts ?? []).map((account) => [account.id, account])),
    ]),
  );
  // The Total row adds a column down the whole book, so it needs the LIST and
  // not the by-id map above. Absent for a column that never answered, which is
  // what keeps its cells blank rather than zero.
  const accountsByColumn = new Map<string, readonly AccountsResponse[] | undefined>(
    book.columns.map((column) => [column.label, column.accounts]),
  );

  // The column hands back its own reader — `BuildTable` is generic over the
  // caller's column type, so this is the very object `leadColumns` holds and
  // not a key to look one up by. On a windowed 3,000-row table that is the
  // difference between one call and seventeen comparisons per identity cell.
  const leadCell = (row: { id: string }, column: CustomerLeadColumn) =>
    customerIdentityText(row.id, accountById.get(row.id), column);

  const columnGroups = book.columns.map(({ label }) => ({ key: label, label }));
  const breakdown = buOnly ? CUSTOMER_BU_SUB_COLUMNS : CUSTOMER_SUB_COLUMNS;
  const breakdownByKey = buOnly ? CUSTOMER_BU_SUB_COLUMN_BY_KEY : CUSTOMER_SUB_COLUMN_BY_KEY;
  const subColumns = breakdown.map(({ key, label }) => ({ key, label, width: 150 }));
  /** The figure itself, shared by the cell below and by the export. */
  const rawFigure = (row: BuildRow, group: BuildColumnGroup, subColumnKey: string) => {
    // A Map, not a scan: `BuildTable` takes plain `BuildSubColumn`s, so the
    // figure's own definition has to be found by key, and this table renders
    // seven or twelve of them under every Period.
    const definition = breakdownByKey.get(subColumnKey)!;
    if (row.id === CUSTOMER_TOTAL_ROW_ID) {
      return customerTotal(accountsByColumn.get(group.key), definition);
    }
    return customerFigure(byColumn.get(group.key)?.get(row.id), definition);
  };
  const cell: BuildCellFor = (row, group, subColumn) => {
    const raw = rawFigure(row, group, subColumn.key);
    const range = rangeByLabel.get(group.key);
    const account = accountById.get(row.id);
    return {
      // Every figure here is currency, so the Scale applies to all of them —
      // unlike the Build, where counts and percentages share the column.
      text: formatMisValue(raw, "currency", { scale }),
      negative: typeof raw === "number" && raw < 0,
      muted: raw === undefined,
      // A FIGURE cell opens the opportunities, and only a figure cell: only
      // one belongs to a Period and so has a date to ask about. An identity
      // cell has no date of its own, and scraping one out of the column header
      // would ask about a date that was never in the cell.
      //
      // The Total row is excluded by `account` alone — its id is `TOTAL_ROW`,
      // which no account carries, so the lookup misses. An explicit
      // `row.id !== CUSTOMER_TOTAL_ROW_ID` beside it was redundant, and a
      // redundant guard is worse than none: it reads as the load-bearing one
      // and invites someone to simplify the wrong half. The behaviour is
      // pinned by a test rather than by a second condition.
      onActivate:
        range && account
          ? () =>
              setOpenedAccount({
                account: { id: row.id, name: account.name ?? "" },
                range,
              })
          : undefined,
    };
  };

  if (book.isLoading) {
    return <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 1.5, mt: 1.5 }} />;
  }

  // Above every state but loading: the control is gated on `!loading` alone,
  // and it sits where the Region Summary's two controls sit beside this one.
  // It matters most on the states that are not the happy one: a reader who
  // lands on an error or
  // an empty book keeps the control, rather than losing the switch at the
  // moment they most want to try the other side of it.
  const breakdownTabs = <MisCustomerBreakdownTabs buOnly={buOnly} onChange={setBuOnly} />;

  const opportunitiesDialog = (
    <MisOpportunities
      open={openedAccount !== null}
      onClose={() => setOpenedAccount(null)}
      account={openedAccount?.account ?? null}
      asOf={openedAccount?.range.end}
      state={opportunities}
      scale={scale}
    />
  );

  if (book.isError) {
    return (
      <Box>
        {breakdownTabs}
        <ErrorNotice onRetry={book.retry} sx={{ mt: 1.5 }}>
          Couldn't load the customers. {book.errorMessage}
        </ErrorNotice>
      </Box>
    );
  }

  if (!book.columns.length || !rows.length) {
    return (
      <Box>
        {breakdownTabs}
        <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
          No customers to show. Widen Years Back, or loosen the filters.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {breakdownTabs}
      <GridCaptionBar
        scale={scale}
        exportButton={
          <MisExportButton
            workbook={() =>
              oneSheet({
                name: MIS_TABLE_LABELS[MIS_TABLES.SOFTWARE_CLOUD_CUSTOMERS],
                leadColumns,
                // The identity columns go in as the words on screen. They ARE
                // text — a name, an owner, a country — and the two that look
                // numeric, Employee Count and Delayed Day Count, reach the
                // screen through the same formatter. The figures are in the
                // Periods. The very same reader the table uses, handed the
                // column itself rather than its key.
                leadCell,
                columnGroups,
                subColumns,
                rows,
                value: rawFigure,
                valueType: ALL_CURRENCY,
              })
            }
            filename={() => exportFilenameFor(MIS_TABLES.SOFTWARE_CLOUD_CUSTOMERS)}
          />
        }
      />
      <BuildTable
        label="ARR Build — Software/Cloud Customers"
        rowLabelHeader="Account Name"
        leadColumns={leadColumns}
        leadCell={leadCell}
        columnGroups={columnGroups}
        subColumns={subColumns}
        rows={rows}
        cell={cell}
      />
      {/* Mounted only on the happy path, beside the table it opens from — the
          same place the Build's drill-down sits. Nothing to open a dialog from
          on the error or empty states. */}
      {opportunitiesDialog}
    </Box>
  );
}

/**
 * The Region Summary, which is one Table asked two ways.
 *
 * Exit ARR is each region's BALANCE at the column's date, split seven ways by
 * business unit; All ARR Metrics is each region's MOVEMENT over the column,
 * narrowed to one business unit. Two endpoints, two row builders and two cache
 * entries — not two arrangements of one answer.
 *
 * This component owns only what they share: which view is on screen, which
 * geography the rows are cut by, and the two controls that choose them. Both
 * controls are rendered above every state a grid can be in — loading, failed,
 * empty — for the same reason the filter bar is: a reader whose Sub Region read
 * failed has to be able to get back to Sales Region.
 */
function RegionSummaryGrid({ view, scale }: { view: MisViewState; scale: MisScale }) {
  // Component state, and not in the URL — see `MisRegionSummaryTabs` and
  // `MisRegionTypeTabs`. The two views are not part of the shared address.
  const [summaryView, setSummaryView] = useState<MisRegionSummaryView>(
    MIS_REGION_SUMMARY_VIEWS.EXIT_ARR,
  );
  const [bySalesRegion, setBySalesRegion] = useState(true);

  // Switching view returns the cut to Sales Region. The two views ask the
  // backend for different things, so
  // carrying a Sub Region cut across would silently re-read the other table by
  // a geography the reader chose for this one.
  const changeView = (next: MisRegionSummaryView) => {
    setSummaryView(next);
    setBySalesRegion(true);
  };

  return (
    <Box>
      <MisRegionSummaryTabs view={summaryView} onChange={changeView} />
      <MisRegionTypeTabs bySalesRegion={bySalesRegion} onChange={setBySalesRegion} />
      {summaryView === MIS_REGION_SUMMARY_VIEWS.ALL_ARR_METRICS ? (
        <RegionMetricsGrid view={view} scale={scale} bySalesRegion={bySalesRegion} />
      ) : (
        <RegionExitGrid view={view} scale={scale} bySalesRegion={bySalesRegion} />
      )}
    </Box>
  );
}

/**
 * Exit ARR by Region — what the company was worth in each region, as at each
 * column's date, split by business unit.
 *
 * ---- a summary is not a Build, and the difference shows in three places ----
 *
 * 1. The column header is `As of {end}` rather than `{opening} - {end}`: this
 *    reports a BALANCE at a moment, not a MOVEMENT over a span. All ARR Metrics
 *    below is the other half of that sentence, and takes the Build's header.
 * 2. The rows come from the RESPONSE. The Build's rows are named metric lines
 *    and the Customers table's are accounts; these are whatever regions the
 *    backend cut by, which depends on the Region Type above.
 * 3. There are seven sub-columns under each Period rather than one, because the
 *    per-unit split is what this table is for — which is also why the unit tabs
 *    above the grid are ignored here and honoured by the other view.
 */
function RegionExitGrid({
  view,
  scale,
  bySalesRegion,
}: {
  view: MisViewState;
  scale: MisScale;
  bySalesRegion: boolean;
}) {
  const ranges = useMemo(
    () => buildColumnRanges(view.period, view.viewWindow, view.filters),
    [view.period, view.viewWindow, view.filters],
  );
  const summary = useExitArrByRegion(ranges, view.filters, bySalesRegion);

  // Not memoised, for the same reason the Build's `byColumn` is not:
  // `summary.columns` is rebuilt every render, so a useMemo over it never hits.
  const { rows, figures } = regionExitTable(summary.columns);

  const columnGroups = summary.columns.map(({ label }) => ({ key: label, label }));
  /** The figure itself, shared by the cell below and by the export. */
  const rawFigure = (row: BuildRow, group: BuildColumnGroup, subColumnKey: string) => {
    // A Map, not a scan: `BuildTable` takes plain `BuildSubColumn`s, so the
    // figure's own definition has to be found by key.
    const definition = REGION_EXIT_SUB_COLUMN_BY_KEY.get(subColumnKey)!;
    return figures.get(group.key)?.get(row.id)?.[definition.field];
  };
  const cell: BuildCellFor = (row, group, subColumn) => {
    const raw = rawFigure(row, group, subColumn.key);
    return {
      // Every figure here is currency, so Scale applies to all of them.
      text: formatMisValue(raw, "currency", { scale }),
      negative: typeof raw === "number" && raw < 0,
      muted: raw === undefined,
    };
  };

  return (
    <SummaryBody
      state={summary}
      // Only the computed total is left once every region has been stripped
      // out, so one row means no regions came back rather than an empty table.
      isEmpty={rows.length <= 1}
      emptyMessage="No regions to show. Widen Years Back, or loosen the filters."
      errorMessage={`Couldn't load the Region Summary. ${summary.errorMessage}`}
      scale={scale}
      exportButton={
        <MisExportButton
          workbook={() =>
            oneSheet({
              name: MIS_TABLE_LABELS[MIS_TABLES.EXIT_ARR_BY_REGION],
              rowLabelHeader: "Region",
              rowLabelWidth: REGION_LABEL_WIDTH,
              columnGroups,
              subColumns: REGION_EXIT_SUB_COLUMNS,
              rows,
              value: rawFigure,
              valueType: ALL_CURRENCY,
            })
          }
          filename={() => exportFilenameFor(MIS_TABLES.EXIT_ARR_BY_REGION)}
        />
      }
    >
      <BuildTable
        label="ARR Build — Region Summary"
        rowLabelHeader="Region"
        rowLabelWidth={REGION_LABEL_WIDTH}
        columnGroups={columnGroups}
        subColumns={REGION_EXIT_SUB_COLUMNS}
        rows={rows}
        cell={cell}
      />
    </SummaryBody>
  );
}

/**
 * All ARR Metrics — each region's MOVEMENT over the column, narrowed to the
 * reader's business unit.
 *
 * ---- what it does NOT share with the Exit ARR view beside it ---------------
 *
 * Only the rows, and only in shape: both take their regions from the response,
 * through `util/misRegions.ts`, so the two views spell a region the same way.
 * Everything else differs, because a movement is not a balance — the columns
 * span a period instead of closing one, the seven sub-columns are movements
 * instead of business units, and the unit selection narrows the question here
 * where it is ignored there.
 *
 * ---- the unit selection binds to the tabs already on screen ---------------
 *
 * A second unit control beside the tabs could disagree with them, and only one
 * of the two would be in the link a reader shares. Here it binds to the tabs
 * above, so there is one unit selection, it is in the address, and the tabs
 * stop being enabled-but-ignored on this Table.
 */
function RegionMetricsGrid({
  view,
  scale,
  bySalesRegion,
}: {
  view: MisViewState;
  scale: MisScale;
  bySalesRegion: boolean;
}) {
  const ranges = useMemo(
    () => buildColumnRanges(view.period, view.viewWindow, view.filters),
    [view.period, view.viewWindow, view.filters],
  );
  const metrics = useRegionMetrics(ranges, view.filters, bySalesRegion);

  // Not memoised, for the same reason the Build's `byColumn` is not:
  // `metrics.columns` is rebuilt every render, so a useMemo over it never hits.
  const { rows, figures } = regionMetricsTable(metrics.columns);

  const columnGroups = metrics.columns.map(({ label }) => ({ key: label, label }));
  /** The figure itself, shared by the cell below and by the export. */
  const rawFigure = (row: BuildRow, group: BuildColumnGroup, subColumnKey: string) => {
    const definition = REGION_METRICS_SUB_COLUMN_BY_KEY.get(subColumnKey)!;
    return figures.get(group.key)?.get(row.id)?.[definition.field];
  };
  const cell: BuildCellFor = (row, group, subColumn) => {
    const raw = rawFigure(row, group, subColumn.key);
    return {
      // Every one of the seven is currency, so Scale applies to all of them.
      text: formatMisValue(raw, "currency", { scale }),
      negative: typeof raw === "number" && raw < 0,
      muted: raw === undefined,
    };
  };

  return (
    <SummaryBody
      state={metrics}
      // One row is the computed total with no regions under it — the same
      // reading the Exit ARR view takes.
      isEmpty={rows.length <= 1}
      // The words for a custom selection with nothing ticked, which is also
      // where no columns lands.
      emptyMessage="Choose units to generate region metrics, or widen Years Back."
      errorMessage={`Couldn't load the ARR metrics. ${metrics.errorMessage}`}
      scale={scale}
      exportButton={
        <MisExportButton
          workbook={() =>
            oneSheet({
              name: ALL_ARR_METRICS_LABEL,
              rowLabelHeader: "Region",
              rowLabelWidth: REGION_LABEL_WIDTH,
              columnGroups,
              subColumns: REGION_METRICS_SUB_COLUMNS,
              rows,
              value: rawFigure,
              valueType: ALL_CURRENCY,
            })
          }
          filename={() => misExportFilename(["arr_build", misFilenameWord(ALL_ARR_METRICS_LABEL)])}
        />
      }
    >
      <BuildTable
        label={`ARR Build — ${ALL_ARR_METRICS_LABEL}`}
        rowLabelHeader="Region"
        rowLabelWidth={REGION_LABEL_WIDTH}
        columnGroups={columnGroups}
        subColumns={REGION_METRICS_SUB_COLUMNS}
        rows={rows}
        cell={cell}
      />
    </SummaryBody>
  );
}

/**
 * Exit ARR by Business Unit — the same balance without the regional split.
 *
 * The mirror image of the Region Summary above: its rows are a constant,
 * because they ARE the `BuType` record the backend answers with, and there is
 * one figure per Period rather than seven, because the per-unit split has
 * become the rows.
 */
function BuSummaryGrid({ view, scale }: { view: MisViewState; scale: MisScale }) {
  const ranges = useMemo(
    () => buildColumnRanges(view.period, view.viewWindow, view.filters),
    [view.period, view.viewWindow, view.filters],
  );
  const summary = useExitArrByBU(ranges, view.filters);
  const byColumn = new Map(summary.columns.map((column) => [column.label, column.response]));

  const columnGroups = summary.columns.map(({ label }) => ({ key: label, label }));
  /** The figure itself, shared by the cell below and by the export. */
  const rawFigure = (row: BuildRow, group: BuildColumnGroup) =>
    buExitFigure(byColumn.get(group.key), row.id);
  const cell: BuildCellFor = (row, group) => {
    const raw = rawFigure(row, group);
    return {
      text: formatMisValue(raw, "currency", { scale }),
      negative: typeof raw === "number" && raw < 0,
      muted: raw === undefined,
    };
  };

  return (
    <SummaryBody
      state={summary}
      // Never empty for want of rows: they are a constant. Only a summary with
      // no COLUMNS has nothing to show, which `SummaryBody` asks on its own.
      isEmpty={false}
      emptyMessage="No periods to show. Widen Years Back."
      errorMessage={`Couldn't load the BU Summary. ${summary.errorMessage}`}
      scale={scale}
      exportButton={
        <MisExportButton
          workbook={() =>
            oneSheet({
              name: MIS_TABLE_LABELS[MIS_TABLES.EXIT_ARR_BY_BU],
              rowLabelHeader: "Business Unit",
              rowLabelWidth: BU_LABEL_WIDTH,
              columnGroups,
              subColumns: EXIT_ARR_SUB_COLUMNS,
              rows: BU_EXIT_ROWS,
              value: rawFigure,
              valueType: ALL_CURRENCY,
            })
          }
          filename={() => exportFilenameFor(MIS_TABLES.EXIT_ARR_BY_BU)}
        />
      }
    >
      <BuildTable
        label="ARR Build — BU Summary"
        rowLabelHeader="Business Unit"
        rowLabelWidth={BU_LABEL_WIDTH}
        columnGroups={columnGroups}
        subColumns={EXIT_ARR_SUB_COLUMNS}
        rows={BU_EXIT_ROWS}
        cell={cell}
      />
    </SummaryBody>
  );
}

/**
 * The four states a summary can be in, around whichever table is inside it.
 *
 * Shared by the two summaries rather than written twice, because the only thing
 * that differs between them is the sentence each failure says. The Build and
 * the Customers table above keep their own copies: those two also differ in
 * what "empty" means and in the caption, and folding four callers into one
 * component with four props would be the abstraction costing more than the
 * repetition.
 */
function SummaryBody({
  state,
  isEmpty,
  emptyMessage,
  errorMessage,
  scale,
  exportButton,
  children,
}: {
  state: { isLoading: boolean; isError: boolean; columns: readonly unknown[]; retry: () => void };
  isEmpty: boolean;
  emptyMessage: string;
  errorMessage: string;
  scale: MisScale;
  /** Rendered beside the caption, and only once there is a table to export. */
  exportButton?: ReactNode;
  children: ReactNode;
}) {
  if (state.isLoading) {
    return <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 1.5, mt: 1.5 }} />;
  }

  // Only when EVERY column failed. One bad column blanks itself and the rest of
  // the summary still reads — see `useColumnQueries`.
  if (state.isError) {
    return (
      <ErrorNotice onRetry={state.retry} sx={{ mt: 1.5 }}>
        {errorMessage}
      </ErrorNotice>
    );
  }

  if (!state.columns.length || isEmpty) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
        {emptyMessage}
      </Typography>
    );
  }

  return (
    <Box>
      {/* Above the grid rather than beside the control, because Finance's
          workflow is to crop a table into a slide deck. */}
      <GridCaptionBar scale={scale} exportButton={exportButton} />
      {children}
    </Box>
  );
}

/**
 * One figure per Period on the BU Summary, under a header naming what it is.
 *
 * The Period above only says which date the balance was read at, so without
 * this the figure column would have no name at all. The Region Summary needs no
 * such row: its seven sub-columns name themselves.
 */
const EXIT_ARR_SUB_COLUMNS = [{ key: "amount", label: "Exit ARR", width: 180 }] as const;

/**
 * The caption over a grid, and the control that takes the grid away.
 *
 * Above the grid rather than beside the Scale control, because Finance's
 * workflow is to crop a table into a slide deck: a figure that has left the
 * screen it was set on has to carry its own units.
 *
 * One component rather than the four copies the four tables would otherwise
 * each keep — the export button arrived as the second thing in this row, and
 * two things in a row is a layout rather than a caption.
 */
function GridCaptionBar({ scale, exportButton }: { scale: MisScale; exportButton?: ReactNode }) {
  return (
    <Stack
      direction="row"
      sx={{ justifyContent: "flex-end", alignItems: "center", gap: 1.5, mb: 0.75 }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
        {amountUnitCaption(scale)}
      </Typography>
      {exportButton}
    </Stack>
  );
}

/**
 * `arr_build_bu_summary_2026-09-14.xlsx` — which table, and the day it was taken.
 *
 * Dated in Pacific Time rather than UTC, which is how `misExportFilename`
 * dates a file; the table's own label rather than a second set of
 * words for the four tables, so the file is named what the tab the reader
 * clicked is named.
 */
const exportFilenameFor = (table: MisTable): string =>
  misExportFilename(["arr_build", misFilenameWord(MIS_TABLE_LABELS[table])]);

/**
 * The Region Summary's second view has no `MisTable` of its own — it is a view
 * OF `exit-arr-by-region` rather than a fifth Table, which is why `?table=` has
 * nothing to say about it and why its name comes from the control that chooses
 * it rather than from `MIS_TABLE_LABELS`.
 */
const ALL_ARR_METRICS_LABEL =
  MIS_REGION_SUMMARY_VIEW_LABELS[MIS_REGION_SUMMARY_VIEWS.ALL_ARR_METRICS];

/**
 * One table, as a one-sheet workbook.
 *
 * `MisExportButton` takes a whole workbook; every table on this page is one
 * sheet, and this is where that difference is said once instead of at each of
 * the four call sites.
 */
const oneSheet = <L extends MisLeadColumn>(sheet: MisBuildSheetInput<L>): MisWorkbookSpec => ({
  sheets: [misBuildSheet(sheet)],
});

/**
 * Every figure on this table is money.
 *
 * The three tables that are not the Subscription Build say this rather than
 * letting the sheet infer it, because they say the same thing on screen by
 * handing `formatMisValue` a literal `"currency"`. Inferring instead would let
 * the file and the screen disagree about an account or a region whose name
 * happened to collide with one of the Build's metric labels.
 */
const ALL_CURRENCY = () => MIS_VALUE_TYPES.CURRENCY;

/** Fixed widths for the two summaries' row-label columns. */
const REGION_LABEL_WIDTH = 170;
const BU_LABEL_WIDTH = 200;

/**
 * One figure per Period, not a pair.
 *
 * `BuildTable` repeats its sub-columns under every Period so that a table can
 * put an Amount beside a % of Opening. The Subscription Build has no such pair:
 * the percentages are rows of their own, further down. So there is one
 * sub-column, and it names what the figure IS — which is worth a line of header
 * given the Period above it only says which dates it covers.
 */
const SUB_COLUMNS = [{ key: "amount", label: "ARR", width: 170 }] as const;

/**
 * A column's header is its identity — no two columns close on the same date —
 * so it is what `BuildTable` groups by and what `cell` looks a figure up with.
 */
const responsesByColumn = (
  columns: readonly ArrSummaryColumn[],
): ReadonlyMap<string, ArrSummaryResponse | undefined> =>
  new Map(columns.map((column) => [column.label, column.response]));
