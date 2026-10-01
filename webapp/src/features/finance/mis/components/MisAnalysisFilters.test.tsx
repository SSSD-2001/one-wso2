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
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MisAnalysisFilters from "./MisAnalysisFilters";
import {
  defaultAnalysisFilters,
  type MisAnalysisFilters as Filters,
} from "../util/misAnalysisFilters";
import { EMPTY_ANALYSIS_MENUS } from "../util/misAnalysisMenus";

// Vitest's 5s default is the wrong one for this file. Every test here mounts a
// real MUI component that is expensive in jsdom — the DataGrid's first mount,
// or an Autocomplete opening its listbox — and under the full suite's
// parallelism those legitimately run past five seconds while taking about two
// on their own. Nothing here waits on a timer or a network, so a timeout is
// always machine load rather than a hang, and a test that fails by luck is
// worse than a slow one. Several of this repo's other grid-heavy suites sit in
// the same place and fail intermittently; this one says so instead.
vi.setConfig({ testTimeout: 20_000 });

// ARR Analysis's ten controls.
//
// Applied at once, with no Apply button, because these filters reach no
// address. The Build's bar
// stages changes because applying one rewrites the query string, and a URL that
// changed on every keystroke would fill the reader's history with views they
// never asked for. Nothing here is in the history, so there is nothing to stage.

const ON = { year: 2026, month: 9, day: 21 };

const MENUS = {
  ...EMPTY_ANALYSIS_MENUS,
  partnerTypes: ["Channel", "Direct"],
  salesRegions: ["APAC", "EMEA"],
  subRegions: ["UK & Ireland"],
  countries: ["Japan", "Sri Lanka"],
};

/** The panel, driving real state, so a change is visible in the next render. */
function showPanel(initial: Partial<Filters> = {}) {
  const seen = vi.fn();
  function Harness() {
    const [filters, setFilters] = useState<Filters>({
      ...defaultAnalysisFilters(ON),
      ...initial,
    });
    return (
      <MisAnalysisFilters
        filters={filters}
        today={ON}
        menus={MENUS}
        menusLoading={false}
        menusErrorMessage=""
        onChange={(next) => {
          seen(next);
          setFilters(next);
        }}
      />
    );
  }
  render(<Harness />);
  return { seen, latest: () => seen.mock.lastCall?.[0] as Filters };
}

/**
 * Focus a tag and press Delete — MUI's own remove gesture for a chip, and the
 * one `MisFilterBar.test.tsx` uses on the Build's chips for the same reason:
 * the CHIP is the labelled button, and the cross inside it is decoration.
 */
async function dismissTag(label: string) {
  screen.getByRole("button", { name: `Remove ${label}` }).focus();
  await userEvent.keyboard("{Delete}");
}

/** Picks `option` out of the multi-select named `label`. */
async function choose(label: string, option: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: label }));
  await user.click(await screen.findByRole("option", { name: option }));
}

describe("narrowing the view", () => {
  it("applies a list choice at once, with no Apply to press", async () => {
    const { latest } = showPanel();
    await choose("Sales Region", "EMEA");
    expect(latest().salesRegions).toEqual(["EMEA"]);
    expect(screen.queryByRole("button", { name: /apply/i })).not.toBeInTheDocument();
  });

  it("applies a partner model", async () => {
    const { latest } = showPanel();
    await userEvent.setup().click(screen.getByRole("button", { name: "Channel" }));
    expect(latest().partnerType).toBe("Channel");
  });

  // Two toggles rather than three segments: pressing the pressed one clears it,
  // which is what makes "neither" reachable without a third button saying
  // "All".
  it("lets First Sale be turned off by pressing it again", async () => {
    const user = userEvent.setup();
    const { latest } = showPanel();
    await user.click(screen.getByRole("button", { name: "Only" }));
    expect(latest().firstSale).toBe("include");
    await user.click(screen.getByRole("button", { name: "Only" }));
    expect(latest().firstSale).toBe("all");
  });
});

// The one pair of Business Units that cannot be asked for together: Moesif's
// ARR is already counted inside the API Platform BU.
describe("Moesif and the API Platform BU", () => {
  it("refuses the pair and says why", async () => {
    const { latest } = showPanel({ businessUnits: ["API Platform"] });
    await choose("Business Units", "Moesif");
    expect(latest()).toBeUndefined();
    expect(screen.getByRole("alert")).toHaveTextContent(/Moesif is already included/i);
  });

  it("refuses it from the other side too", async () => {
    const { latest } = showPanel({ businessUnits: ["Moesif"] });
    await choose("Business Units", "API Platform");
    expect(latest()).toBeUndefined();
  });

  it("allows either on its own", async () => {
    const { latest } = showPanel();
    await choose("Business Units", "Moesif");
    expect(latest().businessUnits).toEqual(["Moesif"]);
  });
});

describe("the product counts that depend on the Business Units", () => {
  it("stops offering a count the chosen Business Units have ruled out", async () => {
    showPanel({ businessUnits: ["IAM", "Choreo"] });
    const counts = screen.getByRole("group", { name: "# Products In Use" });
    expect(within(counts).queryByRole("button", { name: "1" })).not.toBeInTheDocument();
    expect(within(counts).getByRole("button", { name: "2" })).toBeInTheDocument();
  });

  it("drops a count already chosen when a second Business Unit rules it out", async () => {
    const { latest } = showPanel({ businessUnits: ["IAM"], productCounts: [1, 3] });
    await choose("Business Units", "Choreo");
    expect(latest().productCounts).toEqual([3]);
  });
});

