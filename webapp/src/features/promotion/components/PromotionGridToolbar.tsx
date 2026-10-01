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

import { DataGrid, Tooltip } from "@wso2/oxygen-ui";

// Ports source's own CustomTable toolbar (Columns/Filter/Export, plus
// sorting and per-type filter editors it hand-rolls elsewhere) as MUI X
// DataGrid's built-in equivalents. Same pattern as PAR's
// ParGridToolbarWithExport.
// Every Functional Lead Portal grid gets Export (unlike PAR's default,
// withheld pattern): source itself offers export on all four of its own
// tabs here, unconditionally.
export function PromotionGridToolbar() {
  return (
    <DataGrid.Toolbar>
      <Tooltip title="Columns">
        <DataGrid.ColumnsPanelTrigger render={<DataGrid.ToolbarButton aria-label="Columns" />}>
          <DataGrid.GridColumnIcon fontSize="small" />
        </DataGrid.ColumnsPanelTrigger>
      </Tooltip>
      <Tooltip title="Filters">
        <DataGrid.FilterPanelTrigger render={<DataGrid.ToolbarButton aria-label="Filters" />}>
          <DataGrid.GridFilterListIcon fontSize="small" />
        </DataGrid.FilterPanelTrigger>
      </Tooltip>
      <DataGrid.GridToolbarDensitySelector />
      <DataGrid.GridToolbarExport />
    </DataGrid.Toolbar>
  );
}
