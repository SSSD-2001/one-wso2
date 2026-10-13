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

/**
 * Three tones per app mark, derived from the perspective's identity hue.
 *
 * The hue itself is not repeated here — it is `PERSPECTIVE_HUES[key].hue` in
 * @config/perspectiveHues, and `lead` below is that exact value. What this file
 * adds is the two supporting tones a two-colour mark needs.
 *
 *   field   the large ground shape (house body, wallet body, buoy ring)
 *   lead    the identifying form, at full saturation (roof, flap, spokes)
 *   detail  the small dark accent (door, clasp, handle)
 *
 * Precomputed rather than mixed at runtime, following perspectiveHues.ts: values
 * that can be read and asserted beat values that can only be observed.
 *
 * CONTRAST, and the one place this deliberately does not reach 3:1.
 *
 * `lead` and `detail` both clear the WCAG 1.4.11 non-text floor against a white
 * tile AND against the dark tile (3.02-5.79:1 across all ten pairs; the test
 * recomputes them). `field` does not: it measures 1.70-1.88:1 on white.
 *
 * That is not an oversight and it cannot be fixed by darkening. 1.4.11 applies to
 * what is *required to identify* the control, which here is the silhouette plus
 * the saturated `lead` form — both of which pass. `field` is interior modelling.
 * Darkening it until it passed was tried: every hue needs so much darkening that
 * `field` and `lead` end up 1.05-1.37:1 apart, which reads as one flat colour and
 * destroys the two-tone the marks exist for. A two-tone mark on a white ground
 * cannot have both tones dark; that is a property of the goal, not of the values.
 *
 * `detail` is mixed 18% black rather than a deeper 30%: at 30% it dropped to
 * 2.40-2.98:1 against the tile, and the megaphone's handle is a `detail` shape
 * that touches the tile ground rather than sitting inside another shape.
 */
export interface AppMarkTones {
  field: string;
  lead: string;
  detail: string;
}

/** Keyed by `PerspectiveDef.key`, same keys as PERSPECTIVE_HUES. */
export const APP_MARK_TONES: Record<string, AppMarkTones> = {
  // `detail` is unused by MeMark, which is field + lead only — see the note
  // there on why the house stopped being a solid block. Kept rather than made
  // optional: every other perspective needs all three, and the contrast tests
  // below check the full set per key. Don't reach for it to add a third tone
  // here without re-measuring the mark's weight against its neighbours.
  me: { field: "#F8AA95", lead: "#F14E23", detail: "#C6401D" },
  people: { field: "#9BC9F0", lead: "#2E8FE0", detail: "#2675B8" },
  finance: { field: "#95D3C1", lead: "#22A37D", detail: "#1C8666" },
  marketing: { field: "#F0A8C9", lead: "#E04A8F", detail: "#B83D75" },
  csm: { field: "#CFB1F0", lead: "#9B5DE0", detail: "#7F4CB8" },
  legal: { field: "#B8C6F0", lead: "#6C89E0", detail: "#5970B8" },
  // Derived by the same rule as the six above it, from Security's own
  // PERSPECTIVE_HUES entry: field is the hue 50% toward white, detail is the
  // hue at 82% (the 18%-black mix this file's header describes). The test
  // recomputes every ratio, so these are asserted rather than trusted.
  security: { field: "#DCC285", lead: "#B8860B", detail: "#976E09" },
  // Sales. Derived from its hue by this file's own rule — field is the hue 50%
  // toward white, detail the hue at 82%. Measured 3.45:1 and 5.07:1 for lead,
  // 4.88:1 and 3.58:1 for detail, against the light and dark tiles.
  sales: { field: "#EEA5EC", lead: "#DD4BDA", detail: "#B53EB3" },
  // Engineering. Same rule — field 50% toward white, detail at 82%. Measured
  // 3.46:1 and 5.04:1 for lead, 4.89:1 and 3.57:1 for detail, against the
  // light and dark tiles.
  engineering: { field: "#ECB588", lead: "#D96B12", detail: "#B2580F" },
  // Knowledge. Same rule — field 50% toward white, detail at 82%. Measured
  // 4.01:1 and 4.36:1 for lead, 5.58:1 and 3.13:1 for detail, against the
  // light and dark tiles. `detail` is unused by KnowledgeMark (field + lead
  // only, like Me) but kept so the contrast tests check the full set.
  "knowledge-base": { field: "#EEA5AE", lead: "#DD4B5E", detail: "#B53E4D" },
  // Infrastructure. Same rule — field 50% toward white, detail at 82%. Measured
  // 3.46:1 and 5.04:1 for lead, 4.89:1 and 3.57:1 for detail, against the
  // light and dark tiles.
  infra: { field: "#87CDD3", lead: "#0E9AA7", detail: "#0B7E89" },
};

/**
 * Tones for a perspective's mark, or undefined for a key with no entry. Own
 * properties only, so an inherited name like "toString" resolves to nothing.
 */
export function appMarkTones(key: string): AppMarkTones | undefined {
  return Object.prototype.hasOwnProperty.call(APP_MARK_TONES, key)
    ? APP_MARK_TONES[key]
    : undefined;
}
