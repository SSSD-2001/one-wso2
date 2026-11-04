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
import { authedGet, authedPatch, authedPost } from "@api/http";
import { httpRetry } from "@api/errors";
import { useAccessToken } from "@hooks/useAccessToken";
import { useIdToken } from "@hooks/useIdToken";
import { infraServiceUrls, isInfraBackendConfigured } from "@config/apiConfig";
import type { InfraRepositoryRequestList, InfraRequestComment } from "./infraTypes";
import { infraLocalAssertionHeaders } from "./infraLocalBackend";

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
        infraLocalAssertionHeaders(await getIdToken()),
      );
    },
    retry: httpRetry,
  });
}

export function useReviewCreationRequests(
  filter: { leadEmail?: string; fetchAll?: boolean },
  query: { limit: number; offset: number; repoName?: string },
) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const getIdToken = useIdToken();
  const configured = isInfraBackendConfigured();
  const leadEmail = filter.leadEmail?.trim() ?? "";
  const repoName = query.repoName?.trim() ?? "";
  const fetchAll = Boolean(filter.fetchAll);
  return useQuery<InfraRepositoryRequestList>({
    queryKey: [
      "infra-review-creation-requests",
      leadEmail,
      fetchAll,
      query.limit,
      query.offset,
      repoName,
    ],
    enabled: isSignedIn && configured && (fetchAll || leadEmail.length > 0),
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      const params = new URLSearchParams({
        limit: String(query.limit),
        offset: String(query.offset),
      });
      if (leadEmail) params.set("leadEmail", leadEmail);
      if (repoName) params.set("repoName", repoName);
      return authedGet<InfraRepositoryRequestList>(
        `${infraServiceUrls.repositoryRequests}?${params.toString()}`,
        accessToken,
        infraLocalAssertionHeaders(await getIdToken()),
      );
    },
    retry: httpRetry,
  });
}

export function useApproveRepositoryRequest() {
  const getAccessToken = useAccessToken();
  const getIdToken = useIdToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const accessToken = await getAccessToken();
      return authedPatch<unknown>(
        infraServiceUrls.repositoryRequestApprove(id),
        accessToken,
        {},
        infraLocalAssertionHeaders(await getIdToken()),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["infra-review-creation-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["infra-my-creation-requests"] });
    },
  });
}

export function useRejectRepositoryRequest() {
  const getAccessToken = useAccessToken();
  const getIdToken = useIdToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: number; commentText: string }) => {
      const accessToken = await getAccessToken();
      return authedPatch<unknown>(
        infraServiceUrls.repositoryRequestReject(args.id),
        accessToken,
        { commentText: args.commentText },
        infraLocalAssertionHeaders(await getIdToken()),
      );
    },
    onSuccess: (_data, args) => {
      void queryClient.invalidateQueries({ queryKey: ["infra-review-creation-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["infra-my-creation-requests"] });
      void queryClient.invalidateQueries({
        queryKey: ["infra-repository-request-comments", args.id],
      });
    },
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
        infraLocalAssertionHeaders(await getIdToken()),
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
      return authedPost<unknown>(
        infraServiceUrls.repositoryRequestComments(requestId),
        accessToken,
        body,
        infraLocalAssertionHeaders(await getIdToken()),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["infra-repository-request-comments", requestId],
      });
    },
  });
}
