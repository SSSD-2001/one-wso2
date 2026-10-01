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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExcelJS from "exceljs";
import { bytesOf, captureDownloads } from "@/test/downloads";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { inZone } from "@/test/timeZone";
import { MIS_BUILD_PATH_BY_PERIOD } from "@constants/misApps";
import { defaultAppliedFilters } from "@features/finance/mis/util/misViewState";
import { YearsBackSessionProvider } from "@features/finance/mis/util/YearsBackSessionContext";
import {
  MIS_PERIODS,
  type MisDateRange,
  type MisPeriod,
  MIS_TABLES,
  MIS_WINDOWS,
  type MisAppliedFilters,
} from "@features/finance/mis/util/misViewVocabulary";
import {
  buildColumnLabel,
  asOfColumnLabel,
  buildColumnRanges,
  customerColumnRanges,
  pacificColumnRanges,
} from "@features/finance/mis/util/misPeriods";
import type { ArrSummaryState } from "@features/finance/mis/api/useArrSummary";
import type { CustomerAccountsState } from "@features/finance/mis/api/useCustomerAccounts";
import type { SummaryColumnsState } from "@features/finance/mis/api/useExitArr";
import type {
  BuFigures,
  RegionExitResponse,
} from "@features/finance/mis/components/exitArrRows";
import type { RegionMetricsResponse } from "@features/finance/mis/components/regionMetricsRows";
import { customerLeadColumns } from "@features/finance/mis/components/customerAccountRows";
import type { DrillDownState } from "@features/finance/mis/api/useDrillDownCustomers";

// The first real figures on screen. Everything below the shell: the Build's
// rows, one column group per Annual Period, at default filters.
//
// The fetch is stubbed at `useArrSummary` — the seam its own tests cover — so
// this file is about what a reader sees, not about how it was fetched.

vi.mock("@config/apiConfig", () => ({
  isMisArrConfigured: () => true,
  misArrServiceUrls: { userInfo: "https://mis.example/user-info" },
}));

// The page no longer calls /user-info, but MisShell's module graph still
// reaches @asgardeo/browser, which does not resolve under Node's ESM loader.
vi.mock("@features/finance/mis/api/useMisUserInfo", () => ({
  useMisUserInfo: () => ({ data: undefined, isPending: false, isError: false }),
}));

vi.mock("@features/finance/mis/api/useMisGate", () => ({
  useMisGate: () => ({
    canSee: () => true,
    isResolving: false,
    isError: false,
    retry: () => {},
  }),
}));

const summary = {
  value: {} as ArrSummaryState,
  /**
   * The ranges the screen last ASKED for.
   *
   * The fixture below hands back one fixed column whatever it is given, which
   * is right for the ninety-odd tests about what a Build renders — but it means
   * the render says nothing about which Periods were requested. So the stub
   * records its argument, and the Period-to-columns wiring is asserted on the
   * request rather than on a fixture that ignores it.
   */
  lastRanges: [] as readonly MisDateRange[],
};
vi.mock("@features/finance/mis/api/useArrSummary", () => ({
  useArrSummary: (ranges: readonly MisDateRange[]) => {
    summary.lastRanges = ranges;
    return summary.value;
  },
}));

const drillDown = { value: {} as DrillDownState, asked: [] as unknown[] };
vi.mock("@features/finance/mis/api/useDrillDownCustomers", () => ({
  useDrillDownCustomers: (request: unknown) => {
    drillDown.asked.push(request);
    return drillDown.value;
  },
}));

const customers = {
  value: {} as CustomerAccountsState,
  /** The ranges the customers grid last asked for — see `summary.lastRanges`. */
  lastRanges: [] as readonly MisDateRange[],
};
const opportunities = {
  /** What `opportunitiesRequest` produced, or null when the dialog is shut. */
  asked: null as { accountId: string; endDate: string } | null,
  value: {
    opportunities: [
      { id: "OPP-1", name: "Renewal FY26", stageName: "Closed Won", apimArr: 500_000 },
    ],
    isLoading: false,
    isError: false,
    errorMessage: "",
    retry: () => {},
  },
};
vi.mock("@features/finance/mis/api/useOpportunities", async () => {
  const actual = await vi.importActual<typeof import("@features/finance/mis/api/useOpportunities")>(
    "@features/finance/mis/api/useOpportunities",
  );
  return {
    // `opportunitiesRequest` stays REAL: the date it derives from the clicked
    // column is the whole point of this version, so mocking it would leave
    // these tests asserting against a stand-in.
    ...actual,
    useOpportunities: (request: { accountId: string; endDate: string } | null) => {
      opportunities.asked = request;
      return opportunities.value;
    },
  };
});
vi.mock("@features/finance/mis/api/useCustomerAccounts", () => ({
  useCustomerAccounts: (ranges: readonly MisDateRange[]) => {
    customers.lastRanges = ranges;
    return customers.value;
  },
}));

const regionExit = {
  value: {} as SummaryColumnsState<RegionExitResponse>,
  askedBySalesRegion: [] as boolean[],
};
const buExit = { value: {} as SummaryColumnsState<BuFigures> };
const regionMetrics = {
  value: {} as SummaryColumnsState<RegionMetricsResponse>,
  askedBySalesRegion: [] as boolean[],
  askedFilters: [] as MisAppliedFilters[],
};
vi.mock("@features/finance/mis/api/useExitArr", () => ({
  useExitArrByRegion: (
    _ranges: unknown,
    _filters: unknown,
    isSalesRegionSummary: boolean,
  ) => {
    regionExit.askedBySalesRegion.push(isSalesRegionSummary);
    return regionExit.value;
  },
  useExitArrByBU: () => buExit.value,
  useRegionMetrics: (
    _ranges: unknown,
    filters: MisAppliedFilters,
    isSalesRegionSummary: boolean,
  ) => {
    regionMetrics.askedBySalesRegion.push(isSalesRegionSummary);
    regionMetrics.askedFilters.push(filters);
    return regionMetrics.value;
  },
}));

// The filter bar's menus, stubbed at the same seam as the figures and for the
// same reason: this file is about what a reader sees, and `useMisAppConfigs`
// has its own tests. It also reaches @asgardeo/browser, which does not resolve
// under Node's ESM loader.
vi.mock("@features/finance/mis/api/useMisAppConfigs", () => ({
  useMisAppConfigs: () => ({
    options: {
      salesRegions: ["APAC", "EMEA"],
      subRegions: [],
      countries: ["Sri Lanka"],
      industries: ["BFSI"],
      subIndustries: [],
      accountOwners: [],
      technicalOwners: [],
      channelManagers: [],
      businessUnits: ["APIM_BU"],
      productUnits: [],
    },
    isLoading: false,
    isError: false,
    errorMessage: "",
    retry: () => {},
  }),
}));

const MisArrBuildPage = (await import("@features/finance/mis/pages/MisArrBuildPage")).default;
const MisSession = (await import("@features/finance/mis/components/MisSession")).default;

// Driving MUI Autocompletes through userEvent is slow — each click is a full
// pointer-event sequence re-rendered through the Oxygen theme — and the whole
// suite runs 119 files in parallel. The default 5s is enough alone and not
// under that load, which is how a passing file becomes an intermittent red.
// Driving this many MUI Autocompletes needs the extra room.
vi.setConfig({ testTimeout: 20_000 });

/**
 * The newest of the five columns, computed rather than written down.
 *
 * It is derived from today's date in Pacific Time, so a literal here is correct
 * only until the next Pacific midnight — and a stale one does not fail loudly:
 * it silently stops matching the ranges the page computes, so figures vanish
 * and a drill-down cannot find its column. Built with the same helpers the page
 * uses, in the same zone the page is rendered in.
 */
const THIS_YEAR = inZone("Asia/Colombo", () => {
  const filters = defaultAppliedFilters(MIS_PERIODS.ANNUALLY, MIS_TABLES.SUBSCRIPTION);
  const columnDateRanges = pacificColumnRanges(
    MIS_PERIODS.ANNUALLY,
    MIS_WINDOWS.CALENDAR,
    filters,
  );
  const columns = buildColumnRanges(MIS_PERIODS.ANNUALLY, MIS_WINDOWS.CALENDAR, {
    ...filters,
    columnDateRanges,
  });
  return buildColumnLabel(columns[columns.length - 1]);
});

