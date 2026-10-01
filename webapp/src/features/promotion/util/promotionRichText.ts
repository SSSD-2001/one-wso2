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

import DOMPurify from "dompurify";

// Everything to do with a promotion-app recommendation rich-text field
// (recommendationStatement, recommendationAdditionalComment,
// reasonForRejection): the wire encoding, and the HTML sanitizing every
// value goes through whether it's being edited or read back.

// ---- wire encoding ----------------------------------------------------------
//
// Source encodes/decodes with Node's Buffer polyfill — plain UTF-8 bytes,
// base64'd (`Buffer.from(str).toString("base64")` / `Buffer.from(b64,
// "base64").toString("utf-8")`). NOT the same scheme PAR's own
// encodeParComment/decodeParComment use (`btoa(encodeURIComponent(...))`,
// which base64s the *percent-escaped* string, not the raw UTF-8 bytes) —
// the two source apps chose different encodings for the same "rich text as
// base64" idea, so this can't reuse PAR's util. `unescape`/`escape` are
// deprecated but still universal, and are the standard browser-native way
// to reproduce Buffer's plain UTF-8 base64 without a Buffer polyfill.
export function encodePromotionText(value: string): string {
  return btoa(unescape(encodeURIComponent(value)));
}

/** Mirrors source's own defensive decodeBase64 (recommendationForm.tsx /
 * historyLine.tsx): decode, then re-encode the result and compare against
 * the input — if they don't match, the value wasn't actually base64 (a
 * plain-text field, or an empty/malformed one), so it's returned as-is
 * rather than surfacing garbage. Sanitized before being handed back either
 * way, since every caller either seeds an editable field with it or
 * renders it read-only — both need it safe to put in the DOM. */
export function decodePromotionText(value: string | null | undefined): string {
  if (!value) return "";
  try {
    const decoded = decodeURIComponent(escape(atob(value)));
    if (encodePromotionText(decoded) === value.trim()) return sanitizePromotionHtml(decoded);
  } catch {
    // Not valid base64 at all — fall through to the as-is return below.
  }
  return sanitizePromotionHtml(value);
}

// ---- HTML sanitizing ---------------------------------------------------------
//
// Sanitized on both write and read: these fields are written by one person
// and read by a DIFFERENT person (the employee, an admin, a promotion board
// member), so the read side never trusts that the editor sanitized them.
// Allowlist: p/br/strong/em/u/ol/ul/li/a.
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ["p", "br", "strong", "em", "u", "ol", "ul", "li", "a"],
  ALLOWED_ATTR: ["href", "target"],
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
};

export function sanitizePromotionHtml(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}

/** A Quill editor with nothing typed still returns markup (`<p><br></p>`,
 * not `""`), so `.trim() === ""` never catches an empty statement. Strips
 * tags and `&nbsp;` before checking — same check source's own
 * isContentEmpty (recommendationForm.tsx) does on the decoded value. */
export function isEmptyPromotionHtml(html: string): boolean {
  const textContent = html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  return textContent === "";
}
