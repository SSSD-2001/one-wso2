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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router";
import { misPaths } from "@constants/misApps";
import { EMPTY_MIS_FILTER_OPTIONS } from "../api/misAppConfigs";
import { ScalePreferenceProvider } from "../util/ScalePreferenceContext";
import { YearsBackSessionProvider, useYearsBackSession } from "../util/YearsBackSessionContext";
import { filtersAfterSwitch } from "../util/misFilterBarModel";
import { MIS_PERIODS, MIS_TABLES, type MisTable } from "../util/misViewVocabulary";
import { useMisScale } from "../util/useMisScale";
import { useMisViewState } from "../util/useMisViewState";
import MisFilterBar from "./MisFilterBar";

// Driving MUI Autocompletes through userEvent is slow — each click is a full
// pointer-event sequence re-rendered through the Oxygen theme — and the whole
// suite runs 119 files in parallel. The default 5s is enough alone and not
// under that load, which is how a passing file becomes an intermittent red.
// Give each test room under load.
vi.setConfig({ testTimeout: 20_000 });

// The filter bar as a reader uses it.
//
// Rendered against the REAL URL contract rather than a stubbed one, because the
// thing worth proving is exactly the join: change a control, press Apply, and
// the address describes what is on screen. A mocked `useMisViewState` would
// leave that untested and still pass.

const OPTIONS = {
  ...EMPTY_MIS_FILTER_OPTIONS,
  salesRegions: ["APAC", "EMEA"],
  subRegions: ["ANZ"],
  countries: ["Sri Lanka", "United States"],
  industries: ["BFSI", "Utilities"],
  accountOwners: ["Ada Ames"],
  businessUnits: ["APIM_BU", "IAM_BU"],
  productUnits: ["IAM_CLOUD"],
};

/**
 * Forecast mode, which is derived from the type on every hydrate and appears
 * nowhere on screen. Surfaced here so a test can check the derivation actually
 * happened, rather than asserting it against the module that performs it.
 */
function ForecastMode({ mode }: { mode: string }) {
  return <span data-testid="forecast">{mode}</span>;
}

/**
 * The address as it stands, so a test can assert what a reader would copy.
 *
 * A plain span: `<output>` carries an implicit `role="status"`, which would be a
 * second live region beside the bar's own and make either impossible to select.
 */
function Address() {
  const { search } = useLocation();
  return <span data-testid="address">{search}</span>;
}

function Harness({ optionsErrorMessage = "" }: { optionsErrorMessage?: string }) {
  const view = useMisViewState(MIS_PERIODS.ANNUALLY);
  const scale = useMisScale(view);
  const session = useYearsBackSession();
  // Standing in for the Table tabs the page renders above the bar, which is
  // where a switch actually comes from. What it does is the page's own line
  // verbatim; `MisArrBuildPage.test.tsx` pins that the page really does it.
  const switchTo = (table: MisTable) =>
    view.setView({
      table,
      filters: filtersAfterSwitch(view.filters, { period: view.period, table }, session.yearsBack),
    });
  return (
    <>
      <MisFilterBar
        view={view}
        scale={scale}
        options={OPTIONS}
        optionsErrorMessage={optionsErrorMessage}
      />
      <button type="button" onClick={() => switchTo(MIS_TABLES.EXIT_ARR_BY_REGION)}>
        to Region Summary
      </button>
      <Address />
      <ForecastMode mode={view.filters.forecast} />
    </>
  );
}

function renderBar(search = "", props: { optionsErrorMessage?: string } = {}) {
  return render(
    <MemoryRouter initialEntries={[`${misPaths.arrBuild}${search}`]}>
      <ScalePreferenceProvider>
        <YearsBackSessionProvider>
          <Harness {...props} />
        </YearsBackSessionProvider>
      </ScalePreferenceProvider>
    </MemoryRouter>,
  );
}

/** The Table tabs' stand-in; see `Harness`. */
const switchTable = () => userEvent.click(screen.getByRole("button", { name: "to Region Summary" }));

const address = () => screen.getByTestId("address").textContent;
const forecastMode = () => screen.getByTestId("forecast").textContent;
const applyButton = () => screen.getByRole("button", { name: "Apply" });
const expandMore = () => userEvent.click(screen.getByRole("button", { name: "More" }));

