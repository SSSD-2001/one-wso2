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

import { describe, expect, it } from "vitest";
import { isKnownRoute, pinnableRoute } from "@features/pinned/pinnableRoute";

describe("pinnableRoute", () => {
  it("labels a perspective landing route from the registry", () => {
    expect(pinnableRoute("/people-ops")).toMatchObject({
      kind: "page",
      id: "/people-ops",
      label: "People Ops",
      href: "/people-ops",
    });
  });

  it("qualifies an app item with its app so global pins stay unambiguous", () => {
    // A bare item label is not unique across the rail — "History" is a Credit
    // Card item and "Claims" is an app in its own right — so a pin carries the
    // app it came from.
    expect(pinnableRoute("/finance/cc/history").label).toBe("Credit Card Expenses · History");
    expect(pinnableRoute("/me/claims").label).toBe("Claims · Claims");
    expect(pinnableRoute("/finance/cc/history").label).not.toBe(
      pinnableRoute("/me/claims").label,
    );
  });

  // A route added without a registry `path` gets a guessed label instead of a
  // qualified one, so this doubles as the check that a newly ported app was
  // wired into the registry and not just into the router.
  it("qualifies a ported app's screen from the registry", () => {
    expect(pinnableRoute("/me/menu").label).toBe("Cafeteria · Home");
    expect(isKnownRoute("/me/menu")).toBe(true);
  });

  // Detail routes aren't in the registry — one entry cannot enumerate every
  // employee — so they take their parent's label plus the leaf. Without this a
  // pin reads as a bare id with nothing to say where it came from.
  it("qualifies a detail route by the route it sits under", () => {
    expect(pinnableRoute("/me/my-team/E123").label).toBe("My Team · E123");
    expect(pinnableRoute("/finance/cc/history/TXN-9").label).toBe(
      "Credit Card Expenses · History · TXN-9",
    );
  });

  it("labels a leaf section that is a route", () => {
    expect(pinnableRoute("/me/my-team").label).toBe("My Team");
  });

  it("treats query state as a distinct 'search' pin", () => {
    const plain = pinnableRoute("/me/leave");
    const filtered = pinnableRoute("/me/leave", "?status=pending");
    expect(plain.kind).toBe("page");
    expect(filtered.kind).toBe("search");
    // Distinct ids, so pinning the filtered view doesn't overwrite the plain one.
    expect(filtered.id).not.toBe(plain.id);
    expect(filtered.href).toBe("/me/leave?status=pending");
  });

  it("ignores an empty query string rather than calling it a search", () => {
    expect(pinnableRoute("/people-ops", "?").kind).toBe("page");
    expect(pinnableRoute("/people-ops", "").kind).toBe("page");
  });

  it("falls back to a humanized segment for an unregistered route", () => {
    expect(pinnableRoute("/some/unknown-page").label).toBe("Unknown page");
    expect(pinnableRoute("/").label).toBe("Page");
  });

  // React Router matches a trailing slash, so the URL reaches here either way.
  // Without normalizing, the registry lookup missed: the label degraded to a
  // guess and the id/href differed, so the same page pinned twice.
  it("resolves a route with a trailing slash to its canonical entry", () => {
    expect(pinnableRoute("/finance/cc/history/")).toMatchObject({
      kind: "page",
      id: "/finance/cc/history",
      label: "Credit Card Expenses · History",
      href: "/finance/cc/history",
    });
    expect(pinnableRoute("/finance/cc/history/")).toEqual(pinnableRoute("/finance/cc/history"));
  });

  it("keeps the root path intact when normalizing", () => {
    expect(pinnableRoute("/").href).toBe("/");
  });
});

describe("isKnownRoute", () => {
  it("distinguishes registry routes from guessed ones", () => {
    expect(isKnownRoute("/people-ops")).toBe(true);
    expect(isKnownRoute("/me/leave")).toBe(true);
    expect(isKnownRoute("/some/unknown-page")).toBe(false);
  });

  it("recognises a route with a trailing slash", () => {
    expect(isKnownRoute("/me/leave/")).toBe(true);
  });
});

// pinnableRoute runs during render (PinThisPageButton calls it while
// rendering), so a throw here takes the button down rather than just labelling
// itself oddly.
describe("malformed percent encoding in a detail route", () => {
  it("keeps the raw segment instead of throwing", () => {
    // decodeURIComponent("%") throws URIError.
    expect(() => pinnableRoute("/me/my-team/%")).not.toThrow();
    expect(pinnableRoute("/me/my-team/%").label).toBe("My Team · %");
  });

  it("survives other invalid escapes", () => {
    for (const leaf of ["%zz", "%E0%A4%A", "100%"]) {
      expect(() => pinnableRoute(`/me/my-team/${leaf}`), leaf).not.toThrow();
    }
  });

  it("still decodes a valid escape", () => {
    expect(pinnableRoute("/me/my-team/E%20123").label).toBe("My Team · E 123");
  });
});

