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

import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet } from "@api/http";
import { httpRetry } from "@api/errors";
import { useAccessToken } from "@hooks/useAccessToken";
import { infraServiceUrls, isInfraBackendConfigured } from "@config/apiConfig";
import type { InfraEmployee, InfraLead, InfraOrganization, InfraTopic } from "./infraTypes";

export function useInfraLeads(enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const configured = isInfraBackendConfigured();
  return useQuery<InfraLead[]>({
    queryKey: ["infra-leads"],
    enabled: enabled && isSignedIn && configured,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<InfraLead[]>(infraServiceUrls.leads, accessToken);
    },
    staleTime: 5 * 60 * 1000,
    retry: httpRetry,
  });
}

export function useInfraEmployees(enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const configured = isInfraBackendConfigured();
  return useQuery<InfraEmployee[]>({
    queryKey: ["infra-employees"],
    enabled: enabled && isSignedIn && configured,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<InfraEmployee[]>(infraServiceUrls.employees, accessToken);
    },
    staleTime: 5 * 60 * 1000,
    retry: httpRetry,
  });
}

export function useInfraOrganizations(enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const configured = isInfraBackendConfigured();
  return useQuery<InfraOrganization[]>({
    queryKey: ["infra-organizations"],
    enabled: enabled && isSignedIn && configured,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<InfraOrganization[]>(infraServiceUrls.organizations, accessToken);
    },
    staleTime: 5 * 60 * 1000,
    retry: httpRetry,
  });
  }
  
export function useInfraTopics(enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const configured = isInfraBackendConfigured();
  return useQuery<InfraTopic[]>({
    queryKey: ["infra-topics"],
    enabled: enabled && isSignedIn && configured,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<InfraTopic[]>(infraServiceUrls.topics, accessToken);
    },
    staleTime: 5 * 60 * 1000,
    retry: httpRetry,
  });
}

export function useInfraTeams(organizationName: string, enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const configured = isInfraBackendConfigured();
  const organization = organizationName.trim();
  return useQuery<string[]>({
    queryKey: ["infra-teams", organization],
    enabled: enabled && isSignedIn && configured && organization.length > 0,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<string[]>(infraServiceUrls.teams(organization), accessToken);
    },
    staleTime: 5 * 60 * 1000,
    retry: httpRetry,
  });
}