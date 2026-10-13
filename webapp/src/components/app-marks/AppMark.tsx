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
 * Filled, two-tone marks for the eight perspectives, used ONLY by the app
 * launcher.
 *
 * Why these exist at all: Lucide ships no filled icons, so the launcher tile got
 * its visual mass from a coloured wash behind a line glyph. That made an app tile
 * and a rail row look like the same kind of thing. These marks give the launcher
 * its own vocabulary — filled and coloured for "this is an app", line icons
 * everywhere else for "this is somewhere to go". The rail is deliberately
 * untouched; the contrast between the two is the point.
 *
 * Drawn on a 48x48 grid because that is the tile's own size, so the marks are
 * authored at the size they are rendered rather than scaled up from 24.
 *
 * OPTICAL SIZING: the megaphone and the group are scaled about their centres.
 * Equal bounding boxes do not read as equal weight — measured at 64px, the
 * megaphone covered 20% of its box against 33-44% for the others and sat visibly
 * light in the row. The scale factors bring the set to 29-44%.
 *
 * A perspective with no mark here falls back to its line glyph on the hue wash
 * (see WaffleOverlay), so adding a perspective cannot break the launcher.
 */
import { appMarkTones } from "./appMarkTones";

export interface MarkProps {
  /** Rendered size in px. The tile uses 48; tests and stories may differ. */
  size?: number;
}

/**
 * Shared wrapper: fixes the 48-unit coordinate space every mark is drawn in, and
 * hides the graphic from assistive tech because the tile around it is already
 * labelled with the app's name.
 */
