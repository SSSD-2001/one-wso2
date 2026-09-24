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
import { extractDriveId, inferMimeType, parseSavedUrls } from "./parDriveFile";

describe("inferMimeType", () => {
  it.each([
    ["https://docs.google.com/document/d/abc123/edit", "application/vnd.google-apps.document"],
    ["https://docs.google.com/spreadsheets/d/abc123/edit", "application/vnd.google-apps.spreadsheet"],
    ["https://docs.google.com/presentation/d/abc123/edit", "application/vnd.google-apps.presentation"],
    ["https://drive.google.com/file/d/abc123/view", "application/vnd.google-apps.file"],
  ])("%s -> %s", (url, expected) => {
    expect(inferMimeType(url)).toBe(expected);
  });
});

describe("extractDriveId", () => {
  it("pulls the id out of a standard /d/<id>/ Drive URL", () => {
    expect(extractDriveId("https://drive.google.com/file/d/1AbC-2dE_f3/view")).toBe("1AbC-2dE_f3");
  });

  it("falls back to the whole URL when no /d/ segment is present", () => {
    const url = "https://example.com/not-a-drive-link";
    expect(extractDriveId(url)).toBe(url);
  });
});

describe("parseSavedUrls", () => {
  it("splits a newline-delimited string into DriveFile entries", () => {
    const raw = "https://drive.google.com/file/d/id1/view\nhttps://docs.google.com/document/d/id2/edit";
    const files = parseSavedUrls(raw);
    expect(files).toHaveLength(2);
    expect(files[0]).toMatchObject({ id: "id1", url: "https://drive.google.com/file/d/id1/view", mimeType: "application/vnd.google-apps.file" });
    expect(files[1]).toMatchObject({ id: "id2", mimeType: "application/vnd.google-apps.document" });
  });

  it("trims whitespace and drops blank lines", () => {
    const raw = "  https://drive.google.com/file/d/id1/view  \n\n\nhttps://drive.google.com/file/d/id2/view\n";
    expect(parseSavedUrls(raw)).toHaveLength(2);
  });

  it("is empty for an empty string", () => {
    expect(parseSavedUrls("")).toEqual([]);
  });

  it("uses the URL itself as the display name", () => {
    const url = "https://drive.google.com/file/d/id1/view";
    expect(parseSavedUrls(url)[0].name).toBe(url);
  });
});
