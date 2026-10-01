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

// The Post Builder rendering engine — ported near-verbatim from the standalone
// "WSO2 Post Builder" HTML tool (temp/wso2_post_builder_v7_15.1.html). Every
// function here is pure and framework-free: it takes a CanvasRenderingContext2D
// plus explicit state/params, never reads a global or touches the DOM (aside
// from the offscreen canvas recolorToWhite() creates for itself). This is what
// makes the whole module unit-testable and keeps the canvas-drawing logic
// completely decoupled from React.
//
// These are brand-asset constants reproducing WSO2's existing published LinkedIn
// templates exactly — they are NOT app design tokens. Keep COLORS separate from
// @shared/tokens's `tok`: the canvas orange (#F14E23) is a different value from
// tok.orange (#FF6700), and conflating them would be a real, easy-to-miss bug.

import type {
  ColorKey, EventFormat, ImageSource, PostState, PostType, ProjectFile, Slide, TextColorField, TextColors,
} from '../designStudioTypes'
import { PROJECT_VERSION, SLIDE_COLOR_KEYS, SLIDE_KEYS, defaultPostState, defaultTextColors } from '../designStudioTypes'

export const FONT_FAMILY = "'Plus Jakarta Sans',sans-serif"

export const COLORS: Record<ColorKey, string> = { white: '#FFFFFF', black: '#0D0D0D', orange: '#F14E23', blue: '#5CD1FF' }

export const CHIP_DEFS: { k: ColorKey; title: string }[] = [
  { k: 'white', title: 'White' },
  { k: 'black', title: 'Black' },
  { k: 'orange', title: 'Orange' },
  { k: 'blue', title: 'Light blue' },
]

export const LOGO_OPTS: { id: 'aboveHeadline' | 'none'; label: string }[] = [
  { id: 'aboveHeadline', label: 'Above headline' },
  { id: 'none', label: 'No logo' },
]

export const ICON_COLOR_OPTS: { color: '#FFFFFF' | '#F14E23' | '#0D0D0D'; title: string }[] = [
  { color: '#FFFFFF', title: 'White' },
  { color: '#F14E23', title: 'Orange' },
  { color: '#0D0D0D', title: 'Black' },
]

export const POST_TYPE_OPTS: { id: PostType; label: string }[] = [
  { id: 'organic', label: 'Organic Post' },
  { id: 'casestudy', label: 'Case Study' },
  { id: 'ad', label: 'Ad' },
  { id: 'quote', label: 'Quote' },
  { id: 'event', label: 'Event' },
  { id: 'statistic', label: 'Statistic' },
]

export const HEADLINE_WEIGHT_OPTS: { w: 800 | 600 | 500; label: string }[] = [
  { w: 800, label: 'Bold' },
  { w: 600, label: 'Semibold' },
  { w: 500, label: 'Medium' },
]

export const EVENT_FORMAT_OPTS: { id: EventFormat; label: string }[] = [
  { id: 'icons', label: 'Detail icons' },
  { id: 'lockup', label: 'Partner lockup' },
]

export const MAX_IMAGE_MB = 15
// TODO: move this link out of the code, into runtime config (public/config.js).
export const BRAND_KIT_URL = 'https://drive.google.com/drive/folders/1Mtm2MnPQj6yDSW5wDGpXfJ6fDAh_wI-f?usp=drive_link'

export function resolveColor(textColors: TextColors, key: TextColorField): string {
  return COLORS[textColors[key]] ?? '#FFFFFF'
}
export function resolveLogoColor(state: PostState): string {
  return state.logoColor === 'black' ? '#0D0D0D' : '#FFFFFF'
}

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return `"${file.name}" doesn't look like an image file.`
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) return `"${file.name}" is over ${MAX_IMAGE_MB}MB — try a smaller file.`
  return null
}

// Recolors every opaque pixel of an image to solid white while leaving the
// alpha channel untouched — so the logo's exact silhouette is preserved with
// no stretching, skewing, or reshaping, just a flat color swap.
export function recolorToWhite(img: ImageSource): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 'naturalWidth' in img ? (img.naturalWidth || img.width) : img.width
  c.height = 'naturalHeight' in img ? (img.naturalHeight || img.height) : img.height
  const cctx = c.getContext('2d')!
  cctx.drawImage(img, 0, 0, c.width, c.height)
  cctx.globalCompositeOperation = 'source-in'
  cctx.fillStyle = '#FFFFFF'
  cctx.fillRect(0, 0, c.width, c.height)
  return c
}

// ─────────────────────────────────────────────────────────────────────────────
// Background

export function drawBackground(
  ctx: CanvasRenderingContext2D, state: PostState, W: number, H: number,
  carousel: { on: boolean; slideCount: number; activeIdx: number },
) {
  if (state.bgImage) {
    const img = state.bgImage
    const rotDeg = state.bgRotate || 0
    const rotated = rotDeg === 90 || rotDeg === 270
    // Spanning divides the single shared image into N equal vertical strips
    // (N = slide count) and draws only the strip for the currently-rendered
    // slide, so the background flows continuously across the whole carousel
    // instead of repeating the same center-cropped view on every slide. Only
    // makes sense with 2+ slides and no rotation (rotation would mean
    // "horizontal strip" no longer maps to a stable left-to-right axis).
    const spanning = state.bgSpanSlides && carousel.on && carousel.slideCount > 1 && !rotated
    if (spanning) {
      const n = carousel.slideCount, idx = Math.min(carousel.activeIdx, n - 1)
      const sliceW = img.width / n
      // A horizontal flip mirrors the whole panorama, not just this slide's
      // strip: the ctx.scale(-1,1) below already mirrors the pixels *within*
      // whichever strip we draw, but for the strips to still line up edge to
      // edge across slides, we also need to pull from the mirrored slide
      // position — otherwise slide 1 keeps showing the (locally-mirrored)
      // first strip instead of what should now be the last one.
      const sourceIdx = state.bgFlipH ? (n - 1 - idx) : idx
      const sx = sourceIdx * sliceW
      const scale = Math.max(W / sliceW, H / img.height)
      const dw = sliceW * scale, dh = img.height * scale
      ctx.save()
      ctx.translate(W / 2, H / 2)
      ctx.scale(state.bgFlipH ? -1 : 1, state.bgFlipV ? -1 : 1)
      ctx.drawImage(img, sx, 0, sliceW, img.height, -dw / 2, -dh / 2, dw, dh)
      ctx.restore()
    } else {
      // Cover-fit against the image's on-canvas dimensions — swap width/height
      // for the scale calc when rotated 90/270 so it still fully covers W×H.
      const iw = rotated ? img.height : img.width, ih = rotated ? img.width : img.height
      const scale = Math.max(W / iw, H / ih)
      const dw = img.width * scale, dh = img.height * scale
      ctx.save()
      ctx.translate(W / 2, H / 2)
      ctx.rotate((rotDeg * Math.PI) / 180)
      ctx.scale(state.bgFlipH ? -1 : 1, state.bgFlipV ? -1 : 1)
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh)
      ctx.restore()
    }
    ctx.fillStyle = `rgba(13,27,46,${state.overlayOpacity / 100})`
    ctx.fillRect(0, 0, W, H)
  } else {
    // Placeholder until a background image is uploaded. Sits in the bottom
    // strip rather than dead-center — center collides with the content block.
    ctx.fillStyle = '#0D1B2E'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(255,255,255,.03)'
    ctx.font = `600 ${Math.min(W, H) * 0.032}px ${FONT_FAMILY}`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText('Upload a background image', W / 2, H * 0.94)
    ctx.textAlign = 'left'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WSO2 vector logo — exact path data traced from the official WSO2 logo SVG
// (viewBox 0 0 382.13 152.02). ICON_PATHS = the pulse mark only. WORD_PATHS =
// the "WSO2" wordmark only. Both share the same coordinate space, so drawing
// them together with one transform preserves the logo's real proportions.

export const WSO2_ICON_PATHS = [
  "M81.92,94.63s-.09,0-.13,0c-.93-.06-1.71-.69-1.96-1.59l-6.99-25.63-3.58,11.95c-.27.91-1.11,1.54-2.07,1.54h-13.41c-1.19,0-2.16-.97-2.16-2.16s.97-2.16,2.16-2.16h11.8l5.28-17.65c.27-.91,1.12-1.54,2.07-1.54,0,0,.02,0,.03,0,.96.01,1.8.66,2.06,1.59l7.29,26.74,3.16-7.8c.33-.82,1.12-1.35,2-1.35h10.74c1.19,0,2.16.97,2.16,2.16s-.97,2.16-2.16,2.16h-9.29l-5.02,12.38c-.33.82-1.13,1.35-2,1.35Z",
  "M76.01,113.99c-20.94,0-37.98-17.04-37.98-37.98s17.04-37.98,37.98-37.98,37.98,17.04,37.98,37.98-17.04,37.98-37.98,37.98ZM76.01,42.35c-18.56,0-33.66,15.1-33.66,33.66s15.1,33.66,33.66,33.66,33.66-15.1,33.66-33.66-15.1-33.66-33.66-33.66Z",
]
export const WSO2_WORD_PATHS = [
  "M148.85,104.31l-15.2-56.05h9.03l8.09,32.12c.5,1.98.97,4.04,1.39,6.17.43,2.13.85,4.29,1.26,6.47.41,2.18.81,4.36,1.18,6.55h-1.28c.4-2.18.82-4.36,1.24-6.55.43-2.18.87-4.34,1.32-6.47.45-2.13.94-4.19,1.47-6.17l8.31-32.12h9.4l8.24,32.12c.53,1.98,1.02,4.04,1.47,6.17.45,2.13.9,4.29,1.34,6.47.44,2.18.86,4.36,1.26,6.55h-1.35c.4-2.18.8-4.36,1.2-6.55.4-2.18.83-4.34,1.3-6.47.46-2.13.92-4.19,1.37-6.17l8.09-32.12h9.1l-15.27,56.05h-9.89l-8.91-33.21c-.68-2.61-1.3-5.44-1.88-8.5-.58-3.06-1.17-6.42-1.77-10.08h1.96c-.63,3.51-1.2,6.76-1.71,9.74-.51,2.98-1.16,5.93-1.94,8.84l-8.88,33.21h-9.93Z",
  "M228.85,105.25c-4.19,0-7.82-.67-10.91-1.99-3.09-1.33-5.5-3.23-7.24-5.7-1.74-2.47-2.7-5.41-2.88-8.82h8.61c.18,2.03.83,3.71,1.97,5.04s2.63,2.32,4.46,2.97c1.83.65,3.81.98,5.94.98,2.38,0,4.5-.37,6.34-1.11s3.3-1.79,4.38-3.16c1.08-1.37,1.62-2.95,1.62-4.76,0-1.63-.47-2.97-1.41-4.01-.94-1.04-2.21-1.91-3.8-2.6-1.59-.69-3.41-1.3-5.44-1.82l-6.55-1.81c-4.59-1.23-8.17-3.05-10.74-5.45-2.57-2.41-3.86-5.53-3.86-9.37,0-3.23.87-6.06,2.61-8.48,1.74-2.42,4.11-4.3,7.11-5.64,3-1.34,6.38-2.01,10.14-2.01s7.22.67,10.14,2.01c2.92,1.34,5.21,3.18,6.88,5.51,1.67,2.33,2.54,4.99,2.61,7.97h-8.35c-.28-2.56-1.46-4.54-3.55-5.94-2.1-1.4-4.73-2.11-7.92-2.11-2.26,0-4.22.35-5.89,1.05s-2.96,1.67-3.87,2.91c-.92,1.24-1.37,2.65-1.37,4.23,0,1.78.55,3.22,1.64,4.31,1.09,1.09,2.42,1.96,3.99,2.6s3.06,1.15,4.5,1.52l5.45,1.43c1.78.45,3.62,1.06,5.51,1.82,1.89.77,3.64,1.76,5.25,2.97,1.6,1.22,2.9,2.72,3.89,4.51.99,1.79,1.49,3.96,1.49,6.49,0,3.16-.82,5.98-2.44,8.46-1.63,2.48-3.99,4.43-7.09,5.85-3.1,1.42-6.84,2.13-11.23,2.13Z",
  "M278.55,105.06c-4.84,0-9.17-1.15-13-3.44-3.82-2.29-6.83-5.59-9.03-9.89-2.19-4.3-3.29-9.44-3.29-15.4s1.1-11.14,3.29-15.44c2.19-4.3,5.2-7.6,9.03-9.91,3.82-2.31,8.15-3.46,13-3.46s9.16,1.15,12.96,3.46c3.8,2.31,6.8,5.61,8.99,9.91,2.19,4.3,3.29,9.45,3.29,15.44s-1.1,11.1-3.29,15.4c-2.2,4.3-5.19,7.6-8.99,9.89-3.8,2.29-8.12,3.44-12.96,3.44ZM278.55,97.24c3.18,0,6.04-.8,8.56-2.39,2.52-1.59,4.51-3.95,5.98-7.07,1.47-3.12,2.2-6.94,2.2-11.45s-.73-8.41-2.2-11.53c-1.47-3.12-3.46-5.48-5.98-7.07-2.52-1.59-5.37-2.39-8.56-2.39s-6.08.8-8.61,2.41c-2.53,1.61-4.53,3.97-6,7.09-1.47,3.12-2.2,6.95-2.2,11.49s.73,8.33,2.2,11.44c1.47,3.11,3.47,5.47,6,7.07,2.53,1.6,5.4,2.41,8.61,2.41Z",
  "M307.29,104.31v-6.21l19.03-19.67c1.96-2.06,3.59-3.87,4.89-5.45,1.3-1.58,2.29-3.1,2.97-4.55.68-1.45,1.02-3.01,1.02-4.66,0-1.88-.43-3.5-1.3-4.85s-2.04-2.39-3.54-3.12-3.19-1.09-5.1-1.09-3.71.41-5.19,1.22c-1.48.81-2.62,1.96-3.42,3.44-.8,1.48-1.2,3.22-1.2,5.23h-8.24c0-3.41.79-6.4,2.37-8.97,1.58-2.57,3.74-4.56,6.47-5.98,2.73-1.42,5.86-2.12,9.37-2.12s6.69.7,9.38,2.11c2.7,1.41,4.81,3.3,6.34,5.7,1.53,2.4,2.29,5.11,2.29,8.14,0,2.06-.38,4.06-1.15,6.02-.76,1.96-2.11,4.16-4.03,6.62-1.92,2.46-4.62,5.44-8.11,8.95l-10.98,11.47v.45h25.13v7.34h-37.01Z",
]
export const WSO2_ICON_BBOX = { x0: 38.03, y0: 38.03, w: 75.96, h: 75.96 }
export const WSO2_LOCKUP_MINX = 38.03 // leftmost point of the icon = leftmost point of the full lockup
export const WSO2_LOCKUP_WIDTH_RATIO = (344.29 - 38.03) / 75.96 // full icon+wordmark width ÷ icon height

// Draws the customer logo if one's been uploaded; otherwise falls back to
// the category tag text. x/y = left edge / vertical center of the slot.
export function drawTagOrLogo(
  ctx: CanvasRenderingContext2D, state: PostState, textColors: TextColors,
  x: number, y: number, fontSizePx: number, maxW: number, iconR: number,
) {
  if (state.customerLogo) {
    const img = state.customerLogo
    let dh = iconR * 1.7, dw = img.width * (dh / img.height)
    if (dw > maxW) { dw = maxW; dh = img.height * (dw / img.width) }
    ctx.drawImage(img, x, y - dh / 2, dw, dh)
  } else if (state.tag) {
    ctx.save()
    ctx.font = `500 ${fontSizePx}px ${FONT_FAMILY}`
    ctx.fillStyle = resolveColor(textColors, 'tag')
    ctx.textBaseline = 'middle'
    ctx.fillText(state.tag, x, y)
    ctx.restore()
  }
}

// "×" separator between WSO2 and a partner logo — traced from X.svg (two
// stroked lines) rather than a text character, which rendered as mojibake in
// some fonts. s = bounding box side, cx/cy = center.
export function drawXSeparator(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
  const scale = s / 47.33, lw = Math.max(2.05 * scale, 1)
  const x0 = cx - s / 2, y0 = cy - s / 2
  ctx.save()
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'butt'
  ctx.beginPath(); ctx.moveTo(x0 + 0.73 * scale, y0 + 0.73 * scale); ctx.lineTo(x0 + 46.6 * scale, y0 + 46.6 * scale); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x0 + 46.6 * scale, y0 + 0.73 * scale); ctx.lineTo(x0 + 0.73 * scale, y0 + 46.6 * scale); ctx.stroke()
  ctx.restore()
}

