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
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BuildTable, { type BuildCellFor } from "./BuildTable";
import {
  ROW_WINDOW_THRESHOLD,
  type BuildColumnGroup,
  type BuildRow,
  type BuildSubColumn,
} from "./buildTableModel";

// This table is hand-rolled rather than a data grid, and
// that obliges four mechanisms MUI declines to provide, which this repo now owns
// forever. Each one is invisible when it works and each one breaks silently —
// a header row that covers the labels it belongs to, a highlight that stops at
// the frozen column, a figure a screen reader cannot place. So each is tested
// as the mechanism it is, not as a screenshot.
//
// What jsdom will and will not answer, established rather than assumed:
// `getComputedStyle` DOES resolve emotion's plain declarations here, so sticky,
// offsets and colours are assertable against the real render. It does NOT match
// `:hover`, so that one rule is read out of the generated stylesheet instead —
// which is still the rendered artefact, not a constant standing in for it.
// (`financeGridSx.test.ts` records the same jsdom limit for `:focus`.)

// The same raise the many-rows block below argues for, applied to the whole
// file: a render here costs ~540ms in jsdom whatever the fixture size, so under
// the suite's parallelism the ordinary tests also land close enough to vitest's
// 5s default to pass alone and fail under load. The repo's other table-mounting
// suites carry this line for the same reason.
vi.setConfig({ testTimeout: 20_000 });

const SUB_COLUMNS: BuildSubColumn[] = [
  { key: "amount", label: "Amount", width: 104 },
  { key: "pct", label: "% Open", width: 68 },
];
const ROW_LABEL_WIDTH = 288;

const periodsOf = (count: number): BuildColumnGroup[] =>
  Array.from({ length: count }, (_, i) => ({ key: `fy${2020 + i}`, label: `FY${2020 + i}` }));

/** Opening, one movement three levels deep, Closing — a Build in miniature. */
const ROWS: BuildRow[] = [
  { id: "opening", label: "Opening ARR", emphasis: true },
  {
    id: "new",
    label: "New",
    children: [
      {
        id: "new-apim",
        label: "APIM",
        children: [{ id: "new-apim-northwind", label: "Northwind Bank" }],
      },
    ],
  },
  { id: "lost", label: "Lost", children: [{ id: "lost-iam", label: "IAM" }] },
  { id: "closing", label: "Ending ARR", emphasis: true, ruleAbove: true },
];

/** Every figure says where it came from, so a misplaced cell is visible. */
const cell: BuildCellFor = (row, group, subColumn) => ({
  text: `${row.id}/${group.key}/${subColumn.key}`,
  negative: row.id === "lost",
  muted: subColumn.key === "pct",
});

function renderTable(periodCount = 5, rows: BuildRow[] = ROWS, expanded?: readonly string[]) {
  return render(
    <BuildTable
      label="ARR Build"
      rowLabelHeader="Movement"
      columnGroups={periodsOf(periodCount)}
      subColumns={SUB_COLUMNS}
      rows={rows}
      cell={cell}
      defaultExpandedIds={expanded}
    />,
  );
}

const headerRows = () => Array.from(document.querySelectorAll("thead tr"));
const bodyRows = () => Array.from(document.querySelectorAll("tbody tr"));
const cellsOf = (row: Element) => Array.from(row.querySelectorAll("th, td"));

/** The CSS emotion actually generated for an element's classes. */
function cssRulesFor(element: Element): string[] {
  const classes = Array.from(element.classList).filter(Boolean);
  const out: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      const text = rule.cssText ?? "";
      if (classes.some((one) => text.includes(`.${one}`))) out.push(text);
    }
  }
  return out;
}

/** The rules painting a row's cells at rest, or under the pointer. */
const rowCellRules = (row: Element, hovered: boolean) =>
  cssRulesFor(row)
    .map((rule) => rule.replace(/\s*>\s*/g, ">"))
    .filter((rule) =>
      hovered ? /:hover>(th|td)/.test(rule) : />(th|td)/.test(rule) && !rule.includes(":hover"),
    );

const gradientLayers = (css: string) => (css.match(/linear-gradient/g) ?? []).length;

const rowLabelled = (label: string) =>
  bodyRows().find((row) => row.textContent?.includes(label))!;

// The two header rows have no height under jsdom, which is the one thing the
// offset mechanism cannot be tested without. Heights are supplied here and
// changed mid-test, which is what a resize or a zoom does to it.
let measuredHeaderHeight = 30;
const realGetBoundingClientRect = HTMLTableRowElement.prototype.getBoundingClientRect;

beforeEach(() => {
  // Wide enough that the narrow-viewport notice stays out of the way. It is
  // rendered by this component and is a real focusable element
  // above the table, so at jsdom's default 1024 it would sit in front of every
  // keyboard assertion below — which is about the TABLE, not about the notice.
  // The notice has its own tests, and one here for the fact it is mounted.
  Object.defineProperty(window, "innerWidth", { value: 20_000, configurable: true });
  measuredHeaderHeight = 30;
  HTMLTableRowElement.prototype.getBoundingClientRect = function measured() {
    return { ...new DOMRect(0, 0, 800, measuredHeaderHeight), height: measuredHeaderHeight } as DOMRect;
  };
});

afterEach(() => {
  Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
  HTMLTableRowElement.prototype.getBoundingClientRect = realGetBoundingClientRect;
});

