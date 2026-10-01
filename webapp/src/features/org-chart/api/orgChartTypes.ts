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

// Wire type for the people-app backend's employee directory endpoint
// (GET /employees/basic-info), which now backs Org
// Chart directly. Source of truth: EmployeeDirectoryInfo in
// apps/people-app/backend/modules/database/types.bal.
export interface EmployeeDirectoryRecord {
  employeeId: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  employeeThumbnail: string | null;
  /** Combined designation (designation + secondary job title + job role).
   *  Optional on the wire — omitted entirely rather than sent as null. */
  designation?: string;
  jobBand: number | null;
  startDate: string;
  /**
   * Every row has one, including the company's root — there is no
   * "managerEmail is null" signal for "this is the top." Instead, a row is a
   * root candidate when this doesn't resolve to anyone else in the fetched
   * directory (almost always because that manager has since left the
   * company). See util/buildOrgTree.ts.
   */
  managerEmail: string;
  businessUnit: string;
  team: string;
  subTeam: string | null;
  unit: string | null;
  employmentType: string;
  company: string;
  workLocation: string;
  /** "Active" or "Marked leaver" — Left employees aren't in this endpoint. */
  employeeStatus: string;
}

/** A node in the tree. Children are always fully resolved — the whole
 *  directory loads in one request, so nothing here is lazy the way the
 *  original four-endpoint contract required. */
export interface OrgChartNode extends EmployeeDirectoryRecord {
  children: OrgChartNode[];
}
