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

import type { InfraAccessPermission } from "../api/infraTypes";
import { REPO_NAME_MAX } from "../new-repository/repositoryStep";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REPO_NAME = /^[A-Za-z0-9._-]+$/;

export interface AccessRequestFormValues {
  organizationId: number;
  orgName: string;
  repoName: string;
  permission: InfraAccessPermission;
  justification: string;
  leadEmail: string;
  ccList: string[];
}

export type AccessRequestFormErrors = Partial<
  Record<
    "organizationId" | "orgName" | "repoName" | "permission" | "justification" | "leadEmail" | "ccList",
    string
  >
>;

export const emptyAccessRequestForm: AccessRequestFormValues = {
  organizationId: 0,
  orgName: "",
  repoName: "",
  permission: "pull",
  justification: "",
  leadEmail: "",
  ccList: [],
};

export const PERMISSION_LABELS: Record<InfraAccessPermission, string> = {
  pull: "Read",
  triage: "Triage",
  push: "Write",
};

function isEmail(value: string): boolean {
  return EMAIL.test(value.trim());
}

export function accessRequestFormErrors(values: AccessRequestFormValues): AccessRequestFormErrors {
  const errors: AccessRequestFormErrors = {};
  if (!values.organizationId || values.organizationId <= 0) {
    errors.organizationId = "Organization is required.";
  }
  if (!values.orgName.trim()) errors.orgName = "Organization is required.";

  const repoName = values.repoName.trim();
  if (!repoName) errors.repoName = "Repository name is required.";
  else if (repoName.length > REPO_NAME_MAX) {
    errors.repoName = `Repository name must be at most ${REPO_NAME_MAX} characters.`;
  } else if (repoName === "." || repoName === "..") {
    errors.repoName = 'Repository name cannot be "." or "..".';
  } else if (/\.git$/i.test(repoName)) {
    errors.repoName = 'Repository name must not end with ".git".';
  } else if (!REPO_NAME.test(repoName)) {
    errors.repoName =
      "Invalid repository name. Use only letters, numbers, hyphens (-), underscores (_), and periods (.).";
  }

  if (!["pull", "triage", "push"].includes(values.permission)) {
    errors.permission = "Permission is required.";
  }
  if (!values.justification.trim()) errors.justification = "Justification is required.";
  if (!values.leadEmail.trim()) errors.leadEmail = "Lead Email is required.";
  else if (!isEmail(values.leadEmail)) errors.leadEmail = "Lead Email must be a valid email.";
  if (values.ccList.some((email) => !isEmail(email))) {
    errors.ccList = "All emails must be valid.";
  }
  return errors;
}

export function toAccessRequestPayload(values: AccessRequestFormValues) {
  return {
    leadEmail: values.leadEmail.trim(),
    ccList: values.ccList.map((email) => email.trim()).filter(Boolean).join(","),
    organizationId: values.organizationId,
    orgName: values.orgName.trim(),
    repoName: values.repoName.trim(),
    permission: values.permission,
    justification: values.justification.trim(),
  };
}
