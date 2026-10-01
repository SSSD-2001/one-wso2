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

import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import AnalysisIndustryChart from "./AnalysisIndustryChart";
import { ANALYSIS_INDUSTRIES } from "./analysisBreakdowns";
import { MIS_SCALES, type MisScale } from "../util/misViewVocabulary";
import type { IndustryBreakdown } from "../api/useAnalysisBreakdowns";

// Vitest's 5s default is the wrong one for this file: every test mounts a real
// recharts chart, which computes a full SVG layout in jsdom, and under the full
// suite's parallelism that runs past five seconds while taking well under one
// on its own. Nothing here waits on a timer or a network, so a timeout is
// always machine load rather than a hang. The same line is on this repo's
// DataGrid-heavy suites, for the same reason.
vi.setConfig({ testTimeout: 20_000 });

// ARR by industry: the bars, and the companion table that carries the figures.
//
// ---- why the container is mocked -------------------------------------------
//
// Recharts sizes itself from its parent, and jsdom gives every element a
// zero-height, zero-width box — so `ResponsiveContainer` renders NOTHING here
// and every assertion about a bar would pass vacuously against an empty SVG.
// Replacing it with a fixed box is the only way to see the marks at all. This
// is the first charted screen in the repo, so there is no precedent to follow;
// it becomes one.
//
// What is NOT mocked is everything else — the real `BarChart`, the real
// `industrySeries`, the real formatter — so what these assert is what recharts
// actually draws from the data this screen gives it.
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <actual.ResponsiveContainer width={800} height={300}>
        {children as never}
      </actual.ResponsiveContainer>
    ),
  };
});

const breakdown = (over: Partial<IndustryBreakdown> = {}): IndustryBreakdown => ({
  // A figure for every industry asked about, which is what the backend sends —
  // zero included. An asked industry with NO figure means the read failed, and
  // that is a separate case with its own tests.
  byIndustry: Object.fromEntries(ANALYSIS_INDUSTRIES.map((industry) => [industry, 1000])),
  asked: new Set(ANALYSIS_INDUSTRIES),
  isLoading: false,
  isError: false,
  errorMessage: "",
  retry: () => {},
  ...over,
});

/**
 * `totalArr` has a real `undefined` case — the summary read having failed — so
 * it cannot carry a DEFAULT of any kind. `undefined` is exactly what triggers
 * one, positionally and when destructuring alike, so both of the obvious
 * spellings silently ran the "no total" case WITH a total:
 *
 *     function showChart(over = {}, totalArr = 10_000)   // showChart({}, undefined)
 *     function showChart({ totalArr = 10_000 })          // showChart({ totalArr: undefined })
 *
 * Reading the key off the object is the version that can tell "not passed" from
 * "passed as undefined".
 */
function showChart(
  options: {
    breakdown?: Partial<IndustryBreakdown>;
    totalArr?: number;
    scale?: MisScale;
  } = {},
) {
  const { breakdown: over = {}, scale = MIS_SCALES.UNITS } = options;
  const totalArr = "totalArr" in options ? options.totalArr : 10_000;
  return render(
    <AnalysisIndustryChart breakdown={breakdown(over)} totalArr={totalArr} scale={scale} />,
  );
}

/** Every industry answering, which is the ordinary case. */
const allAnswering = Object.fromEntries(
  ANALYSIS_INDUSTRIES.map((industry) => [industry, 1000]),
);

/** The companion table's rows, as `[industry, amount, share]`. */
const tableRows = () =>
  within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    );