function Svg({ size = 48, children }: MarkProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/**
 * Me — a house. Traced from the same silhouette as the rail's line icon
 * (lucide's House, scaled 2x for this 48-unit grid) rather than a separately
 * drawn roof-on-a-box, so the two only differ in fill style, not in what
 * shape they're actually showing.
 */
export function MeMark({ size }: MarkProps) {
  const t = appMarkTones("me")!;
  return (
    <Svg size={size}>
      {/* Pale silhouette, then the roof and door in lead — the same build every
          other mark here uses: a large shape in `field`, with `lead` carrying
          the identifying form.

          The house was previously one solid `lead` block with a `detail` door,
          which made it the darkest mark in the launcher by a wide margin —
          mean L* 54.7 against 57.1–76.3 for the other five. This lands at 67.9,
          beside People at 66.4.

          The roof reuses the silhouette's own arc, closed straight across at
          the wall line. Drawing separate roof and wall paths renders
          identically but duplicates that bottom edge, leaving two things to
          keep in sync when the outline is ever adjusted. */}
      <path
        d="M6 20a4 4 0 0 1 1.418-3.056l14-12a4 4 0 0 1 5.164 0l14 12A4 4 0 0 1 42 20v18a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z"
        fill={t.field}
      />
      <path
        d="M6 20a4 4 0 0 1 1.418-3.056l14-12a4 4 0 0 1 5.164 0l14 12A4 4 0 0 1 42 20z"
        fill={t.lead}
      />
      <path d="M30 42v-16a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v16z" fill={t.lead} />
    </Svg>
  );
}

/**
 * Security — a shield, echoing the perspective's own rail glyph.
 *
 * Built the way the rest of this set is: the silhouette carries `field`, the
 * identifying form carries `lead`, and a small accent carries `detail`. The
 * band is the shield's own upper section closed at the waist rather than a
 * second drawn shape, so there is no near-duplicate outline to keep in sync if
 * the silhouette ever moves.
 *
 * Measures L* 68.5 at 49% coverage — beside People (66.4) and Me (66.7), which
 * is the point: before this existed the launcher fell back to the outline glyph
 * on a wash, and Security was the one tile that did not look like a tile.
 */
export function SecurityMark({ size }: MarkProps) {
  const t = appMarkTones("security")!;
  return (
    <Svg size={size}>
      <path d="M24 4 6 10v14c0 9.6 7.4 16.8 18 20 10.6-3.2 18-10.4 18-20V10z" fill={t.field} />
      <path d="M24 4 6 10v12h36V10z" fill={t.lead} />
      <path d="M21.6 33.4l-7.9-7.9 3.3-3.3 4.6 4.6 10.4-10.4 3.3 3.3z" fill={t.detail} />
    </Svg>
  );
}

/** People Ops — two figures, the nearer one carrying the hue. */
export function PeopleMark({ size }: MarkProps) {
  const t = appMarkTones("people")!;
  return (
    <Svg size={size}>
      <g transform="translate(24 24) scale(1.05) translate(-24 -24)">
        <circle cx="32.5" cy="16.5" r="5.5" fill={t.field} />
        <path
          d="M32.5 24c5.2 0 9.6 3.2 11 7.8.5 1.6-.7 3.2-2.4 3.2H24.5c-1.7 0-2.9-1.6-2.4-3.2 1.4-4.6 5.8-7.8 10.4-7.8z"
          fill={t.field}
        />
        <circle cx="18.5" cy="18.5" r="7.5" fill={t.lead} />
        <path
          d="M18.5 28c6.4 0 11.9 4 13.6 9.7.6 1.9-.9 3.8-2.9 3.8H7.8c-2 0-3.5-1.9-2.9-3.8C6.6 32 12.1 28 18.5 28z"
          fill={t.lead}
        />
      </g>
    </Svg>
  );
}

/** Finance — a wallet: body, flap, clasp. */
export function FinanceMark({ size }: MarkProps) {
  const t = appMarkTones("finance")!;
  return (
    <Svg size={size}>
      <rect x="5" y="12" width="38" height="27" rx="6" fill={t.field} />
      <path d="M28 20h15v11H28a5.5 5.5 0 0 1 0-11z" fill={t.lead} />
      <circle cx="32.6" cy="25.5" r="2.9" fill={t.detail} />
    </Svg>
  );
}

/** Marketing Ops — a megaphone with its sound arc. */
export function MarketingMark({ size }: MarkProps) {
  const t = appMarkTones("marketing")!;
  return (
    <Svg size={size}>
      <g transform="translate(24 24) scale(1.2) translate(-24 -24)">
        <path
          d="M12 19.5 30.5 11v26l-18.5-8.5a1 1 0 0 1-.6-.9v-6.2a1 1 0 0 1 .6-.9z"
          fill={t.lead}
        />
        <path d="M15 29.6l5.5 2.5V38a3 3 0 0 1-6 0z" fill={t.detail} />
        <path
          d="M35.5 17.2a1.9 1.9 0 0 1 2.7.4 12 12 0 0 1 0 12.8 1.9 1.9 0 1 1-3.1-2.2 8.2 8.2 0 0 0 0-8.4 1.9 1.9 0 0 1 .4-2.6z"
          fill={t.field}
        />
      </g>
    </Svg>
  );
}

/**
 * Sales — a rising bar chart with an arrow above its tallest column.
 *
 * Chosen over a handshake (too much fine detail to survive 48px) and a target
 * (CSM is already a ring form, and two ring marks in one launcher is exactly the
 * collision the hues exist to avoid). Bars give it a silhouette nothing else here
 * has: flat-topped verticals against a house, two figures, a wallet, a megaphone
 * and a buoy.
 *
 * The only mark that uses all three tones as three separate shapes — the two
 * shorter bars recede as `field`, the tallest carries `lead`, and the arrowhead
 * is `detail`. Growth reads from the step up in height, so the tallest bar is the
 * one that should be saturated.
 *
 * Bars sit on a common baseline at y=41 and are 8 wide on a 12 pitch, so the
 * rhythm is even; the arrowhead clears the tallest bar's cap by 2.
 */
export function SalesMark({ size }: MarkProps) {
  const t = appMarkTones("sales")!;
  return (
    <Svg size={size}>
      <rect x="7" y="27" width="8" height="14" rx="2" fill={t.field} />
      <rect x="19" y="21" width="8" height="20" rx="2" fill={t.field} />
      <rect x="31" y="13" width="8" height="28" rx="2" fill={t.lead} />
      <path d="M35 3l6 8H29z" fill={t.detail} />
    </Svg>
  );
}

/** CSM — a life buoy: ring plus four spokes. */
export function CsmMark({ size }: MarkProps) {
  const t = appMarkTones("csm")!;
  return (
    <Svg size={size}>
      <path
        fillRule="evenodd"
        d="M24 5.5A18.5 18.5 0 1 0 24 42.5 18.5 18.5 0 0 0 24 5.5zm0 10.5a8 8 0 1 1 0 16 8 8 0 0 1 0-16z"
        fill={t.field}
      />
      <g fill={t.lead}>
        <rect x="21.6" y="2.5" width="4.8" height="12" rx="2.4" />
        <rect x="21.6" y="33.5" width="4.8" height="12" rx="2.4" />
        <rect x="2.5" y="21.6" width="12" height="4.8" rx="2.4" />
        <rect x="33.5" y="21.6" width="12" height="4.8" rx="2.4" />
      </g>
    </Svg>
  );
}

/**
 * Legal — scales of justice, traced from the same silhouette as the rail's
 * line icon (lucide's Scale, scaled 2x for this 48-unit grid) rather than
 * separately-drawn straight-edged triangles for the pans — the real icon's
 * pans have a scalloped bottom curve, not a hard point, so a from-scratch
 * triangle read as a different (and, per feedback, wrong-looking) shape.
 * Post/crossbar/base stay stroked lines (they have no fillable area of their
 * own); the two pans are closed shapes, so they're filled solid instead of
 * stroked, keeping the launcher's bold/filled look.
 */
export function LegalMark({ size }: MarkProps) {
  const t = appMarkTones("legal")!;
  return (
    <Svg size={size}>
      <path
        d="M6 14h4c4 0 10-2 14-4 4 2 10 4 14 4h4"
        fill="none"
        stroke={t.lead}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M24 6v36" stroke={t.lead} strokeWidth={4} strokeLinecap="round" />
      <path d="M14 42h20" stroke={t.lead} strokeWidth={4} strokeLinecap="round" />
      <path d="M4 32l6-16 6 16c-1.74 1.3-3.84 2-6 2s-4.26-.7-6-2z" fill={t.field} />
      <path d="M32 32l6-16 6 16c-1.74 1.3-3.84 2-6 2s-4.26-.7-6-2z" fill={t.field} />
      <circle cx="24" cy="8" r="3" fill={t.detail} />
    </Svg>
  );
}

/** Infrastructure — two stacked server units. */
export function InfrastructureMark({ size }: MarkProps) {
  const t = appMarkTones("infra")!;

  return (
    <Svg size={size}>
      <rect x="5" y="7" width="38" height="15" rx="4" fill={t.field} />
      <rect x="5" y="26" width="38" height="15" rx="4" fill={t.field} />

      <rect x="10" y="12" width="19" height="5" rx="2.5" fill={t.lead} />
      <rect x="10" y="31" width="19" height="5" rx="2.5" fill={t.lead} />

      <circle cx="36" cy="14.5" r="2.5" fill={t.lead} />
      <circle cx="36" cy="33.5" r="2.5" fill={t.lead} />
    </Svg>
  );
}

/**
 * Engineering — a terminal window: the body in `field`, the title bar in
 * `lead`, and a `>_` prompt in `detail`.
 *
 * Built like the Security shield: the title bar is the window's own top
 * section closed straight across, so the outline is drawn once.
 *
 * Drawn at 36x30 rather than filling the grid. At 40x34 it covered 59% of its
 * box at 64px, heavier than any mark in the set (Security is 49%); at this
 * size it measures 46% and L* 68.8.
 */
export function EngineeringMark({ size }: MarkProps) {
  const t = appMarkTones("engineering")!;
  return (
    <Svg size={size}>
      <rect x="6" y="9" width="36" height="30" rx="5.5" fill={t.field} />
      <path d="M6 14.5A5.5 5.5 0 0 1 11.5 9h25a5.5 5.5 0 0 1 5.5 5.5V17H6z" fill={t.lead} />
      <path
        d="M13 23l5.5 5-5.5 5"
        fill="none"
        stroke={t.detail}
        strokeWidth={4.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="22" y="30.9" width="12" height="4.2" rx="2.1" fill={t.detail} />
    </Svg>
  );
}

/**
 * Knowledge — an open book, traced from the same silhouette as the rail's line
 * icon (lucide's BookOpen, scaled 2x for this 48-unit grid) and split at the
 * spine into two pages. The left page carries the hue and the right one sits
 * back in `field`, the same split People uses for its two figures. Field + lead
 * only, like Me.
 *
 * Scaled to 0.88 about its centre so its weight sits with the rest of the set:
 * 40% coverage and L* 64.0 at 64px.
 */
export function KnowledgeMark({ size }: MarkProps) {
  const t = appMarkTones("knowledge-base")!;
  return (
    <Svg size={size}>
      <g transform="translate(24 24) scale(0.88) translate(-24 -24)">
        <path
          d="M42 36a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H32a8 8 0 0 0-8 8v28a6 6 0 0 1 6-6z"
          fill={t.field}
        />
        <path
          d="M6 36a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h10a8 8 0 0 1 8 8v28a6 6 0 0 0-6-6z"
          fill={t.lead}
        />
      </g>
    </Svg>
  );
}
