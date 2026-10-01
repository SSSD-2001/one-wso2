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

import { Dialog, DialogContent, DialogTitle } from "@wso2/oxygen-ui";
import type { PromotionRequestFull } from "../api/types";
import PromotionRequestDetailPanel from "./PromotionRequestDetailPanel";

// Wraps PromotionRequestDetailPanel in a Dialog for the Functional Lead
// Portal's grids. Source's own CustomTable expands the detail inline below
// the row (an "ExpandMore" action), which MUI X DataGrid Community can't do
// (getDetailPanelContent is a Pro-only feature — checked, not available in
// this app's DataGrid re-export) — a dialog on the same action icon instead.
export default function PromotionRequestDetailDialog({
  request,
  onClose,
}: {
  request: PromotionRequestFull | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(request)} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{request?.employeeEmail}</DialogTitle>
      <DialogContent dividers sx={{ position: "relative" }}>
        {request && <PromotionRequestDetailPanel request={request} />}
      </DialogContent>
    </Dialog>
  );
}
