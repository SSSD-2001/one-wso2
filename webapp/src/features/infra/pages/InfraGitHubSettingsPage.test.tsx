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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InfraGitHubSettingsPage from "@features/infra/pages/InfraGitHubSettingsPage";
import type { InfraGate } from "@features/infra/api/useInfraGate";
import type { InfraOrganization } from "@features/infra/api/infraTypes";

vi.mock("@config/apiConfig", () => ({
  isInfraBackendConfigured: () => true,
  isGitHubOAuthConfigured: () => false,
  infraServiceUrls: {},
  infraBackendUrl: "",
}));

const state = vi.hoisted(() => {
    const listeners = new Set<() => void>();
    let version = 0;
    return {
      editing: undefined as InfraOrganization | undefined,
      editingLoading: false,
      subscribe(listener: () => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      version() {
        return version;
      },
      publish() {
        version += 1;
        listeners.forEach((listener) => listener());
      },
    };
  });

const TEAMS = [
    { teamId: 1, teamName: "platform", permissionLevel: "push" },
    { teamId: 4, teamName: "security", permissionLevel: "pull" },
];

const LIST_ROW: InfraOrganization = {
    organizationId: 7,
    organizationName: "wso2-extensions",
    organizationVisibility: "Private",
    organizationPlan: "Team",
    enableIssues: 1,
    defaultTeams: "platform, security",
    teamIds: "1,4",
};

function idleMutation() {
  return {
    isPending: false,
    error: null,
    reset: vi.fn(),
    mutate: vi.fn(),
    mutateAsync: vi.fn(async () => undefined),
  };
}

vi.mock("../api/useInfraDirectory", () => ({
    useInfraOrganizations: () => ({
        data: [LIST_ROW],
        isFetching: false,
        error: null,
        refetch: vi.fn(async () => ({ data: [LIST_ROW] })),
    }),
    useInfraLeads: () => ({ data: [], isFetching: false, error: null }),
    useInfraTopics: () => ({ data: [], isFetching: false, error: null }),
}));

vi.mock("../api/useInfraSettings", async () => {
    const { useSyncExternalStore } = await import("react");
    return {
        useInfraOrganization: () => {
            useSyncExternalStore(state.subscribe, state.version, state.version);
            return {
            data: state.editing,
            isLoading: state.editingLoading,
            error: null,
            };
        },
        useInfraDefaultTeams: () => ({ data: TEAMS, isFetching: false, error: null }),
        useAddOrganization: idleMutation,
        useUpdateOrganization: idleMutation,
        useDeleteOrganization: idleMutation,
        useSyncOrganization: idleMutation,
        useAddLead: idleMutation,
        useUpdateLead: idleMutation,
        useDeleteLead: idleMutation,
        useAddTopic: idleMutation,
        useUpdateTopic: idleMutation,
        useDeleteTopic: idleMutation,
        useAddDefaultTeam: idleMutation,
        useUpdateDefaultTeam: idleMutation,
        useDeleteDefaultTeam: idleMutation,
    };
  });

const gate = vi.hoisted(() => ({ value: {} as InfraGate }));
vi.mock("../api/useInfraGate", () => ({
    useInfraGate: () => gate.value,
}));

const ADMIN: InfraGate = {
    canSee: () => true,
    isAuthorized: true,
    isEmployee: true,
    isApprover: false,
    isAdmin: true,
    isResolving: false,
    isForbidden: false,
    isError: false,
    retry: () => {},
};

let client: QueryClient;

function page() {
    return (
        <QueryClientProvider client={client}>
        <InfraGitHubSettingsPage />
        </QueryClientProvider>
    );
}

function renderPage() {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(page());
}

function organizationsCard() {
    const title = screen.getByText("Organizations");
    const card = title.closest(".MuiCard-root");
    if (!card) throw new Error("Organizations card not found");
    return card as HTMLElement;
}

function selectByLabel(dialog: HTMLElement, label: string) {
    const labelEl = within(dialog).getByText(label, { selector: "label" });
    const control = labelEl.parentElement;
    if (!control) throw new Error(`${label} control not found`);
    return within(control).getByRole("combobox");
}

beforeEach(() => {
    gate.value = ADMIN;
    state.editing = undefined;
    state.editingLoading = false;
});

describe("OrganizationDialog", () => {
    it("fills the edit dialog after the organization loads", async () => {
        const user = userEvent.setup();
        state.editingLoading = true;
        renderPage();
      
        const row = screen.getByRole("row", { name: /wso2-extensions/ });
        await user.click(within(row).getByRole("button", { name: "Edit" }));
      
        const loadingDialog = screen.getByRole("dialog", { name: "Edit Organization" });
        expect(within(loadingDialog).getByRole("progressbar")).toBeInTheDocument();
        expect(screen.queryByRole("textbox", { name: "Organization Name" })).not.toBeInTheDocument();
      
        act(() => {
            state.editing = LIST_ROW;
            state.editingLoading = false;
            state.publish();
        });
      
        const dialog = screen.getByRole("dialog", { name: "Edit Organization" });
        expect(within(dialog).getByRole("textbox", { name: "Organization Name" })).toHaveValue(
          "wso2-extensions",
        );
        expect(selectByLabel(dialog, "Visibility")).toHaveTextContent("Private");
        expect(selectByLabel(dialog, "Allow Issues")).toHaveTextContent("Yes");
        expect(selectByLabel(dialog, "Default Teams")).toHaveTextContent("platform, security");
    });

    it("shows Public when the organization visibility is empty", async () => {
        const user = userEvent.setup();
        state.editing = { ...LIST_ROW, organizationVisibility: "" };
        renderPage();

        const row = screen.getByRole("row", { name: /wso2-extensions/ });
        await user.click(within(row).getByRole("button", { name: "Edit" }));

        const dialog = screen.getByRole("dialog", { name: "Edit Organization" });
        expect(selectByLabel(dialog, "Visibility")).toHaveTextContent("Public");
    });

    it("starts Add Organization blank, with Public visibility and issues on", async () => {
        const user = userEvent.setup();
        renderPage();

        await user.click(within(organizationsCard()).getByRole("button", { name: "Add" }));

        const dialog = screen.getByRole("dialog", { name: "Add Organization" });
        expect(within(dialog).getByRole("textbox", { name: "Organization Name" })).toHaveValue("");
        expect(selectByLabel(dialog, "Visibility")).toHaveTextContent("Public");
        expect(selectByLabel(dialog, "Allow Issues")).toHaveTextContent("Yes");
    });

    it("keeps edits for the same organization object and resets for a new one", async () => {
        const user = userEvent.setup();
        const loaded = { ...LIST_ROW };
        state.editing = loaded;
        renderPage();

        const row = screen.getByRole("row", { name: /wso2-extensions/ });
        await user.click(within(row).getByRole("button", { name: "Edit" }));

        const name = screen.getByRole("textbox", { name: "Organization Name" });
        await user.clear(name);
        await user.type(name, "typed-name");

        act(() => {
            state.publish();
          });
        expect(screen.getByRole("textbox", { name: "Organization Name" })).toHaveValue("typed-name");
          
        act(() => {
            state.editing = {
              ...loaded,
              organizationName: "other-org",
              organizationVisibility: "Public",
              enableIssues: 0,
              teamIds: "1",
            };
            state.publish();
        });
          
        const dialog = screen.getByRole("dialog", { name: "Edit Organization" });
        expect(within(dialog).getByRole("textbox", { name: "Organization Name" })).toHaveValue("other-org");
        expect(selectByLabel(dialog, "Visibility")).toHaveTextContent("Public");
        expect(selectByLabel(dialog, "Allow Issues")).toHaveTextContent("No");
        expect(selectByLabel(dialog, "Default Teams")).toHaveTextContent("platform");    });
});
