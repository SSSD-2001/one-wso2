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
import { accessStepErrors, emptyAccessStep } from "./accessStep";

describe("accessStepErrors", () => {
    it("requires at least one team", () => {
        expect(accessStepErrors({ ...emptyAccessStep, teams: ["wso2-all"] })).toEqual({});
        expect(accessStepErrors(emptyAccessStep).teams).toBe("Teams are required.");
    });

    it("requires a real reason when a private repo declines triage", () => {
        expect(
        accessStepErrors({
            ...emptyAccessStep,
            teams: ["wso2-all"],
            repoType: "Private",
            enableTriageWso2All: "No",
            disableTriageReason: "N/A",
        }).disableTriageReason,
        ).toMatch(/reason/);
    });

    it("leaves the reason alone for a public repository", () => {
        expect(
        accessStepErrors({
            ...emptyAccessStep,
            teams: ["wso2-all"],
            repoType: "Public",
            enableTriageWso2All: "No",
            disableTriageReason: "N/A",
        }),
        ).toEqual({});
    });
});