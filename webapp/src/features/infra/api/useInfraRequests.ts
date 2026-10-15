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
import { authedGet, authedPost } from "@api/http";
import { httpRetry } from "@api/errors";
import { useAccessToken } from "@hooks/useAccessToken";
import { useIdToken } from "@hooks/useIdToken";
import { infraBackendUrl, infraServiceUrls, isInfraBackendConfigured } from "@config/apiConfig";
import type { InfraAccessRequest, InfraRepositoryRequestList, InfraRequestComment } from "./infraTypes";

function localAssertionHeaders(idToken: string) {
  return infraBackendUrl.startsWith("http://localhost")
    ? { "x-jwt-assertion": idToken }
    : undefined;
}

export function useMyCreationRequests(
  memberEmail: string,
  query: { limit: number; offset: number; repoName?: string },
) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const getIdToken = useIdToken();
  const configured = isInfraBackendConfigured();
  const email = memberEmail.trim();
  const repoName = query.repoName?.trim() ?? "";
  return useQuery<InfraRepositoryRequestList>({
    queryKey: ["infra-my-creation-requests", email, query.limit, query.offset, repoName],
    enabled: isSignedIn && configured && email.length > 0,
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      const params = new URLSearchParams({
        memberEmail: email,
        limit: String(query.limit),
        offset: String(query.offset),
      });
      if (repoName) params.set("repoName", repoName);
      return authedGet<InfraRepositoryRequestList>(
        `${infraServiceUrls.repositoryRequests}?${params.toString()}`,
        accessToken,
        localAssertionHeaders(await getIdToken()),
      );
    },
    retry: httpRetry,
  });
}

export function useRepositoryRequestComments(requestId: number | null) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const getIdToken = useIdToken();
  const configured = isInfraBackendConfigured();
  return useQuery<InfraRequestComment[]>({
    queryKey: ["infra-repository-request-comments", requestId],
    enabled: isSignedIn && configured && requestId !== null,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<InfraRequestComment[]>(
        infraServiceUrls.repositoryRequestComments(requestId as number),
        accessToken,
        localAssertionHeaders(await getIdToken()),
      );
    },
    retry: httpRetry,
  });
}

export function useAddRepositoryRequestComment(requestId: number) {
  const getAccessToken = useAccessToken();
  const getIdToken = useIdToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { authorEmail: string; commentText: string }) => {
      const accessToken = await getAccessToken();
      const localAssertion = infraBackendUrl.startsWith("http://localhost")
        ? { "x-jwt-assertion": await getIdToken() }
        : undefined;
      return authedPost<unknown>(
        infraServiceUrls.repositoryRequestComments(requestId),
        accessToken,
        body,
        localAssertion,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["infra-repository-request-comments", requestId],
      });
    },
  });
}

export function useMyAccessRequests(enabled: boolean) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const getIdToken = useIdToken();
  const configured = isInfraBackendConfigured();
  return useQuery<InfraAccessRequest[]>({
    queryKey: ["infra-my-access-requests"],
    enabled: enabled && isSignedIn && configured,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<InfraAccessRequest[]>(
        infraServiceUrls.repositoryAccessRequests,
        accessToken,
        localAssertionHeaders(await getIdToken()),
      );
    },
    retry: httpRetry,
  });
}