/** Open a single-select and choose an option by its label. */
async function pick(control: string, option: string) {
  await userEvent.click(screen.getByLabelText(control));
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

/** Focus a chip and press Delete — MUI's own remove gesture for a chip. */
async function dismissChip(label: string) {
  const chip = screen.getByRole("button", { name: `Remove ${label}` });
  chip.focus();
  await userEvent.keyboard("{Delete}");
}

const chipLabels = () =>
  within(screen.getByRole("list", { name: "Applied filters" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent);

beforeEach(() => {
  localStorage.clear();
});

describe("a bar opened on a link", () => {
  it("shows what the link narrowed, not the defaults", async () => {
    renderBar("?type=Closed+Won+ARR&view=Sales+Region&region=EMEA&channel=Channel&years=3");
    expect(screen.getByLabelText("ARR Type")).toHaveValue("Only Closed Won ARR");
    expect(screen.getByLabelText("View")).toHaveValue("Sales Region");
    expect(screen.getByLabelText("Channel/Direct")).toHaveValue("Channel");
    await expandMore();
    expect(screen.getByLabelText("Years Back")).toHaveValue("3");
  });

  it("starts clean, with nothing to apply", () => {
    renderBar("?type=Closed+Won+ARR&years=3");
    expect(applyButton()).toBeDisabled();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("says in words what it was narrowed by", () => {
    renderBar("?type=Closed+Won+ARR&years=3&channel=Direct");
    expect(chipLabels()).toEqual([
      "Years Back: 3",
      "Type: Only Closed Won ARR",
      "Channel/Direct: Direct",
    ]);
  });
});

describe("changing a filter", () => {
  it("does not touch the address until the reader applies it", async () => {
    renderBar();
    await pick("ARR Type", "Only Closed Won ARR");
    expect(address()).toBe("");
    expect(applyButton()).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("Filters changed — apply to refresh");
  });

  it("puts the whole view in the address on Apply, and reads clean again", async () => {
    renderBar();
    await pick("ARR Type", "Only Closed Won ARR");
    await userEvent.click(applyButton());
    expect(address()).toBe("?type=Closed+Won+ARR");
    expect(applyButton()).toBeDisabled();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("carries a list filter as a readable parameter", async () => {
    renderBar();
    await expandMore();
    await userEvent.click(screen.getByLabelText("Billing Country"));
    await userEvent.click(await screen.findByRole("option", { name: "Sri Lanka" }));
    await userEvent.keyboard("{Escape}");
    await userEvent.click(applyButton());
    expect(address()).toBe("?billingCountry=Sri+Lanka");
  });

  it("takes a default back out of the address rather than pinning it there", async () => {
    renderBar("?type=Closed+Won+ARR");
    await pick("ARR Type", "ARR");
    await userEvent.click(applyButton());
    expect(address()).toBe("");
  });
});

describe("controls that decide whether other controls exist", () => {
  it("offers a region list only for the View that uses it", async () => {
    renderBar();
    expect(screen.queryByLabelText("Sales Region")).not.toBeInTheDocument();
    await pick("View", "Sales Region");
    expect(screen.getByLabelText("Sales Region")).toBeInTheDocument();
    expect(screen.queryByLabelText("Sub Region")).not.toBeInTheDocument();
  });

  it("clears the regions a View no longer uses, so nothing narrows invisibly", async () => {
    renderBar("?view=Sales+Region&region=EMEA");
    expect(screen.getByText("EMEA")).toBeInTheDocument();
    await pick("View", "Global");
    await userEvent.click(applyButton());
    expect(address()).toBe("");
  });

  it("offers Forecast Type for a forecast, and takes Years Back away from it", async () => {
    renderBar();
    await expandMore();
    expect(screen.getByLabelText("Years Back")).toBeInTheDocument();
    await pick("ARR Type", "Forecasted ARR");
    expect(screen.getByLabelText("Forecast Type")).toBeInTheDocument();
    expect(screen.queryByLabelText("Years Back")).not.toBeInTheDocument();
  });

  it("keeps a Confidence only while something is steering by it", async () => {
    renderBar();
    await pick("ARR Type", "Forecasted ARR");
    await pick("Forecast Type", "GM's Commit");
    await userEvent.click(applyButton());
    expect(address()).toBe("?type=Forecasted+ARR&confidence=GM");
    await pick("ARR Type", "Renewal ARR");
    await userEvent.click(applyButton());
    expect(address()).toBe("?type=Renewal+ARR");
  });
});

describe("Scale, Years Back, and what Apply writes", () => {
  // Each of these is implemented in a module with its own tests; these pin
  // them where a reader meets them.
  it("offers Years Back over the whole 1-10 range", async () => {
    renderBar();
    await expandMore();
    await userEvent.click(screen.getByLabelText("Years Back"));
    expect((await screen.findAllByRole("option")).map((option) => option.textContent))
      .toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
  });

  it("starts an Annually Build at 5 years", () => {
    renderBar();
    expect(chipLabels()[0]).toBe("Years Back: 5");
  });

  it("turns forecast mode on for a Forecasted type and off for anything else", async () => {
    // Derived on the way back out of the URL, never set by the bar — so this is
    // the test that the round trip actually performs the derivation.
    renderBar();
    await pick("ARR Type", "Forecasted ARR");
    await userEvent.click(applyButton());
    expect(forecastMode()).toBe("Enable");
    await pick("ARR Type", "Renewal ARR");
    await userEvent.click(applyButton());
    expect(forecastMode()).toBe("Enable");
    await pick("ARR Type", "Only Closed Won ARR");
    await userEvent.click(applyButton());
    expect(forecastMode()).toBe("Disable");
  });

  it("gives back the YTD the reader had when they come home from TTM", async () => {
    // Calendar → TTM resets YTD and remembers what it replaced; the way back
    // restores the reader's choice rather than the default.
    renderBar();
    await expandMore();
    await userEvent.click(screen.getByLabelText("YTD"));
    await userEvent.click(applyButton());
    expect(address()).toBe("?ytd=0");

    await userEvent.click(screen.getByRole("button", { name: "TTM" }));
    expect(address()).toBe("?window=ttm");
    expect(screen.queryByLabelText("YTD")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Annually" }));
    expect(address()).toBe("?ytd=0");
    expect(screen.getByLabelText("YTD")).not.toBeChecked();
    expect(applyButton()).toBeDisabled();
  });
});

describe("the Period control", () => {
  it("switches the Build to a trailing window, and says so in the address", async () => {
    renderBar();
    await userEvent.click(screen.getByRole("button", { name: "TTM" }));
    expect(address()).toBe("?window=ttm");
  });

  it("takes YTD away on a trailing window, which is not a year to a date", async () => {
    renderBar();
    await expandMore();
    expect(screen.getByLabelText("YTD")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "TTM" }));
    // Still expanded: a Window switch changes the view, not how much of the bar
    // the reader asked to see.
    expect(screen.getByRole("button", { name: "Less" })).toBeInTheDocument();
    expect(screen.queryByLabelText("YTD")).not.toBeInTheDocument();
  });

  it("offers Total, Closed Won and Delayed there, and nothing else", async () => {
    renderBar("?window=ttm");
    await userEvent.click(screen.getByLabelText("ARR Type"));
    expect((await screen.findAllByRole("option")).map((option) => option.textContent))
      .toEqual(["ARR", "Only Closed Won ARR", "Only Delayed ARR"]);
  });

  it("carries a Delayed trailing window in the address", async () => {
    renderBar("?window=ttm");
    await pick("ARR Type", "Only Delayed ARR");
    await userEvent.click(applyButton());
    expect(address()).toBe("?window=ttm&type=Delayed+ARR");
  });

  it("coerces a forecast away on the way to TTM, without the reader applying anything", async () => {
    renderBar("?type=Forecasted+ARR");
    await userEvent.click(screen.getByRole("button", { name: "TTM" }));
    expect(screen.getByLabelText("ARR Type")).toHaveValue("ARR");
    expect(applyButton()).toBeDisabled();
  });
});

describe("the controls that do not wait for Apply", () => {
  it("changes the unit at once: a different unit is a different report", async () => {
    renderBar();
    await userEvent.click(screen.getByRole("button", { name: "Software Build" }));
    expect(address()).toBe("?unit=sw-all");
    await userEvent.click(screen.getByRole("button", { name: "API Platform Software" }));
    expect(address()).toBe("?unit=sw-apim");
  });

  it("unlocks the two custom lists, and lets a Build be cut one way only", async () => {
    renderBar();
    await userEvent.click(screen.getByRole("button", { name: "Custom Build" }));
    const businessUnits = screen.getByRole("group", { name: "Business Units" });
    await userEvent.click(within(businessUnits).getByRole("button", { name: "API Platform BU" }));
    expect(address()).toBe("?unit=custom&customBu=APIM_BU");
    // Picking a product unit empties the business units: a Build is cut by one
    // or the other, never both.
    const productUnits = screen.getByRole("group", { name: "Product Units" });
    await userEvent.click(within(productUnits).getByRole("button", { name: "IAM Private Cloud + Asgardeo" }));
    expect(address()).toBe("?unit=custom&customProduct=IAM_CLOUD");
  });

  it("changes the Scale at once, and remembers it for the next screen", async () => {
    renderBar();
    await userEvent.click(screen.getByLabelText("Values in '000"));
    expect(address()).toBe("?scale=k");
    expect(localStorage.getItem("one-wso2.scale")).toContain("thousands");
  });

  it("keeps the Scale out of the filters, so applying one does not drop it", async () => {
    renderBar();
    await userEvent.click(screen.getByLabelText("Values in '000"));
    await pick("ARR Type", "Only Closed Won ARR");
    await userEvent.click(applyButton());
    expect(address()).toBe("?type=Closed+Won+ARR&scale=k");
  });
});

describe("dismissing a chip", () => {
  it("drops that one filter at once, without an Apply", async () => {
    renderBar("?type=Closed+Won+ARR&channel=Direct");
    await dismissChip("Channel/Direct: Direct");
    expect(address()).toBe("?type=Closed+Won+ARR");
    expect(applyButton()).toBeDisabled();
  });

  it("leaves an edit the reader has not applied yet still pending", async () => {
    renderBar("?channel=Direct");
    await pick("ARR Type", "Only Closed Won ARR");
    await dismissChip("Channel/Direct: Direct");
    expect(address()).toBe("");
    expect(screen.getByLabelText("ARR Type")).toHaveValue("Only Closed Won ARR");
    expect(applyButton()).toBeEnabled();
  });

  it("does not offer to remove the Years Back, which every view has", () => {
    renderBar("?years=3");
    expect(screen.queryByRole("button", { name: /Remove Years Back/ })).not.toBeInTheDocument();
    expect(chipLabels()).toContain("Years Back: 3");
  });
});

describe("Clear All", () => {
  it("empties the address of everything the bar owns", async () => {
    renderBar("?type=Closed+Won+ARR&view=Sales+Region&region=EMEA&years=3");
    await userEvent.click(screen.getByRole("button", { name: "Clear All" }));
    expect(address()).toBe("");
    expect(applyButton()).toBeDisabled();
  });

  it("leaves the unit alone, because clearing filters is not changing report", async () => {
    renderBar("?unit=sw-apim&type=Closed+Won+ARR");
    await userEvent.click(screen.getByRole("button", { name: "Clear All" }));
    expect(address()).toBe("?unit=sw-apim");
  });
});

describe("when the option lists could not be fetched", () => {
  it("says so and leaves every written-down control working", async () => {
    renderBar("", { optionsErrorMessage: "Gateway timed out." });
    expect(screen.getByText(/couldn't load the filter lists/i)).toBeInTheDocument();
    await pick("ARR Type", "Only Closed Won ARR");
    await userEvent.click(applyButton());
    expect(address()).toBe("?type=Closed+Won+ARR");
  });
});

describe("a Table that does not offer every filter", () => {
  // These stay on screen, greyed out, rather than disappearing, so that nothing
  // disappears silently between Tables. The tooltip goes on a wrapping span,
  // because a disabled input fires no pointer events and would show none.

  /** The span the tooltip is attached to, which is what a reader hovers. */
  const wrapper = (label: string) => screen.getByLabelText(label).closest("span");

  it("greys out the filters Customers does not offer, and says which Table took them", () => {
    renderBar("?table=customers");
    expect(screen.getByLabelText("Industry")).toBeDisabled();
    expect(wrapper("Industry")).toHaveAttribute("title", "Not available for Customers");
    expect(screen.getByLabelText("View")).toBeDisabled();
    // The filters it does offer are untouched.
    expect(screen.getByLabelText("ARR Type")).toBeEnabled();
  });

  it("shows the reason on hover, which a disabled control alone could not", async () => {
    renderBar("?table=customers");
    await userEvent.hover(wrapper("Industry") as HTMLElement);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Not available for Customers");
  });

  it("puts the reason where a keyboard reaches it, which a disabled control does not", async () => {
    // The other half of the same affordance: the span takes focus (`tabIndex`)
    // so a reader who never hovers still gets the reason, as its description.
    // The popper itself is not asserted here — MUI opens it only for a focus
    // jsdom will call `:focus-visible`, which it stops doing for the rest of a
    // file once anything has hovered, so the assertion would pass or fail on
    // test order. What is pinned is what a screen reader reads out.
    renderBar("?table=customers");
    const industry = wrapper("Industry") as HTMLElement;
    for (let i = 0; i < 40 && document.activeElement !== industry; i += 1) await userEvent.tab();
    expect(document.activeElement).toBe(industry);
    expect(industry).toHaveAccessibleDescription("Not available for Customers");
  });

  it("leaves the summaries the Channel/Direct that Customers does not have", () => {
    renderBar("?table=region-summary");
    expect(screen.getByLabelText("Channel/Direct")).toBeEnabled();
    expect(screen.getByLabelText("Industry")).toBeDisabled();
    expect(wrapper("Industry")).toHaveAttribute("title", "Not available for Region Summary");
  });

  it("greys nothing out on the Build, which offers every filter", async () => {
    renderBar();
    await expandMore();
    for (const label of ["View", "Industry", "Channel/Direct", "Account Owner"]) {
      expect(screen.getByLabelText(label)).toBeEnabled();
    }
  });
});

describe("the Years Back a session carries", () => {
  it("carries a Years Back the reader applied on to the next Table", async () => {
    renderBar();
    await expandMore();
    await pick("Years Back", "3");
    await userEvent.click(applyButton());
    await switchTable();
    // Region Summary starts at 2 of its own accord — this is the reader's 3.
    expect(address()).toBe("?table=region-summary&years=3");
    // Still expanded: a switch resets the filters, not how much of the bar the
    // reader has open.
    expect(screen.getByLabelText("Years Back")).toHaveValue("3");
  });

  it("adopts a Years Back the link carried, so a shared view survives a switch", async () => {
    renderBar("?years=7");
    await switchTable();
    expect(address()).toBe("?table=region-summary&years=7");
  });

  it("lets the new Table answer when the reader never chose", async () => {
    renderBar("?type=Closed+Won+ARR");
    await switchTable();
    expect(address()).toBe("?table=region-summary");
    await expandMore();
    expect(screen.getByLabelText("Years Back")).toHaveValue("2");
  });

  it("forgets one that is only the Table's own default", async () => {
    renderBar("?years=3");
    await expandMore();
    await pick("Years Back", "5");
    await userEvent.click(applyButton());
    await switchTable();
    expect(address()).toBe("?table=region-summary");
  });

  it("forgets it on Clear All", async () => {
    renderBar("?years=3");
    await userEvent.click(screen.getByRole("button", { name: "Clear All" }));
    await switchTable();
    expect(address()).toBe("?table=region-summary");
  });
});

describe("what the bar says about a switch that dropped filters", () => {
  it("names the Table it reset to", async () => {
    renderBar("?view=Sales+Region&region=EMEA");
    await switchTable();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Filters reset to the Region Summary defaults",
    );
    expect(address()).toBe("?table=region-summary");
  });

  it("says so for a filter the reader applied on THIS screen, not only one the link carried", async () => {
    // The bar cannot read the Applied set to answer this: the switch replaced it
    // in the same navigation. It reads the controls, which are still the ones
    // about to be thrown away.
    renderBar();
    await pick("Channel/Direct", "Channel");
    await userEvent.click(applyButton());
    await switchTable();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Filters reset to the Region Summary defaults",
    );
  });

  it("says so for an edit the reader never applied, because that is lost too", async () => {
    renderBar();
    await pick("Channel/Direct", "Channel");
    expect(applyButton()).toBeEnabled();
    await switchTable();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Filters reset to the Region Summary defaults",
    );
  });

  it("says nothing when the reader had chosen nothing to lose", async () => {
    renderBar();
    await switchTable();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("drops the notice once the reader applies filters again", async () => {
    renderBar("?channel=Channel");
    await switchTable();
    expect(screen.getByRole("status")).toHaveTextContent(/reset/);
    await pick("ARR Type", "Only Closed Won ARR");
    // A pending change takes the line first — the bar has one line to say
    // something in, and what the reader is about to do outranks what is done.
    expect(screen.getByRole("status")).toHaveTextContent("Filters changed — apply to refresh");
    await userEvent.click(applyButton());
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});

describe("a Customers type that drags Years Back with it", () => {
  // The URL contract already drops a Customers + Delayed view to one
  // year; the control has to reach the same value, or the bar and the address
  // disagree about what is on screen.

  it("goes quiet after Apply rather than staying dirty forever", async () => {
    renderBar("?table=customers");
    await pick("ARR Type", "Only Delayed ARR");
    await userEvent.click(applyButton());
    expect(address()).toBe("?table=customers&years=1&type=Delayed+ARR");
    expect(applyButton()).toBeDisabled();
  });

  it("records the year it pinned as the session's, so the next Table starts there", async () => {
    renderBar("?table=customers");
    await pick("ARR Type", "Only Delayed ARR");
    await userEvent.click(applyButton());
    await switchTable();
    expect(address()).toBe("?table=region-summary&years=1");
  });

  it("leaves alone a Years Back the link carried", async () => {
    // A value the reader arrived with is theirs; only a type they CHANGE re-pins.
    renderBar("?table=customers&type=Delayed+ARR&years=3");
    expect(applyButton()).toBeDisabled();
  });
});

describe("coming back to a Build mid-session", () => {
  // The whole point of holding Years Back outside the screen. `MisSession` is
  // the layout route that does it in the app; here the provider wraps the routes
  // for the same reason — inside the screen it would be remade on every
  // navigation and would remember nothing.

  const renderMisRoutes = (search = "") =>
    render(
      <MemoryRouter initialEntries={[`${misPaths.arrBuild}${search}`]}>
        <ScalePreferenceProvider>
          <YearsBackSessionProvider>
            <Routes>
              <Route
                path={misPaths.arrBuild}
                element={
                  <>
                    <Harness />
                    <Link to={misPaths.analysis}>to ARR Analysis</Link>
                  </>
                }
              />
              <Route
                path={misPaths.analysis}
                element={
                  <>
                    <Link to={misPaths.arrBuild}>back to the Build</Link>
                    <Link to={`${misPaths.arrBuild}?table=customers`}>back to Customers</Link>
                  </>
                }
              />
            </Routes>
          </YearsBackSessionProvider>
        </ScalePreferenceProvider>
      </MemoryRouter>,
    );

  const leaveAndReturn = async () => {
    await userEvent.click(screen.getByRole("link", { name: "to ARR Analysis" }));
    await userEvent.click(screen.getByRole("link", { name: "back to the Build" }));
  };

  it("opens on the Years Back the reader was working in, not the Table's default", async () => {
    // The session value goes on the grid when the link carried no view. Here
    // that means putting it in the address, which is where this app keeps what
    // is on screen.
    renderMisRoutes("?years=3");
    await leaveAndReturn();
    await waitFor(() => expect(address()).toBe("?years=3"));
    await expandMore();
    expect(screen.getByLabelText("Years Back")).toHaveValue("3");
  });

  it("lets a link carrying any view answer for itself, session or no session", async () => {
    // Not "no `years` in the address" but "no view in it at all": any Table,
    // filter or TTM window is a view. So a bookmark to a Table opens on that
    // Table's own Years Back even mid-session, and only the session keeps the
    // reader's.
    renderMisRoutes("?years=3");
    await userEvent.click(screen.getByRole("link", { name: "to ARR Analysis" }));
    await userEvent.click(screen.getByRole("link", { name: "back to Customers" }));
    expect(address()).toBe("?table=customers");
    await expandMore();
    expect(screen.getByLabelText("Years Back")).toHaveValue("5");
  });

  it("lets the Table answer when the reader had set nothing", async () => {
    renderMisRoutes();
    await leaveAndReturn();
    expect(address()).toBe("");
    await expandMore();
    expect(screen.getByLabelText("Years Back")).toHaveValue("5");
  });
});
