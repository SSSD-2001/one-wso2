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

export interface ErrorSnack {
  open: boolean;
  message: string;
}

// Same shape as MyAccountsTab's own success/error snack, narrowed to the
// error-only case its other callers actually have (a rejected mutation with
// no success toast to show alongside it).
export function useErrorSnackbar() {
  const [snack, setSnack] = useState<ErrorSnack>({ open: false, message: "" });
  return {
    snack,
    showError: (message: string) => setSnack({ open: true, message }),
    close: () => setSnack((s) => ({ ...s, open: false })),
  };
}