describe("the shape of the table", () => {
  // Five Annual Periods is the default view, twelve is the Monthly
  // Build — 24 numeric columns, which is where a layout that merely looks fine
  // at five stops being fine.
  it.each([5, 8, 12])("renders %i Periods without the layout collapsing", (periodCount) => {
    renderTable(periodCount);
    const [periodRow, subRow] = headerRows();

    // One row-label cell spanning both header rows, then one cell per Period.
    expect(cellsOf(periodRow)).toHaveLength(1 + periodCount);
    expect(cellsOf(periodRow)[0]).toHaveAttribute("rowspan", "2");
    expect(cellsOf(periodRow)[1]).toHaveAttribute("colspan", String(SUB_COLUMNS.length));
    // The sub-header repeats under every Period and has no label column of its own.
    expect(cellsOf(subRow)).toHaveLength(periodCount * SUB_COLUMNS.length);
    for (const row of bodyRows()) {
      expect(cellsOf(row)).toHaveLength(1 + periodCount * SUB_COLUMNS.length);
    }
  });

  // The explicit minimum is what makes two dozen columns keep their width and
  // the container scroll, rather than every column squeezing to illegible.
  it.each([5, 8, 12])("asks for the width %i Periods actually need", (periodCount) => {
    renderTable(periodCount);
    const table = screen.getByRole("table", { name: "ARR Build" });
    const groupWidth = SUB_COLUMNS.reduce((total, column) => total + column.width, 0);
    expect(table.style.minWidth).toBe(`${ROW_LABEL_WIDTH + periodCount * groupWidth}px`);
  });

  it("scrolls the table rather than the page", () => {
    renderTable(12);
    const scroller = screen.getByRole("table").parentElement!;
    expect(getComputedStyle(scroller).overflow).toBe("auto");
  });
});

