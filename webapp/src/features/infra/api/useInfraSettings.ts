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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedDelete, authedGet, authedPatch, authedPost, authedPut } from "@api/http";
import { httpRetry } from "@api/errors";
import { useAccessToken } from "@hooks/useAccessToken";
import { useIdToken } from "@hooks/useIdToken";
import { infraBackendUrl, infraServiceUrls, isInfraBackendConfigured } from "@config/apiConfig";
import type { InfraDefaultTeam, InfraOrganization } from "./infraTypes";

function useLocalHeaders() {
  const getIdToken = useIdToken();
  return async () =>
    infraBackendUrl.startsWith("http://localhost")
      ? { "x-jwt-assertion": await getIdToken() }
      : undefined;
}

/** Loads default teams offered when an admin adds or edits an organization. */
export function useInfraDefaultTeams(enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const localHeaders = useLocalHeaders();
  const configured = isInfraBackendConfigured();
  return useQuery<InfraDefaultTeam[]>({
    queryKey: ["infra-default-teams"],
    enabled: enabled && isSignedIn && configured,
    queryFn: async () =>
      authedGet(infraServiceUrls.defaultTeams, await getAccessToken(), await localHeaders()),
    retry: httpRetry,
  });
}

/** Loads one organization for the edit dialog. Cached as ["infra-organization", id]. */
export function useInfraOrganization(organizationId: number | null) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const localHeaders = useLocalHeaders();
  const configured = isInfraBackendConfigured();
  return useQuery<InfraOrganization>({
    queryKey: ["infra-organization", organizationId],
    enabled: isSignedIn && configured && organizationId !== null,
    queryFn: async () =>
      authedGet(
        infraServiceUrls.organization(organizationId as number),
        await getAccessToken(),
        await localHeaders(),
      ),
    retry: httpRetry,
  });
}

function useSettingsMutation<TBody>(
  run: (
    body: TBody,
    accessToken: string,
    headers: Record<string, string> | undefined,
  ) => Promise<unknown>,
  invalidate: string[][],
) {
  const getAccessToken = useAccessToken();
  const localHeaders = useLocalHeaders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: TBody) => run(body, await getAccessToken(), await localHeaders()),
    onSuccess: () => {
      for (const queryKey of invalidate) void queryClient.invalidateQueries({ queryKey });
    },
  });
}

/** Fields sent when creating or updating an organization. teamIds are default-team IDs. */
export type OrganizationWrite = {
  organizationName: string;
  organizationVisibility: string;
  enableIssues: boolean;
  teamIds: number[];
};

/** Creates an organization and refreshes the organizations list. */
export function useAddOrganization() {
  return useSettingsMutation(
    (body: OrganizationWrite, token, headers) =>
      authedPost(infraServiceUrls.organizations, token, body, headers),
    [["infra-organizations"]],
  );
}

/** Updates an organization and refreshes the organizations list and that organization's cache. */
export function useUpdateOrganization() {
  return useSettingsMutation(
    (body: OrganizationWrite & { organizationId: number }, token, headers) =>
      authedPut(infraServiceUrls.organization(body.organizationId), token, body, headers),
    [["infra-organizations"], ["infra-organization"]],
  );
}

/** Deletes an organization and refreshes the organizations list. */
export function useDeleteOrganization() {
  return useSettingsMutation(
    (id: number, token, headers) => authedDelete(infraServiceUrls.organization(id), token, headers),
    [["infra-organizations"]],
  );
}

/** Syncs an organization's GitHub plan and refreshes the organizations list and that organization's cache. */
export function useSyncOrganization() {
  return useSettingsMutation(
    (name: string, token, headers) =>
      authedPatch(infraServiceUrls.organizationSyncPlan(name), token, undefined, headers),
    [["infra-organizations"], ["infra-organization"]],
  );
}

/** Creates a functional lead and refreshes the leads list. */
export function useAddLead() {
  return useSettingsMutation(
    (body: { leadEmail: string; teamName: string }, token, headers) =>
      authedPost(infraServiceUrls.leads, token, body, headers),
    [["infra-leads"]],
  );
}

/** Updates a functional lead and refreshes the leads list. */
export function useUpdateLead() {
  return useSettingsMutation(
    (body: { leadId: number; leadEmail: string; teamName: string }, token, headers) =>
      authedPut(infraServiceUrls.lead(body.leadId), token, body, headers),
    [["infra-leads"]],
  );
}

/** Deletes a functional lead and refreshes the leads list. */
export function useDeleteLead() {
  return useSettingsMutation(
    (id: number, token, headers) => authedDelete(infraServiceUrls.lead(id), token, headers),
    [["infra-leads"]],
  );
}

/** Creates a repository topic and refreshes the topics list. */
export function useAddTopic() {
  return useSettingsMutation(
    (body: { topicName: string }, token, headers) =>
      authedPost(infraServiceUrls.topics, token, body, headers),
    [["infra-topics"]],
  );
}

/** Updates a repository topic and refreshes the topics list. */
export function useUpdateTopic() {
  return useSettingsMutation(
    (body: { topicId: number; topicName: string }, token, headers) =>
      authedPut(infraServiceUrls.topic(body.topicId), token, body, headers),
    [["infra-topics"]],
  );
}

/** Deletes a repository topic and refreshes the topics list. */
export function useDeleteTopic() {
  return useSettingsMutation(
    (id: number, token, headers) => authedDelete(infraServiceUrls.topic(id), token, headers),
    [["infra-topics"]],
  );
}

/** Creates a default team and refreshes the default-teams list. */
export function useAddDefaultTeam() {
  return useSettingsMutation(
    (body: { teamName: string; permissionLevel: string }, token, headers) =>
      authedPost(infraServiceUrls.defaultTeams, token, body, headers),
    [["infra-default-teams"]],
  );
}

/** Updates a default team and refreshes the default-teams list. */
export function useUpdateDefaultTeam() {
  return useSettingsMutation(
    (body: { teamId: number; teamName: string; permissionLevel: string }, token, headers) =>
      authedPut(infraServiceUrls.defaultTeam(body.teamId), token, body, headers),
    [["infra-default-teams"]],
  );
}

/** Deletes a default team and refreshes the default-teams list. */
export function useDeleteDefaultTeam() {
  return useSettingsMutation(
    (id: number, token, headers) => authedDelete(infraServiceUrls.defaultTeam(id), token, headers),
    [["infra-default-teams"]],
  );
}