const loaded = (response: Record<string, unknown>): ArrSummaryState => ({
  columns: [{ label: THIS_YEAR, response, isError: false }],
  isLoading: false,
  isError: false,
  errorMessage: "",
  retry: () => {},
});

/**
 * The address as it stands, so a test can assert what a reader would copy.
 *
 * A plain span: `<output>` carries an implicit `role="status"`, which would be
 * a second live region beside the filter bar's own.
 */
function Address() {
  const { pathname, search } = useLocation();
  return (
    <>
      <span data-testid="address">{search}</span>
      {/* The Period is the ROUTE, so the Period control is the one thing on
          this bar whose effect is not visible in the query string. */}
      <span data-testid="path">{pathname}</span>
    </>
  );
}

function renderPage(search = "", period: MisPeriod = MIS_PERIODS.ANNUALLY) {
  const path = MIS_BUILD_PATH_BY_PERIOD[period];
  return inZone("Asia/Colombo", () =>
    render(
      <MemoryRouter initialEntries={[`${path}${search}`]}>
        {/* Standing in for `MisSession`, the layout route this screen is mounted
            under in `App.tsx`. The session Years Back has to outlive the screen,
            so the page does not provide it and cannot render without it. */}
        <YearsBackSessionProvider>
          <MisArrBuildPage period={period} />
        </YearsBackSessionProvider>
        <Address />
      </MemoryRouter>,
    ),
  );
}

/**
 * The same screen, but mounted through a ROUTE TREE rather than directly.
 *
 * Needed for the Period control alone: a Period switch is a navigation to
 * another route, so the page and its filter bar UNMOUNT and remount. Rendering
 * the element directly hides that — the bar would survive the switch and
 * behave like a Table tab, which is exactly the assumption that made the reset
 * notice look free.
 */
function renderRouted(initial: string) {
  return inZone("Asia/Colombo", () =>
    render(
      // The same shape as `App.tsx`: three sibling routes inside the
      // `MisSession` layout route, which is what provides the session Years
      // Back. Mirrored rather than approximated, because whether the page
      // REMOUNTS across a Period switch is the whole question here, and that
      // depends on the tree.
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route element={<MisSession />}>
            <Route
              path={misPathFor(MIS_PERIODS.ANNUALLY)}
              element={<MisArrBuildPage period={MIS_PERIODS.ANNUALLY} />}
            />
            <Route
              path={misPathFor(MIS_PERIODS.QUARTERLY)}
              element={<MisArrBuildPage period={MIS_PERIODS.QUARTERLY} />}
            />
            <Route
              path={misPathFor(MIS_PERIODS.MONTHLY)}
              element={<MisArrBuildPage period={MIS_PERIODS.MONTHLY} />}
            />
          </Route>
        </Routes>
        <Address />
      </MemoryRouter>,
    ),
  );
}

const misPathFor = (period: MisPeriod) => MIS_BUILD_PATH_BY_PERIOD[period];

const address = () => screen.getByTestId("address").textContent;
const path = () => screen.getByTestId("path").textContent;

/** Click one of the Table tabs, which commit on click. */
const switchTable = (name: string) =>
  userEvent.click(within(screen.getByRole("group", { name: /table/i })).getByRole("button", { name }));

const NORTHWIND = {
  id: "0018000001abcXYZ",
  name: "Northwind Bank",
  accountOwnerName: "John Doe",
  partnerType: "Direct",
  naicsIndustry: "Technology",
  salesRegions: "EMEA",
  arrSoftwareTotal: 600_000,
  arrCloudTotal: 150_000,
  arrGrandTotal: 750_000,
  // The BU-only breakdown's own fields. Not the software and cloud halves added
  // up — the backend attributes a unit's revenue itself.
  apimBuTotal: 400_000,
  iamBuTotal: 200_000,
  integrationBuTotal: 100_000,
  choreoBuTotal: 30_000,
  agentPlatformBuTotal: 20_000,
  moesifBuTotal: 10_000,
};

const customerBook = (accounts: Record<string, unknown>[]): CustomerAccountsState => ({
  columns: [{ label: THIS_YEAR, accounts: accounts as never, isError: false }],
  isLoading: false,
  isError: false,
  errorMessage: "",
  retry: () => {},
});

/** The five business units, Moesif and a total, as `BuType` sends them. */
const SPLIT = {
  apim: 4_000_000,
  iam: 3_000_000,
  integration: 2_000_000,
  choreo: 1_000_000,
  agentPlatform: 500_000,
  moesif: 250_000,
  all: 10_500_000,
};

/** The column header both summaries show — the closing date alone. */
const THIS_YEAR_AS_OF = inZone("Asia/Colombo", () => {
  const filters = defaultAppliedFilters(MIS_PERIODS.ANNUALLY, MIS_TABLES.EXIT_ARR_BY_REGION);
  const columnDateRanges = pacificColumnRanges(
    MIS_PERIODS.ANNUALLY,
    MIS_WINDOWS.CALENDAR,
    filters,
  );
  const columns = buildColumnRanges(MIS_PERIODS.ANNUALLY, MIS_WINDOWS.CALENDAR, {
    ...filters,
    columnDateRanges,
  });
  return asOfColumnLabel(columns[columns.length - 1]);
});

const regionsLoaded = (response: RegionExitResponse): SummaryColumnsState<RegionExitResponse> => ({
  columns: [{ label: THIS_YEAR_AS_OF, response, isError: false }],
  isLoading: false,
  isError: false,
  errorMessage: "",
  retry: () => {},
});

/** One region's movement over a column, as `/arr-summary/region-metrics` sends it. */
const MOVEMENT = {
  opening: 1_000_000,
  firstSale: 200_000,
  expansions: 150_000,
  reductions: 50_000,
  lost: 100_000,
  netNew: 200_000,
  ending: 1_200_000,
};

/**
 * All ARR Metrics columns are headed with the SPAN they cover, not the date
 * they close on — the Build's own header, because a movement covers a period.
 */
const THIS_YEAR_SPAN = THIS_YEAR;

const metricsLoaded = (
  response: RegionMetricsResponse,
): SummaryColumnsState<RegionMetricsResponse> => ({
  columns: [{ label: THIS_YEAR_SPAN, response, isError: false }],
  isLoading: false,
  isError: false,
  errorMessage: "",
  retry: () => {},
});

const unitsLoaded = (response: BuFigures): SummaryColumnsState<BuFigures> => ({
  columns: [{ label: THIS_YEAR_AS_OF, response, isError: false }],
  isLoading: false,
  isError: false,
  errorMessage: "",
  retry: () => {},
});

beforeEach(() => {
  localStorage.clear();
  summary.value = loaded({ openingArr: 1_234_567.5 });
  customers.value = customerBook([NORTHWIND]);
  regionExit.askedBySalesRegion = [];
  regionExit.value = regionsLoaded({ NA: SPLIT, "Middle East": { apim: 1_000, all: 1_000 } });
  buExit.value = unitsLoaded(SPLIT);
  regionMetrics.askedBySalesRegion = [];
  regionMetrics.askedFilters = [];
  regionMetrics.value = metricsLoaded({ NA: MOVEMENT, EU: { ...MOVEMENT, ending: 300_000 } });
  opportunities.asked = null;
  drillDown.asked = [];
  drillDown.value = {
    customers: [
      {
        accountId: "0018000001abcXYZ",
        name: "Northwind Bank",
        salesRegion: "EMEA",
        subRegion: "Northern Europe",
        amount: 750_000,
      },
    ],
    isLoading: false,
    isError: false,
    errorMessage: "",
    retry: () => {},
  };
});

