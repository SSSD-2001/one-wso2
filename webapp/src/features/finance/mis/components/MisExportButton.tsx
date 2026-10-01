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

// The one control that takes a MIS table out of the browser.
//
// An export is required scope rather than a caveat: a hand-rolled
// `<table>` gets none of the select-and-paste a data grid gives free, and that
// paste is Finance's existing workflow.

import { useState } from "react";
import { Button, Stack, Typography } from "@wso2/oxygen-ui";
import { Download } from "@wso2/oxygen-ui-icons-react";
import { saveMisWorkbook, type MisWorkbookSpec } from "../export/misWorkbook";

export interface MisExportButtonProps {
  /**
   * The workbook to write, described when the reader asks for it.
   *
   * A whole SPEC rather than one sheet: a workbook is the thing written, even
   * though every caller today writes a single sheet (the Build page's
   * `oneSheet`, the drill-down's).
   *
   * A thunk rather than a value: a per-customer Build is thousands of rows and
   * every one of them would be walked on every render of a screen whose export
   * is usually never clicked.
   */
  workbook: () => MisWorkbookSpec;
  /** Likewise deferred — it carries today's date. */
  filename: () => string;
}

export default function MisExportButton({ workbook, filename }: MisExportButtonProps) {
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);

  const run = async () => {
    setWorking(true);
    setFailed(false);
    try {
      // Yield once before describing the workbook. Walking a 3,000-row
      // customers table is synchronous and takes long enough to be seen, and
      // without this it happens in the same tick as the state above — so the
      // screen freezes with the button still reading "Export", which is the
      // moment a reader clicks it a second time.
      await new Promise((resolve) => setTimeout(resolve, 0));
      await saveMisWorkbook(workbook(), filename());
    } catch {
      // Said on screen rather than only in the console. The work happens after
      // the click returns — a dynamic import, then a zip — so a failure is
      // silent by default, and a reader who saw nothing happen would click
      // again rather than know.
      setFailed(true);
    } finally {
      setWorking(false);
    }
  };

  return (
    <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
      {failed && (
        // Not "couldn't build": Build means only the finance roll-forward
        // this very screen is showing, and the sentence sits directly above one.
        <Typography variant="caption" color="error" role="alert">
          Couldn&apos;t write the file.
        </Typography>
      )}
      <Button
        size="small"
        variant="outlined"
        startIcon={<Download size={15} />}
        onClick={run}
        disabled={working}
      >
        {working ? "Exporting…" : "Export"}
      </Button>
    </Stack>
  );
}
