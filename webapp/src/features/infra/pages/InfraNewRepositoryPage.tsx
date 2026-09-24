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

import { Alert } from "@wso2/oxygen-ui";
import { INFRA_EYEBROW } from "@constants/infraApps";
import InfraShell from "../components/InfraShell";
import { useInfraGate } from "../api/useInfraGate";
import NewRepositoryForm from "../new-repository/NewRepositoryForm";

export default function InfraNewRepositoryPage() {
    const gate = useInfraGate();

    return (
        <InfraShell
            eyebrow={INFRA_EYEBROW.github}
            title="New Repository"
            subtitle="Request a new GitHub repository."
        >
            {gate.isEmployee ? (
                <NewRepositoryForm />
            ) : (
                <Alert severity="warning">Only employees can request a new repository.</Alert>
            )}
        </InfraShell>
    );
}