describe("opening the customers behind a figure", () => {
  // Only fourteen rows of the Build have a customer
  // list behind them; the rest are arithmetic over other rows.
  //
  // The Period label is read off the rendered header rather than hard-coded.
  // It is derived from today's date in Pacific Time, so a constant here would
  // be correct only until midnight — and the drill-down's dates come from that
  // same range, which is exactly what these tests are checking.
  const periodHeader = () =>
    within(screen.getAllByRole("rowgroup")[0]).getAllByRole("columnheader")[1].textContent!;

  const openNew = async () => {
    const newRow = screen.getByText("New").closest("tr")!;
    await userEvent.click(within(newRow).getAllByRole("button")[0]);
    return screen.findByRole("dialog");
  };

  it("offers no way in on a row that is arithmetic over other rows", () => {
    renderPage();
    // `Net New` is Opening minus Closing — there is no set of customers that IS
    // it, so the cell stays inert.
    const netNew = screen.getByText("Net New").closest("tr")!;
    expect(within(netNew).queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens the dialog on a figure that has customers behind it", async () => {
    renderPage();
    const dialog = await openNew();
    expect(within(dialog).getByText("Northwind Bank")).toBeInTheDocument();
  });

  it("names the row and the Period it was opened from", async () => {
    renderPage();
    const period = periodHeader();
    const dialog = await openNew();
    expect(dialog).toHaveAccessibleName(`New · ${period}`);
  });

  it("asks the backend for that row's movement, at that column's dates", async () => {
    renderPage();
    // The column header is `{opening} - {end}` in slash form; the wire wants
    // the closing half in dashes.
    const endDate = periodHeader().split(" - ")[1].replace(/\//g, "-");
    await openNew();
    const request = drillDown.asked.at(-1) as Record<string, unknown>;
    expect(request).toMatchObject({ customerArrType: "New", endDate });
  });

  it("asks for nothing at all while the dialog is shut", () => {
    renderPage();
    expect(drillDown.asked.every((one) => one === null)).toBe(true);
  });

  it("closes again, and stops asking", async () => {
    renderPage();
    const newRow = screen.getByText("New").closest("tr")!;
    await userEvent.click(within(newRow).getAllByRole("button")[0]);
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /close/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(drillDown.asked.at(-1)).toBeNull();
  });
});

describe("the Software/Cloud Customers table", () => {
  // `?table=customers` is the whole switch. What is under test here is that a
  // different table appears under the same bar.

  it("shows the customer book, one row per account", () => {
    renderPage("?table=customers");
    expect(screen.getByRole("table", { name: /Customers/ })).toBeInTheDocument();
    expect(screen.getByText("Northwind Bank")).toBeInTheDocument();
  });

  it("shows the Subscription Build when the link names no Table", () => {
    // Subscription is the default and is never written to the URL, so "no
    // table" and "the Build" are the same state.
    renderPage();
    expect(screen.getByRole("table", { name: /Subscription/ })).toBeInTheDocument();
    expect(screen.queryByText("Northwind Bank")).not.toBeInTheDocument();
  });

  it("falls back to the Build rather than erroring on a Table it does not know", () => {
    renderPage("?table=not-a-table");
    expect(screen.getByRole("table", { name: /Subscription/ })).toBeInTheDocument();
  });

  it("gives each account its identity columns before the first figure", () => {
    renderPage("?table=customers");
    const row = screen.getByText("Northwind Bank").closest("tr")!;
    const cells = within(row).getAllByRole("cell");
    // Account ID, Owner, Source — read off the fields the wire sends them under.
    expect(cells[0]).toHaveTextContent("0018000001abcXYZ");
    expect(cells[1]).toHaveTextContent("John Doe");
    expect(cells[2]).toHaveTextContent("Direct");
  });

  it("heads the figure columns so the three Totals can be told apart", async () => {
    // Two header rows, so the labels have to carry which Total is which.
    // Reached through the breakdown control, because BU only is the default.
    renderPage("?table=customers");
    await userEvent.click(screen.getByRole("button", { name: "Software / Cloud" }));
    expect(screen.getAllByText("Software Total").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cloud Total").length).toBeGreaterThan(0);
  });

  it("says so when the whole customer book failed, and offers a retry", () => {
    customers.value = {
      columns: [],
      isLoading: false,
      isError: true,
      errorMessage: "Gateway said no.",
      retry: () => {},
    };
    renderPage("?table=customers");
    expect(screen.getByText(/Gateway said no/)).toBeInTheDocument();
  });

  it("holds the space rather than showing an empty book while it loads", () => {
    customers.value = { ...customerBook([]), isLoading: true, columns: [] };
    renderPage("?table=customers");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("how the customer table breaks a customer's revenue down", () => {
  // Two views of one response. The business-unit split is the default; the
  // twelve Software/Cloud columns are the second option.

  it("opens on the business-unit split", () => {
    renderPage("?table=customers");
    expect(screen.getAllByText("API Platform BU").length).toBeGreaterThan(0);
    expect(screen.queryByText("Software Total")).not.toBeInTheDocument();
  });

  it("warns that Moesif is already counted inside API Platform BU", () => {
    renderPage("?table=customers");
    expect(
      screen.getAllByText("Moesif (Already included in API Platform BU)").length,
    ).toBeGreaterThan(0);
  });

  it("swaps to the Software/Cloud breakdown when the reader asks for it", async () => {
    renderPage("?table=customers");
    await userEvent.click(screen.getByRole("button", { name: "Software / Cloud" }));
    expect(screen.getAllByText("Software Total").length).toBeGreaterThan(0);
    expect(screen.queryByText("API Platform BU")).not.toBeInTheDocument();
  });

  it("reads a unit off its own field, not off the software and cloud halves", () => {
    // 400,000 is `apimBuTotal`. Software plus Cloud for this account is
    // 750,000, so reconstructing the unit from the halves would show that instead.
    renderPage("?table=customers");
    const row = screen.getByText("Northwind Bank").closest("tr")!;
    expect(within(row).getByText("400,000.00")).toBeInTheDocument();
  });

  it("keeps the control on screen when the whole book failed", () => {
    // The control is gated on `!loading` alone, so an error keeps it — and an
    // error is where a reader most wants the switch still there.
    customers.value = {
      columns: [],
      isLoading: false,
      isError: true,
      errorMessage: "Gateway said no.",
      retry: () => {},
    };
    renderPage("?table=customers");
    expect(screen.getByRole("group", { name: "Breakdown" })).toBeInTheDocument();
  });

  it("keeps the control on screen when the book came back empty", () => {
    customers.value = customerBook([]);
    renderPage("?table=customers");
    expect(screen.getByText(/no customers to show/i)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Breakdown" })).toBeInTheDocument();
  });

  it("holds the control back while the book is still loading", () => {
    customers.value = { ...customerBook([]), isLoading: true, columns: [] };
    renderPage("?table=customers");
    expect(screen.queryByRole("group", { name: "Breakdown" })).not.toBeInTheDocument();
  });

  it("asks the backend for nothing more when the breakdown changes", async () => {
    // Both views are the same `POST /accounts` response, so switching must not
    // refetch. The stub counts renders of the hook's result, not calls, so what
    // is pinned is that the columns handed in are the same object.
    renderPage("?table=customers");
    const before = customers.value;
    await userEvent.click(screen.getByRole("button", { name: "Software / Cloud" }));
    expect(customers.value).toBe(before);
  });
});

describe("the customer table's Total row", () => {
  // The only client-computed total in the ARR Build that runs down the
  // CUSTOMERS rather than across named metric rows.

  it("sits above the customers, so the column total is read first", () => {
    renderPage("?table=customers");
    const rows = within(screen.getByRole("table", { name: /Customers/ })).getAllByRole("row");
    // Two header rows, then the total, then the book.
    expect(rows[2]).toHaveTextContent("Total");
    expect(rows[3]).toHaveTextContent("Northwind Bank");
  });

  it("adds the column down the book", () => {
    customers.value = customerBook([
      NORTHWIND,
      { ...NORTHWIND, id: "a2", name: "Contoso", apimBuTotal: 100_000 },
    ]);
    renderPage("?table=customers");
    const total = within(screen.getByRole("table", { name: /Customers/ })).getAllByRole("row")[2];
    expect(within(total).getByText("500,000.00")).toBeInTheDocument();
  });

  it("reads a dash in the identity columns, because it is not an account", () => {
    renderPage("?table=customers");
    const total = within(screen.getByRole("table", { name: /Customers/ })).getAllByRole("row")[2];
    const cells = within(total).getAllByRole("cell");
    // Account ID, Owner, Source — where a customer row carries its facts.
    expect(cells[0]).toHaveTextContent("-");
    expect(cells[1]).toHaveTextContent("-");
    expect(cells[2]).toHaveTextContent("-");
  });

  it("totals the Software/Cloud breakdown too, not only the units", async () => {
    renderPage("?table=customers");
    await userEvent.click(screen.getByRole("button", { name: "Software / Cloud" }));
    const total = within(screen.getByRole("table", { name: /Customers/ })).getAllByRole("row")[2];
    expect(within(total).getByText("600,000.00")).toBeInTheDocument();
  });
});

describe("while the figures are loading", () => {
  it("holds the space rather than showing an empty Build", () => {
    summary.value = { ...loaded({}), isLoading: true, columns: [] };
    renderPage();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("when every column fails", () => {
  it("says so, and offers the reader a way to try again", () => {
    summary.value = {
      columns: [],
      isLoading: false,
      isError: true,
      errorMessage: "Gateway timed out.",
      retry: () => {},
    };
    renderPage();
    expect(screen.getByText(/couldn't load the build/i)).toBeInTheDocument();
    // "Retry" is ErrorNotice's own word, shared by every screen in this app.
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

describe("the Build itself", () => {
  it("renders the movement from an Opening balance to a Closing one", () => {
    renderPage();
    const table = screen.getByRole("table");
    expect(within(table).getByText("Opening ARR")).toBeInTheDocument();
    expect(within(table).getByText("Ending ARR")).toBeInTheDocument();
  });

  it("heads each column with the two balance dates it spans", () => {
    renderPage();
    expect(screen.getByText(THIS_YEAR)).toBeInTheDocument();
  });

  it("opens every section, since a Subscription Build is a summary already", () => {
    renderPage();
    const table = screen.getByRole("table");
    for (const section of ["ARR movement", "Dollar retention", "Customers"]) {
      expect(within(table).getByText(section)).toBeInTheDocument();
    }
  });
});

describe("the filter bar above the Build", () => {
  it("is there, bound to the same view the grid is drawn from", () => {
    renderPage("?type=Closed+Won+ARR&years=3");
    expect(screen.getByLabelText("ARR Type")).toHaveValue("Only Closed Won ARR");
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  it("survives a Build that is still loading, so the reader can change it", () => {
    summary.value = { ...loaded({}), isLoading: true, columns: [] };
    renderPage();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByLabelText("ARR Type")).toBeInTheDocument();
  });

  it("survives a Build that failed, which is when it is most needed", () => {
    summary.value = {
      columns: [],
      isLoading: false,
      isError: true,
      errorMessage: "Gateway timed out.",
      retry: () => {},
    };
    renderPage();
    expect(screen.getByText(/couldn't load the build/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear All" })).toBeInTheDocument();
  });

  it("survives a custom selection that asks for no units at all", () => {
    // `arrSummaryRequests` answers with nothing here, deliberately — and the
    // reader needs the units control still on screen to get out of it.
    summary.value = { ...loaded({}), columns: [] };
    renderPage("?unit=custom");
    expect(screen.getByText(/no periods to show/i)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Business Units" })).toBeInTheDocument();
  });
});

describe("the figures", () => {
  it("are written as money at full value", () => {
    renderPage();
    expect(screen.getByText("1,234,567.50")).toBeInTheDocument();
  });

  it("are divided by a thousand when the link asks for thousands", () => {
    renderPage("?scale=k");
    expect(screen.getByText("1,234.57")).toBeInTheDocument();
  });

  it("leave a headcount alone at either Scale", () => {
    // 1,234 customers are 1,234 customers however the amounts are shown.
    summary.value = loaded({ openingSubscriptionCustomers: 1234 });
    renderPage("?scale=k");
    expect(screen.getByText("1,234")).toBeInTheDocument();
  });

  it("say what they are in, so a cropped screenshot still states its units", () => {
    renderPage("?scale=k");
    expect(screen.getByText("All amounts in USD '000")).toBeInTheDocument();
  });

  it("leave a cell blank when the backend had nothing for that row", () => {
    summary.value = loaded({ openingArr: null });
    renderPage();
    const table = screen.getByRole("table");
    expect(within(table).queryByText("NaN")).not.toBeInTheDocument();
  });
});

describe("choosing which of the Build's tables to read", () => {
  // The tabs commit on click: a different table is a different report, not a
  // narrowing of this one, which is the same rule the unit tabs already follow.

  it("offers Subscription, Customers, Region Summary and BU Summary", () => {
    renderPage();
    const tabs = screen.getByRole("group", { name: /table/i });
    for (const name of ["Subscription", "Customers", "Region Summary", "BU Summary"]) {
      expect(within(tabs).getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("marks the table being read", () => {
    renderPage("?table=customers");
    const tabs = screen.getByRole("group", { name: /table/i });
    expect(within(tabs).getByRole("button", { name: "Customers" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("shows Subscription as the one being read when the link names no Table", () => {
    renderPage();
    const tabs = screen.getByRole("group", { name: /table/i });
    expect(within(tabs).getByRole("button", { name: "Subscription" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("puts the chosen table in the address, so the view can be shared", async () => {
    renderPage();
    const tabs = screen.getByRole("group", { name: /table/i });
    await userEvent.click(within(tabs).getByRole("button", { name: "Customers" }));
    expect(screen.getByRole("table", { name: /Customers/ })).toBeInTheDocument();
  });

  it("shows the table the address names, and not the Build under its heading", () => {
    // `region-summary` is a RECOGNISED Table — `parseViewState` accepts it and
    // the filter rules key off it — so falling through to the Subscription
    // Build would show the reader a different report than the one they asked
    // for. An unrecognised value is the other case and still degrades to the
    // Build, which the test above covers.
    renderPage("?table=region-summary");
    expect(screen.getByRole("table", { name: /Region Summary/ })).toBeInTheDocument();
  });

  it("has a table for every one of the four, none of them an apology", () => {
    for (const search of ["", "?table=customers", "?table=region-summary", "?table=bu-summary"]) {
      const view = renderPage(search);
      expect(screen.getByRole("table")).toBeInTheDocument();
      view.unmount();
    }
  });
});

describe("Exit ARR by Region", () => {
  // A summary, not a Build: it reports what was on the books at one
  // moment rather than the movement between two, so its columns are headed with
  // that moment alone and its rows are regions rather than metric lines.

  it("gives each region a row, under the regions the backend named", () => {
    renderPage("?table=region-summary");
    const table = screen.getByRole("table", { name: /Region Summary/ });
    expect(within(table).getByText("NA")).toBeInTheDocument();
    expect(within(table).getByText("Middle East")).toBeInTheDocument();
  });

  it("totals the regions in a row of its own, last", () => {
    renderPage("?table=region-summary");
    const rows = within(screen.getByRole("table", { name: /Region Summary/ })).getAllByRole("row");
    expect(rows.at(-1)).toHaveTextContent("Total Exit ARR");
  });

  it("heads each column with the date the balance was read at", () => {
    renderPage("?table=region-summary");
    expect(screen.getByText(THIS_YEAR_AS_OF)).toBeInTheDocument();
  });

  it("breaks each region down by business unit, Moesif last before the total", () => {
    renderPage("?table=region-summary");
    const table = screen.getByRole("table", { name: /Region Summary/ });
    expect(within(table).getByText("API Platform BU")).toBeInTheDocument();
    expect(
      within(table).getByText("Moesif (Already included in API Platform BU)"),
    ).toBeInTheDocument();
  });

  it("puts each unit's figure under its own header", () => {
    // The wire names and the headers disagree — `apim` is headed "API Platform
    // BU", `all` is "Total" — so a figure landing one column over is the
    // failure this table can have silently and plausibly.
    renderPage("?table=region-summary");
    const table = screen.getByRole("table", { name: /Region Summary/ });
    const na = within(table).getByText("NA").closest("tr")!;
    expect(within(na).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "4,000,000.00",
      "3,000,000.00",
      "2,000,000.00",
      "1,000,000.00",
      "500,000.00",
      "250,000.00",
      "10,500,000.00",
    ]);
  });

  it("writes the figures as money, at the Scale the link asked for", () => {
    renderPage("?table=region-summary&scale=k");
    expect(screen.getByText("4,000.00")).toBeInTheDocument();
    expect(screen.getByText("All amounts in USD '000")).toBeInTheDocument();
  });

  it("reads the balance by Sales Region until the reader says otherwise", () => {
    renderPage("?table=region-summary");
    expect(regionExit.askedBySalesRegion.at(-1)).toBe(true);
  });

  it("re-reads it by Sub Region when the reader switches", async () => {
    renderPage("?table=region-summary");
    const cut = screen.getByRole("group", { name: /region type/i });
    await userEvent.click(within(cut).getByRole("button", { name: "Sub Region" }));
    expect(regionExit.askedBySalesRegion.at(-1)).toBe(false);
  });

  it("keeps the Region Type control on screen when every column failed", () => {
    // The control is the reader's way out of a failed read, so it survives the
    // error the way the filter bar does.
    regionExit.value = {
      columns: [],
      isLoading: false,
      isError: true,
      errorMessage: "Gateway timed out.",
      retry: () => {},
    };
    renderPage("?table=region-summary");
    expect(screen.getByText(/couldn't load the region summary/i)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /region type/i })).toBeInTheDocument();
  });

  it("holds the space rather than showing an empty summary while it loads", () => {
    regionExit.value = { ...regionsLoaded({}), isLoading: true, columns: [] };
    renderPage("?table=region-summary");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("Exit ARR by Business Unit", () => {
  it("gives each business unit a row, in BuType order", () => {
    // Seven, whatever the backend returned: this table's rows ARE the `BuType`
    // record, so they come from the code where the Region Summary's come from
    // the response.
    renderPage("?table=bu-summary");
    const body = within(screen.getByRole("table", { name: /BU Summary/ })).getAllByRole(
      "rowgroup",
    )[1];
    const rows = within(body).getAllByRole("row");
    expect(rows).toHaveLength(7);
    expect(rows[0]).toHaveTextContent("API Platform");
    expect(rows.at(-1)).toHaveTextContent("Total");
  });

  it("shows one figure per period, because a summary has nothing to pair it with", () => {
    renderPage("?table=bu-summary");
    const table = screen.getByRole("table", { name: /BU Summary/ });
    const apiPlatform = within(table).getByText("API Platform").closest("tr")!;
    // One figure cell beside the row label, where the Region Summary has seven.
    expect(within(apiPlatform).getAllByRole("cell")).toHaveLength(1);
    expect(apiPlatform).toHaveTextContent("4,000,000.00");
  });

  it("offers no Region Type control, having no regions to cut by", () => {
    renderPage("?table=bu-summary");
    expect(screen.queryByRole("group", { name: /region type/i })).not.toBeInTheDocument();
  });

  it("says so when every column failed, and offers a retry", () => {
    buExit.value = {
      columns: [],
      isLoading: false,
      isError: true,
      errorMessage: "Gateway timed out.",
      retry: () => {},
    };
    renderPage("?table=bu-summary");
    expect(screen.getByText(/couldn't load the bu summary/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

/** The workbook the page wrote, loaded back the way Excel would. */
async function loadWorkbook(blob: Blob): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await bytesOf(blob));
  return workbook;
}

/** Click Export and hand back the sheet that came out. */
async function exportedSheet(name: string): Promise<ExcelJS.Worksheet> {
  const { blobs } = captureDownloads();
  await userEvent.click(screen.getByRole("button", { name: /export/i }));
  await waitFor(() => expect(blobs).toHaveLength(1));
  return (await loadWorkbook(blobs[0])).getWorksheet(name)!;
}

/**
 * One figure, found by the words around it rather than by counting.
 *
 * The four tables have one, seven, twelve and eighteen columns and differ in
 * how many rows precede the first figure, so a literal row and column here
 * would be four different pieces of arithmetic to keep right — and each would
 * silently start reading the wrong cell the moment a column moved.
 */
function figureAt(sheet: ExcelJS.Worksheet, rowLabel: string, columnLabel: string): unknown {
  const headerRow = sheet.getRow(sheet.getRow(3).values ? 4 : 3);
  const headers = (headerRow.values as unknown[]) ?? [];
  const column = headers.indexOf(columnLabel);
  expect(column, `no column "${columnLabel}"`).toBeGreaterThan(0);

  let found: ExcelJS.Row | undefined;
  sheet.eachRow((row) => {
    if (String(row.getCell(1).value ?? "").trim() === rowLabel) found ??= row;
  });
  expect(found, `no row "${rowLabel}"`).toBeDefined();
  return found!.getCell(column).value;
}

describe("taking the Build out of the browser", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("writes the table on screen into a workbook, at units and as numbers", async () => {
    const { blobs, filenames } = captureDownloads();
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /export/i }));
    await waitFor(() => expect(blobs).toHaveLength(1));

    const sheet = (await loadWorkbook(blobs[0])).getWorksheet("Subscription")!;
    expect(sheet).toBeDefined();
    // 1,234,567.50 is what the screen shows. The file gets the figure.
    const openingArr = sheet.getRow(6);
    expect(openingArr.getCell(1).value).toBe("  Opening ARR");
    expect(openingArr.getCell(2).value).toBe(1_234_567.5);
    // And it names itself after the table it came from, dated in Pacific Time.
    expect(filenames[0]).toMatch(/^arr_build_subscription_\d{4}-\d{2}-\d{2}\.xlsx$/);
  });

  it("exports the same figure at units while the screen is showing thousands", async () => {
    // A CSV that inherited the display formatter would be 1000x off, with
    // nothing in the file saying so. The reader sets thousands, exports, and
    // the workbook must still hold the raw figure.
    renderPage("?scale=k");
    expect(screen.getByText("All amounts in USD '000")).toBeInTheDocument();

    const sheet = await exportedSheet("Subscription");
    expect(sheet.getRow(6).getCell(2).value).toBe(1_234_567.5);
    // Not 1,234.57 — and the file says which of the two it is.
    expect(sheet.getRow(1).getCell(1).value).toBe("All amounts in USD");
  });

  // Each of the other three tables builds its OWN raw-figure reader, so the
  // raw-figure rule has to be asked of each of them rather than of the Build
  // alone. The sheet
  // layer cannot scale — `misBuildSheet` has no Scale parameter — but nothing
  // stops a call site handing it an already-scaled figure, and these are the
  // tests that say it does not.
  it("exports the Customers table at units while the screen shows thousands", async () => {
    renderPage("?table=customers&scale=k");
    const sheet = await exportedSheet("Customers");
    expect(figureAt(sheet, "Northwind Bank", "Total")).toBe(750_000);
    expect(sheet.getRow(1).getCell(1).value).toBe("All amounts in USD");
  });

  it("exports the Region Summary at units while the screen shows thousands", async () => {
    renderPage("?table=region-summary&scale=k");
    const sheet = await exportedSheet("Region Summary");
    expect(figureAt(sheet, "NA", "API Platform BU")).toBe(4_000_000);
    expect(sheet.getRow(1).getCell(1).value).toBe("All amounts in USD");
  });

  it("exports All ARR Metrics at units while the screen shows thousands", async () => {
    // The fifth grid on this page: the sheet builder takes no Scale, but its
    // `value` reader would carry
    // a figure a caller had already divided.
    renderPage("?table=region-summary&scale=k");
    await userEvent.click(screen.getByRole("button", { name: "All ARR Metrics" }));
    const sheet = await exportedSheet("All ARR Metrics");
    expect(figureAt(sheet, "NA", "Opening ARR")).toBe(1_000_000);
    expect(sheet.getRow(1).getCell(1).value).toBe("All amounts in USD");
  });

  it("names the All ARR Metrics file after the view it came from", async () => {
    const { blobs, filenames } = captureDownloads();
    renderPage("?table=region-summary");
    await userEvent.click(screen.getByRole("button", { name: "All ARR Metrics" }));
    await userEvent.click(screen.getByRole("button", { name: /export/i }));
    await waitFor(() => expect(blobs).toHaveLength(1));
    expect(filenames[0]).toMatch(/^arr_build_all_arr_metrics_\d{4}-\d{2}-\d{2}\.xlsx$/);
  });

  it("exports the BU Summary at units while the screen shows thousands", async () => {
    renderPage("?table=bu-summary&scale=k");
    const sheet = await exportedSheet("BU Summary");
    expect(figureAt(sheet, "API Platform", "Exit ARR")).toBe(4_000_000);
    expect(sheet.getRow(1).getCell(1).value).toBe("All amounts in USD");
  });

  it("names the file after whichever table is on screen", async () => {
    const { filenames, blobs } = captureDownloads();
    renderPage("?table=bu-summary");

    await userEvent.click(screen.getByRole("button", { name: /export/i }));
    await waitFor(() => expect(blobs).toHaveLength(1));

    expect(filenames[0]).toMatch(/^arr_build_bu_summary_\d{4}-\d{2}-\d{2}\.xlsx$/);
  });
});

describe("what a Table switch does to the filters", () => {
  // A different Table is a different report: the filters reset and the new
  // Table's defaults apply at once, and a Region Summary
  // still carrying the Build's EMEA filter would be narrowed by something its
  // own bar cannot show or clear.

  it("drops the filters the reader had chosen for the Table they left", async () => {
    renderPage("?view=Sales+Region&region=EMEA&channel=Channel");
    await switchTable("Region Summary");
    expect(address()).toBe("?table=region-summary");
  });

  it("says which Table's defaults it landed on", async () => {
    renderPage("?channel=Channel");
    await switchTable("Region Summary");
    // By its TEXT rather than by the role alone: this screen has two
    // always-mounted live regions — the bar's, and the table's narrow-viewport
    // notice — which is correct, and means `getByRole("status")` is ambiguous.
    expect(
      screen.getByText("Filters reset to the Region Summary defaults"),
    ).toBeInTheDocument();
  });

  it("carries the Years Back the reader set, which is the one thing not lost", async () => {
    renderPage("?years=3");
    await switchTable("Region Summary");
    expect(address()).toBe("?table=region-summary&years=3");
  });

  it("lets the new Table answer when the reader never chose one", async () => {
    renderPage();
    await switchTable("Region Summary");
    // Region Summary's own default is 2, and a default is never written.
    expect(address()).toBe("?table=region-summary");
  });

  it("clears the unit selection on the way into Customers", async () => {
    // The one Table whose switch also clears the units.
    renderPage("?unit=custom&customBu=APIM_BU");
    await switchTable("Customers");
    expect(address()).toBe("?table=customers");
  });

  it("leaves the unit selection alone on the way to a summary", async () => {
    renderPage("?unit=custom&customBu=APIM_BU");
    await switchTable("BU Summary");
    expect(address()).toBe("?table=bu-summary&unit=custom&customBu=APIM_BU");
  });
});

describe("a session Years Back that happens to equal the Table's own default", () => {
  // The case both session rules turn on, and the only one where they are
  // visible: the reader's five years and the Build's five years are the same
  // number, so nothing on screen distinguishes "they chose this" from "this is
  // what the Table starts at" — and what the NEXT Table shows depends on which
  // it was. Region Summary starts at two, so it is where the answer shows up.

  /** Set a Years Back on Region Summary, then go and stand on the Build. */
  const withSessionOfFive = async () => {
    renderPage("?table=region-summary&years=5");
    await switchTable("Subscription");
    expect(address()).toBe("");
  };

  it("survives applying something else, because the reader did not change it", async () => {
    await withSessionOfFive();
    await userEvent.click(screen.getByLabelText("Channel/Direct"));
    await userEvent.click(await screen.findByRole("option", { name: "Channel" }));
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    await switchTable("Region Summary");
    expect(address()).toBe("?table=region-summary&years=5");
  });

  it("is forgotten by Clear All, which no change on screen would have shown", async () => {
    await withSessionOfFive();
    await userEvent.click(screen.getByRole("button", { name: "Clear All" }));
    // Nothing visible moved — the Build was already at five — but the session
    // is gone, so Region Summary answers with its own two.
    await switchTable("Region Summary");
    expect(address()).toBe("?table=region-summary");
  });
});

describe("the QRR and MRR Builds", () => {
  // The whole model layer is Period-generic already — the Applied
  // set holds one type and one cumulative flag whatever the Period, and
  // `TYPE_KEY_BY_PERIOD` decides which key each becomes — so what these pin is
  // that the SCREEN is wired to the Period its route carries, rather than
  // being an Annually screen three times over.

  it("labels the type control for the Period it is on", () => {
    renderPage("", MIS_PERIODS.QUARTERLY);
    expect(screen.getByLabelText(/QRR Type/i)).toBeInTheDocument();
  });

  it("takes its own Period's type from a link and degrades another Period's", () => {
    renderPage("?type=Closed+Won+MRR", MIS_PERIODS.MONTHLY);
    expect(screen.getByLabelText("MRR Type")).toHaveValue("Only Closed Won MRR");
    cleanup();
    // `Closed Won ARR` is a real type value, and it is not a MONTHLY one — so
    // on this route it is unrecognised like any other, and degrades to the
    // default rather than being honoured. The same query string means
    // different things on the three screens, which is the whole reason the
    // Period is in the path and not the query.
    renderPage("?type=Closed+Won+ARR", MIS_PERIODS.MONTHLY);
    expect(screen.getByLabelText("MRR Type")).toHaveValue("MRR");
  });

  it("navigates to the other Period's route when the Period control is used", async () => {
    renderPage();
    expect(path()).toBe(MIS_BUILD_PATH_BY_PERIOD[MIS_PERIODS.ANNUALLY]);
    await userEvent.click(
      within(screen.getByRole("group", { name: "Period" })).getByRole("button", { name: "Quarterly" }),
    );
    expect(path()).toBe(MIS_BUILD_PATH_BY_PERIOD[MIS_PERIODS.QUARTERLY]);
  });

  it("keeps TTM on the annual route, because it is a Window and not a Period", async () => {
    renderPage();
    await userEvent.click(
      within(screen.getByRole("group", { name: "Period" })).getByRole("button", { name: "TTM" }),
    );
    expect(path()).toBe(MIS_BUILD_PATH_BY_PERIOD[MIS_PERIODS.ANNUALLY]);
    expect(address()).toBe("?window=ttm");
  });

  it("offers all four options, which the annual Build alone used to", () => {
    renderPage("", MIS_PERIODS.QUARTERLY);
    const control = within(screen.getByRole("group", { name: "Period" }));
    for (const name of ["Annually", "Quarterly", "Monthly", "TTM"]) {
      expect(control.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("carries a Cumulative control the annual Build does not have", async () => {
    // The Pending set holds one `cumulative` flag whatever the Period, and
    // `CUMULATIVE_KEY_BY_PERIOD`
    // decides which Applied key it becomes. Confirmed rather than assumed.
    renderPage("", MIS_PERIODS.QUARTERLY);
    // Last of seventeen controls, and the bar shows seven collapsed, so it is
    // behind More like the other ten.
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    await userEvent.click(screen.getByLabelText("Cumulative Quarterly"));
    await userEvent.click(screen.getByRole("button", { name: /apply/i }));
    expect(address()).toBe("?cumulative=1");
  });

  it("makes Cumulative move the figures and not just the address", () => {
    // The control used to serialise and nothing read it. `computePrevDateFor`
    // is where it lives — it moves where each column's OPENING balance is read,
    // so every quarter of
    // a year opens at that year's previous 31 December and the figures
    // accumulate from 1 January instead of rolling forward one quarter.
    renderPage("", MIS_PERIODS.QUARTERLY);
    const rolling = summary.lastRanges.map((range) => range.start);
    expect(new Set(rolling).size).toBeGreaterThan(1);

    cleanup();
    renderPage("?cumulative=1", MIS_PERIODS.QUARTERLY);
    const accumulating = summary.lastRanges;
    expect(accumulating).toHaveLength(rolling.length);
    // Every column of a given year now starts on that year's 1 January, so
    // there is one start per year on screen rather than one per quarter.
    const startsPerYear = new Set(accumulating.map((range) => range.start));
    expect(startsPerYear.size).toBeLessThan(rolling.length);
    for (const start of startsPerYear) {
      expect(start, `${start} is not a 1 January`).toMatch(/\/01\/01$/);
    }
  });

  it("has no Cumulative control on Annually, which has no such flag", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.queryByLabelText(/^Cumulative/)).not.toBeInTheDocument();
  });

  it("ignores a TTM window on a Period that has none", () => {
    // `window=ttm` is not an error off Annually, it is a parameter
    // that means nothing there — so the view is not TTM and the control does
    // not light a TTM button the screen has no Window for.
    renderPage("?window=ttm", MIS_PERIODS.MONTHLY);
    const control = within(screen.getByRole("group", { name: "Period" }));
    expect(control.getByRole("button", { name: "Monthly" })).toHaveAttribute("aria-pressed", "true");
    expect(control.getByRole("button", { name: "TTM" })).toHaveAttribute("aria-pressed", "false");
  });

  it("drops an ignored window from the address the moment it writes a view", async () => {
    // Arriving
    // on a stale link does NOT scrub the address — nothing has written a view
    // yet, so the parameter sits there being ignored. It goes the first time
    // the app writes, because the serialiser only ever emits `window` on
    // Annually (`misViewState.ts`).
    renderPage("?window=ttm", MIS_PERIODS.MONTHLY);
    expect(address()).toBe("?window=ttm");
    await switchTable("Customers");
    expect(address()).toBe("?table=customers");
  });

  it("asks for quarterly ranges on the Quarterly Build, not annual ones", () => {
    renderPage("", MIS_PERIODS.QUARTERLY);
    // The headers are what the page prints, not a recomputation of the ranges:
    // on the Build every column names its quarter BARE — the Subscription
    // grid passes `includePrefix: false` — except the quarter still running,
    // which is named by its date. An annual Build asks for `{opening} - {end}`
    // instead, so this fails outright if the Period did not reach the builder.
    const headers = summary.lastRanges.map((range) => buildColumnLabel(range));
    expect(headers.length).toBeGreaterThanOrEqual(5);
    for (const header of headers.slice(0, -1)) {
      expect(header, `${header} is not a quarter`).toMatch(/^\d{4} Q[1-4]$/);
    }
    // The last is the open quarter, dated rather than named.
    expect(headers.at(-1)).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
  });

  it("asks for thirteen months on the Monthly Build at its default Years Back", () => {
    // Years Back defaults to 1 off Annually, and `generateMonths` walks
    // `i <= yearsBack * 12` — so thirteen. The extra month is kept rather than
    // corrected. No Years
    // Back slice applies here either: that is an Annually rule.
    renderPage("", MIS_PERIODS.MONTHLY);
    expect(summary.lastRanges).toHaveLength(13);
  });

  it("still asks for an annual range on the annual Build", () => {
    // The other side of the branch, so a change that sent quarters everywhere
    // could not pass by only being checked off Annually.
    renderPage();
    expect(buildColumnLabel(summary.lastRanges[0])).toMatch(
      /^\d{4}\/\d{2}\/\d{2} - \d{4}\/\d{2}\/\d{2}$/,
    );
  });

  it("narrows the customers table to a recent run plus today on a Delayed type", async () => {
    // Delayed QRR is two historic quarters plus the current day, not the seven
    // quarters the
    // Build draws — a Delayed figure is revenue that has not landed, so a long
    // tail of closed quarters says nothing.
    renderPage("?table=customers&type=Delayed+QRR", MIS_PERIODS.QUARTERLY);
    expect(customers.lastRanges).toHaveLength(3);
    expect(buildColumnLabel(customers.lastRanges.at(-1)!)).toMatch(
      /^\d{4}\/\d{2}\/\d{2}$/,
    );
  });

  it("gives the customers table the whole Period on every other type", () => {
    renderPage("?table=customers", MIS_PERIODS.QUARTERLY);
    expect(customers.lastRanges).toHaveLength(7);
  });

  it("says which defaults it landed on when a Period switch drops the filters", async () => {
    // A Period switch was expected to come free once the Period could move. It
    // did not. A Period switch is a NAVIGATION, so the bar unmounts and its
    // `seededFor` re-initialises
    // to the view it arrived on — the comparison that drives the notice can
    // never be true. A Table switch works only because it stays on one route.
    renderRouted(`${misPathFor(MIS_PERIODS.ANNUALLY)}?channel=Channel`);
    await userEvent.click(
      within(screen.getByRole("group", { name: "Period" })).getByRole("button", { name: "Quarterly" }),
    );
    expect(address()).toBe("");
    expect(screen.getByText("Filters reset to the Quarterly defaults")).toBeInTheDocument();
  });

  it("says nothing when the reader was already on the defaults", async () => {
    // The notice reports what a switch THREW AWAY. Nothing was thrown away
    // here, so a notice would be noise — `filterResetNotice` returns "" and
    // this pins that the new path did not lose that rule.
    renderRouted(misPathFor(MIS_PERIODS.ANNUALLY));
    await userEvent.click(
      within(screen.getByRole("group", { name: "Period" })).getByRole("button", { name: "Monthly" }),
    );
    expect(screen.queryByText(/Filters reset to the/)).not.toBeInTheDocument();
  });

  it("serialises a default view to an empty query string on each of the three Periods", () => {
    // Years Back defaults
    // to 1 off Annually and 5 on it, so this is also where a Period that kept
    // the annual default would show itself — as a `years=` nobody asked for.
    for (const period of [MIS_PERIODS.ANNUALLY, MIS_PERIODS.QUARTERLY, MIS_PERIODS.MONTHLY]) {
      cleanup();
      renderPage("", period);
      expect(address(), `${period} does not open clean`).toBe("");
    }
  });
});

describe("the Region Summary's two views", () => {
  // Exit ARR is each region's BALANCE at the column's
  // date, split by business unit; All ARR Metrics is each region's MOVEMENT
  // over the column, narrowed to one business unit. Two questions, not two
  // arrangements of one answer.

  const openMetrics = async () => {
    renderPage("?table=region-summary");
    await userEvent.click(screen.getByRole("button", { name: "All ARR Metrics" }));
  };

  it("opens on Exit ARR", () => {
    renderPage("?table=region-summary");
    expect(screen.getByRole("button", { name: "Exit ARR" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("API Platform BU")).toBeInTheDocument();
  });

  it("shows each region's movement once the reader asks for the metrics", async () => {
    await openMetrics();
    expect(screen.getByText("Opening ARR")).toBeInTheDocument();
    expect(screen.getByText("First Sale")).toBeInTheDocument();
    expect(screen.getByText("Closing ARR")).toBeInTheDocument();
    // The business-unit split belongs to the other view.
    expect(screen.queryByText("API Platform BU")).not.toBeInTheDocument();
  });

  it("heads each column with the span it covers, not the date it closes on", async () => {
    await openMetrics();
    expect(screen.getAllByText(THIS_YEAR_SPAN).length).toBeGreaterThan(0);
  });

  it("gives each region a row, and totals them last", async () => {
    await openMetrics();
    const table = screen.getByRole("table", { name: /All ARR Metrics/ });
    const headers = within(table).getAllByRole("rowheader");
    expect(headers.map((header) => header.textContent)).toEqual(["NA", "EU", "Total"]);
  });

  it("adds each metric down the regions", async () => {
    await openMetrics();
    const table = screen.getByRole("table", { name: /All ARR Metrics/ });
    const total = within(table).getAllByRole("row").at(-1)!;
    // Two regions, both opening at 1,000,000.
    expect(within(total).getByText("2,000,000.00")).toBeInTheDocument();
    // Their Closings differ, so this is not the opening read twice.
    expect(within(total).getByText("1,500,000.00")).toBeInTheDocument();
  });

  it("narrows the metrics by the unit the reader selected, which Exit ARR ignores", async () => {
    // This view binds to the unit tabs the screen already carries, rather than
    // keeping a second unit control of its own.
    renderPage("?table=region-summary&unit=BU_APIM");
    await userEvent.click(screen.getByRole("button", { name: "All ARR Metrics" }));
    expect(regionMetrics.askedFilters.at(-1)).toMatchObject({ buProductSelection: "BU_APIM" });
  });

  it("cuts by Sub Region when the reader switches, on the metrics too", async () => {
    await openMetrics();
    await userEvent.click(screen.getByRole("button", { name: "Sub Region" }));
    expect(regionMetrics.askedBySalesRegion.at(-1)).toBe(false);
  });

  it("returns to Sales Region when the view changes", async () => {
    renderPage("?table=region-summary");
    await userEvent.click(screen.getByRole("button", { name: "Sub Region" }));
    expect(regionExit.askedBySalesRegion.at(-1)).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "All ARR Metrics" }));
    expect(regionMetrics.askedBySalesRegion.at(-1)).toBe(true);
  });

  it("keeps both controls on screen when every column failed", async () => {
    regionMetrics.value = {
      columns: [],
      isLoading: false,
      isError: true,
      errorMessage: "Gateway said no.",
      retry: () => {},
    };
    await openMetrics();
    expect(screen.getByText(/Gateway said no/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exit ARR" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sales Region" })).toBeInTheDocument();
  });

  it("says what to do when a custom selection has asked for no units", async () => {
    // `regionMetricsRequests` returns no bodies, so the hook returns no columns
    // — the same state as no columns at all.
    regionMetrics.value = {
      columns: [],
      isLoading: false,
      isError: false,
      errorMessage: "",
      retry: () => {},
    };
    await openMetrics();
    expect(screen.getByText(/Choose units to generate region metrics/)).toBeInTheDocument();
  });

  it("holds the space rather than showing an empty table while it loads", async () => {
    regionMetrics.value = { ...regionMetrics.value, isLoading: true, columns: [] };
    await openMetrics();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});


// `GET /opportunities` belongs here: this table's row dialog is its only caller.
describe("opening the opportunities behind an account", () => {
  /** The first openable figure cell on Northwind's row. */
  const northwindFigure = () => {
    const row = screen.getByText("Northwind Bank").closest("tr")!;
    return within(row).getAllByRole("button")[0];
  };

  /**
   * The Periods this table asks for at its defaults, built the way the page
   * builds them — computed rather than written down, for the reason THIS_YEAR
   * gives.
   */
  const customerColumns = () =>
    inZone("Asia/Colombo", () => {
      const filters = defaultAppliedFilters(
        MIS_PERIODS.ANNUALLY,
        MIS_TABLES.SOFTWARE_CLOUD_CUSTOMERS,
      );
      const columnDateRanges = pacificColumnRanges(
        MIS_PERIODS.ANNUALLY,
        MIS_WINDOWS.CALENDAR,
        filters,
      );
      return customerColumnRanges(MIS_PERIODS.ANNUALLY, MIS_WINDOWS.CALENDAR, {
        ...filters,
        columnDateRanges,
      });
    });

  /**
   * Northwind's first cell under a column header, found the way a screen reader
   * finds it: by the cell's `headers` naming that header. Under a Period that is
   * the first figure; under an identity column, the one fact.
   */
  const northwindCellUnder = (header: string) => {
    const { id } = screen.getByRole("columnheader", { name: header });
    const row = screen.getByText("Northwind Bank").closest("tr")!;
    return within(row)
      .getAllByRole("cell")
      .find((one) => one.getAttribute("headers")?.split(" ").includes(id))!;
  };
  const northwindFigureUnder = (periodLabel: string) =>
    within(northwindCellUnder(periodLabel)).getByRole("button");

  // Two Periods on screen, and each clicked in turn, because with one column
  // "that column's date" and "a column's date" are the same claim — a dialog
  // that always asked as at the newest Period, or the first, would pass. The
  // date is the column's own closing date, not a date scraped back out of the
  // column header.
  it("opens on a figure cell, and asks for that account as at that column", async () => {
    const periods = customerColumns().slice(-2);
    customers.value = {
      ...customerBook([]),
      columns: periods.map((range) => ({
        label: buildColumnLabel(range),
        accounts: [NORTHWIND] as never,
        isError: false,
      })),
    };

    for (const range of periods) {
      cleanup();
      opportunities.asked = null;
      renderPage("?table=customers");
      await userEvent.click(northwindFigureUnder(buildColumnLabel(range)));

      expect(opportunities.asked, `opened under ${buildColumnLabel(range)}`).toEqual({
        accountId: NORTHWIND.id,
        // `yyyy-MM-dd`, the shape the endpoint wants.
        endDate: range.end.replace(/\//g, "-"),
      });
    }
  });

  it("shows the opportunities for the account that was opened", async () => {
    renderPage("?table=customers");
    await userEvent.click(northwindFigure());
    expect(await screen.findByRole("heading", { name: /Opportunities/ })).toBeInTheDocument();
    expect(screen.getByText("Renewal FY26")).toBeInTheDocument();
  });

  // The Total row is a computed footing, not an account, so there are no
  // opportunities behind it. Enforced by its id missing from the account map
  // rather than by a name check — see the comment on `onActivate` — so this
  // pins the behaviour independently of which guard happens to do it.
  it("does not open anything from the Total row", async () => {
    renderPage("?table=customers");
    // Found by the row it heads rather than by the word alone: "Total" is
    // also in the `Software Total` and `Cloud Total` column headers.
    const total = screen
      .getAllByRole("row")
      .find((row) => row.textContent?.trim().startsWith("Total"))!;
    expect(total).toBeDefined();
    expect(within(total).queryAllByRole("button")).toHaveLength(0);
  });

  // Only a figure cell belongs to a Period, so only a figure cell has a date
  // to ask about. Opening an identity cell and scraping a date out of the
  // column header would ask about a date that was never in the cell. Every
  // identity cell is CLICKED, rather
  // than searched for a button, so a handler hung on the row is caught as well
  // as one on the cell.
  it("does not open anything from an identity cell", async () => {
    renderPage("?table=customers");
    // The name heads the row; every other identity column is a fact about it,
    // under its own header. Read off the table's own list, so a column added to
    // it is clicked here too.
    const [, ...facts] = customerLeadColumns("Total ARR");
    const identityCells = [
      screen.getByRole("rowheader", { name: /Northwind Bank/ }),
      ...facts.map((column) => northwindCellUnder(column.label)),
    ];
    // Proof these are the cells meant, not seventeen misses.
    expect(northwindCellUnder("Account ID")).toHaveTextContent(NORTHWIND.id);
    expect(identityCells.every(Boolean)).toBe(true);

    for (const cell of identityCells) await userEvent.click(cell);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opportunities.asked).toBeNull();
  });

  // Nothing is asked until something is opened. The dialog being shut is the
  // ordinary state of this screen.
  it("asks for nothing before anything is opened", () => {
    renderPage("?table=customers");
    expect(screen.getByText("Northwind Bank")).toBeInTheDocument();
    expect(opportunities.asked).toBeNull();
  });
});


// The notice appears and the table
// STILL RENDERS — it is a sentence above one, not a substitute for it. So what
// this pins is both halves, on the real screen rather than on the component.
//
// The notice itself is `BuildTable`'s, because that is the only place the
// table's required width exists. What belongs HERE is that it reaches the real
// Build with a real width, and does NOT appear over the states that have no
// table at all.
describe("the Build on a narrow screen", () => {
  const atWidth = (width: number) => {
    Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  };

  afterEach(() => atWidth(1024));

  it("says nothing on a screen with room for it", () => {
    atWidth(20_000);
    renderPage();
    expect(screen.queryByText(/wider than your screen/i)).not.toBeInTheDocument();
  });

  it("says so on a narrow one, and still draws every figure", () => {
    atWidth(400);
    renderPage();
    expect(screen.getByText(/wider than your screen/i)).toBeInTheDocument();
    // The half that matters most: the figures are all still there, reachable by
    // scrolling. A notice that replaced the table would be Variant C, which is
    // the candidate this decision rejected.
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getAllByText("1,234,567.50").length).toBeGreaterThan(0);
  });

  it("says it once, and on the table that is actually showing", () => {
    atWidth(400);
    renderPage("?table=customers");
    expect(screen.getAllByText(/wider than your screen/i)).toHaveLength(1);
    // Named, not just counted: the old version of this test passed identically
    // on the Subscription table.
    expect(screen.getByRole("table")).toHaveAccessibleName(/Software\/Cloud Customers/);
  });

  // The reason the notice moved into `BuildTable`. Mounted on the page it also
  // appeared above the loading skeleton, the error and the empty state — none
  // of which is a table wider than the screen.
  it("says nothing when the Build failed to load", () => {
    atWidth(400);
    summary.value = {
      columns: [],
      isLoading: false,
      isError: true,
      errorMessage: "Gateway timed out.",
      retry: () => {},
    };
    renderPage();
    expect(screen.getByText(/Gateway timed out/)).toBeInTheDocument();
    expect(screen.queryByText(/wider than your screen/i)).not.toBeInTheDocument();
  });
});
