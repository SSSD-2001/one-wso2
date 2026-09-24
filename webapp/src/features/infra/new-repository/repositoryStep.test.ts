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

import { describe, expect, it } from "vitest";
import type { InfraOrganization } from "../api/infraTypes";
import {
  emptyRepositoryStep,
  fieldsFromOrganization,
  repositoryStepErrors,
  sanitizeTopics,
} from "./repositoryStep";

const org = (patch: Partial<InfraOrganization>): InfraOrganization => ({
  organizationId: 4,
  organizationName: "wso2",
  organizationVisibility: "Public",
  organizationPlan: "Team",
  enableIssues: 1,
  ...patch,
});

const valid = {
  ...emptyRepositoryStep,
  ...fieldsFromOrganization(org({})),
  repoName: "one-wso2",
  description: "Portal repositories.",
  topics: ["api-management"],
};

describe("repositoryStepErrors", () => {
  it("accepts a complete repository step", () => {
    expect(repositoryStepErrors(valid)).toEqual({});
  });

  it("rejects a reserved name, a .git suffix, and an overlong description", () => {
    expect(repositoryStepErrors({ ...valid, repoName: "demo.git" }).repoName).toBe(
    'Repository name must not end with ".git".',
    );
    expect(
    repositoryStepErrors({ ...valid, description: "x".repeat(351) }).description,
    ).toMatch(/350/);
  });

  it("forces a Free-plan org to a public repo and default PR protection", () => {
    expect(fieldsFromOrganization(org({ organizationPlan: "Free", organizationVisibility: "Private" }))).toMatchObject({
    repoType: "Public",
    enableIssues: "No",
    prProtection: "Default",
    });
  });

  it("lowercases and dedupes topics", () => {
    expect(sanitizeTopics(["API", "api", " ballerina "])).toEqual(["api", "ballerina"]);
  });
});