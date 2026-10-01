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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authedDelete, authedGet, authedPatch, authedPost, fetchWithReauth, HttpError } from "@api/http";
import { httpRetry } from "@api/errors";
import { useAccessToken } from "@hooks/useAccessToken";
import { dueDiligenceServiceUrls, isDueDiligenceBackendConfigured } from "@config/apiConfig";
import { ALLOWED_FILE_EXTENSIONS } from "@features/due-diligence/constants";
import type { FinanceAnswerData, PartnerQuestionData } from "./financeTypes";

/** GET /partners/questions — the finance/legal/trade-reference question bank (shared across all three forms). */
export function usePartnerQuestions(enabled = true) {
  const getAccessToken = useAccessToken();
  const configured = isDueDiligenceBackendConfigured();

  return useQuery<PartnerQuestionData>({
    queryKey: ["due-diligence", "partner-questions"],
    enabled: enabled && configured,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<PartnerQuestionData>(dueDiligenceServiceUrls.partnerQuestions, accessToken);
    },
    staleTime: 5 * 60 * 1000,
    retry: httpRetry,
  });
}

const financeAnswersKey = (companyId: string | number) => ["due-diligence", "finance-answers", companyId];

/** GET /partners/{id}/answers — this company's finance answers, files, comments, and special-approval status. */
export function useFinanceAnswers(companyId: string | number, enabled = true) {
  const getAccessToken = useAccessToken();
  const configured = isDueDiligenceBackendConfigured();

  return useQuery<FinanceAnswerData>({
    queryKey: financeAnswersKey(companyId),
    enabled: enabled && configured && Boolean(companyId),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<FinanceAnswerData>(dueDiligenceServiceUrls.partnerAnswers(companyId), accessToken);
    },
    retry: httpRetry,
  });
}

export interface FinanceFeedbackAnswer {
  subQuestionId: number;
  questionId: number;
  booleanAnswer: boolean;
  descriptionAnswer: string;
  companyId: string;
}

/** POST /finance/feedback — save one question's answers (and, for question 44, the finance result). */
export function useSaveFinanceFeedback(companyId: string | number) {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      answers: FinanceFeedbackAnswer[];
      financeResult: string;
      specialApprovalResult: string;
    }) => {
      const accessToken = await getAccessToken();
      return authedPost(dueDiligenceServiceUrls.financeFeedback, accessToken, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: financeAnswersKey(companyId) });
    },
  });
}

/** POST /finance/comments — add one new comment (a single-element array; matches the backend's bulk-create contract). */
export function useAddFinanceComment(companyId: string | number) {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (comment: {
      sortIndex: number;
      userEmail: string;
      comment: string;
      questionId: number;
      companyId: number;
      financeResult: string;
    }) => {
      const accessToken = await getAccessToken();
      return authedPost(dueDiligenceServiceUrls.financeComments, accessToken, [comment]);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: financeAnswersKey(companyId) });
    },
  });
}

/** PATCH /finance/comments/{commentId} — edit an existing comment. */
export function useEditFinanceComment(companyId: string | number) {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      commentId,
      ...payload
    }: {
      commentId: number;
      sortIndex: number;
      userEmail: string;
      comment: string;
      questionId: number;
      companyId: number;
    }) => {
      const accessToken = await getAccessToken();
      return authedPatch(dueDiligenceServiceUrls.financeComment(commentId), accessToken, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: financeAnswersKey(companyId) });
    },
  });
}

/** POST /special-approval-email — the backend expects the raw company id as the JSON body (an int, not an object). */
export function useSendSpecialApprovalEmail() {
  const getAccessToken = useAccessToken();

  return useMutation({
    mutationFn: async (companyId: number) => {
      const accessToken = await getAccessToken();
      return authedPost(dueDiligenceServiceUrls.specialApprovalEmail, accessToken, companyId);
    },
  });
}

/** POST partners/{email}/files — upload one raw file for a sub-question's attachment. */
export function useUploadPartnerFile() {
  const getAccessToken = useAccessToken();

  return useMutation({
    mutationFn: async ({ email, file }: { email: string; file: File }) => {
      const extension = (file.name.split(".").pop() ?? "").toLowerCase();
      if (!ALLOWED_FILE_EXTENSIONS.has(extension)) {
        throw new Error(`"${file.name}" isn't an allowed file type. Only PDF, JPEG, PNG, and JPG files can be attached.`);
      }
      const accessToken = await getAccessToken();
      const url = dueDiligenceServiceUrls.partnerFileUpload(email, file.name, extension);
      const res = await fetchWithReauth(url, { method: "POST", body: file }, accessToken);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new HttpError(url, res.status, body);
      }
      return res.json() as Promise<{ data: { fileName: string } }>;
    },
  });
}

/** DELETE partners/{email}/files/{fileName} — remove an uploaded (not-yet-saved) file. */
export function useDeletePartnerFile() {
  const getAccessToken = useAccessToken();

  return useMutation({
    mutationFn: async ({ email, fileName }: { email: string; fileName: string }) => {
      const accessToken = await getAccessToken();
      return authedDelete(dueDiligenceServiceUrls.partnerFileDelete(email, fileName), accessToken);
    },
  });
}

/** POST partners/{email}/files/metadata — persist uploaded files' metadata against a question/sub-question. */
export function useSavePartnerFilesMetadata(companyId: string | number) {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      email,
      files,
    }: {
      email: string;
      files: { companyId: number; questionId: number; subQuestionId: number; fileName: string; fileType: string }[];
    }) => {
      const accessToken = await getAccessToken();
      return authedPost(dueDiligenceServiceUrls.partnerFilesMetadata(email), accessToken, files);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: financeAnswersKey(companyId) });
    },
  });
}
