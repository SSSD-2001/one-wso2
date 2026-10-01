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

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { inZone } from "@/test/timeZone";
import PacificTimeChip from "@features/finance/mis/components/PacificTimeChip";

// The suite is pinned to America/Los_Angeles, where a Pacific-versus
// -local confusion is invisible, so this renders from somewhere else.

afterEach(() => {
  vi.useRealTimers();
});

function renderAt(iso: string, tz = "Asia/Colombo") {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
  return inZone(tz, () => render(<PacificTimeChip />));
}

describe("the permanent Pacific Time chip", () => {
  it("says PST in the winter", () => {
    renderAt("2026-01-15T12:00:00Z");
    expect(screen.getByText("Pacific Time (PST)")).toBeInTheDocument();
  });

  it("says PDT in the summer", () => {
    renderAt("2026-07-15T12:00:00Z");
    expect(screen.getByText("Pacific Time (PDT)")).toBeInTheDocument();
  });

  it("changes over at the transition, not at the turn of the month", () => {
    // 02:00 PST on 8 March 2026 is 10:00 UTC.
    renderAt("2026-03-08T09:59:00Z");
    expect(screen.getByText("Pacific Time (PST)")).toBeInTheDocument();

    renderAt("2026-03-08T10:01:00Z");
    expect(screen.getByText("Pacific Time (PDT)")).toBeInTheDocument();
  });

  it("says what the chip is for, not just what it says", () => {
    renderAt("2026-07-15T12:00:00Z");
    expect(screen.getByLabelText(/every period on this screen/i)).toBeInTheDocument();
  });
});
