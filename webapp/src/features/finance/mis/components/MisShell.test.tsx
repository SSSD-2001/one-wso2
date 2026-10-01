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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import MisShell from "@features/finance/mis/components/MisShell";
import type { MisGate } from "@features/finance/mis/api/useMisGate";
import { useScalePreference } from "@features/finance/mis/util/ScalePreferenceContext";

const configured = vi.hoisted(() => ({ value: true }));
vi.mock("@config/apiConfig", () => ({
  isMisArrConfigured: () => configured.value,
}));

const gate = vi.hoisted(() => ({ value: {} as MisGate }));
vi.mock("@features/finance/mis/api/useMisGate", () => ({
  useMisGate: () => gate.value,
}));

const ALLOWED: MisGate = {
  canSee: () => true,
  isResolving: false,
  isError: false,
  retry: () => {},
};

const SUBTITLE = "Recurring revenue from opening to closing balance.";

function renderShell(g: Partial<MisGate> = {}) {
  gate.value = { ...ALLOWED, ...g };
  return render(
    <MemoryRouter>
      <MisShell gateId="mis-arr-build" title="ARR Build" subtitle={SUBTITLE}>
        <div>the real page</div>
      </MisShell>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  configured.value = true;
});

describe("a screen the caller can open", () => {
  it("renders it", () => {
    renderShell();
    expect(screen.getByText("the real page")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ARR Build" })).toBeInTheDocument();
  });
});

describe("the ladder above the page", () => {
  it("names the missing config key when the ARR backend isn't set", () => {
    configured.value = false;
    renderShell();
    expect(screen.getByText(/ONE_WSO2_MIS_ARR_BACKEND_URL/)).toBeInTheDocument();
    expect(screen.queryByText("the real page")).not.toBeInTheDocument();
  });

  // Rendering a denial first and correcting it a moment later flashes a lock at
  // people who do have access, on every single load.
  it("holds the page while the privilege check is in flight", () => {
    renderShell({ isResolving: true, canSee: () => false });
    expect(screen.getByText(/checking your mis access/i)).toBeInTheDocument();
    expect(screen.queryByText(/don't have access/i)).not.toBeInTheDocument();
  });

  // Checked BEFORE the locked rung. A failed request also leaves us with no
  // privileges, and reporting that as a missing permission sends someone
  // chasing an LDAP group they are already in.
  it("reports a failed check as an error with a retry, not as a denial", () => {
    renderShell({
      isError: true,
      errorMessage: "Gateway timed out.",
      canSee: () => false,
    });
    expect(screen.getByText(/couldn't check your mis access/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText(/don't have access/i)).not.toBeInTheDocument();
  });

  it("locks someone holding no MIS privilege at all", () => {
    renderShell({ canSee: () => false });
    expect(screen.getByText(/don't have access to finance mis/i)).toBeInTheDocument();
    expect(screen.queryByText("the real page")).not.toBeInTheDocument();
  });

  it("does not call a switched-off ARR Analysis screen a missing permission", () => {
    gate.value = {
      ...ALLOWED,
      canSee: (itemId) => itemId === "mis-arr-build",
    };
    render(
      <MemoryRouter>
        <MisShell gateId="mis-analysis" title="ARR Analysis">
          <div>the real page</div>
        </MisShell>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "ARR Analysis isn't available" })).toBeInTheDocument();
    expect(screen.queryByText(/don't have access to finance mis/i)).not.toBeInTheDocument();
    expect(screen.queryByText("the real page")).not.toBeInTheDocument();
  });
});

describe("the subtitle", () => {
  it("is dropped on a locked screen, since it sells something withheld", () => {
    renderShell({ canSee: () => false });
    expect(screen.queryByText(SUBTITLE)).not.toBeInTheDocument();
  });

  it("survives every other rung", () => {
    renderShell({ isResolving: true, canSee: () => false });
    expect(screen.getByText(SUBTITLE)).toBeInTheDocument();
  });
});

// Every MIS screen carries the chip, so no screen has to remember it —
// the same argument that puts the degraded states here.
describe("the Pacific Time chip", () => {
  const chip = () => screen.queryByText(/^Pacific Time \((PST|PDT|PT)\)$/);

  it("sits above a screen showing figures", () => {
    renderShell();
    expect(chip()).toBeInTheDocument();
  });

  // "Permanent" is the spec's own word, and the subtitle is the contrast: that
  // one IS dropped on the locked rung, because it sells a screen being withheld.
  // A timezone states a fact about MIS rather than advertising anything, so it
  // survives every rung the subtitle does not.
  it("survives a locked screen", () => {
    renderShell({ canSee: () => false });
    expect(chip()).toBeInTheDocument();
  });

  it("survives the privilege check being in flight", () => {
    renderShell({ isResolving: true, canSee: () => false });
    expect(chip()).toBeInTheDocument();
  });

  it("survives the backend not being connected", () => {
    configured.value = false;
    renderShell();
    expect(chip()).toBeInTheDocument();
  });
});

describe("the Scale preference", () => {
  // Mounted here rather than per screen for the same reason everything else in
  // this file is: a screen that forgot the provider would throw, and a screen
  // that carried its own would hold a Scale the next MIS screen did not share.
  function ScaleProbe() {
    return <span data-testid="preference">{useScalePreference().preference}</span>;
  }

  it("is readable from a MIS screen without the screen providing it", () => {
    gate.value = ALLOWED;
    localStorage.setItem("one-wso2.scale", "thousands");
    render(
      <MemoryRouter>
        <MisShell gateId="mis-arr-build" title="ARR Build">
          <ScaleProbe />
        </MisShell>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("preference")).toHaveTextContent("thousands");
    localStorage.clear();
  });
});
