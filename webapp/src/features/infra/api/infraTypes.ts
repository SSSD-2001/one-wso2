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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

export const INFRA_PRIVILEGE = {
  EMPLOYEE: 987,
  APPROVER: 762,
  ADMIN: 123,
  } as const;
  export interface InfraUserInfo {
  employeeId: string;
  workEmail: string;
  firstName: string;
  lastName: string;
  jobRole: string;
  employeeThumbnail: string | null;
  department: string | null;
  team: string | null;
  employmentType: string | null;
  privileges: number[];
  githubUserId: string | null;
  githubUsername: string | null;
  }
  export interface InfraLead {
  leadId: number;
  leadEmail: string;
  teamName: string;
  }
  export interface InfraEmployee {
  firstName: string;
  lastName: string;
  workEmail: string;
  employeeThumbnail?: string | null;
  }
  export interface InfraOrganization {
  organizationId: number;
  organizationName: string;
  organizationVisibility: string;
  organizationPlan: string;
  /** 1 when the org allows issues, 0 when it does not. */
  enableIssues: number | boolean;
  defaultTeams?: string | null;
  }
  export interface InfraTopic {
  topicId: number;
  topicName: string;
  }