export function drawWSO2Icon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  const scale = (r * 2) / WSO2_ICON_BBOX.w
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  ctx.translate(-(WSO2_ICON_BBOX.x0 + WSO2_ICON_BBOX.w / 2), -(WSO2_ICON_BBOX.y0 + WSO2_ICON_BBOX.h / 2))
  ctx.fillStyle = color
  WSO2_ICON_PATHS.forEach(d => ctx.fill(new Path2D(d)))
  ctx.restore()
}

// Draws the full icon+wordmark lockup exactly as laid out in the source SVG
// (same transform for both groups, so the native spacing carries over).
// x = left edge of the icon, y = vertical center of the icon, r = icon radius.
export function drawLogoWordmark(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const scale = (r * 2) / WSO2_ICON_BBOX.w
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.translate(-WSO2_LOCKUP_MINX, -(WSO2_ICON_BBOX.y0 + WSO2_ICON_BBOX.h / 2))
  ctx.fillStyle = color
  WSO2_ICON_PATHS.forEach(d => ctx.fill(new Path2D(d)))
  WSO2_WORD_PATHS.forEach(d => ctx.fill(new Path2D(d)))
  ctx.restore()
}

// ─────────────────────────────────────────────────────────────────────────────
// Rich text — "**word**" inline-bold support, greedy word-wrap, left- and
// right-aligned rendering (the quote block's staggered second line uses the
// right-aligned variant).

export interface RichWord { text: string; bold: boolean }

export function parseInlineBold(text: string): { text: string; bold: boolean }[] {
  const segments: { text: string; bold: boolean }[] = []
  const re = /\*\*(.+?)\*\*/g
  let last = 0, m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) segments.push({ text: text.slice(last, m.index), bold: false })
    segments.push({ text: m[1], bold: true })
    last = re.lastIndex
  }
  if (last < text.length) segments.push({ text: text.slice(last), bold: false })
  return segments
}

export function segmentsToWords(segments: { text: string; bold: boolean }[]): RichWord[] {
  const words: RichWord[] = []
  segments.forEach(seg => {
    seg.text.split(/\s+/).forEach(p => { if (p !== '') words.push({ text: p, bold: seg.bold }) })
  })
  return words
}

export function richFont(weight: number, size: number, family: string): string {
  return `${weight} ${size}px ${family}`
}

export function layoutRichLines(
  ctx: CanvasRenderingContext2D, words: RichWord[], maxW: number, size: number, wNorm: number, wBold: number, family: string,
): RichWord[][] {
  const lines: RichWord[][] = []
  let line: RichWord[] = [], lineW = 0
  ctx.font = richFont(wNorm, size, family)
  const spaceW = ctx.measureText(' ').width
  words.forEach(w => {
    ctx.font = richFont(w.bold ? wBold : wNorm, size, family)
    const ww = ctx.measureText(w.text).width
    const add = line.length ? spaceW + ww : ww
    if (lineW + add > maxW && line.length) { lines.push(line); line = [w]; lineW = ww }
    else { line.push(w); lineW += add }
  })
  if (line.length) lines.push(line)
  return lines
}

export function drawRichLines(
  ctx: CanvasRenderingContext2D, lines: RichWord[][], x: number, y: number, lh: number,
  size: number, wNorm: number, wBold: number, family: string, color: string,
) {
  ctx.fillStyle = color; ctx.textBaseline = 'top'
  ctx.font = richFont(wNorm, size, family)
  const spaceW = ctx.measureText(' ').width
  lines.forEach((line, i) => {
    let cx = x
    line.forEach(w => {
      ctx.font = richFont(w.bold ? wBold : wNorm, size, family)
      ctx.fillText(w.text, cx, y + i * lh)
      cx += ctx.measureText(w.text).width + spaceW
    })
  })
}

export function drawRichLinesRight(
  ctx: CanvasRenderingContext2D, lines: RichWord[][], rightX: number, y: number, lh: number,
  size: number, wNorm: number, wBold: number, family: string, color: string,
) {
  ctx.fillStyle = color; ctx.textBaseline = 'top'
  ctx.font = richFont(wNorm, size, family)
  const spaceW = ctx.measureText(' ').width
  lines.forEach((line, i) => {
    let lineW = 0
    line.forEach((w, idx) => {
      ctx.font = richFont(w.bold ? wBold : wNorm, size, family)
      lineW += ctx.measureText(w.text).width
      if (idx < line.length - 1) lineW += spaceW
    })
    let cx = rightX - lineW
    line.forEach(w => {
      ctx.font = richFont(w.bold ? wBold : wNorm, size, family)
      ctx.fillText(w.text, cx, y + i * lh)
      cx += ctx.measureText(w.text).width + spaceW
    })
  })
}

export function countRichLines(
  ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, wNorm: number, wBold: number, family: string,
): number {
  if (!text) return 0
  const words = segmentsToWords(parseInlineBold(text))
  return layoutRichLines(ctx, words, maxW, size, wNorm, wBold, family).length || 1
}

export function wrapAndDrawRich(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number,
  size: number, wNorm: number, family: string, color: string,
): number {
  if (!text) return 0
  const wBold = Math.min(800, wNorm + 300)
  const words = segmentsToWords(parseInlineBold(text))
  const lines = layoutRichLines(ctx, words, maxW, size, wNorm, wBold, family)
  drawRichLines(ctx, lines, x, y, lh, size, wNorm, wBold, family, color)
  return lines.length
}

// Right-aligned variant — wraps within maxW same as the left version, but
// each line's right edge is flush against rightX instead of its left edge
// starting at x. Used for the quote's second block.
export function wrapAndDrawRichRight(
  ctx: CanvasRenderingContext2D, text: string, rightX: number, y: number, maxW: number, lh: number,
  size: number, wNorm: number, family: string, color: string,
): number {
  if (!text) return 0
  const wBold = Math.min(800, wNorm + 300)
  const words = segmentsToWords(parseInlineBold(text))
  const lines = layoutRichLines(ctx, words, maxW, size, wNorm, wBold, family)
  drawRichLinesRight(ctx, lines, rightX, y, lh, size, wNorm, wBold, family, color)
  return lines.length
}

// ─────────────────────────────────────────────────────────────────────────────
// Quotation-mark glyphs — exact vector paths traced from the supplied
// QUOTES_OPEN / QUOTES_CLOSED SVGs (stroked, not filled). Both share the same
// bounding box within their 288.16×231.88 viewBox.

