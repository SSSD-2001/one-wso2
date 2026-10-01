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

import type { DataGrid } from "@wso2/oxygen-ui";
import type { PromotionRequestFull } from "../api/types";
import { capitalizeWords } from "../util/promotionText";

// The column set every Functional Lead Portal grid shares (Active/Approved/
// Rejected all render these, each appending its own status/action columns).
// Ports the common subset of source's own per-tab header arrays
// (submittedRequests.tsx / approvedList.tsx / rejectedList.tsx), which are
// otherwise near-identical. Deliberately NOT included: Location, Joined
// date, Last promoted Date — none of those three fields exist on the
// backend's own FullPromotionRequest record (checked against
// modules/db/types.bal), so source's own columns for them render blank in
// the real running app; reproducing empty columns would add nothing.
export function basePromotionRequestColumns(): DataGrid.GridColDef<PromotionRequestFull>[] {
  return [
    { field: "employeeEmail", headerName: "Employee Email", flex: 1.4, minWidth: 200 },
    { field: "promotionType", headerName: "Promotion Type", flex: 1, minWidth: 140 },
    { field: "currentJobRole", headerName: "Current Designation", flex: 1.1, minWidth: 160 },
    {
      field: "businessUnit",
      headerName: "Business Unit",
      flex: 1,
      minWidth: 140,
      valueFormatter: (value: string) => capitalizeWords(value),
    },
    {
      field: "department",
      headerName: "Department",
      flex: 1,
      minWidth: 140,
      valueFormatter: (value: string) => capitalizeWords(value),
    },
    {
      field: "team",
      headerName: "Team",
      flex: 1,
      minWidth: 120,
      valueFormatter: (value: string) => capitalizeWords(value),
    },
    { field: "currentJobBand", headerName: "Current Job Band", type: "number", flex: 0.8, minWidth: 130 },
    { field: "nextJobBand", headerName: "Applied Job Band", type: "number", flex: 0.8, minWidth: 130 },
  ];
}