describe("the row-label column, while the Periods scroll past it", () => {
  // "Readable when scrolled fully right" is two
  // things: the column is pinned, and it is OPAQUE. A translucent pinned cell
  // lets the columns moving behind it show through, and the frozen pane reads
  // as a smear across the figures rather than as a pane.
  it("is pinned to the left edge", () => {
    renderTable(12);
    const label = cellsOf(bodyRows()[0])[0];
    const style = getComputedStyle(label);
    expect(style.position).toBe("sticky");
    expect(style.left).toBe("0px");
  });

  it("is opaque, so the columns moving behind it do not show through", () => {
    renderTable(12);
    for (const row of bodyRows()) {
      // rgb(), never rgba() with an alpha below 1.
      expect(getComputedStyle(cellsOf(row)[0]).backgroundColor).toMatch(/^rgb\(/);
    }
  });

  it("outranks the figures it scrolls over, and yields to the header it scrolls under", () => {
    renderTable(5);
    const labelZ = Number(getComputedStyle(cellsOf(bodyRows()[0])[0]).zIndex);
    const periodHeaderZ = Number(getComputedStyle(cellsOf(headerRows()[0])[1]).zIndex);
    const cornerZ = Number(getComputedStyle(cellsOf(headerRows()[0])[0]).zIndex);
    expect(labelZ).toBeGreaterThan(0);
    expect(periodHeaderZ).toBeGreaterThan(labelZ);
    // Sticky on both axes, so it has to beat both.
    expect(cornerZ).toBeGreaterThan(periodHeaderZ);
  });

  it("holds its width so a long customer name ellipsises instead of widening the column", () => {
    renderTable(5);
    const label = cellsOf(bodyRows()[0])[0] as HTMLElement;
    expect(label.style.width).toBe(`${ROW_LABEL_WIDTH}px`);
    expect(label.style.maxWidth).toBe(`${ROW_LABEL_WIDTH}px`);
  });
});

describe("the second header row's offset", () => {
  // MUI's stickyHeader pins EVERY header cell to top: 0 — verified
  // in @mui/material 7.3.4, TableCell.js:145-151 — so without a measured offset
  // the sub-header lands on top of the Period labels and covers the very thing
  // that says which Period a column belongs to.
  it("holds the sub-header below the Period row rather than on top of it", () => {
    renderTable(5);
    for (const headerCell of cellsOf(headerRows()[0])) {
      expect((headerCell as HTMLElement).style.top).toBe("");
    }
    for (const headerCell of cellsOf(headerRows()[1])) {
      expect((headerCell as HTMLElement).style.top).toBe("30px");
    }
  });

  it("follows the Period row changing height, which is what a resize does to it", () => {
    renderTable(5);
    measuredHeaderHeight = 52;
    act(() => window.dispatchEvent(new Event("resize")));
    for (const headerCell of cellsOf(headerRows()[1])) {
      expect((headerCell as HTMLElement).style.top).toBe("52px");
    }
  });

  // At any zoom other than 100% the true height is fractional. Rounding it
  // leaves either a hairline of the row above showing through, or an overlap
  // that eats the descenders — so the measurement is used as measured.
  it("keeps the fraction a zoomed browser reports", () => {
    renderTable(5);
    measuredHeaderHeight = 41.6;
    act(() => window.dispatchEvent(new Event("resize")));
    expect((cellsOf(headerRows()[1])[0] as HTMLElement).style.top).toBe("41.6px");
  });

  it("stops measuring once the table is gone", () => {
    const { unmount } = renderTable(5);
    const removeListener = vi.spyOn(window, "removeEventListener");
    unmount();
    expect(removeListener).toHaveBeenCalledWith("resize", expect.any(Function));
    removeListener.mockRestore();
  });
});

describe("the row under the pointer", () => {
  // `<TableRow hover>` cannot do this: it tints the <tr>, which
  // sits BEHIND the pinned cell's own opaque background, so the highlight runs
  // across the scrolling figures and stops dead at the row label — the one cell
  // saying which row is highlighted. jsdom cannot match :hover, so the rule
  // emotion generated is read instead.
  it("is highlighted per cell, reaching the pinned label as well as the figures", () => {
    renderTable(5);
    // An ordinary movement row, not a balance row: a balance row already rests
    // on a tint, so sampling one would prove the selector exists without
    // proving anything changes.
    const selectors = rowCellRules(rowLabelled("New"), true).join(" ");
    // The row label is a <th scope="row">, so a rule reaching only <td> would
    // leave out exactly the cell this exists for.
    expect(selectors).toContain(":hover>th");
    expect(selectors).toContain(":hover>td");
  });

  it("paints the highlight opaquely, so it survives on the pinned cell", () => {
    renderTable(5);
    const rule = rowCellRules(rowLabelled("New"), true).join(" ");
    // A translucent background-color alone would let the scrolling columns show
    // through the pinned cell. The tint is composited inside the cell instead.
    expect(rule).toContain("background-image");
    expect(rule).toContain("linear-gradient");
  });

  // A balance row already rests on the hover tint, so highlighting it with that
  // same tint repaints the identical colour and nothing happens — the pointer
  // crosses the Closing balance, the row a Build exists to land on, and the
  // screen does not move. The prototype hit this and called it "fine"; on a
  // table two dozen columns wide it is not.
  it("still deepens a row that already rests on a tint", () => {
    renderTable(5);
    const closing = rowLabelled("Ending ARR");
    const resting = gradientLayers(rowCellRules(closing, false).join(" "));
    const hovered = gradientLayers(rowCellRules(closing, true).join(" "));
    expect(resting).toBeGreaterThan(0);
    expect(hovered).toBeGreaterThan(resting);
  });

  // MUI's own row highlight is `.MuiTableRow-hover:hover { background-color:
  // rgba(0,0,0,0.04) }` — a translucent fill on the <tr>, which is exactly the
  // mechanism that stops at the opaque frozen column. It ships in the same generated
  // sheet; what matters is that no row ever wears the class that turns it on.
  it("does not use MUI's own row hover, which is the mechanism that fails here", () => {
    renderTable(5);
    for (const row of bodyRows()) {
      expect(row.className).not.toContain("MuiTableRow-hover");
    }
  });
});

describe("borders", () => {
  // stickyHeader forces border-collapse: separate, under which the collapsed
  // shorthand does nothing at all. Every border here is placed on a cell.
  it("are placed per cell, because the table cannot place them", () => {
    renderTable(5);
    const table = screen.getByRole("table");
    expect(getComputedStyle(table).borderCollapse).toBe("separate");
    expect(getComputedStyle(cellsOf(bodyRows()[0])[1]).borderBottomWidth).not.toBe("");
  });

  it("separates one Period from the next, but not the first from the pinned column", () => {
    renderTable(5);
    const figures = cellsOf(bodyRows()[0]).slice(1);
    // The first Period's Amount sits against the pinned column's own right
    // edge; a second border there would be drawn twice, not merged.
    expect(getComputedStyle(figures[0]).borderLeftWidth).toBe("");
    expect(getComputedStyle(figures[2]).borderLeftWidth).not.toBe("");
    // Only on the first sub-column of a Period — not between Amount and % Open.
    expect(getComputedStyle(figures[3]).borderLeftWidth).toBe("");
  });
});

describe("what a screen reader can say about a figure", () => {
  // With 24 numeric columns, `scope` and `colSpan` are not enough: they let a
  // reader announce "1,240,000" with no way to say which Period it came from.
  // Every data cell names its row, its Period and its sub-column explicitly.
  it("points every figure at its row, its Period and its sub-column", () => {
    renderTable(5);
    const figure = cellsOf(bodyRows()[0])[1];
    const named = figure.getAttribute("headers")!.split(" ");
    expect(named).toHaveLength(3);

    const [rowHeader, periodHeader, subHeader] = named.map((id) => document.getElementById(id));
    expect(rowHeader).not.toBeNull();
    // Resolved, not merely present: an id that points at the wrong cell reads
    // exactly like one that points at the right one.
    expect(rowHeader).toHaveTextContent("Opening ARR");
    expect(periodHeader).toHaveTextContent("FY2020");
    expect(subHeader).toHaveTextContent("Amount");
  });

  it("resolves every reference in the whole table, not just the first", () => {
    renderTable(8);
    const dangling: string[] = [];
    for (const row of bodyRows()) {
      for (const figure of cellsOf(row).slice(1)) {
        for (const id of figure.getAttribute("headers")!.split(" ")) {
          if (!document.getElementById(id)) dangling.push(id);
        }
      }
    }
    expect(dangling).toEqual([]);
  });

  it("gives the table and its row labels their proper roles", () => {
    renderTable(5);
    expect(screen.getByRole("table", { name: "ARR Build" })).toBeInTheDocument();
    expect(cellsOf(bodyRows()[0])[0].tagName).toBe("TH");
    expect(cellsOf(bodyRows()[0])[0]).toHaveAttribute("scope", "row");
  });
});

describe("opening and closing a section", () => {
  it("opens as the summary a Build is meant to be", () => {
    renderTable(5);
    expect(bodyRows()).toHaveLength(4);
    expect(screen.queryByText("APIM")).not.toBeInTheDocument();
  });

  it("shows what a section holds, one level at a time", async () => {
    const user = userEvent.setup();
    renderTable(5);

    await user.click(screen.getByRole("button", { name: "New" }));
    expect(screen.getByText("APIM")).toBeInTheDocument();
    // One level at a time: opening the movement does not open the unit under it.
    expect(screen.queryByText("Northwind Bank")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "APIM" }));
    expect(screen.getByText("Northwind Bank")).toBeInTheDocument();
  });

  it("takes the whole subtree away again, not just the level below", async () => {
    const user = userEvent.setup();
    renderTable(5);
    await user.click(screen.getByRole("button", { name: "New" }));
    await user.click(screen.getByRole("button", { name: "APIM" }));
    await user.click(screen.getByRole("button", { name: "New" }));
    expect(screen.queryByText("APIM")).not.toBeInTheDocument();
    expect(screen.queryByText("Northwind Bank")).not.toBeInTheDocument();
  });

  it("says whether a section is open", async () => {
    const user = userEvent.setup();
    renderTable(5);
    const toggle = screen.getByRole("button", { name: "New" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(screen.getByRole("button", { name: "New" })).toHaveAttribute("aria-expanded", "true");
  });

  it("offers no control on a row that holds nothing", () => {
    renderTable(5);
    expect(screen.queryByRole("button", { name: "Opening ARR" })).not.toBeInTheDocument();
  });

  it("opens the sections the caller asks for", () => {
    render(
      <BuildTable
        label="ARR Build"
        rowLabelHeader="Movement"
        columnGroups={periodsOf(5)}
        subColumns={SUB_COLUMNS}
        rows={ROWS}
        cell={cell}
        defaultExpandedIds={["new", "new-apim"]}
      />,
    );
    expect(screen.getByText("Northwind Bank")).toBeInTheDocument();
  });

  // A refetch, or a change of Period, must not blow open a tree the reader had
  // closed — or reading a Build becomes a fight with the screen.
  it("keeps what the reader opened when the rows are replaced", async () => {
    const user = userEvent.setup();
    const { rerender } = renderTable(5);
    await user.click(screen.getByRole("button", { name: "New" }));
    expect(screen.getByText("APIM")).toBeInTheDocument();

    rerender(
      <BuildTable
        label="ARR Build"
        rowLabelHeader="Movement"
        columnGroups={periodsOf(5)}
        subColumns={SUB_COLUMNS}
        // Same ids, new objects — what a refetch produces.
        rows={structuredClone(ROWS)}
        cell={cell}
      />,
    );
    expect(screen.getByText("APIM")).toBeInTheDocument();
  });
});

describe("the figures themselves", () => {
  // Formatting is injected. The Build shows currency, counts and percentages in
  // the same column and only currency is scaled, so the row's own
  // formatter decides — this table must not second-guess it.
  it("shows exactly what the caller formatted, in the right cell", () => {
    renderTable(5);
    const figures = cellsOf(bodyRows()[0]).slice(1);
    expect(figures[0]).toHaveTextContent("opening/fy2020/amount");
    expect(figures[1]).toHaveTextContent("opening/fy2020/pct");
    expect(figures[2]).toHaveTextContent("opening/fy2021/amount");
  });

  it("asks the caller for every figure on screen, and for no others", () => {
    const spy = vi.fn(cell);
    render(
      <BuildTable
        label="ARR Build"
        rowLabelHeader="Movement"
        columnGroups={periodsOf(5)}
        subColumns={SUB_COLUMNS}
        rows={[{ id: "opening", label: "Opening ARR" }]}
        cell={spy}
      />,
    );
    // The SET of figures, not the number of calls: measuring the header row
    // settles a height and re-renders once, so a call count would be counting
    // renders rather than figures.
    const asked = new Set(
      spy.mock.calls.map(([row, group, subColumn]) => `${row.id}/${group.key}/${subColumn.key}`),
    );
    expect(asked.size).toBe(5 * SUB_COLUMNS.length);
    expect(asked.has("opening/fy2024/pct")).toBe(true);
  });

  // Not asked for rows nobody can see: a
  // closed section must cost nothing rather than merely look as though it does.
  it("asks for nothing on a row a closed section is hiding", () => {
    const spy = vi.fn(cell);
    render(
      <BuildTable
        label="ARR Build"
        rowLabelHeader="Movement"
        columnGroups={periodsOf(5)}
        subColumns={SUB_COLUMNS}
        rows={ROWS}
        cell={spy}
      />,
    );
    expect(spy.mock.calls.some(([row]) => row.id === "new-apim")).toBe(false);
  });

  it("marks a figure that subtracts, and mutes one that is subordinate", () => {
    renderTable(5);
    const lostRow = bodyRows().find((row) => row.textContent?.includes("Lost"))!;
    const amount = cellsOf(lostRow)[1];
    const openingPct = cellsOf(bodyRows()[0])[2];
    expect(getComputedStyle(amount).color).not.toBe(getComputedStyle(cellsOf(bodyRows()[0])[1]).color);
    expect(getComputedStyle(openingPct).color).not.toBe(getComputedStyle(cellsOf(bodyRows()[0])[1]).color);
  });

  // A Closing balance is emphasised AND ruled. Both used to be written to the
  // same computed sx key, which does not merge — the rule replaced the emphasis
  // outright and the one row a Build exists to land on rendered unbolded and
  // untinted, with a stroke above it and nothing else to say what it was.
  it("gives a Closing balance the rule AND the weight AND the tint", () => {
    renderTable(5);
    const resting = rowCellRules(rowLabelled("Ending ARR"), false).join(" ");
    expect(resting).toContain("border-top");
    expect(resting).toContain("font-weight: 700");
    expect(resting).toContain("linear-gradient");
  });

  it("emphasises a balance that carries no rule, and rules nothing else", () => {
    renderTable(5);
    const opening = rowCellRules(rowLabelled("Opening ARR"), false).join(" ");
    expect(opening).toContain("font-weight: 700");
    expect(opening).toContain("linear-gradient");
    expect(opening).not.toContain("border-top");
    expect(rowCellRules(rowLabelled("New"), false).join(" ")).not.toContain("font-weight: 700");
  });
});

// The timeout is raised for the whole block, and it is not papering over a slow
// implementation. Measured: a render here costs ~540ms whatever the fixture
// size — 151 rows and 3,000 rows both put 48 rows in the document and both cost
// the same, which is windowing working. What costs is those 48 MUI rows in
// jsdom, times the two passes the measurement settle takes, and the one test
// below that deliberately renders 150 rows UNWINDOWED to have something to
// compare against. Against vitest's 5s default that left tests landing at 1-4.4s
// with no margin, so they passed alone and failed under load — the worst way for
// a suite to fail. Raised to a bound the machine cannot cross rather than
// trimmed to a number that looks better.
describe("a Build with more rows than a document should hold", { timeout: 30_000 }, () => {
  // The hand-rolled `<table>` was chosen with row windowing as required
  // scope in the same breath, because a hand-rolled table has no virtualization
  // and the per-customer Builds are hundreds of customers per business unit.
  //
  // The row height under jsdom is the 30 the stub above reports, and the
  // scroll container has no height at all, so the table falls back to its own
  // `maxBodyHeight`. Both are the real code paths: a browser's first paint also
  // measures nothing before layout.

  /** A per-customer Build: one row each, no tree, thousands of them. */
  const customers = (count: number): BuildRow[] =>
    Array.from({ length: count }, (_, i) => ({ id: `c${i}`, label: `Customer ${i}` }));

  const scroller = () => screen.getByRole("table").parentElement!;
  /** The spacer rows standing in for what was not rendered. */
  const spacers = () => Array.from(document.querySelectorAll("tbody tr[aria-hidden]"));
  const spacerHeights = () =>
    spacers().map((row) => Number.parseFloat((row.firstElementChild as HTMLElement).style.height));

  it("renders every row while the table is still small enough to", () => {
    // The Subscription Build is 34 rows and always will be — the figures arrive
    // as columns. It must pay nothing for a mechanism it does not need.
    renderTable(5, customers(34));
    expect(bodyRows()).toHaveLength(34);
    expect(spacers()).toHaveLength(0);
  });

  it("renders a window of them once there are thousands", () => {
    renderTable(5, customers(3000));
    const rendered = bodyRows().filter((row) => !row.hasAttribute("aria-hidden"));
    expect(rendered.length).toBeGreaterThan(10);
    expect(rendered.length).toBeLessThan(100);
    expect(screen.getByText("Customer 0")).toBeInTheDocument();
    expect(screen.queryByText("Customer 2999")).not.toBeInTheDocument();
  });

  it("keeps the height of the whole table, so the scrollbar does not lie", () => {
    renderTable(5, customers(3000));
    const rendered = bodyRows().filter((row) => !row.hasAttribute("aria-hidden"));
    const padding = spacerHeights().reduce((total, height) => total + height, 0);
    expect(padding + rendered.length * 30).toBe(3000 * 30);
  });

  it("asks the caller for figures only for the rows it put on screen", () => {
    // The point of the whole exercise, and the thing that is actually
    // expensive. Every figure is a call into the caller's formatter, so an
    // unwindowed 3,000-row Build at five Periods asks 30,000 questions to show
    // twenty lines — and asks them again on every hover, every toggle, and
    // every time the measured header settles.
    const askedFor = (rows: BuildRow[]) => {
      const asked = vi.fn(cell);
      render(
        <BuildTable
          label="ARR Build"
          rowLabelHeader="Customer"
          columnGroups={periodsOf(5)}
          subColumns={SUB_COLUMNS}
          rows={rows}
          cell={asked}
        />,
      );
      return asked.mock.calls.length;
    };

    const windowed = askedFor(customers(3000));
    // Bounded by what is on screen, not by what exists. Two passes, not one:
    // the first window is computed from the estimated row height and the second
    // from the measured one, which is the same settle the two-row header makes
    // and for the same reason. ~47 rows then ~43, at ten figures each — 900 of
    // the 30,000 an unwindowed table would ask for.
    expect(windowed).toBeGreaterThan(0);
    expect(windowed).toBeLessThan(1000);

    // And the unwindowed table below the threshold asks for every figure it
    // holds, every pass — which is the behaviour being escaped, shown at the
    // largest size that still takes that path.
    const everything = askedFor(customers(ROW_WINDOW_THRESHOLD));
    expect(everything).toBeGreaterThanOrEqual(ROW_WINDOW_THRESHOLD * 5 * 2);
    // Twenty times the rows, a fraction of the questions.
    expect(windowed).toBeLessThan(everything / 3);
  });

  it("can be worked from the keyboard, at any size", async () => {
    // Windowing removes rows from the
    // document, so the risk is a table that can be read and not operated.
    const tree: BuildRow[] = [{ id: "new", label: "New", children: customers(2000) }];
    renderTable(5, tree);
    await userEvent.tab();
    const toggle = screen.getByRole("button", { name: "New" });
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.keyboard("{Enter}");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Customer 0")).toBeInTheDocument();
    // Still the same control, still focused: opening two thousand rows under it
    // did not move the reader somewhere else.
    expect(screen.getByRole("button", { name: "New" })).toHaveFocus();
  });

  it("lets the reader close a section that is being windowed, and releases its rows", async () => {
    // A windowed table nobody can operate has traded one failure for another.
    //
    // The section is open from the START, which is the whole point: two
    // COLLAPSED parents would be two visible rows, which is the plain path, and
    // a test that renders them pins nothing about windowing however many
    // children they have. Open, this is 2,001 visible rows and the window is
    // already running before the click.
    const tree: BuildRow[] = [{ id: "new", label: "New", children: customers(2000) }];
    renderTable(5, tree, ["new"]);
    expect(spacers().length).toBeGreaterThan(0);
    expect(screen.getByText("Customer 0")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "New" }));

    // Released, not hidden: the rows are gone from the document and so is the
    // space that was being held for them — a spacer left behind here would be a
    // Build scrolling over the ghost of a section that is no longer open.
    expect(bodyRows()).toHaveLength(1);
    expect(spacers()).toHaveLength(0);
    expect(screen.queryByText("Customer 0")).not.toBeInTheDocument();
  });

  it("shows the rows further down once the reader scrolls to them", () => {
    renderTable(5, customers(3000));
    expect(screen.queryByText("Customer 1000")).not.toBeInTheDocument();
    act(() => {
      Object.defineProperty(scroller(), "scrollTop", { value: 1000 * 30, writable: true });
      fireEvent.scroll(scroller());
    });
    expect(screen.getByText("Customer 1000")).toBeInTheDocument();
    expect(screen.queryByText("Customer 0")).not.toBeInTheDocument();
  });

  it("keeps the pinned header and the pinned label column under windowing", () => {
    // The two mechanisms most likely to break when rows stop being continuously
    // present.
    renderTable(5, customers(3000));
    expect(headerRows()).toHaveLength(2);
    const label = cellsOf(bodyRows().find((row) => !row.hasAttribute("aria-hidden"))!)[0];
    expect(getComputedStyle(label).position).toBe("sticky");
    expect(getComputedStyle(label).left).toBe("0px");
    const periodHeader = cellsOf(headerRows()[0])[1];
    expect(getComputedStyle(periodHeader).position).toBe("sticky");
  });

  it("still holds the sub-header below the Period row, not on top of it", () => {
    // The one hand-rolled mechanism with no precedent and no help
    // from MUI, checked in the state most likely to disturb it: the header is
    // measured from a row that is now sitting above a windowed body.
    renderTable(5, customers(3000));
    const subHeader = cellsOf(headerRows()[1])[0];
    expect(getComputedStyle(subHeader).top).toBe(`${measuredHeaderHeight}px`);
  });

  it("still dresses a row the way the Build reads it", () => {
    // The per-cell borders and tints are two more of the table's four, and they
    // are applied per row — so a windowed row is the one that would quietly
    // lose them.
    const rows: BuildRow[] = [
      ...customers(300),
      { id: "closing", label: "Ending ARR", emphasis: true, ruleAbove: true },
    ];
    renderTable(5, rows);
    const figure = cellsOf(bodyRows().find((row) => !row.hasAttribute("aria-hidden"))!)[1];
    expect(getComputedStyle(figure).borderBottomWidth).toBe("1px");

    // The balance is row 300, so it starts outside the window. Scroll it in and
    // read the row the component actually rendered: asking `rowSx` what it
    // returns would only be the component's own styling function agreeing with
    // itself, and would pass just as well if the window never mounted the row.
    act(() => {
      Object.defineProperty(scroller(), "scrollTop", { value: 300 * 30, writable: true });
      fireEvent.scroll(scroller());
    });
    const balance = rowCellRules(rowLabelled("Ending ARR"), false).join(" ");
    expect(balance).toContain("font-weight: 700");
    expect(balance).toContain("border-top");
  });

  it("keeps every figure pointed at its row, its Period and its sub-column", () => {
    // A windowed table a screen reader cannot traverse has traded one failure
    // for a quieter one.
    renderTable(5, customers(3000));
    const row = bodyRows().find((one) => !one.hasAttribute("aria-hidden"))!;
    const figure = cellsOf(row)[1];
    const headers = figure.getAttribute("headers")!.split(" ");
    expect(headers).toHaveLength(3);
    for (const id of headers) expect(document.getElementById(id)).not.toBeNull();
  });

  it("says nothing to a screen reader about the space it is holding open", () => {
    renderTable(5, customers(3000));
    expect(spacers().length).toBeGreaterThan(0);
    // getAllByRole excludes aria-hidden, so the accessibility tree sees only
    // the header rows and the rows actually carrying figures.
    const announced = screen.getAllByRole("row");
    expect(announced.length).toBe(2 + bodyRows().filter((r) => !r.hasAttribute("aria-hidden")).length);
  });

  // The other direction from the collapse test above: that one closes a section
  // the window is already running on, this one opens one it was not.
  it("costs nothing while a section is closed, and windows it the moment it opens", async () => {
    const tree: BuildRow[] = [
      { id: "opening", label: "Opening ARR", emphasis: true },
      { id: "new", label: "New", children: customers(3000) },
    ];
    renderTable(5, tree);
    // Closed: two rows, no window needed.
    expect(bodyRows()).toHaveLength(2);
    expect(spacers()).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "New" }));
    const rendered = bodyRows().filter((row) => !row.hasAttribute("aria-hidden"));
    expect(rendered.length).toBeLessThan(100);
    expect(screen.getByText("Customer 0")).toBeInTheDocument();
  });
});