// Typing in a number field sets state on every keystroke, and each change here
// is two network reads. Debouncing every filter would delay a deliberate
// click; committing on blur instead means a deliberate change costs one
// read and an in-progress one costs none.
describe("the ARR range", () => {
  it("does not narrow anything until the field is left", async () => {
    const user = userEvent.setup();
    const { seen, latest } = showPanel();
    await user.type(screen.getByLabelText("Minimum ARR"), "50000");
    expect(seen).not.toHaveBeenCalled();
    await user.tab();
    expect(latest().arrRange.lower).toBe(50_000);
  });

  it("commits on Enter, for a reader who does not tab away", async () => {
    const user = userEvent.setup();
    const { latest } = showPanel();
    await user.type(screen.getByLabelText("Maximum ARR"), "1000000{Enter}");
    expect(latest().arrRange.upper).toBe(1_000_000);
  });

  it("reads an emptied field as no boundary rather than as zero", async () => {
    const user = userEvent.setup();
    const { latest } = showPanel({ arrRange: { lower: 50_000, upper: null } });
    await user.clear(screen.getByLabelText("Minimum ARR"));
    await user.tab();
    expect(latest().arrRange.lower).toBeNull();
  });
});

describe("the tags", () => {
  it("shows nothing, and offers no Clear all, on the view the screen opens on", () => {
    showPanel();
    expect(screen.queryByRole("button", { name: /^Remove / })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /clear all/i })).not.toBeInTheDocument();
  });

  it("counts what is actually narrowed", () => {
    showPanel({ salesRegions: ["EMEA", "APAC"], partnerType: "Channel" });
    expect(screen.getByText("3 filters")).toBeInTheDocument();
  });

  it("counts one narrowing in the singular", () => {
    showPanel({ partnerType: "Channel" });
    expect(screen.getByText("1 filter")).toBeInTheDocument();
  });

  it("drops one value of a list without touching the rest", async () => {
    const { latest } = showPanel({ salesRegions: ["EMEA", "APAC"] });
    await dismissTag("Sales Region: EMEA");
    expect(latest().salesRegions).toEqual(["APAC"]);
  });

  // Each end of the range is its own tag, so a reader who set a floor and a
  // ceiling can lift one and keep the other.
  it("lifts one end of the ARR range and leaves the other", async () => {
    const { latest } = showPanel({ arrRange: { lower: 50_000, upper: 1_000_000 } });
    await dismissTag("ARR from $50K");
    expect(latest().arrRange).toEqual({ lower: null, upper: 1_000_000 });
  });

  it("clears everything at once, back to today", async () => {
    const { latest } = showPanel({
      salesRegions: ["EMEA"],
      partnerType: "Channel",
      arrRange: { lower: 1, upper: 2 },
      asOf: { year: 2020, month: 1, day: 1 },
    });
    await userEvent.setup().click(screen.getByRole("button", { name: /clear all/i }));
    expect(latest()).toEqual(defaultAnalysisFilters(ON));
  });
});

describe("As Of Date", () => {
  it("stays empty while it is cleared, and returns to today when the field is left", () => {
    const { latest } = showPanel({ asOf: { year: 2020, month: 1, day: 1 } });
    const field = screen.getByLabelText("As Of Date");
    expect(field).toHaveValue("2020-01-01");

    fireEvent.change(field, { target: { value: "" } });
    expect(field).toHaveValue("");
    expect(latest()).toBeUndefined();

    fireEvent.blur(field);
    expect(latest().asOf).toEqual(ON);
    expect(field).toHaveValue("2026-09-21");
  });

  it("applies a complete date without waiting to leave the field", () => {
    const { latest } = showPanel();
    fireEvent.change(screen.getByLabelText("As Of Date"), { target: { value: "2024-06-01" } });
    expect(latest().asOf).toEqual({ year: 2024, month: 6, day: 1 });
  });
});

describe("when the option lists failed to load", () => {
  it("says so and offers a retry, leaving the written-down controls working", async () => {
    const retry = vi.fn();
    render(
      <MisAnalysisFilters
        filters={defaultAnalysisFilters(ON)}
        today={ON}
        menus={{ ...EMPTY_ANALYSIS_MENUS, partnerTypes: ["Channel", "Direct"] }}
        menusLoading={false}
        menusErrorMessage="Gateway timed out."
        onRetryMenus={retry}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/Gateway timed out/);
    await userEvent.setup().click(screen.getByRole("button", { name: /retry/i }));
    expect(retry).toHaveBeenCalled();
    // Partner Type, First Sale, # Products In Use, Business Units and Lifetime
    // are all written down in this app, so a failed `GET /app-configs` costs
    // three menus rather than the panel.
    expect(screen.getByRole("button", { name: "Channel" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Business Units" })).toBeInTheDocument();
  });
});

describe("collapsing the panel", () => {
  it("puts the controls away and leaves the tags where they are", async () => {
    const user = userEvent.setup();
    showPanel({ salesRegions: ["EMEA"] });
    await user.click(screen.getByRole("button", { name: /collapse/i }));
    expect(screen.queryByRole("combobox", { name: "Sales Region" })).not.toBeInTheDocument();
    expect(screen.getByText("Sales Region: EMEA")).toBeInTheDocument();
  });
});