export const QUOTE_OPEN_PATH = 'M3.56,229.18L67.44,2.69h61.95l-34.07,226.49H3.56ZM159.2,229.18L223.08,2.69h61.95l-34.07,226.49h-91.76Z'
export const QUOTE_CLOSED_PATH = 'M285.03,2.69l-63.88,226.49h-61.95L193.27,2.69h91.76ZM129.39,2.69l-63.88,226.49H3.56L37.63,2.69h91.76Z'
export const QUOTE_GLYPH_BBOX = { x0: 3.6, y0: 2.69, w: 281.4, h: 226.5 }
export const QUOTE_GLYPH_STROKE = 5.39 // native stroke width at the SVG's own scale

export function quoteMarkWidth(h: number): number {
  return h * (QUOTE_GLYPH_BBOX.w / QUOTE_GLYPH_BBOX.h)
}

export function drawQuoteGlyph(ctx: CanvasRenderingContext2D, pathD: string, x: number, y: number, h: number, color: string) {
  const scale = h / QUOTE_GLYPH_BBOX.h
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.translate(-QUOTE_GLYPH_BBOX.x0, -QUOTE_GLYPH_BBOX.y0)
  ctx.strokeStyle = color; ctx.lineWidth = QUOTE_GLYPH_STROKE; ctx.miterLimit = 10
  ctx.stroke(new Path2D(pathD))
  ctx.restore()
}

// Quote layout: opening mark top-left, quote text (optionally in two
// staggered blocks — part 2 right-aligned and indented further in, matching
// the reference), closing mark trailing the last line (with reserved space
// so text can never run under it), then attribution.
export function drawQuoteContentSquare(
  ctx: CanvasRenderingContext2D, state: PostState, textColors: TextColors,
  W: number, pad: number, contentTopY: number, bottomBound: number,
) {
  const color = resolveColor(textColors, 'headline')
  const subColor = resolveColor(textColors, 'sub')
  const weight = state.headlineWeight
  const wBold = Math.min(800, weight + 300)
  const hasP2 = !!state.quote2

  function metrics(scale: number) {
    const fs = W * 0.036 * scale, lh = fs * 1.25
    const markH = W * 0.075 * scale
    const markW = quoteMarkWidth(markH)
    const gap = W * 0.025 * scale
    const reserve = markW + gap
    const rightEdge = W - pad
    const leftMargin1 = pad + markW + W * 0.02 * scale
    const maxW1Full = rightEdge - leftMargin1
    const indent2 = W * 0.09 * scale
    const maxW2 = Math.max(maxW1Full - indent2, maxW1Full * 0.5)
    const maxW1 = Math.max(maxW1Full - reserve, maxW1Full * 0.5)
    const rightX2 = rightEdge - reserve
    const n1 = state.quote1 ? countRichLines(ctx, state.quote1, maxW1, fs, weight, wBold, FONT_FAMILY) : 0
    const n2 = hasP2 ? countRichLines(ctx, state.quote2, maxW2, fs, weight, wBold, FONT_FAMILY) : 0
    const nameFs = W * 0.024 * scale, titleFs = W * 0.019 * scale
    return { fs, lh, markH, markW, leftMargin1, maxW1, maxW2, rightX2, n1, n2, nameFs, titleFs, rightEdge }
  }
  function totalHeight(scale: number) {
    const m = metrics(scale)
    let h = m.n1 * m.lh
    if (m.n2 > 0) h += W * 0.045 * scale + m.n2 * m.lh
    let attrH = 0
    if (state.quoteName) attrH += m.nameFs * 1.3
    if (state.quoteTitle) attrH += m.titleFs * 1.3 + (state.quoteName ? W * 0.006 * scale : 0)
    if (attrH > 0) h += W * 0.05 * scale + attrH
    return h
  }

  const available = bottomBound - contentTopY
  let scale: number
  if (totalHeight(state.textScale) <= available) { scale = state.textScale }
  else {
    let lo = 0.3, hi = state.textScale
    for (let i = 0; i < 15; i++) { const mid = (lo + hi) / 2; if (totalHeight(mid) <= available) lo = mid; else hi = mid }
    scale = lo
  }
  const m = metrics(scale)

  let y = contentTopY
  drawQuoteGlyph(ctx, QUOTE_OPEN_PATH, pad, y, m.markH, '#FFFFFF')

  ctx.textBaseline = 'top'
  if (state.quote1) {
    const n = wrapAndDrawRich(ctx, state.quote1, m.leftMargin1, y, m.maxW1, m.lh, m.fs, weight, FONT_FAMILY, color)
    y += n * m.lh
  }
  if (hasP2) {
    y += W * 0.045 * scale
    const n = wrapAndDrawRichRight(ctx, state.quote2, m.rightX2, y, m.maxW2, m.lh, m.fs, weight, FONT_FAMILY, color)
    y += n * m.lh
  }

  const lastLineTop = y - m.lh
  const markY = lastLineTop + m.lh / 2 - m.markH / 2
  drawQuoteGlyph(ctx, QUOTE_CLOSED_PATH, m.rightEdge - m.markW, markY, m.markH, '#FFFFFF')

  if (state.quoteName || state.quoteTitle) {
    y += W * 0.05 * scale
    ctx.textAlign = 'right'
    if (state.quoteName) {
      ctx.font = `700 ${m.nameFs}px ${FONT_FAMILY}`; ctx.fillStyle = resolveColor(textColors, 'quoteName')
      ctx.fillText('- ' + state.quoteName, m.rightX2, y)
      y += m.nameFs * 1.3
    }
    if (state.quoteTitle) {
      ctx.font = `400 ${m.titleFs}px ${FONT_FAMILY}`; ctx.fillStyle = subColor
      ctx.fillText(state.quoteTitle, m.rightX2, y)
    }
    ctx.textAlign = 'left'
  }
}

// Banner variant: same glyph and attribution treatment, but a single left
// margin throughout since the horizontal zone is much narrower.
export function drawQuoteContentBanner(
  ctx: CanvasRenderingContext2D, state: PostState, textColors: TextColors,
  padX: number, contentMaxW: number, contentTopY: number, bottomBound: number,
) {
  const color = resolveColor(textColors, 'headline')
  const subColor = resolveColor(textColors, 'sub')
  const weight = state.headlineWeight
  const wBold = Math.min(800, weight + 300)
  const refH = bottomBound - contentTopY
  const hasP2 = !!state.quote2

  function metrics(scale: number) {
    const fs = refH * 0.135 * scale, lh = fs * 1.25
    const markH = refH * 0.28 * scale
    const markW = quoteMarkWidth(markH)
    const gap = refH * 0.05 * scale
    const reserve = markW + gap
    const leftMargin = markW + refH * 0.06 * scale
    const maxWFull = Math.max(contentMaxW - leftMargin, contentMaxW * 0.4)
    const maxW1 = Math.max(maxWFull - reserve, maxWFull * 0.4)
    const rightX2 = padX + contentMaxW - reserve
    const n1 = state.quote1 ? countRichLines(ctx, state.quote1, maxW1, fs, weight, wBold, FONT_FAMILY) : 0
    const n2 = hasP2 ? countRichLines(ctx, state.quote2, maxWFull, fs, weight, wBold, FONT_FAMILY) : 0
    const nameFs = refH * 0.08 * scale, titleFs = refH * 0.065 * scale
    return { fs, lh, markH, markW, leftMargin, maxW1, maxWFull, rightX2, n1, n2, nameFs, titleFs }
  }
  function totalHeight(scale: number) {
    const m = metrics(scale)
    let h = m.n1 * m.lh
    if (m.n2 > 0) h += refH * 0.09 * scale + m.n2 * m.lh
    let attrH = 0
    if (state.quoteName) attrH += m.nameFs * 1.3
    if (state.quoteTitle) attrH += m.titleFs * 1.3 + (state.quoteName ? refH * 0.02 * scale : 0)
    if (attrH > 0) h += refH * 0.12 * scale + attrH
    return h
  }

  let scale: number
  if (totalHeight(state.textScale) <= refH) { scale = state.textScale }
  else {
    let lo = 0.3, hi = state.textScale
    for (let i = 0; i < 15; i++) { const mid = (lo + hi) / 2; if (totalHeight(mid) <= refH) lo = mid; else hi = mid }
    scale = lo
  }
  const m = metrics(scale)
  let totalH = m.n1 * m.lh
  if (m.n2 > 0) totalH += refH * 0.09 * scale + m.n2 * m.lh
  let attrH = 0
  if (state.quoteName) attrH += m.nameFs * 1.3
  if (state.quoteTitle) attrH += m.titleFs * 1.3 + (state.quoteName ? refH * 0.02 * scale : 0)
  if (attrH > 0) totalH += refH * 0.12 * scale + attrH
  let y = contentTopY + Math.max(0, (refH - totalH) / 2)

  drawQuoteGlyph(ctx, QUOTE_OPEN_PATH, padX, y, m.markH, '#FFFFFF')
  ctx.textBaseline = 'top'
  if (state.quote1) {
    const n = wrapAndDrawRich(ctx, state.quote1, padX + m.leftMargin, y, m.maxW1, m.lh, m.fs, weight, FONT_FAMILY, color)
    y += n * m.lh
  }
  if (hasP2) {
    y += refH * 0.09 * scale
    const n = wrapAndDrawRichRight(ctx, state.quote2, m.rightX2, y, m.maxWFull, m.lh, m.fs, weight, FONT_FAMILY, color)
    y += n * m.lh
  }

  const lastLineTop = y - m.lh
  const markY = lastLineTop + m.lh / 2 - m.markH / 2
  drawQuoteGlyph(ctx, QUOTE_CLOSED_PATH, padX + contentMaxW - m.markW, markY, m.markH, '#FFFFFF')

  if (state.quoteName || state.quoteTitle) {
    y += refH * 0.12 * scale
    ctx.textAlign = 'right'
    if (state.quoteName) {
      ctx.font = `700 ${m.nameFs}px ${FONT_FAMILY}`; ctx.fillStyle = resolveColor(textColors, 'quoteName')
      ctx.fillText('- ' + state.quoteName, m.rightX2, y)
      y += m.nameFs * 1.3
    }
    if (state.quoteTitle) {
      ctx.font = `400 ${m.titleFs}px ${FONT_FAMILY}`; ctx.fillStyle = subColor
      ctx.fillText(state.quoteTitle, m.rightX2, y)
    }
    ctx.textAlign = 'left'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Filled icons — traced from the supplied date.svg / time.svg / location.svg.
// Each icon's paths are combined into one Path2D so the browser's fill rule
// preserves any holes (e.g. location's ring), matching the source exactly.

interface FilledIconDef { paths: string[]; circles: [number, number, number][]; bbox: { w: number; h: number } }

export const ICON_DATE: FilledIconDef = {
  paths: ["M46.19,10.89h43.45v-6.62C89.64,2.2,92.9.05,94.91,0c2.14-.05,5.6,2.04,5.6,4.27v6.62c10.8-.82,20.88,1.25,27.97,9.88,7.3,8.88,6.17,17.93,6.64,28.67.93,21.2,1.36,43.99-.33,65.16-1.4,17.57-10.75,26.96-28.35,28.35-21.01,1.66-43.46,1.24-64.5.35-14.29-.61-26.46.94-35.75-12.12-5.1-7.17-5.07-14.52-5.51-23.01-1.01-19.51-.83-39.23.03-58.73.46-10.49-.65-19.81,6.44-28.52,7.08-8.69,17.35-10.88,28.17-10.02v-6.62C35.33,2.2,38.58.05,40.59,0c2.14-.05,5.6,2.04,5.6,4.27v6.62ZM35.33,21.75c-7.39-.27-14.16-.37-19.36,5.59-1.83,2.1-4.07,6.76-4.07,9.51v6.62h112.03v-6.62c0-2-1.66-6.01-2.78-7.74-4.83-7.45-12.49-7.78-20.64-7.36v6.62c0,2.23-3.46,4.32-5.6,4.27-2.01-.05-5.26-2.2-5.26-4.27v-6.62h-43.45v6.62c0,2.23-3.46,4.32-5.6,4.27-2.01-.05-5.26-2.2-5.26-4.27v-6.62ZM124.61,54.34H11.23c-.16,11.24-.58,22.51-.36,33.79.17,8.76.01,21.74,1.47,30.1,2.69,15.48,17.73,13.65,29.63,14.17,19.15.84,38.56,1.07,57.71.03,14.06-.77,22.8-2.03,24.26-18.18,1.5-16.58,1.22-35.26.67-51.92-.09-2.66.09-5.34.01-7.99Z"],
  circles: [[40.77, 78.79, 8.14], [67.92, 78.79, 8.14], [95.08, 78.79, 8.14], [40.77, 105.94, 8.14], [67.92, 105.94, 8.14], [95.08, 105.94, 8.14]],
  bbox: { w: 135.94, h: 144.07 },
}
export const ICON_TIME: FilledIconDef = {
  paths: [
    "M82.83,156.32h-9.16l-11.86-1.74c-29.76-6.32-53.7-30.26-60.02-60.02L.06,82.7c.13-3.03-.17-6.14,0-9.16C3.99,4.87,89.82-25.65,136.3,25.73c43.98,48.62,11.38,126.87-53.46,130.59ZM144.3,78.12c0-36.48-29.57-66.05-66.05-66.05S12.2,41.65,12.2,78.12s29.57,66.05,66.05,66.05,66.05-29.57,66.05-66.05Z",
    "M76.95,36.35c3.72-.63,6.57,1.43,7.34,5.04l.13,34.08,22.55,17.16c4.43,5.73-1.4,12.76-7.92,9.14-8.19-4.55-16.44-13.44-24.61-18.46-1.53-1.24-2.15-3.11-2.31-5.02-1-11.6.77-24.61,0-36.36.36-2.64,2.05-5.11,4.81-5.58Z",
  ],
  circles: [],
  bbox: { w: 156.45, h: 156.32 },
}
export const ICON_LOCATION: FilledIconDef = {
  paths: [
    "M55.45,150.32h-2.35c-1.61-.68-2.79-1.96-3.97-3.23-8.35-8.95-17.33-21.42-24.18-31.64C6.39,87.75-12.51,52.58,10.85,21.56c21.65-28.75,65.2-28.74,86.84,0,23.02,30.57,5.03,65-13.16,92.48-7.07,10.68-16.42,23.72-25.12,33.05-1.18,1.27-2.36,2.55-3.97,3.23ZM53.93,9.68c-23.43.2-43.02,18.98-44.3,42.38-1.33,24.34,23.94,60.14,38.78,78.71,1.45,1.82,3.72,4.99,5.28,6.47.21.2.34.51.71.43,9.71-11.71,19.09-24.02,27.03-37.03,8-13.1,18.16-32.35,17.52-48.02-.99-23.85-21.07-43.16-45.01-42.95Z",
    "M81.66,54.38c0,15.12-12.26,27.38-27.38,27.38s-27.38-12.26-27.38-27.38,12.26-27.38,27.38-27.38,27.38,12.26,27.38,27.38ZM71.85,54.39c0-9.71-7.87-17.58-17.58-17.58s-17.58,7.87-17.58,17.58,7.87,17.58,17.58,17.58,17.58-7.87,17.58-17.58Z",
  ],
  circles: [],
  bbox: { w: 108.56, h: 150.32 },
}

// Draws an icon centered at (cx,cy), scaled to fit within an s×s box (scaled
// by its larger dimension so proportions stay exact, no stretch).
export function drawFilledIcon(ctx: CanvasRenderingContext2D, iconDef: FilledIconDef, cx: number, cy: number, s: number, color: string) {
  const scale = s / Math.max(iconDef.bbox.w, iconDef.bbox.h)
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  ctx.translate(-iconDef.bbox.w / 2, -iconDef.bbox.h / 2)
  ctx.fillStyle = color
  if (iconDef.paths.length) ctx.fill(new Path2D(iconDef.paths.join(' ')))
  iconDef.circles.forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill() })
  ctx.restore()
}
export function drawIconCalendar(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) { drawFilledIcon(ctx, ICON_DATE, cx, cy, s, color) }
export function drawIconClock(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) { drawFilledIcon(ctx, ICON_TIME, cx, cy, s, color) }
export function drawIconPin(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) { drawFilledIcon(ctx, ICON_LOCATION, cx, cy, s, color) }