describe("a table whose rows need more than a name to identify them", () => {
  // The Subscription Build identifies a row by one thing — the
  // movement's name — and the Software/Cloud Customers table needs eighteen
  // before the first figure: Account Name, Account ID, Owner, Source, both
  // countries, Industry, Sub Industry, Region, Sub Region, Activation and Churn
  // dates, Lost Reason, Rating, Employee Count. The frozen first column is ours;
  // this is that mechanism widened from one column to a run of them,
  // and the one-column Build is now the degenerate case of the same code.

  const LEAD = [
    { key: "name", label: "Account Name", width: 200, pinned: true },
    { key: "id", label: "Account ID", width: 120, pinned: true },
    { key: "owner", label: "Account Owner", width: 140 },
  ];
  const CUSTOMERS: BuildRow[] = [
    { id: "a1", label: "Northwind Bank" },
    { id: "a2", label: "Contoso" },
  ];
  /** Every lead cell says which row and column it is, so a misplaced one shows. */
  const leadCell = (row: BuildRow, column: { key: string }) => `${row.id}/${column.key}`;

  const renderWithLead = (rows: BuildRow[] = CUSTOMERS, lead = LEAD) =>
    render(
      <BuildTable
        label="Software/Cloud Customers"
        rowLabelHeader="Account Name"
        columnGroups={periodsOf(2)}
        subColumns={SUB_COLUMNS}
        rows={rows}
        cell={cell}
        leadColumns={lead}
        leadCell={leadCell}
      />,
    );

  it("heads every identity column, above the Periods' own header row", () => {
    renderWithLead();
    const firstRow = cellsOf(headerRows()[0]).map((one) => one.textContent);
    expect(firstRow.slice(0, 3)).toEqual(["Account Name", "Account ID", "Account Owner"]);
    // And the sub-header row still holds only the figure columns, because each
    // identity column spans both header rows rather than repeating.
    expect(cellsOf(headerRows()[1])).toHaveLength(2 * SUB_COLUMNS.length);
  });

  it("puts each row's identity in its own cell, before the figures", () => {
    renderWithLead();
    const cells = cellsOf(rowLabelled("Northwind Bank"));
    expect(cells[0].textContent).toContain("Northwind Bank");
    expect(cells[1].textContent).toBe("a1/id");
    expect(cells[2].textContent).toBe("a1/owner");
  });

  it("still names the row after the first identity column, for a screen reader", () => {
    // The first column is the row's NAME, so it stays the `th scope="row"` that
    // every figure in the row points at. The others are ordinary cells: an
    // Account ID is not a second name for the row.
    renderWithLead();
    const cells = cellsOf(rowLabelled("Northwind Bank"));
    expect(cells[0].tagName).toBe("TH");
    expect(cells[0].getAttribute("scope")).toBe("row");
    expect(cells[1].tagName).toBe("TD");
  });

  it("points every identity cell at its own column header", () => {
    renderWithLead();
    const cells = cellsOf(rowLabelled("Northwind Bank"));
    for (const identity of [cells[1], cells[2]]) {
      const headers = identity.getAttribute("headers")!.split(" ");
      expect(headers.length).toBeGreaterThanOrEqual(1);
      for (const id of headers) expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it("freezes the run of columns that asked to be, each past the last", () => {
    // The arithmetic `leadColumnOffsets` exists for, checked against what was
    // actually rendered: Account ID sits at exactly Account Name's width, or
    // the two overlap and the ID looks like missing data.
    renderWithLead();
    const cells = cellsOf(rowLabelled("Northwind Bank"));
    expect(getComputedStyle(cells[0]).position).toBe("sticky");
    expect(getComputedStyle(cells[0]).left).toBe("0px");
    expect(getComputedStyle(cells[1]).position).toBe("sticky");
    expect(getComputedStyle(cells[1]).left).toBe("200px");
  });

  it("freezes the identity HEADERS at the same offsets as their cells", () => {
    // The header and the body have to agree to the pixel or the pane shears
    // when the reader scrolls right. Worth its own test because the two are not
    // the same expression: an UNFROZEN header must stay `position: sticky` to
    // keep `top: 0` under the vertical scroll, while an unfrozen body cell goes
    // back into the flow.
    renderWithLead();
    const headers = cellsOf(headerRows()[0]);
    expect(getComputedStyle(headers[0]).left).toBe("0px");
    expect(getComputedStyle(headers[1]).left).toBe("200px");
    // Still pinned to the top, frozen horizontally or not.
    expect(getComputedStyle(headers[2]).position).toBe("sticky");
    expect(getComputedStyle(headers[2]).top).toBe("0px");
  });

  it("lets the columns that did not ask to be frozen scroll away", () => {
    renderWithLead();
    const owner = cellsOf(rowLabelled("Northwind Bank"))[2];
    expect(getComputedStyle(owner).position).not.toBe("sticky");
  });

  it("keeps the figures pointed at their row, Period and sub-column", () => {
    // The identity columns must not have shifted the `headers` wiring along.
    renderWithLead();
    const cells = cellsOf(rowLabelled("Northwind Bank"));
    const figure = cells[LEAD.length];
    const headers = figure.getAttribute("headers")!.split(" ");
    expect(headers).toHaveLength(3);
    for (const id of headers) expect(document.getElementById(id)).not.toBeNull();
  });

  it("still windows its rows, which is the case this table exists for", () => {
    // Identity columns must not have cost the windowing. A customers table
    // is hundreds of rows, which is why windowing exists.
    const many: BuildRow[] = Array.from({ length: 3000 }, (_, i) => ({
      id: `c${i}`,
      label: `Customer ${i}`,
    }));
    renderWithLead(many);
    const rendered = bodyRows().filter((row) => !row.hasAttribute("aria-hidden"));
    expect(rendered.length).toBeLessThan(100);
    expect(screen.queryByText("Customer 2999")).not.toBeInTheDocument();
    // And an identity cell in a windowed row still reads.
    expect(screen.getByText("c0/id")).toBeInTheDocument();
  });

  it("behaves exactly as before when a table names only one identity column", () => {
    // The Subscription Build's case, which is 37 other tests in this file. Here
    // only to say that the one-column path is the same code and not a branch.
    renderTable(5);
    const cells = cellsOf(rowLabelled("Opening ARR"));
    expect(cells[0].tagName).toBe("TH");
    expect(getComputedStyle(cells[0]).left).toBe("0px");
    expect(cells).toHaveLength(1 + 5 * SUB_COLUMNS.length);
  });
});

describe("opening the figures that have something behind them", () => {
  // Most of a Build is inert: a y/y growth, a retention
  // ratio and a percentage have no customer list behind them, so only SOME
  // figures may be opened. The decision is the caller's — it comes back on the
  // cell, beside the text — because this component knows nothing about
  // customers and should not learn.

  const openable: BuildCellFor = (row, group, subColumn) => ({
    text: `${row.id}/${group.key}/${subColumn.key}`,
    // Only the balance rows, so a test can see the table treat two rows
    // differently within one render.
    onActivate: row.id === "opening" || row.id === "closing" ? () => opened.push(row.id) : undefined,
  });
  let opened: string[] = [];

  const renderOpenable = (rows: BuildRow[] = ROWS) => {
    opened = [];
    return render(
      <BuildTable
        label="ARR Build"
        rowLabelHeader="Movement"
        columnGroups={periodsOf(2)}
        subColumns={SUB_COLUMNS}
        rows={rows}
        cell={openable}
      />,
    );
  };

  it("gives an openable figure a control, and a plain one none", () => {
    renderOpenable();
    expect(screen.getByRole("button", { name: /opening\/fy2020\/amount/ })).toBeInTheDocument();
    // `New` is not openable, so its figure is text and nothing else.
    expect(screen.queryByRole("button", { name: /new\/fy2020\/amount/ })).not.toBeInTheDocument();
    expect(screen.getByText("new/fy2020/amount")).toBeInTheDocument();
  });

  it("calls back with the figure the reader actually opened", () => {
    renderOpenable();
    fireEvent.click(screen.getByRole("button", { name: /closing\/fy2021\/pct/ }));
    expect(opened).toEqual(["closing"]);
  });

  it("can be opened from the keyboard", async () => {
    // A drill-down reachable only by mouse is a drill-down half the readers of
    // a finance report cannot use.
    renderOpenable();
    const control = screen.getByRole("button", { name: /opening\/fy2020\/amount/ });
    control.focus();
    expect(control).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(opened).toEqual(["opening"]);
  });

  it("never makes the row-label column openable", () => {
    // The label column has no date, so there is nothing
    // to ask the backend about. Its only control stays the section toggle.
    renderOpenable();
    const label = cellsOf(rowLabelled("Opening ARR"))[0] as HTMLElement;
    expect(within(label).queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps the figure pointed at its row, Period and sub-column", () => {
    // The control sits INSIDE the cell rather than replacing it, so the
    // `headers` wiring a screen reader follows is untouched.
    renderOpenable();
    const figure = cellsOf(rowLabelled("Opening ARR"))[1] as HTMLElement;
    expect(figure.getAttribute("headers")!.split(" ")).toHaveLength(3);
    expect(within(figure).getByRole("button")).toBeInTheDocument();
  });

  it("still windows, so a Build of thousands is still openable", () => {
    const many: BuildRow[] = Array.from({ length: 3000 }, (_, i) => ({
      id: i === 0 ? "opening" : `c${i}`,
      label: `Customer ${i}`,
    }));
    renderOpenable(many);
    expect(bodyRows().filter((r) => !r.hasAttribute("aria-hidden")).length).toBeLessThan(100);
    expect(screen.getByRole("button", { name: /opening\/fy2020\/amount/ })).toBeInTheDocument();
  });
});

describe("a table that is all identity and no Periods", () => {
  // The drill-down dialog: a flat list of customers with eleven
  // columns and no Period axis at all. It wants everything this table already
  // owns — the frozen first column, the sticky header, horizontal scroll at a
  // dozen columns, and above all the row windowing, because the endpoint behind
  // it has no pagination and a Closing drill-down returns the whole book.
  //
  // So `columnGroups` may be empty. What must NOT happen is a second header row
  // with nothing in it.

  const LEAD = [
    { key: "id", label: "Account ID", width: 188, pinned: true },
    { key: "name", label: "Account Name", width: 220 },
    { key: "amount", label: "Amount (USD)", width: 140 },
  ];
  const CUSTOMERS: BuildRow[] = [
    { id: "a1", label: "Northwind Bank" },
    { id: "a2", label: "Contoso" },
  ];

  const renderFlat = (rows: BuildRow[] = CUSTOMERS) =>
    render(
      <BuildTable
        label="Customers"
        rowLabelHeader="Account ID"
        columnGroups={[]}
        subColumns={[]}
        rows={rows}
        cell={cell}
        leadColumns={LEAD}
        leadCell={(row, column) => `${row.id}/${column.key}`}
      />,
    );

  it("has ONE header row, not an empty second one", () => {
    renderFlat();
    expect(headerRows()).toHaveLength(1);
    expect(cellsOf(headerRows()[0]).map((one) => one.textContent)).toEqual([
      "Account ID",
      "Account Name",
      "Amount (USD)",
    ]);
  });

  it("does not span its headers across a row that is not there", () => {
    renderFlat();
    for (const head of cellsOf(headerRows()[0])) {
      expect(head).not.toHaveAttribute("rowspan", "2");
    }
  });

  it("renders every row as its identity columns and nothing else", () => {
    renderFlat();
    const cells = cellsOf(rowLabelled("Northwind Bank"));
    expect(cells).toHaveLength(3);
    expect(cells.map((one) => one.textContent)).toEqual(["Northwind Bank", "a1/name", "a1/amount"]);
  });

  it("asks only for the width its own columns need", () => {
    renderFlat();
    const table = screen.getByRole("table", { name: "Customers" });
    expect(table.style.minWidth).toBe(`${188 + 220 + 140}px`);
  });

  it("still freezes the column that asked to be", () => {
    renderFlat();
    expect(getComputedStyle(cellsOf(rowLabelled("Northwind Bank"))[0]).position).toBe("sticky");
  });

  it("still windows, which is the reason this table was chosen for the dialog", () => {
    const many: BuildRow[] = Array.from({ length: 3000 }, (_, i) => ({
      id: `a${i}`,
      label: `Customer ${i}`,
    }));
    renderFlat(many);
    expect(bodyRows().filter((r) => !r.hasAttribute("aria-hidden")).length).toBeLessThan(100);
    expect(screen.queryByText("Customer 2999")).not.toBeInTheDocument();
  });
});


// The notice lives HERE rather than on the page because
// this is the only place the table's required width exists — `tableMinWidth`
// computes it from the column model — and because a page that mounted it itself
// would show it over a loading skeleton and an error too.
describe("the narrow-viewport notice", () => {
  const atViewport = (width: number) =>
    Object.defineProperty(window, "innerWidth", { value: width, configurable: true });

  it("says nothing when the viewport fits the table", () => {
    atViewport(20_000);
    renderTable(5);
    expect(screen.queryByText(/wider than your screen/i)).not.toBeInTheDocument();
  });

  it("says so when it does not, and still renders every figure", () => {
    atViewport(400);
    renderTable(5);
    expect(screen.getByText(/wider than your screen/i)).toBeInTheDocument();
    // The decision's other half: a notice ABOVE a table, never instead of one.
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  // The width is the TABLE's, not a fixed breakpoint — which is what lets a
  // narrow table on a narrow screen stay quiet. One Period is 288 + 170 = 458px.
  it("stays quiet for a table that fits, even on a small screen", () => {
    atViewport(600);
    renderTable(1);
    expect(screen.queryByText(/wider than your screen/i)).not.toBeInTheDocument();
  });
});
