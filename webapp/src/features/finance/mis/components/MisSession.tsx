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

import type { JSX } from "react";
import { Outlet } from "react-router";
import { YearsBackSessionProvider } from "../util/YearsBackSessionContext";

// What every MIS screen shares and no MIS screen owns.
//
// A layout route rather than a wrapper inside `MisShell`, and the difference
// matters exactly once: each MIS screen renders its OWN shell, so a provider
// there is unmounted and remade on every navigation between them. `Scale` does
// not notice, because it reads its value back out of `localStorage`. The session
// Years Back is held in memory alone — deliberately, see
// `YearsBackSessionContext` — so a remount would forget it, and a reader who set
// three years on the Build would be back to five after a look at ARR Analysis.
//
// Only what actually needs the longer life belongs here. `Scale` stays in
// `MisShell`, because the shell is the honest scope for
// anything that survives on its own.

export default function MisSession(): JSX.Element {
  return (
    <YearsBackSessionProvider>
      <Outlet />
    </YearsBackSessionProvider>
  );
}