// Draws one icon+text detail row; icon vertically centered on the first text
// line. Returns the block's total rendered height.
export function drawEventRow(
  ctx: CanvasRenderingContext2D,
  iconFn: (ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) => void,
  x: number, y: number, iconSize: number, lines: string[], fontSize: number, lh: number,
  color: string, family: string, weight: number, firstLineWeight?: number,
): number {
  iconFn(ctx, x + iconSize / 2, y + fontSize * 0.55, iconSize, color)
  const textX = x + iconSize * 1.55
  ctx.fillStyle = color; ctx.textBaseline = 'top'
  lines.forEach((line, i) => {
    ctx.font = `${i === 0 && firstLineWeight ? firstLineWeight : weight} ${fontSize}px ${family}`
    ctx.fillText(line, textX, y + i * lh)
  })
  return lines.length * lh
}

// ─────────────────────────────────────────────────────────────────────────────
// Event — "detail icons" format: headline, sub-headline, then date/time/
// location rows each with a small icon (matches the São Paulo reference).
export function drawEventContentSquare(
  ctx: CanvasRenderingContext2D, state: PostState, textColors: TextColors,
  W: number, pad: number, contentTopY: number, bottomBound: number,
) {
  const hlColor = resolveColor(textColors, 'eventHeadline'), subColor = resolveColor(textColors, 'eventSub')
  const detailColor = '#FFFFFF'
  const weight = state.headlineWeight
  const wBold = Math.min(800, weight + 300)
  const maxTextW = W - pad * 2
  const locLines = state.eventLocation ? state.eventLocation.split('\n').filter(l => l !== '') : []

  function metrics(scale: number) {
    const hlFs = W * 0.075 * scale, hlLh = hlFs * 1.15
    const subFs = W * 0.034 * scale, subLh = subFs * 1.3
    const detailFs = W * 0.026 * scale, detailLh = detailFs * 1.4
    const iconSize = W * 0.03 * scale
    const n1 = state.eventHeadline ? countRichLines(ctx, state.eventHeadline, maxTextW, hlFs, weight, wBold, FONT_FAMILY) : 0
    const n2 = state.eventSub ? countRichLines(ctx, state.eventSub, maxTextW, subFs, 500, 800, FONT_FAMILY) : 0
    return { hlFs, hlLh, subFs, subLh, detailFs, detailLh, iconSize, n1, n2 }
  }
  function totalHeight(scale: number) {
    const m = metrics(scale)
    let h = m.n1 * m.hlLh
    if (m.n2 > 0) h += W * 0.02 * scale + m.n2 * m.subLh
    const hasDetails = !!(state.eventDate || state.eventTime || locLines.length > 0)
    if (hasDetails) h += W * 0.055 * scale
    if (state.eventDate) h += m.detailLh + W * 0.02 * scale
    if (state.eventTime) h += m.detailLh + W * 0.02 * scale
    if (locLines.length > 0) h += locLines.length * m.detailLh + W * 0.02 * scale
    return h
  }

  const available = bottomBound - contentTopY
  let scale: number
  if (totalHeight(state.textScale) <= available) { scale = state.textScale }
  else {
    let lo = 0.3, hi = state.textScale
    for (let i = 0; i < 15; i++) { const mid = (lo + hi) / 2; if (totalHeight(mid) <= available) lo = mid; else hi = mid }
    scale = lo
  }
  const m = metrics(scale)

  let y = contentTopY; ctx.textBaseline = 'top'
  if (state.eventHeadline) {
    const n = wrapAndDrawRich(ctx, state.eventHeadline, pad, y, maxTextW, m.hlLh, m.hlFs, weight, FONT_FAMILY, hlColor)
    y += n * m.hlLh
  }
  if (state.eventSub) {
    y += W * 0.02 * scale
    const n = wrapAndDrawRich(ctx, state.eventSub, pad, y, maxTextW, m.subLh, m.subFs, 500, FONT_FAMILY, subColor)
    y += n * m.subLh
  }
  if (state.eventDate || state.eventTime || locLines.length > 0) y += W * 0.055 * scale
  if (state.eventDate) {
    y += drawEventRow(ctx, drawIconCalendar, pad, y, m.iconSize, [state.eventDate], m.detailFs, m.detailLh, detailColor, FONT_FAMILY, 600)
    y += W * 0.02 * scale
  }
  if (state.eventTime) {
    y += drawEventRow(ctx, drawIconClock, pad, y, m.iconSize, [state.eventTime], m.detailFs, m.detailLh, detailColor, FONT_FAMILY, 600)
    y += W * 0.02 * scale
  }
  if (locLines.length > 0) {
    drawEventRow(ctx, drawIconPin, pad, y, m.iconSize, locLines, m.detailFs, m.detailLh, detailColor, FONT_FAMILY, 500, 700)
  }
}

