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

// Kept out of ConfirmationDialog.tsx itself (rather than exported alongside
// the component) because ESLint's react-refresh/only-export-components flags
// mixing a constant export into a component file — same reason
// bankAccountsColumns.ts was split out of BankAccountsTable.tsx.

// The theme's Paper is translucent — a glassmorphism effect meant for panels
// sitting on the page canvas (Oxygen's WSO2Theme paper is `#00000026` in dark
// mode) — which reads as barely distinguishable from the backdrop for a small
// floating dialog; on a dark theme it can look like there is no dialog there
// at all, just dimmer page content. `background.default` (the theme's own
// opaque canvas colour) opts the dialog out of that, same fix already applied
// to this app's GRC admin dialogs for the same reason. It's read as a CSS
// variable, not `theme.palette.background.default`, because that accessor
// freezes the light scheme's value at first paint under CssVarsProvider — the
// same trap documented in this app's due-diligence and expense screens. The
// "divider" border adds a visible edge on top of the opaque fill.
export const dialogPaperSx = {
  backdropFilter: "none",
  backgroundImage: "none",
  backgroundColor: "var(--oxygen-palette-background-default)",
  border: "1px solid",
  borderColor: "divider",
};
