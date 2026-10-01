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
import userEvent from "@testing-library/user-event";
import AnalysisPartnerModelChart from "./AnalysisPartnerModelChart";
import { MIS_SCALES, type MisScale } from "../util/misViewVocabulary";
import type { PartnerModelBreakdown } from "../api/useAnalysisBreakdowns";

// Vitest's 5s default is the wrong one for this file: every test mounts a real
// recharts chart, which computes a full SVG layout in jsdom, and under the full
// suite's parallelism that runs past five seconds while taking well under one
// on its own. Nothing here waits on a timer or a network, so a timeout is
// always machine load rather than a hang. The same line is on this repo's
// DataGrid-heavy suites, for the same reason.
vi.setConfig({ testTimeout: 20_000 });

// ARR by partner model. A proportion bar rather than a two-slice pie — see
// the component for why, and note that no figure moves: the amounts are in
// the companion table to the cent.

/** Both models asked about — the ordinary case. */
const BOTH = new Set(["Channel", "Direct"]);

const breakdown = (over: Partial<PartnerModelBreakdown> = {}): PartnerModelBreakdown => ({
  channel: 300,
  direct: 700,
  asked: BOTH,
  isLoading: false,
  isError: false,
  errorMessage: "",
  retry: () => {},
  ...over,
});

function showChart(over: Partial<PartnerModelBreakdown> = {}, scale: MisScale = MIS_SCALES.UNITS) {
  return render(<AnalysisPartnerModelChart breakdown={breakdown(over)} scale={scale} />);
}

const tableRows = () =>
  within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    );

describe("the bar", () => {
  // A row of coloured divs means nothing to a screen reader, so the bar carries
  // the whole split as one label and the table below is the real presentation.
  it("states the whole split in one accessible name", () => {
    showChart();
    expect(screen.getByRole("img")).toHaveAccessibleName("Channel 30%, Direct 70%");
  });

  it("labels each segment directly, so identity is never colour alone", () => {
    showChart();
    expect(screen.getByText("Channel 30%")).toBeInTheDocument();
    expect(screen.getByText("Direct 70%")).toBeInTheDocument();
  });

  // A view narrowed to one model should read "all of it is Direct", not
  // "Direct 100%" beside a segment too thin to see.
  it("shows one segment when one model holds everything", () => {
    showChart({ channel: 0, direct: 1000 });
    expect(screen.getByRole("img")).toHaveAccessibleName("Direct 100%");
    expect(screen.queryByText(/Channel/)).not.toBeInTheDocument();
  });

  // The reader narrowed to Direct, so Channel was never asked about. The
  // absence is a fact here, and Direct really is the whole of this view.
  it("shows one segment when the other model was never asked about", () => {
    showChart({ channel: undefined, direct: 1000, asked: new Set(["Direct"]) });
    expect(screen.getByRole("img")).toHaveAccessibleName("Direct 100%");
  });
});

// The case that matters most: BOTH
// models were asked and one did not answer. `isError` is false — the other read
// succeeded — so nothing upstream flags it, and the obvious rendering is the
// survivor at 100%, which states something about a book half of which never
// answered.
describe("when one model was asked and did not answer", () => {
  it("draws no split, rather than the survivor at 100%", () => {
    showChart({ channel: undefined, direct: 700, isError: false });
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByText(/100%/)).not.toBeInTheDocument();
  });

  // And says which of the nothings it is, WITH a way out. `isError` is false —
  // one read succeeded — so nothing upstream offers a retry, and without this
  // the reader gets a blank card and no reason to think it is retryable.
  it("says the split could not be loaded, and offers a retry", async () => {
    const retry = vi.fn();
    showChart({ channel: undefined, direct: 700, isError: false, retry });
    expect(screen.getByText(/didn't load/i)).toBeInTheDocument();
    expect(screen.queryByText(/No ARR in this view/)).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /retry/i }));
    expect(retry).toHaveBeenCalled();
  });
});

// A partner type that is neither Channel nor Direct — the menu offers whatever
// the loaded accounts report, so this is reachable. There is no Channel/Direct
// split of such a view, and "No ARR in this view" would be false: the account
// table below it is full.
describe("when the reader narrowed to a third partner type", () => {
  it("says the split does not apply, rather than claiming there is no ARR", () => {
    showChart({ channel: undefined, direct: undefined, asked: new Set() });
    expect(screen.getByRole("status")).toHaveTextContent(/don't apply/i);
    expect(screen.queryByText(/No ARR in this view/)).not.toBeInTheDocument();
  });
});

describe("the companion table", () => {
  it("carries the amount and the share for each model", () => {
    showChart();
    expect(tableRows()).toEqual([
      ["Channel", "300.00", "30.00%"],
      ["Direct", "700.00", "70.00%"],
    ]);
  });

  it("writes amounts at the reader's Scale", () => {
    showChart({ channel: 1000, direct: 1000 }, MIS_SCALES.THOUSANDS);
    expect(tableRows()[0]?.[1]).toBe("1.00");
  });

  // Scale reaches currency and nothing else.
  it("leaves a share alone at either Scale", () => {
    showChart({}, MIS_SCALES.THOUSANDS);
    expect(tableRows()[0]?.[2]).toBe("30.00%");
  });
});

describe("the states that are not a split", () => {
  // No ARR is an answer. An empty track would read as a chart that failed.
  it("says there is no ARR rather than drawing an empty track", () => {
    showChart({ channel: 0, direct: 0 });
    expect(screen.getByRole("status")).toHaveTextContent("No ARR in this view.");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  // A share needs both halves, so half a split is not a smaller split — it is a
  // wrong one. Reporting an un-asked model as `0` would draw the other at
  // 100%.
  it("draws nothing when a read failed, rather than a confident 100%", () => {
    // Figures cleared alongside `isError`, because the hook cannot report both.
    // `useColumnQueries.isError` is true only when EVERY column failed, so
    // there are no figures to have in that state — a fixture keeping them is
    // describing something production cannot produce, which is the exact shape
    // that hid the half-failed-read bug.
    showChart({
      channel: undefined,
      direct: undefined,
      isError: true,
      errorMessage: "Gateway timed out.",
      retry: vi.fn(),
    });
    expect(screen.getByText(/Gateway timed out/)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("offers a retry on a failure", () => {
    const retry = vi.fn();
    showChart({
      channel: undefined,
      direct: undefined,
      isError: true,
      errorMessage: "Gateway timed out.",
      retry,
    });
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("shows no figures while the reads are in flight", () => {
    // Same reason: in flight means no figures yet, so the fixture says so.
    showChart({ channel: undefined, direct: undefined, isLoading: true });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
