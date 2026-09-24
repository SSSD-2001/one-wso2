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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import InfraHomePage from "@features/infra/pages/InfraHomePage";
import type { InfraGate } from "@features/infra/api/useInfraGate";

vi.mock("@config/apiConfig", () => ({
    isInfraBackendConfigured: () => true,
}));

const gate = vi.hoisted(() => ({ value: {} as InfraGate }));
vi.mock("@features/infra/api/useInfraGate", () => ({
    useInfraGate: () => gate.value,
}));

const AUTHORIZED: InfraGate = {
    canSee: () => true,
    isAuthorized: true,
    isEmployee: true,
    isApprover: false,
    isAdmin: false,
    isResolving: false,
    isForbidden: false,
    isError: false,
    retry: () => {},
};

const ITEM_LABELS: Record<string, string> = {
    "infra-github-new-repository": "New Repository",
    "infra-github-repository-access": "Repository Access",
    "infra-github-request-access": "Request Access",
    "infra-github-my-requests": "My Requests",
    "infra-github-review-requests": "Review Requests",
    "infra-security-dashboard": "Security Dashboard",
    "infra-github-settings": "GitHub Settings",
};

function renderHome(g: Partial<InfraGate> = {}) {
    gate.value = { ...AUTHORIZED, ...g };
    return render(
        <MemoryRouter>
        <InfraHomePage />
        </MemoryRouter>,
    );
}

beforeEach(() => {
    gate.value = AUTHORIZED;
});

describe("InfraHomePage", () => {
    it("lists every registry item as not here yet, with scroll ids for the rail", () => {
        renderHome();

        expect(screen.getByRole("link", { name: "Open new repository" })).toHaveAttribute(
            "href",
            "/infra/github/repository-requests",
        );
        expect(screen.getAllByText("Not here yet")).toHaveLength(6);

        for (const [id, label] of Object.entries(ITEM_LABELS)) {
            const el = document.getElementById(id);
            expect(el, id).not.toBeNull();
            expect(el).toHaveTextContent(label);
        }
    });

    it("hides items the gate refuses, including their scroll ids", () => {
        renderHome({
        canSee: (id) => id === "infra-github-review-requests",
    });

    expect(document.getElementById("infra-github-review-requests")).not.toBeNull();
    expect(screen.getByText("Review Requests")).toBeInTheDocument();
    expect(screen.getByText("Not here yet")).toBeInTheDocument();

    expect(screen.queryByText("New Repository")).not.toBeInTheDocument();
    expect(screen.queryByText("GitHub Settings")).not.toBeInTheDocument();
    expect(document.getElementById("infra-github-new-repository")).toBeNull();
    expect(document.getElementById("infra-github-settings")).toBeNull();
    });
});