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

import type { AccessStepValues } from "./accessStep";
import type { GeneralStepValues } from "./generalStep";
import { sanitizeTopics, websiteWithScheme, type RepositoryStepValues } from "./repositoryStep";

export interface RepositoryRequestCreate {
  email: string;
  leadEmail: string;
  requirement: string;
  ccList: string;
  repoName: string;
  organizationId: number;
  repoType: string;
  description: string;
  enableIssues: string;
  websiteUrl: string | null;
  topics: string;
  prProtection: string;
  teams: string;
  enableTriageWso2All: string;
  enableTriageWso2AllInterns: string;
  disableTriageReason: string;
  cicdRequirement: string;
  jenkinsJobType: string;
  jenkinsGroupId: string;
  azureDevopsOrg: string;
  azureDevopsProject: string;
}

export function toRepositoryRequestCreate(
  general: GeneralStepValues,
  repository: RepositoryStepValues,
  access: AccessStepValues,
): RepositoryRequestCreate {
  const privateRepo = repository.repoType === "Private";
  return {
    email: general.email.trim(),
    leadEmail: general.leadEmail.trim(),
    requirement: general.requirement.trim(),
    ccList: general.ccList.map((email) => email.trim()).filter(Boolean).join(","),
    repoName: repository.repoName.trim(),
    organizationId: repository.organizationId,
    repoType: repository.repoType,
    description: repository.description.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim(),
    enableIssues: repository.enableIssues,
    websiteUrl: repository.websiteUrl.trim() ? websiteWithScheme(repository.websiteUrl) : null,
    topics: sanitizeTopics(repository.topics).join(","),
    prProtection: repository.prProtection,
    teams: access.teams.map((team) => team.trim()).filter(Boolean).join(","),
    enableTriageWso2All: privateRepo ? access.enableTriageWso2All : "Yes",
    enableTriageWso2AllInterns: privateRepo ? access.enableTriageWso2AllInterns : "Yes",
    disableTriageReason: privateRepo ? access.disableTriageReason.trim() || "N/A" : "N/A",
    cicdRequirement: "Not Applicable",
    jenkinsJobType: "N/A",
    jenkinsGroupId: "N/A",
    azureDevopsOrg: "N/A",
    azureDevopsProject: "N/A",
  };
}