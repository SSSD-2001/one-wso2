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

import type { InfraOrganization } from "../api/infraTypes";

export const DESCRIPTION_MAX = 350;
export const TOPIC_MAX_COUNT = 20;
export const TOPIC_MAX_LENGTH = 50;
export const REPO_NAME_MAX = 100;

const REPO_NAME = /^[A-Za-z0-9._-]+$/;
const TOPIC = /^[a-z0-9][a-z0-9-]*$/;
const HAS_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;
const UNSAFE_SCHEME = /^\s*(javascript|data):/i;

const ORG_PRIORITY = ["wso2", "wso2-extensions", "wso2-enterprise", "ballerina-platform"];

export type RepoType = "Public" | "Private";

export interface RepositoryStepValues {
    organizationId: number;
    organizationName: string;
    organizationVisibility: string;
    organizationPlan: string;
    repoName: string;
    repoType: RepoType;
    enableIssues: "Yes" | "No";
    description: string;
    topics: string[];
    websiteUrl: string;
    prProtection: string;
}

export const emptyRepositoryStep: RepositoryStepValues = {
    organizationId: 0,
    organizationName: "",
    organizationVisibility: "",
    organizationPlan: "",
    repoName: "",
    repoType: "Public",
    enableIssues: "No",
    description: "",
    topics: [],
    websiteUrl: "",
    prProtection: "",
};

export type RepositoryStepErrors = Partial<
    Record<"organizationId" | "repoName" | "repoType" | "description" | "topics" | "websiteUrl", string>
>;

export function organizationAllowsIssues(org: Pick<InfraOrganization, "enableIssues">): boolean {
    return org.enableIssues === 1 || org.enableIssues === true;
}

export function sortOrganizations(organizations: InfraOrganization[]): InfraOrganization[] {
    return [...organizations].sort((a, b) => {
        const indexA = ORG_PRIORITY.indexOf(a.organizationName);
        const indexB = ORG_PRIORITY.indexOf(b.organizationName);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.organizationName.localeCompare(b.organizationName);
    });
}

/** Fields an organization choice forces. Enable Issues always returns to No. */
export function fieldsFromOrganization(org: InfraOrganization): Pick<
    RepositoryStepValues,
    | "organizationId"
    | "organizationName"
    | "organizationVisibility"
    | "organizationPlan"
    | "repoType"
    | "enableIssues"
    | "prProtection"
    > {
    let repoType: RepoType = "Public";
    if (org.organizationVisibility === "Private") repoType = "Private";
    if (org.organizationVisibility === "Public") repoType = "Public";
    if (org.organizationPlan === "Free") repoType = "Public";
    return {
        organizationId: org.organizationId,
        organizationName: org.organizationName,
        organizationVisibility: org.organizationVisibility,
        organizationPlan: org.organizationPlan,
        repoType,
        enableIssues: "No",
        prProtection: organizationAllowsIssues(org) ? "Default" : "Bal Lib Repo",
    };
    }

export function repoTypeRestriction(values: Pick<RepositoryStepValues, "organizationPlan" | "organizationVisibility">): {
    type: RepoType;
    message: string;
    } | null {
    if (!values.organizationVisibility && !values.organizationPlan) return null;
    if (values.organizationPlan === "Free") {
        return {
        type: "Public",
        message: "This organization is on the GitHub Free plan — only Public repositories are permitted.",
        };
    }
    if (values.organizationVisibility === "Public") {
        return {
        type: "Public",
        message: "This organization is Public — only Public repositories are allowed.",
        };
    }
    if (values.organizationVisibility === "Private") {
        return {
        type: "Private",
        message: "This organization is Private — only Private repositories are allowed.",
        };
    }
    return null;
}

export function sanitizeTopics(raw: string[]): string[] {
    const cleaned = raw.flatMap((value) => value.split(",")).map((value) => value.trim().toLowerCase()).filter(Boolean);
    return [...new Set(cleaned)];
}

    function repoNameError(name: string): string | undefined {
        const value = name.trim();
        if (!value) return "Repository name is required.";
        if (value.length > REPO_NAME_MAX) return `Repository name must be at most ${REPO_NAME_MAX} characters.`;
        if (value === "." || value === "..") return 'Repository name cannot be "." or "..".';
        if (/(?:^|.)\.git$/i.test(value)) return 'Repository name must not end with ".git".';
        if (!REPO_NAME.test(value)) {
            for (let i = 0; i < value.length; i++) {
            const ch = value[i];
            if (!/[A-Za-z0-9._-]/.test(ch)) {
                return `Invalid character at position ${i + 1}: "${ch}". Use only letters, numbers, hyphens (-), underscores (_), and periods (.).`;
            }
            }
            return "Invalid repository name. Use only letters, numbers, hyphens (-), underscores (_), and periods (.).";
        }
        return undefined;
    }

    function websiteError(value: string): string | undefined {
        const trimmed = value.trim();
        if (!trimmed) return undefined;
        if (UNSAFE_SCHEME.test(trimmed)) return "Website URL must start with http:// or https://";
        const withScheme = HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;
        try {
            const url = new URL(withScheme);
            if (url.protocol !== "http:" && url.protocol !== "https:") {
            return "Website URL must start with http:// or https://";
            }
        } catch {
            return "Website URL must be a valid URL.";
        }
        return undefined;
    }

export function repositoryStepErrors(
    values: RepositoryStepValues,
): RepositoryStepErrors {
    const errors: RepositoryStepErrors = {};
    if (values.organizationId <= 0) errors.organizationId = "Organization is required.";
    const nameError = repoNameError(values.repoName);
    if (nameError) errors.repoName = nameError;
    const restriction = repoTypeRestriction(values);
    if (restriction && values.repoType !== restriction.type) errors.repoType = restriction.message;

    const description = values.description.trim();
    if (!description) errors.description = "Description is required.";
    else if (description.length > DESCRIPTION_MAX) {
        errors.description = `Description cannot exceed ${DESCRIPTION_MAX} characters.`;
    }
    if (values.topics.length === 0) errors.topics = "Topics are required.";
    else if (values.topics.length > TOPIC_MAX_COUNT) errors.topics = `Add no more than ${TOPIC_MAX_COUNT} topics.`;
    else {
        for (let i = 0; i < values.topics.length; i++) {
        const topic = values.topics[i];
        if (topic.length > TOPIC_MAX_LENGTH) {
            errors.topics = `Topic #${i + 1} ("${topic}") is too long (max ${TOPIC_MAX_LENGTH}).`;
            break;
        }
        if (!TOPIC.test(topic)) {
            errors.topics = `Topic #${i + 1} ("${topic}") is invalid. Use lowercase letters, numbers, and hyphens, and start with a letter or number.`;
            break;
        }
        }
    }
    const urlError = websiteError(values.websiteUrl);
    if (urlError) errors.websiteUrl = urlError;
    return errors;
}