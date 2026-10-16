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

export type OrganizationWrite = {
  organizationName: string;
  organizationVisibility: string;
  enableIssues: boolean;
  teamIds: number[];
};

export function useAddOrganization() {
  return useSettingsMutation(
    (body: OrganizationWrite, token, headers) =>
      authedPost(infraServiceUrls.organizations, token, body, headers),
    [["infra-organizations"]],
  );
}

export function useUpdateOrganization() {
  return useSettingsMutation(
    (body: OrganizationWrite & { organizationId: number }, token, headers) =>
      authedPut(infraServiceUrls.organization(body.organizationId), token, body, headers),
    [["infra-organizations"]],
  );
}

export function useDeleteOrganization() {
  return useSettingsMutation(
    (id: number, token, headers) => authedDelete(infraServiceUrls.organization(id), token, headers),
    [["infra-organizations"]],
  );
}

export function useSyncOrganization() {
  return useSettingsMutation(
    (name: string, token, headers) =>
      authedPatch(infraServiceUrls.organizationSyncPlan(name), token, undefined, headers),
    [["infra-organizations"]],
  );
}

export function useAddLead() {
  return useSettingsMutation(
    (body: { leadEmail: string; teamName: string }, token, headers) =>
      authedPost(infraServiceUrls.leads, token, body, headers),
    [["infra-leads"]],
  );
}

export function useUpdateLead() {
  return useSettingsMutation(
    (body: { leadId: number; leadEmail: string; teamName: string }, token, headers) =>
      authedPut(infraServiceUrls.lead(body.leadId), token, body, headers),
    [["infra-leads"]],
  );
}

export function useDeleteLead() {
  return useSettingsMutation(
    (id: number, token, headers) => authedDelete(infraServiceUrls.lead(id), token, headers),
    [["infra-leads"]],
  );
}

export function useAddTopic() {
  return useSettingsMutation(
    (body: { topicName: string }, token, headers) =>
      authedPost(infraServiceUrls.topics, token, body, headers),
    [["infra-topics"]],
  );
}

export function useUpdateTopic() {
  return useSettingsMutation(
    (body: { topicId: number; topicName: string }, token, headers) =>
      authedPut(infraServiceUrls.topic(body.topicId), token, body, headers),
    [["infra-topics"]],
  );
}

export function useDeleteTopic() {
  return useSettingsMutation(
    (id: number, token, headers) => authedDelete(infraServiceUrls.topic(id), token, headers),
    [["infra-topics"]],
  );
}

export function useAddDefaultTeam() {
  return useSettingsMutation(
    (body: { teamName: string; permissionLevel: string }, token, headers) =>
      authedPost(infraServiceUrls.defaultTeams, token, body, headers),
    [["infra-default-teams"]],
  );
}

export function useUpdateDefaultTeam() {
  return useSettingsMutation(
    (body: { teamId: number; teamName: string; permissionLevel: string }, token, headers) =>
      authedPut(infraServiceUrls.defaultTeam(body.teamId), token, body, headers),
    [["infra-default-teams"]],
  );
}

export function useDeleteDefaultTeam() {
  return useSettingsMutation(
    (id: number, token, headers) => authedDelete(infraServiceUrls.defaultTeam(id), token, headers),
    [["infra-default-teams"]],
  );
}