// Event — "partner lockup" format: WSO2 × partner logo row up top, then a
// kicker, event name, venue, and dates (matches the Vietnam reference). No
// pulse icon or tag in this format — the lockup itself is the branding.
export function drawEventLockupSquare(
  ctx: CanvasRenderingContext2D, state: PostState, textColors: TextColors, W: number, pad: number, bottomBound: number,
) {
  const color = resolveColor(textColors, 'headline'), subColor = resolveColor(textColors, 'sub')
  const weight = state.headlineWeight
  const wBold = Math.min(800, weight + 300)
  const maxTextW = W - pad * 2
  const lockupR = W * 0.028
  const gap = W * 0.09

  function metrics(scale: number) {
    const kFs = W * 0.024 * scale, kLh = kFs * 1.3
    const hlFs = W * 0.062 * scale, hlLh = hlFs * 1.15
    const lineFs = W * 0.028 * scale, lineLh = lineFs * 1.4
    const n1 = state.eventName ? countRichLines(ctx, state.eventName, maxTextW, hlFs, weight, wBold, FONT_FAMILY) : 0
    return { kFs, kLh, hlFs, hlLh, lineFs, lineLh, n1 }
  }
  function textBlockHeight(scale: number) {
    const m = metrics(scale)
    let h = 0
    if (state.eventKicker) h += m.kLh + W * 0.012 * scale
    h += m.n1 * m.hlLh
    const lines = (state.eventVenue ? 1 : 0) + (state.eventDates ? 1 : 0)
    if (lines > 0) h += W * 0.038 * scale + lines * m.lineLh
    return h
  }

  const minTop = W * 0.06
  const available = bottomBound - minTop - lockupR * 2 - gap
  let scale: number
  if (textBlockHeight(state.textScale) <= available) { scale = state.textScale }
  else {
    let lo = 0.3, hi = state.textScale
    for (let i = 0; i < 15; i++) { const mid = (lo + hi) / 2; if (textBlockHeight(mid) <= available) lo = mid; else hi = mid }
    scale = lo
  }
  const m = metrics(scale)
  const textH = textBlockHeight(scale)

  // Center the whole lockup+gap+text composition, so the balance holds
  // regardless of how much text there is, rather than pinning everything to
  // the top and leaving a big empty gap at the bottom.
  const totalCompH = lockupR * 2 + gap + textH
  const compTop = Math.max(minTop, (bottomBound - totalCompH) / 2)
  const lockupY = compTop + lockupR

  drawLogoWordmark(ctx, pad, lockupY, lockupR, resolveLogoColor(state))
  let lx = pad + lockupR * 2 * WSO2_LOCKUP_WIDTH_RATIO + W * 0.022
  const xSize = lockupR * 0.85
  drawXSeparator(ctx, lx + xSize / 2, lockupY, xSize, resolveLogoColor(state))
  lx += xSize + W * 0.022
  if (state.partnerLogo) {
    const img = state.partnerLogo
    const dh = lockupR * 1.9, dw = img.width * (dh / img.height)
    ctx.drawImage(img, lx, lockupY - dh / 2, dw, dh)
  }

  let y = compTop + lockupR * 2 + gap; ctx.textBaseline = 'top'
  if (state.eventKicker) {
    ctx.font = `500 ${m.kFs}px ${FONT_FAMILY}`; ctx.fillStyle = subColor
    ctx.fillText(state.eventKicker, pad, y)
    y += m.kLh + W * 0.012 * scale
  }
  if (state.eventName) {
    const n = wrapAndDrawRich(ctx, state.eventName, pad, y, maxTextW, m.hlLh, m.hlFs, weight, FONT_FAMILY, color)
    y += n * m.hlLh
  }
  if (state.eventVenue || state.eventDates) {
    y += W * 0.038 * scale
    ctx.font = `600 ${m.lineFs}px ${FONT_FAMILY}`; ctx.fillStyle = color
    if (state.eventVenue) { ctx.fillText(state.eventVenue, pad, y); y += m.lineLh }
    if (state.eventDates) { ctx.fillText(state.eventDates, pad, y); y += m.lineLh }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Statistic — optional lead-in, a big hero number, a label below it, an
// optional second stat pair underneath, and an optional CTA.
export function drawStatContentSquare(
  ctx: CanvasRenderingContext2D, state: PostState, textColors: TextColors,
  W: number, pad: number, contentTopY: number, bottomBound: number,
) {
  const color = resolveColor(textColors, 'headline')
  const weight = state.headlineWeight
  const wBold = Math.min(800, weight + 300)
  const maxTextW = W - pad * 2
  const hasSecond = state.statTwoUp && !!(state.statNumber2 || state.statLabel2)

  function metrics(scale: number) {
    const leadinFs = W * 0.032 * scale, leadinLh = leadinFs * 1.3
    const numFs = W * 0.155 * scale, numLh = numFs * 1.05
    const labelFs = W * 0.038 * scale, labelLh = labelFs * 1.35
    const num2Fs = W * 0.095 * scale, num2Lh = num2Fs * 1.08
    const label2Fs = W * 0.032 * scale, label2Lh = label2Fs * 1.35
    const n0 = state.statLeadin ? countRichLines(ctx, state.statLeadin, maxTextW, leadinFs, 500, 800, FONT_FAMILY) : 0
    const n1 = state.statNumber ? countRichLines(ctx, state.statNumber, maxTextW, numFs, weight, wBold, FONT_FAMILY) : 0
    const n2 = state.statLabel ? countRichLines(ctx, state.statLabel, maxTextW, labelFs, 500, 800, FONT_FAMILY) : 0
    const n3 = hasSecond && state.statNumber2 ? countRichLines(ctx, state.statNumber2, maxTextW, num2Fs, weight, wBold, FONT_FAMILY) : 0
    const n4 = hasSecond && state.statLabel2 ? countRichLines(ctx, state.statLabel2, maxTextW, label2Fs, 500, 800, FONT_FAMILY) : 0
    return { leadinFs, leadinLh, numFs, numLh, labelFs, labelLh, num2Fs, num2Lh, label2Fs, label2Lh, n0, n1, n2, n3, n4 }
  }
  function totalHeight(scale: number) {
    const m = metrics(scale)
    let h = 0
    if (m.n0 > 0) h += m.n0 * m.leadinLh + W * 0.012 * scale
    h += m.n1 * m.numLh
    if (m.n2 > 0) h += W * 0.012 * scale + m.n2 * m.labelLh
    if (hasSecond) {
      h += W * 0.045 * scale + m.n3 * m.num2Lh
      if (m.n4 > 0) h += W * 0.01 * scale + m.n4 * m.label2Lh
    }
    if (state.cta) h += W * 0.05 * scale + W * 0.056 * scale
    return h
  }

  const available = bottomBound - contentTopY
  let scale: number
  if (totalHeight(state.textScale) <= available) { scale = state.textScale }
  else {
    let lo = 0.3, hi = state.textScale
    for (let i = 0; i < 15; i++) { const mid = (lo + hi) / 2; if (totalHeight(mid) <= available) lo = mid; else hi = mid }
    scale = lo
  }
  const m = metrics(scale)
  const totalH = totalHeight(scale)

  let y = contentTopY + Math.max(0, (available - totalH) / 2); ctx.textBaseline = 'top'
  if (state.statLeadin) {
    const n = wrapAndDrawRich(ctx, state.statLeadin, pad, y, maxTextW, m.leadinLh, m.leadinFs, 500, FONT_FAMILY, color)
    y += n * m.leadinLh + W * 0.012 * scale
  }
  if (state.statNumber) {
    const n = wrapAndDrawRich(ctx, state.statNumber, pad, y, maxTextW, m.numLh, m.numFs, weight, FONT_FAMILY, color)
    y += n * m.numLh
  }
  if (state.statLabel) {
    y += W * 0.012 * scale
    const n = wrapAndDrawRich(ctx, state.statLabel, pad, y, maxTextW, m.labelLh, m.labelFs, 500, FONT_FAMILY, color)
    y += n * m.labelLh
  }
  if (hasSecond) {
    y += W * 0.045 * scale
    if (state.statNumber2) {
      const n = wrapAndDrawRich(ctx, state.statNumber2, pad, y, maxTextW, m.num2Lh, m.num2Fs, weight, FONT_FAMILY, color)
      y += n * m.num2Lh
    }
    if (state.statLabel2) {
      y += W * 0.01 * scale
      const n = wrapAndDrawRich(ctx, state.statLabel2, pad, y, maxTextW, m.label2Lh, m.label2Fs, 500, FONT_FAMILY, color)
      y += n * m.label2Lh
    }
  }
  if (state.cta) {
    y += W * 0.05 * scale
    const cSize = Math.max(W * 0.033 * scale, W * 0.017)
    ctx.font = `500 ${cSize}px ${FONT_FAMILY}`
    const ctaW = ctx.measureText(state.cta).width + W * 0.08 * scale
    const ctaH = W * 0.056 * scale
    ctx.strokeStyle = 'rgba(255,255,255,.55)'
    ctx.lineWidth = Math.max(W * 0.0025 * scale, 1)
    ctx.beginPath(); ctx.roundRect(pad, y, ctaW, ctaH, ctaH / 2); ctx.stroke()
    ctx.fillStyle = '#FFFFFF'; ctx.textBaseline = 'middle'
    ctx.fillText(state.cta, pad + ctaW / 2 - ctx.measureText(state.cta).width / 2, y + ctaH / 2 - cSize * 0.06)
  }
}

export function drawStatContentBanner(
  ctx: CanvasRenderingContext2D, state: PostState, textColors: TextColors,
  padX: number, contentMaxW: number, topY: number, bottomY: number,
) {
  const color = resolveColor(textColors, 'headline')
  const weight = state.headlineWeight
  const wBold = Math.min(800, weight + 300)
  const refH = bottomY - topY
  const hasSecond = state.statTwoUp && !!(state.statNumber2 || state.statLabel2)

  function metrics(scale: number) {
    const leadinFs = refH * 0.09 * scale, leadinLh = leadinFs * 1.3
    const numFs = refH * 0.34 * scale, numLh = numFs * 1.05
    const labelFs = refH * 0.095 * scale, labelLh = labelFs * 1.35
    const num2Fs = refH * 0.2 * scale, num2Lh = num2Fs * 1.08
    const label2Fs = refH * 0.08 * scale, label2Lh = label2Fs * 1.35
    const n0 = state.statLeadin ? countRichLines(ctx, state.statLeadin, contentMaxW, leadinFs, 500, 800, FONT_FAMILY) : 0
    const n1 = state.statNumber ? countRichLines(ctx, state.statNumber, contentMaxW, numFs, weight, wBold, FONT_FAMILY) : 0
    const n2 = state.statLabel ? countRichLines(ctx, state.statLabel, contentMaxW, labelFs, 500, 800, FONT_FAMILY) : 0
    const n3 = hasSecond && state.statNumber2 ? countRichLines(ctx, state.statNumber2, contentMaxW, num2Fs, weight, wBold, FONT_FAMILY) : 0
    const n4 = hasSecond && state.statLabel2 ? countRichLines(ctx, state.statLabel2, contentMaxW, label2Fs, 500, 800, FONT_FAMILY) : 0
    return { leadinFs, leadinLh, numFs, numLh, labelFs, labelLh, num2Fs, num2Lh, label2Fs, label2Lh, n0, n1, n2, n3, n4 }
  }
  function totalHeight(scale: number) {
    const m = metrics(scale)
    let h = 0
    if (m.n0 > 0) h += m.n0 * m.leadinLh + refH * 0.025 * scale
    h += m.n1 * m.numLh
    if (m.n2 > 0) h += refH * 0.025 * scale + m.n2 * m.labelLh
    if (hasSecond) {
      h += refH * 0.09 * scale + m.n3 * m.num2Lh
      if (m.n4 > 0) h += refH * 0.02 * scale + m.n4 * m.label2Lh
    }
    if (state.cta) h += refH * 0.1 * scale + refH * 0.104 * scale
    return h
  }

  let scale: number
  if (totalHeight(state.textScale) <= refH) { scale = state.textScale }
  else {
    let lo = 0.3, hi = state.textScale
    for (let i = 0; i < 15; i++) { const mid = (lo + hi) / 2; if (totalHeight(mid) <= refH) lo = mid; else hi = mid }
    scale = lo
  }
  const m = metrics(scale)
  const totalH = totalHeight(scale)
  let y = topY + Math.max(0, (refH - totalH) / 2); ctx.textBaseline = 'top'

  if (state.statLeadin) {
    const n = wrapAndDrawRich(ctx, state.statLeadin, padX, y, contentMaxW, m.leadinLh, m.leadinFs, 500, FONT_FAMILY, color)
    y += n * m.leadinLh + refH * 0.025 * scale
  }
  if (state.statNumber) {
    const n = wrapAndDrawRich(ctx, state.statNumber, padX, y, contentMaxW, m.numLh, m.numFs, weight, FONT_FAMILY, color)
    y += n * m.numLh
  }
  if (state.statLabel) {
    y += refH * 0.025 * scale
    const n = wrapAndDrawRich(ctx, state.statLabel, padX, y, contentMaxW, m.labelLh, m.labelFs, 500, FONT_FAMILY, color)
    y += n * m.labelLh
  }
  if (hasSecond) {
    y += refH * 0.09 * scale
    if (state.statNumber2) {
      const n = wrapAndDrawRich(ctx, state.statNumber2, padX, y, contentMaxW, m.num2Lh, m.num2Fs, weight, FONT_FAMILY, color)
      y += n * m.num2Lh
    }
    if (state.statLabel2) {
      y += refH * 0.02 * scale
      const n = wrapAndDrawRich(ctx, state.statLabel2, padX, y, contentMaxW, m.label2Lh, m.label2Fs, 500, FONT_FAMILY, color)
      y += n * m.label2Lh
    }
  }
  if (state.cta) {
    y += refH * 0.1 * scale
    const cSize = Math.max(refH * 0.058 * scale, refH * 0.032)
    ctx.font = `500 ${cSize}px ${FONT_FAMILY}`
    const ctaW = ctx.measureText(state.cta).width + refH * 0.13 * scale
    const ctaH = refH * 0.104 * scale
    ctx.strokeStyle = 'rgba(255,255,255,.55)'
    ctx.lineWidth = Math.max(refH * 0.006 * scale, 1)
    ctx.beginPath(); ctx.roundRect(padX, y, ctaW, ctaH, ctaH / 2); ctx.stroke()
    ctx.fillStyle = '#FFFFFF'; ctx.textBaseline = 'middle'
    ctx.fillText(state.cta, padX + ctaW / 2 - ctx.measureText(state.cta).width / 2, y + ctaH / 2 - cSize * 0.06)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Event banner variants — single column, sized off the available vertical
// space (refH) since the left zone is much narrower.
export function drawEventContentBanner(
  ctx: CanvasRenderingContext2D, state: PostState, textColors: TextColors,
  padX: number, contentMaxW: number, topY: number, bottomY: number,
) {
  const hlColor = resolveColor(textColors, 'eventHeadline'), subColor = resolveColor(textColors, 'eventSub')
  const detailColor = '#FFFFFF'
  const weight = state.headlineWeight
  const wBold = Math.min(800, weight + 300)
  const refH = bottomY - topY
  const locLines = state.eventLocation ? state.eventLocation.split('\n').filter(l => l !== '') : []

  function metrics(scale: number) {
    const hlFs = refH * 0.155 * scale, hlLh = hlFs * 1.15
    const subFs = refH * 0.075 * scale, subLh = subFs * 1.3
    const detailFs = refH * 0.062 * scale, detailLh = detailFs * 1.4
    const iconSize = refH * 0.075 * scale
    const n1 = state.eventHeadline ? countRichLines(ctx, state.eventHeadline, contentMaxW, hlFs, weight, wBold, FONT_FAMILY) : 0
    const n2 = state.eventSub ? countRichLines(ctx, state.eventSub, contentMaxW, subFs, 500, 800, FONT_FAMILY) : 0
    return { hlFs, hlLh, subFs, subLh, detailFs, detailLh, iconSize, n1, n2 }
  }
  const hasDetails = !!(state.eventDate || state.eventTime || locLines.length > 0)
  function totalHeight(scale: number) {
    const m = metrics(scale)
    let h = m.n1 * m.hlLh
    if (m.n2 > 0) h += refH * 0.045 * scale + m.n2 * m.subLh
    if (hasDetails) h += refH * 0.11 * scale
    if (state.eventDate) h += m.detailLh + refH * 0.045 * scale
    if (state.eventTime) h += m.detailLh + refH * 0.045 * scale
    if (locLines.length > 0) h += locLines.length * m.detailLh + refH * 0.045 * scale
    return h
  }

  let scale: number
  if (totalHeight(state.textScale) <= refH) { scale = state.textScale }
  else {
    let lo = 0.3, hi = state.textScale
    for (let i = 0; i < 15; i++) { const mid = (lo + hi) / 2; if (totalHeight(mid) <= refH) lo = mid; else hi = mid }
    scale = lo
  }
  const m = metrics(scale)
  const totalH = totalHeight(scale)
  let y = topY + Math.max(0, (refH - totalH) / 2)
  ctx.textBaseline = 'top'
  if (state.eventHeadline) {
    const n = wrapAndDrawRich(ctx, state.eventHeadline, padX, y, contentMaxW, m.hlLh, m.hlFs, weight, FONT_FAMILY, hlColor)
    y += n * m.hlLh
  }
  if (state.eventSub) {
    y += refH * 0.045 * scale
    const n = wrapAndDrawRich(ctx, state.eventSub, padX, y, contentMaxW, m.subLh, m.subFs, 500, FONT_FAMILY, subColor)
    y += n * m.subLh
  }
  if (hasDetails) y += refH * 0.11 * scale
  if (state.eventDate) {
    y += drawEventRow(ctx, drawIconCalendar, padX, y, m.iconSize, [state.eventDate], m.detailFs, m.detailLh, detailColor, FONT_FAMILY, 600)
    y += refH * 0.045 * scale
  }
  if (state.eventTime) {
    y += drawEventRow(ctx, drawIconClock, padX, y, m.iconSize, [state.eventTime], m.detailFs, m.detailLh, detailColor, FONT_FAMILY, 600)
    y += refH * 0.045 * scale
  }
  if (locLines.length > 0) {
    drawEventRow(ctx, drawIconPin, padX, y, m.iconSize, locLines, m.detailFs, m.detailLh, detailColor, FONT_FAMILY, 500, 700)
  }
}

export function drawEventLockupBanner(
  ctx: CanvasRenderingContext2D, state: PostState, textColors: TextColors,
  padX: number, contentMaxW: number, topY: number, bottomY: number,
) {
  const color = resolveColor(textColors, 'headline'), subColor = resolveColor(textColors, 'sub')
  const weight = state.headlineWeight
  const wBold = Math.min(800, weight + 300)
  const refH = bottomY - topY
  const lockupR = refH * 0.075
  const gap = refH * 0.09

  function metrics(scale: number) {
    const kFs = refH * 0.062 * scale, kLh = kFs * 1.3
    const hlFs = refH * 0.135 * scale, hlLh = hlFs * 1.15
    const lineFs = refH * 0.07 * scale, lineLh = lineFs * 1.4
    const n1 = state.eventName ? countRichLines(ctx, state.eventName, contentMaxW, hlFs, weight, wBold, FONT_FAMILY) : 0
    return { kFs, kLh, hlFs, hlLh, lineFs, lineLh, n1 }
  }
  function textBlockHeight(scale: number) {
    const m = metrics(scale)
    let h = 0
    if (state.eventKicker) h += m.kLh + refH * 0.025 * scale
    h += m.n1 * m.hlLh
    const lines = (state.eventVenue ? 1 : 0) + (state.eventDates ? 1 : 0)
    if (lines > 0) h += refH * 0.07 * scale + lines * m.lineLh
    return h
  }

  const available = refH - lockupR * 2 - gap
  let scale: number
  if (textBlockHeight(state.textScale) <= available) { scale = state.textScale }
  else {
    let lo = 0.3, hi = state.textScale
    for (let i = 0; i < 15; i++) { const mid = (lo + hi) / 2; if (textBlockHeight(mid) <= available) lo = mid; else hi = mid }
    scale = lo
  }
  const m = metrics(scale)
  const textH = textBlockHeight(scale)

  const totalCompH = lockupR * 2 + gap + textH
  const compTop = Math.max(topY, topY + (refH - totalCompH) / 2)
  const lockupY = compTop + lockupR

  drawLogoWordmark(ctx, padX, lockupY, lockupR, resolveLogoColor(state))
  let lx = padX + lockupR * 2 * WSO2_LOCKUP_WIDTH_RATIO + refH * 0.03
  const xSize = lockupR * 0.85
  drawXSeparator(ctx, lx + xSize / 2, lockupY, xSize, resolveLogoColor(state))
  lx += xSize + refH * 0.03
  if (state.partnerLogo) {
    const img = state.partnerLogo
    const dh = lockupR * 1.9, dw = img.width * (dh / img.height)
    ctx.drawImage(img, lx, lockupY - dh / 2, dw, dh)
  }

  let y = compTop + lockupR * 2 + gap; ctx.textBaseline = 'top'
  if (state.eventKicker) {
    ctx.font = `500 ${m.kFs}px ${FONT_FAMILY}`; ctx.fillStyle = subColor
    ctx.fillText(state.eventKicker, padX, y)
    y += m.kLh + refH * 0.025 * scale
  }
  if (state.eventName) {
    const n = wrapAndDrawRich(ctx, state.eventName, padX, y, contentMaxW, m.hlLh, m.hlFs, weight, FONT_FAMILY, color)
    y += n * m.hlLh
  }
  if (state.eventVenue || state.eventDates) {
    y += refH * 0.07 * scale
    ctx.font = `600 ${m.lineFs}px ${FONT_FAMILY}`; ctx.fillStyle = color
    if (state.eventVenue) { ctx.fillText(state.eventVenue, padX, y); y += m.lineLh }
    if (state.eventDates) { ctx.fillText(state.eventDates, padX, y); y += m.lineLh }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-fit text scaling — measures the stacked height of a set of text items
// (headline/sub/body) at a given scale, then binary-searches (15 iterations)
// for the largest scale (<=textScale, >=minScale) at which everything fits.
// This guarantees monotonicity — a higher "Text size" slider value can never
// produce smaller rendered text than a lower one.

export interface FitItem { text: string; weight: number; baseSize: number; lhRatio: number; gapAfter: number }

export function measureStackHeight(ctx: CanvasRenderingContext2D, scale: number, items: FitItem[], maxW: number): number {
  let total = 0
  items.forEach(it => {
    if (!it.text) return
    const size = it.baseSize * scale
    const lh = size * it.lhRatio
    const wBold = Math.min(800, it.weight + 300)
    total += countRichLines(ctx, it.text, maxW, size, it.weight, wBold, FONT_FAMILY) * lh + it.gapAfter * scale
  })
  return total
}

export function fitScale(
  ctx: CanvasRenderingContext2D, items: FitItem[], maxW: number, extraFixed: number,
  available: number, minScale: number, textScale: number,
): number {
  const total = (scale: number) => measureStackHeight(ctx, scale, items, maxW) + extraFixed * scale
  if (total(textScale) <= available) return textScale
  let lo = minScale, hi = textScale
  for (let i = 0; i < 15; i++) { const mid = (lo + hi) / 2; if (total(mid) <= available) lo = mid; else hi = mid }
  return lo
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-level renderers — dispatch to the per-type layout above.

export function renderSquare(ctx: CanvasRenderingContext2D, state: PostState, textColors: TextColors, W: number, H: number) {
  const pad = W * 0.1
  const iconR = W * 0.037
  const topY = H * 0.085
  const contentTopY = H * 0.38
  const isEventLockup = state.type === 'event' && state.eventFormat === 'lockup'

  // Top bar: tag/logo left, pulse right — both vertically centred on same
  // line. Skipped for the event "partner lockup" format, which draws its own
  // WSO2 × partner branding row instead.
  if (!isEventLockup) {
    if (state.iconOn) drawWSO2Icon(ctx, W - pad - iconR, topY, iconR, state.iconColor)
    if (state.type !== 'organic' && state.type !== 'quote' && state.type !== 'event' && (state.tag || state.customerLogo)) {
      const tagMaxW = (W - pad - iconR * 2.4) - pad
      drawTagOrLogo(ctx, state, textColors, pad, topY, W * 0.017, tagMaxW, iconR)
    }
  }

  // Logo — tracks the headline's actual top position (contentTopY) so it
  // always sits a fixed gap above the headline, wherever that lands.
  if (!isEventLockup && state.logoPos === 'aboveHeadline') {
    const lR = W * 0.028
    const lY = Math.max(topY + iconR * 1.6, contentTopY - lR * 2.4)
    drawLogoWordmark(ctx, pad, lY, lR, resolveLogoColor(state))
  }

  // Bottom margin matches the top gap (topY), plus a small extra buffer so
  // content never sits exactly at the computed boundary — auto-fit shrinks to
  // a scale that's calculated to just barely fit, which leaves no room for
  // any real-world rounding, so a bit of slack here is what actually
  // guarantees nothing clips.
  const bottomBound = H - topY - H * 0.025
  // Hard clip as a backstop: whatever the auto-fit scale computes, nothing
  // drawn by the content functions below can ever render past bottomBound.
  ctx.save()
  ctx.beginPath(); ctx.rect(0, 0, W, bottomBound); ctx.clip()
  if (state.type === 'quote') {
    drawQuoteContentSquare(ctx, state, textColors, W, pad, contentTopY, bottomBound)
    ctx.restore()
    return
  }
  if (state.type === 'event') {
    if (state.eventFormat === 'lockup') drawEventLockupSquare(ctx, state, textColors, W, pad, bottomBound)
    else drawEventContentSquare(ctx, state, textColors, W, pad, contentTopY, bottomBound)
    ctx.restore()
    return
  }
  if (state.type === 'statistic') {
    drawStatContentSquare(ctx, state, textColors, W, pad, contentTopY, bottomBound)
    ctx.restore()
    return
  }

  // Content — font sizes auto-scale down so headline/sub/body/CTA always fit
  // between the headline's start and the bottom of the canvas.
  const maxTextW = W - pad * 2
  const scale = fitScale(ctx, [
    { text: state.headline, weight: state.headlineWeight, baseSize: W * 0.086, lhRatio: 1.15, gapAfter: W * 0.015 },
    { text: state.sub, weight: 500, baseSize: W * 0.042, lhRatio: 1.32, gapAfter: W * 0.013 },
    { text: state.body, weight: 400, baseSize: W * 0.031, lhRatio: 1.5, gapAfter: W * 0.016 },
  ], maxTextW, state.cta ? (W * 0.056 + W * 0.008) : 0, bottomBound - contentTopY, 0.3, state.textScale)

  let y = contentTopY; ctx.textBaseline = 'top'
  const hlSize = W * 0.086 * scale; const hlLH = hlSize * 1.15
  const hlN = wrapAndDrawRich(ctx, state.headline, pad, y, maxTextW, hlLH, hlSize, state.headlineWeight, FONT_FAMILY, resolveColor(textColors, 'headline'))
  y += hlN * hlLH + W * 0.015 * scale

  if (state.sub) {
    const sSize = W * 0.042 * scale; const sLH = sSize * 1.32
    const sN = wrapAndDrawRich(ctx, state.sub, pad, y, maxTextW, sLH, sSize, 500, FONT_FAMILY, resolveColor(textColors, 'sub'))
    y += sN * sLH + W * 0.013 * scale
  }
  if (state.body) {
    const bSize = W * 0.031 * scale; const bLH = bSize * 1.5
    const bN = wrapAndDrawRich(ctx, state.body, pad, y, maxTextW, bLH, bSize, 400, FONT_FAMILY, resolveColor(textColors, 'body'))
    y += bN * bLH + W * 0.016 * scale
  }
  if (state.cta) {
    const cSize = Math.max(W * 0.033 * scale, W * 0.017)
    ctx.font = `500 ${cSize}px ${FONT_FAMILY}`
    const ctaW = ctx.measureText(state.cta).width + W * 0.08 * scale
    const ctaH = W * 0.056 * scale; const ctaY = y + W * 0.008 * scale
    ctx.strokeStyle = 'rgba(255,255,255,.55)'
    ctx.lineWidth = Math.max(W * 0.0025 * scale, 1)
    ctx.beginPath(); ctx.roundRect(pad, ctaY, ctaW, ctaH, ctaH / 2); ctx.stroke()
    ctx.fillStyle = '#FFFFFF'; ctx.textBaseline = 'middle'
    ctx.fillText(state.cta, pad + ctaW / 2 - ctx.measureText(state.cta).width / 2, ctaY + ctaH / 2 - cSize * 0.06)
  }
  ctx.restore()
}

export function renderBanner(ctx: CanvasRenderingContext2D, state: PostState, textColors: TextColors, W: number, H: number) {
  // Banner: 1200x628 — icon/tag sit in a slim top row; content below uses
  // (almost) the full width, same as renderSquare.
  const padX = W * 0.07
  const padY = H * 0.09
  const iconR = H * 0.045
  const topY = H * 0.09
  const isEventLockup = state.type === 'event' && state.eventFormat === 'lockup'

  if (!isEventLockup) {
    if (state.iconOn) drawWSO2Icon(ctx, W - padX - iconR, topY, iconR, state.iconColor)
    if (state.type !== 'organic' && state.type !== 'quote' && state.type !== 'event' && (state.tag || state.customerLogo)) {
      const tagMaxW = (W - padX - iconR * 2.4) - padX
      drawTagOrLogo(ctx, state, textColors, padX, topY, H * 0.022, tagMaxW, iconR)
    }
  }

  const lR = H * 0.032
  const contentMaxW = W - padX * 2
  const topMargin = padY + H * 0.08
  const bottomMargin = topMargin + H * 0.02
  // Hard clip as a backstop — see the matching comment in renderSquare.
  ctx.save()
  ctx.beginPath(); ctx.rect(0, 0, W, H - bottomMargin); ctx.clip()
  if (state.type === 'quote') {
    drawQuoteContentBanner(ctx, state, textColors, padX, contentMaxW, topMargin, H - bottomMargin)
    ctx.restore()
    return
  }
  if (state.type === 'event') {
    if (state.eventFormat === 'lockup') drawEventLockupBanner(ctx, state, textColors, padX, contentMaxW, topMargin, H - bottomMargin)
    else drawEventContentBanner(ctx, state, textColors, padX, contentMaxW, topMargin, H - bottomMargin)
    ctx.restore()
    return
  }
  if (state.type === 'statistic') {
    drawStatContentBanner(ctx, state, textColors, padX, contentMaxW, topMargin, H - bottomMargin)
    ctx.restore()
    return
  }

  // Content block — vertically centered in left zone; sizes auto-scale to
  // keep everything on-canvas.
  ctx.textBaseline = 'top'
  const scale = fitScale(ctx, [
    { text: state.headline, weight: state.headlineWeight, baseSize: H * 0.1, lhRatio: 1.12, gapAfter: H * 0.02 },
    { text: state.sub, weight: 500, baseSize: H * 0.055, lhRatio: 1.3, gapAfter: H * 0.016 },
    { text: state.body, weight: 400, baseSize: H * 0.042, lhRatio: 1.45, gapAfter: H * 0.016 },
  ], contentMaxW, state.cta ? (H * 0.065 + H * 0.015) : 0, H - topMargin - bottomMargin, 0.3, state.textScale)

  const hlSize = H * 0.1 * scale; const hlLH = hlSize * 1.12
  const sSize = H * 0.055 * scale; const sLH = sSize * 1.3
  const bSize = H * 0.042 * scale; const bLH = bSize * 1.45
  const ctaH = H * 0.065 * scale

  const hlLines = countRichLines(ctx, state.headline, contentMaxW, hlSize, state.headlineWeight, Math.min(800, state.headlineWeight + 300), FONT_FAMILY)
  let totalH = hlLines * hlLH
  if (state.sub) { totalH += countRichLines(ctx, state.sub, contentMaxW, sSize, 500, 800, FONT_FAMILY) * sLH + H * 0.02 * scale }
  if (state.body) { totalH += countRichLines(ctx, state.body, contentMaxW, bSize, 400, 700, FONT_FAMILY) * bLH + H * 0.016 * scale }
  if (state.cta) totalH += ctaH + H * 0.015 * scale

  let y = Math.max(topMargin, (H - totalH) / 2)

  if (state.logoPos === 'aboveHeadline') {
    const lY = Math.max(topY + iconR * 1.5, y - lR * 2.5)
    drawLogoWordmark(ctx, padX, lY, lR, resolveLogoColor(state))
  }

  const hlN = wrapAndDrawRich(ctx, state.headline, padX, y, contentMaxW, hlLH, hlSize, state.headlineWeight, FONT_FAMILY, resolveColor(textColors, 'headline'))
  y += hlN * hlLH + H * 0.02 * scale

  if (state.sub) {
    const sN = wrapAndDrawRich(ctx, state.sub, padX, y, contentMaxW, sLH, sSize, 500, FONT_FAMILY, resolveColor(textColors, 'sub'))
    y += sN * sLH + H * 0.016 * scale
  }
  if (state.body) {
    const bN = wrapAndDrawRich(ctx, state.body, padX, y, contentMaxW, bLH, bSize, 400, FONT_FAMILY, resolveColor(textColors, 'body'))
    y += bN * bLH + H * 0.016 * scale
  }
  if (state.cta) {
    const cSize = Math.max(H * 0.031 * scale, H * 0.016)
    ctx.font = `500 ${cSize}px ${FONT_FAMILY}`
    const cW = ctx.measureText(state.cta).width + H * 0.078 * scale
    const cH = ctaH; const cY = y + H * 0.008 * scale
    ctx.strokeStyle = 'rgba(255,255,255,.55)'
    ctx.lineWidth = Math.max(H * 0.004 * scale, 1)
    ctx.beginPath(); ctx.roundRect(padX, cY, cW, cH, cH / 2); ctx.stroke()
    ctx.fillStyle = '#FFFFFF'; ctx.textBaseline = 'middle'
    ctx.fillText(state.cta, padX + cW / 2 - ctx.measureText(state.cta).width / 2, cY + cH / 2 - cSize * 0.06)
  }
  ctx.restore()
}

// Draws the full post (background + type-specific content) onto `canvas`,
// sizing its pixel buffer to state.canvasW/H first — the canvas's internal
// resolution is always the full export resolution, never a scaled preview.
export function draw(
  canvas: HTMLCanvasElement, state: PostState, textColors: TextColors,
  carousel: { on: boolean; slideCount: number; activeIdx: number },
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const W = state.canvasW, H = state.canvasH
  canvas.width = W; canvas.height = H
  drawBackground(ctx, state, W, H, carousel)
  if (state.format === 'banner') renderBanner(ctx, state, textColors, W, H)
  else renderSquare(ctx, state, textColors, W, H)
}

// ─────────────────────────────────────────────────────────────────────────────
// Carousel — snapshot/restore the per-slide field subset.

export function snapshotSlide(state: PostState, textColors: TextColors): Slide {
  const slide = {} as Slide
  SLIDE_KEYS.forEach(k => { (slide[k] as unknown) = state[k] })
  slide.colors = {} as Slide['colors']
  SLIDE_COLOR_KEYS.forEach(k => { slide.colors[k] = textColors[k] })
  return slide
}

export function applySlideToState(slide: Slide, state: PostState, textColors: TextColors): { state: PostState; textColors: TextColors } {
  const nextState = { ...state }
  SLIDE_KEYS.forEach(k => { if (k in slide) (nextState[k] as unknown) = slide[k] })
  const nextColors = { ...textColors }
  if (slide.colors) SLIDE_COLOR_KEYS.forEach(k => { if (k in slide.colors) nextColors[k] = slide.colors[k] })
  return { state: nextState, textColors: nextColors }
}

// Label shown on a carousel slide's chip in the slide strip.
export function slideLabel(slide: Slide): string {
  const text = slide.headline || slide.statNumber || slide.tag || ''
  if (text) return text.length > 16 ? text.slice(0, 16) + '…' : text
  const names: Partial<Record<PostType, string>> = { organic: 'Organic', casestudy: 'Case Study', ad: 'Ad', statistic: 'Statistic' }
  return names[slide.type] ?? slide.type
}

// ─────────────────────────────────────────────────────────────────────────────
// Project serialization — shared by autosave (localStorage) and manual
// save/load (.json file). Image/canvas state fields aren't JSON-safe, so
// they're stored as data URLs and rebuilt into real Image objects on load.

export function imageToDataURL(img: ImageSource | null): string | null {
  if (!img) return null
  if (img instanceof HTMLCanvasElement) return img.toDataURL('image/png')
  // <img> elements may be sourced from a blob: URL (e.g. library-picked backgrounds),
  // which isn't valid outside the current page session — rasterize to a data URL instead
  // of trusting img.src so autosave/save-to-file always persist a loadable image.
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  const ctx = canvas.getContext('2d')
  if (!ctx || canvas.width === 0 || canvas.height === 0) return null
  ctx.drawImage(img, 0, 0)
  return canvas.toDataURL('image/png')
}

export function serializeProject(state: PostState, textColors: TextColors, carouselOn: boolean, slides: Slide[], activeSlideIdx: number): ProjectFile {
  const { bgImage, customerLogo, partnerLogo, ...restState } = state
  return {
    v: PROJECT_VERSION,
    savedAt: new Date().toISOString(),
    state: restState,
    images: {
      bgImage: imageToDataURL(bgImage),
      customerLogo: imageToDataURL(customerLogo),
      partnerLogo: imageToDataURL(partnerLogo),
    },
    textColors: { ...textColors },
    carouselOn,
    slides: JSON.parse(JSON.stringify(slides)),
    activeSlideIdx,
  }
}

export function loadImageFromDataURL(dataUrl: string | null | undefined): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    if (!dataUrl) { resolve(null); return }
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

export interface DeserializedProject {
  state: PostState
  textColors: TextColors
  carouselOn: boolean
  slides: Slide[]
  activeSlideIdx: number
}

export async function deserializeProject(proj: ProjectFile): Promise<DeserializedProject> {
  if (!proj || !proj.state) throw new Error('Not a valid project file')
  const [bgImage, customerLogo, partnerLogo] = await Promise.all([
    loadImageFromDataURL(proj.images?.bgImage),
    loadImageFromDataURL(proj.images?.customerLogo),
    loadImageFromDataURL(proj.images?.partnerLogo),
  ])
  const defaults = defaultPostState()
  const state: PostState = { ...defaults, ...proj.state, bgImage, customerLogo, partnerLogo }
  // A hand-edited or corrupted project file can carry a non-finite/non-positive
  // canvas size — draw() would assign it straight to the <canvas> element and
  // produce an unusable (zero-size, or absurdly huge) canvas.
  if (!Number.isFinite(state.canvasW) || state.canvasW <= 0) state.canvasW = defaults.canvasW
  if (!Number.isFinite(state.canvasH) || state.canvasH <= 0) state.canvasH = defaults.canvasH
  const textColors: TextColors = { ...defaultTextColors(), ...(proj.textColors ?? {}) }
  const slides = Array.isArray(proj.slides) ? proj.slides : []
  // Same reasoning for activeSlideIdx: a negative or non-integer value can make
  // drawBackground compute a negative image source position when background
  // spanning is on.
  const rawIdx = Number(proj.activeSlideIdx)
  const activeSlideIdx = Number.isInteger(rawIdx)
    ? Math.min(Math.max(rawIdx, 0), Math.max(slides.length - 1, 0))
    : 0
  return { state, textColors, carouselOn: !!proj.carouselOn, slides, activeSlideIdx }
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV / XLSX bulk import — row → field mapping, pure and library-free (the
// actual xlsx-parsing call lives in BulkImportPanel.tsx, which is the only
// place that needs the `xlsx` package; this module only shapes already-parsed
// rows, which keeps it testable without a real file).

const TYPE_ALIAS: Record<string, PostType> = {
  organic: 'organic', organicpost: 'organic',
  casestudy: 'casestudy', case: 'casestudy',
  ad: 'ad', advert: 'ad', advertisement: 'ad',
  quote: 'quote',
  event: 'event',
  statistic: 'statistic', statistics: 'statistic', stat: 'statistic', stats: 'statistic',
}

export function resolvePostTypeAlias(raw: string): PostType | null {
  const norm = raw.toLowerCase().replace(/[\s_-]/g, '')
  return TYPE_ALIAS[norm] ?? null
}

// Accepts a row as long as it has SOME content — not just a headline, since
// Quote/Event/Statistic rows don't use the headline column.
export function filterMeaningfulRows(rows: Record<string, string>[]): Record<string, string>[] {
  return rows.filter(r => Object.values(r).some(v => v && String(v).trim()))
}

export function csvRowTitle(row: Record<string, string>): string {
  return row.headline || row.quote1 || row.eventheadline || row.eventname || row.statnumber || '(untitled row)'
}

// Splits one CSV line into fields, honoring double-quoted fields (which may
// contain commas and escaped `""` quotes) — a bare `line.split(',')`, which
// the source tool used, shifts every column after a quoted comma.
function splitCsvLine(line: string): string[] {
  const fields: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      fields.push(field)
      field = ''
    } else {
      field += c
    }
  }
  fields.push(field)
  return fields
}

// Parses a raw .csv file's text into lowercase-header row objects.
export function parseCsvRows(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n')
  if (!lines.length) return []
  const hdrs = splitCsvLine(lines[0]).map(h => h.trim().toLowerCase())
  const rows = lines.slice(1).map(line => {
    const v = splitCsvLine(line)
    const o: Record<string, string> = {}
    hdrs.forEach((h, i) => { o[h] = (v[i] || '').trim() })
    return o
  })
  return filterMeaningfulRows(rows)
}

export interface ImportedRowPatch {
  type: PostType | null
  fields: Partial<PostState>
  // The row's "background" column, if present — a shared-library image's `name`
  // (unique, so it identifies exactly one). Not a PostState field itself (the
  // library image has to be fetched async), so it's resolved by the caller
  // rather than folded into `fields`.
  backgroundName?: string
}

// Maps one imported row to the state fields it should overwrite — mirrors
// the source tool's csv-row-click handler exactly: generic fields always
// apply, while quote/event/statistic groups only apply (and, for event,
// pick a sub-format) when that group's columns are actually present in the
// row, so a row for one post type never clobbers another type's fields.
export function importRowToPatch(row: Record<string, string>): ImportedRowPatch {
  const fields: Partial<PostState> = {
    tag: row.tag || '',
    headline: row.headline || '',
    sub: row.sub || row.subtitle || '',
    body: row.body || '',
    cta: row.cta || '',
  }
  const backgroundName = row.background ? row.background.trim() : undefined

  const type = row.type ? resolvePostTypeAlias(row.type) : null

  if (row.quote1 || row.quote) {
    fields.quote1 = row.quote1 || row.quote || ''
    fields.quote2 = row.quote2 || ''
    fields.quoteName = row.name || ''
    fields.quoteTitle = row.title || ''
  }

  const hasEvent = !!(row.eventheadline || row.eventsub || row.eventdate || row.eventtime || row.eventlocation
    || row.eventname || row.eventkicker || row.eventvenue || row.eventdates)
  if (hasEvent) {
    const isLockup = !!(row.eventname || row.eventkicker || row.eventvenue || row.eventdates)
    fields.eventFormat = isLockup ? 'lockup' : 'icons'
    fields.eventHeadline = row.eventheadline || ''
    fields.eventSub = row.eventsub || ''
    fields.eventDate = row.eventdate || ''
    fields.eventTime = row.eventtime || ''
    fields.eventLocation = row.eventlocation ? row.eventlocation.replace(/\|/g, '\n') : ''
    fields.eventKicker = row.eventkicker || 'See us at'
    fields.eventName = row.eventname || ''
    fields.eventVenue = row.eventvenue || ''
    fields.eventDates = row.eventdates || ''
  }

  if (row.statnumber || row.statlabel || row.statnumber2 || row.statlabel2) {
    fields.statLeadin = row.statleadin || ''
    fields.statNumber = row.statnumber || ''
    fields.statLabel = row.statlabel || ''
    const hasSecond = !!(row.statnumber2 || row.statlabel2)
    fields.statTwoUp = hasSecond
    fields.statNumber2 = row.statnumber2 || ''
    fields.statLabel2 = row.statlabel2 || ''
  }

  return { type, fields, backgroundName }
}

// The full set of columns `importRowToPatch` understands, in the order the
// downloadable template presents them. Kept next to importRowToPatch so the
// two can't silently drift apart.
export const BULK_IMPORT_TEMPLATE_HEADERS = [
  'type', 'tag', 'headline', 'sub', 'body', 'cta', 'background',
  'quote1', 'quote2', 'name', 'title',
  'eventheadline', 'eventsub', 'eventdate', 'eventtime', 'eventlocation',
  'eventkicker', 'eventname', 'eventvenue', 'eventdates',
  'statleadin', 'statnumber', 'statlabel', 'statnumber2', 'statlabel2',
] as const

// One example row per post type (the Event rows show both sub-formats) so a
// designer filling in the template can see which columns apply to which type
// — columns that don't apply to a given row are simply left blank. `background`
// is left blank here too: it must match an existing shared-library image's
// exact (unique) name, which is environment-specific — a fabricated example
// would just fail to resolve.
export const BULK_IMPORT_TEMPLATE_ROWS: Record<string, string>[] = [
  {
    type: 'casestudy', tag: 'CASE STUDY_', headline: 'How a Leading Business Association Uses WSO2',
    sub: 'to Unify Member Services', body: 'See how they cut **integration time** by 70%.', cta: 'Read the Case Study',
  },
  {
    type: 'organic', headline: 'WSO2 Turns 20',
    sub: 'Two decades of building open-source integration technology',
    body: 'Thank you to everyone who has been part of the journey.',
  },
  { type: 'ad', headline: 'Deploy anywhere. Control everything.', sub: 'Built for enterprise-grade IAM', cta: 'Learn More' },
  {
    type: 'quote', quote1: 'WSO2 gave us the flexibility to scale integration without vendor lock-in.',
    name: 'Jane Doe', title: 'CTO, Acme Corp',
  },
  {
    type: 'event', eventheadline: 'Join us in São Paulo', eventsub: 'WSO2 Integration Summit',
    eventdate: '12 May 2026', eventtime: '10:00 AM', eventlocation: 'Hall A|Booth 4',
  },
  {
    type: 'event', eventkicker: 'See us at', eventname: 'Summit 2026',
    eventvenue: 'Convention Center', eventdates: '12–14 May 2026',
  },
  { type: 'statistic', statleadin: 'Trusted by', statnumber: '70%', statlabel: 'faster integration time', cta: 'Learn More' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Export filename helpers — pure string logic, shared by PNG/ZIP export.

export function postFilenameSlug(text: string, fallback: string, maxLen = 28): string {
  // Restrict to a safe charset (matches Email Workbench's ExportDialog.tsx) — the slug
  // feeds both a <a download> filename and, for carousels, a ZIP entry path, where an
  // unsanitized "/" would create an unintended nested path inside the archive.
  return String(text || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen)
}

export function slidePngFilename(index: number, label: string, formatSubdir?: string): string {
  const name = `wso2-slide-${index + 1}-${label}.png`
  return formatSubdir ? `${formatSubdir}/${name}` : name
}
