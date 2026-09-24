/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * The focus ring every read-only data grid should suppress.
 *
 * MUI rings the cell you last clicked. On a grid with no cell-level action
 * that reads as "this cell is selected" while meaning nothing, and it persists
 * after the pointer has moved on — so people try to do something with the
 * selection, and there is nothing to do.
 *
 * Keyboard focus is deliberately kept: `:focus-visible` still rings, so
 * arrow-key navigation through the grid can be followed. Only the
 * pointer-driven ring goes, which is the one carrying no information. Column
 * headers get the same treatment for the same reason, and keep the same
 * exception — a header is reachable by keyboard for sorting and its menu, and
 * removing every header ring left that navigation invisible.
 *
 * Lifted out of the finance grids (FINANCE_GRID_SX, which now builds on this)
 * when the Leave report turned out to need the identical rule. The source app
 * suppresses it globally in its own theme (theme.ts:281-297); we do not own a
 * global grid theme, so this is the shared piece instead of a third copy.
 */
export const GRID_NO_POINTER_FOCUS_SX = {
  "& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within": { outline: "none" },
  "& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within": {
    outline: "none",
  },
  "& .MuiDataGrid-cell:focus-visible": { outline: "auto 1px" },
  "& .MuiDataGrid-columnHeader:focus-visible": { outline: "auto 1px" },
} as const;