describe("the bars", () => {
  it("draws one per industry that has a figure, plus Other", () => {
    const { container } = showChart();
    // Seven: the six named industries and Other.
    expect(container.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(7);
  });

  it("names every industry on the category axis", () => {
    showChart();
    for (const industry of ANALYSIS_INDUSTRIES) {
      // Long names read left to right on a horizontal chart — which is the
      // reason for turning it.
      expect(screen.getAllByText(industry).length).toBeGreaterThan(0);
    }
  });

  // THE assertion this chart exists for. An industry the backend never offered
  // was never asked about, so there is no figure — and a zero bar would state
  // that it holds no ARR.
  it("draws no bar for an industry that was never asked about", () => {
    const { container } = showChart({
      breakdown: { asked: new Set(["Information"]), byIndustry: { Information: 400 } },
    });
    expect(container.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(1);
  });

  it("says which industries were left out, rather than leaving a silent gap", () => {
    showChart({
      breakdown: { asked: new Set(["Information"]), byIndustry: { Information: 400 } },
    });
    const notice = screen.getByText(/Not reported by this tenant/);
    expect(notice).toHaveTextContent("Utilities");
    expect(notice).toHaveTextContent(/left out rather than shown as zero/);
  });

  it("says nothing of the kind when every industry answered", () => {
    showChart();
    expect(screen.queryByText(/Not reported by this tenant/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Didn't load/)).not.toBeInTheDocument();
  });

  // The third state. This industry WAS asked about and its read fell over, so
  // a zero bar would be the same false claim by a different route — and the
  // reader is owed a different sentence than "this tenant doesn't track it".
  it("draws no bar for an industry whose read failed, and says which", () => {
    const { container } = showChart({
      breakdown: {
        byIndustry: { ...allAnswering, Utilities: undefined },
      },
    });
    expect(container.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(5);
    expect(screen.getByText(/Didn't load/)).toHaveTextContent("Utilities");
    expect(screen.queryByText(/Not reported by this tenant/)).not.toBeInTheDocument();
  });

  // Other is the total less the six, so a six missing one of its members would
  // hand that member's ARR to Other and overstate it.
  it("withholds Other when an asked industry did not answer", () => {
    showChart({ breakdown: { byIndustry: { ...allAnswering, Utilities: undefined } } });
    const industries = tableRows().map(([industry]) => industry);
    expect(industries).not.toContain("Other");
  });
});

describe("the companion table", () => {
  it("carries every industry, including the ones with no bar", () => {
    showChart({
      breakdown: { asked: new Set(["Information"]), byIndustry: { Information: 400 } },
    });
    const industries = tableRows().map(([industry]) => industry);
    expect(industries).toEqual([...ANALYSIS_INDUSTRIES]);
  });

  // An em dash, not a zero. The table is where a reader checks a figure, so it
  // is the last place to state one nobody asked for.
  it("writes an em dash where nothing was asked, not a zero", () => {
    showChart({
      breakdown: { asked: new Set(["Information"]), byIndustry: { Information: 400 } },
    });
    const utilities = tableRows().find(([industry]) => industry === "Utilities");
    expect(utilities?.[1]).toBe("—");
    expect(utilities?.[2]).toBe("—");
  });

  it("writes amounts at the reader's Scale", () => {
    showChart({ scale: MIS_SCALES.THOUSANDS });
    const information = tableRows().find(([industry]) => industry === "Information");
    // 1,000 at thousands is 1.00.
    expect(information?.[1]).toBe("1.00");
  });

  // A share is a percentage, and Scale reaches currency alone.
  it("leaves a share alone at either Scale", () => {
    // Unmounted between the two, rather than reaching into the DOM to delete
    // the first table — a second `render` shares the container, so without this
    // `getByRole("table")` would find two and throw.
    const units = showChart({ scale: MIS_SCALES.UNITS });
    const atUnits = tableRows().find(([industry]) => industry === "Information")?.[2];
    units.unmount();

    showChart({ scale: MIS_SCALES.THOUSANDS });
    const atThousands = tableRows().find(([industry]) => industry === "Information")?.[2];
    expect(atThousands).toBe(atUnits);
    expect(atUnits).toBe("10.00%");
  });

  // Other is the total less the six, so it needs the summary read. Without it
  // there is no whole to take a share of and no tail to name.
  it("has no Other, and no shares, when the total never arrived", () => {
    showChart({ totalArr: undefined });
    const industries = tableRows().map(([industry]) => industry);
    expect(industries).not.toContain("Other");
    expect(tableRows().every(([, , share]) => share === "—")).toBe(true);
  });
});

describe("the states that are not a chart", () => {
  it("says so, with a retry, when the reads failed", () => {
    const retry = vi.fn();
    showChart({ breakdown: { isError: true, errorMessage: "Gateway timed out.", retry } });
    expect(screen.getByText(/Gateway timed out/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("holds its height while loading, rather than collapsing and jumping", () => {
    const { container } = showChart({ breakdown: { isLoading: true } });
    expect(container.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(0);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  // No ARR in this view is an ANSWER. An empty plot area would read as a chart
  // that failed to draw.
  it("says there is nothing to show rather than drawing an empty chart", () => {
    showChart({ breakdown: { byIndustry: {}, asked: new Set() }, totalArr: undefined });
    expect(screen.getByRole("status")).toHaveTextContent(/No industry figures/);
  });

  // Reachable by over-narrowing — an ARR Range no account falls in, say. Every
  // industry answers zero, which drew seven flat bars and a table of zeros: a
  // chart that looks broken rather than one saying the view is empty. The
  // partner chart beside it already says so, and the two should not disagree
  // about what an empty view looks like.
  it("says so when every industry answered zero, rather than drawing flat bars", () => {
    const { container } = showChart({
      breakdown: { byIndustry: Object.fromEntries(ANALYSIS_INDUSTRIES.map((i) => [i, 0])) },
      totalArr: 0,
    });
    expect(container.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent(/No industry figures/);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
