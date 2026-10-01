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

import { useState } from "react";

export interface PromotionFeedbackState {
  open: boolean;
  severity: "success" | "error";
  message: string;
}

// Several Admin Portal mutations (create/end cycle, sheet import, declined-
// reason edits, user sync) had no success/error feedback at all, so a
// failure looked identical to success. Pairs with
// components/PromotionFeedbackSnackbar.tsx, matching this app's own
// existing local Snackbar+Alert convention (e.g.
// features/my/banking/pages/MyAccountsTab.tsx) rather than introducing a
// global toast provider.
export function usePromotionFeedback() {
  const [feedback, setFeedback] = useState<PromotionFeedbackState>({ open: false, severity: "success", message: "" });
  return {
    feedback,
    notifySuccess: (message: string) => setFeedback({ open: true, severity: "success", message }),
    notifyError: (message: string) => setFeedback({ open: true, severity: "error", message }),
    close: () => setFeedback((f) => ({ ...f, open: false })),
  };
}
