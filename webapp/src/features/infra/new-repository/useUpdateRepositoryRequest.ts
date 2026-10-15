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

import { useMutation } from "@tanstack/react-query";
import { authedPatch } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { useIdToken } from "@hooks/useIdToken";
import { infraBackendUrl, infraServiceUrls } from "@config/apiConfig";
import type { RepositoryRequestUpdate } from "./submitRequest";

export function useUpdateRepositoryRequest() {
  const getAccessToken = useAccessToken();
  const getIdToken = useIdToken();
  return useMutation({
    mutationFn: async (body: RepositoryRequestUpdate) => {
      const accessToken = await getAccessToken();
      const localAssertion = infraBackendUrl.startsWith("http://localhost")
        ? { "x-jwt-assertion": await getIdToken() }
        : undefined;
      return authedPatch<unknown>(
        infraServiceUrls.repositoryRequest(body.id),
        accessToken,
        body,
        localAssertion,
      );
    },
  });
}
