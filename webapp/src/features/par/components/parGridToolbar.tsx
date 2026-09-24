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

// Same reasoning as Finance's ccGridToolbar.tsx (ToolbarNoExport): Export is
// withheld on grids showing live, in-progress PAR status for named
// employees — this app already has a dedicated View Reports flow for
// exporting that data, so a CSV button here would hand it out for free. No
// quick filter either: callers already have their own search box. Uses the
// Panel Trigger API (ColumnsPanelTrigger/FilterPanelTrigger) rather than
// GridToolbarColumnsButton/GridToolbarFilterButton, which are deprecated in
// this DataGrid version.
export function ParGridToolbar() {
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
    </DataGrid.Toolbar>
  );
}

// Same as above, plus Export — for the one admin grid, quota assignment,
// where the legacy app itself offered it (AssignQuota.tsx's ExportToolbar).
export function ParGridToolbarWithExport() {
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
