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

export interface DriveFile {
  id: string;
  name: string;
  url: string;
  mimeType: string;
}

// Ports LeadReviewPanel.tsx's own inferMimeType: a re-parsed saved URL has
// no real mimeType (the wire only ever stores the URL, see parseSavedUrls
// below), so this guesses from the URL's own path shape well enough to pick
// a reasonable icon in ParDriveFileChip.tsx.
export function inferMimeType(url: string): string {
  if (url.includes("/document/")) return "application/vnd.google-apps.document";
  if (url.includes("/spreadsheets/")) return "application/vnd.google-apps.spreadsheet";
  if (url.includes("/presentation/")) return "application/vnd.google-apps.presentation";
  return "application/vnd.google-apps.file";
}

// Ports LeadReviewPanel.tsx's own extractDriveId: pulls the file id out of
// a standard Drive "/d/<id>/" URL segment, falling back to the whole URL for
// anything else (an id is only ever used for React keys/dedup, not sent
// anywhere) — never expected to fail on a URL the picker itself produced.
export function extractDriveId(url: string): string {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : url;
}

// Ports LeadReviewPanel.tsx's own parseSavedUrls: parPerformanceNoticeAck is
// one newline-delimited string on the wire, not an array — this is the only
// place that reconstructs DriveFile[] from it, for both the editable chip
// list and the read-only link list.
export function parseSavedUrls(raw: string): DriveFile[] {
  return raw
    .split(/\r?\n/)
    .map((u) => u.trim())
    .filter((u) => u.length > 0)
    .map((url) => ({
      id: extractDriveId(url),
      name: url,
      url,
      mimeType: inferMimeType(url),
    }));
}
