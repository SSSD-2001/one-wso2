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

import type { RepoType } from "./repositoryStep";

export interface AccessStepValues {
    teams: string[];
    repoType: RepoType;
    enableTriageWso2All: "Yes" | "No";
    enableTriageWso2AllInterns: "Yes" | "No";
    disableTriageReason: string;
}

export const emptyAccessStep: AccessStepValues = {
    teams: [],
    repoType: "Public",
    enableTriageWso2All: "Yes",
    enableTriageWso2AllInterns: "Yes",
    disableTriageReason: "N/A",
};

export type AccessStepErrors = Partial<Record<"teams" | "disableTriageReason", string>>;

export function triageReasonRequired(values: AccessStepValues): boolean {
    return (
        values.repoType === "Private" &&
        (values.enableTriageWso2All === "No" || values.enableTriageWso2AllInterns === "No")
    );
}

export function accessStepErrors(values: AccessStepValues): AccessStepErrors {
    const errors: AccessStepErrors = {};
    if (values.teams.length === 0) errors.teams = "Teams are required.";
    if (triageReasonRequired(values)) {
        const reason = values.disableTriageReason.trim();
        if (!reason) errors.disableTriageReason = "Disable Triage Reason is required.";
        else if (reason === "N/A") {
        errors.disableTriageReason = "Please provide a reason for disabling triage access.";
        }
    }
    return errors;
}