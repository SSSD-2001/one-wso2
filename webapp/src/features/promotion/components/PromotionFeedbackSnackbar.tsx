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

import { Alert, Snackbar } from "@wso2/oxygen-ui";
import type { PromotionFeedbackState } from "../util/usePromotionFeedback";

// Renders whatever state util/usePromotionFeedback.ts's hook is holding —
// see that file's own comment for why this exists.
export default function PromotionFeedbackSnackbar({
  feedback,
  onClose,
}: {
  feedback: PromotionFeedbackState;
  onClose: () => void;
}) {
  return (
    <Snackbar
      open={feedback.open}
      autoHideDuration={4000}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <Alert severity={feedback.severity} onClose={onClose}>
        {feedback.message}
      </Alert>
    </Snackbar>
  );
}
