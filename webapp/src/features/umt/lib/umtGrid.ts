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

// `getRowHeight: () => "auto"` leaves DataGrid cells as `display: block`, so
// cell text sits flush against the top border while the row's slack collects
// underneath it. Wrapping each cell's content in a flex box that fills the
// cell restores symmetric vertical padding and keeps every UMT table aligned
// the same way.
export const gridCellContentSx = {
  alignItems: "center",
  display: "flex",
  minHeight: "100%",
  py: 0.75,
  width: "100%",
} as const;
