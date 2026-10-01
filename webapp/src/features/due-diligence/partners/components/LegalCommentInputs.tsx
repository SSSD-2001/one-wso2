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

import { useRef, useState } from "react";
import { Alert, Avatar, Box, Button, Chip, CircularProgress, IconButton, Snackbar, Stack, TextField, Tooltip, Typography } from "@wso2/oxygen-ui";
import { EditIcon, FileIcon, UploadIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import { humanizeHttpError } from "@api/http";
import { useAsgardeoUser } from "@hooks/useAsgardeoUser";
import { useDueDiligenceGate } from "@features/due-diligence/api/useDueDiligenceGate";
import { FILE_UPLOAD_LIMIT } from "@features/due-diligence/constants";
import { useDeletePartnerFile, useUploadPartnerFile } from "../api/useFinance";
import { useAddLegalComment, useEditLegalComment } from "../api/useLegal";
import type { LegalComment, LegalFileSubmission, LegalSubQuestion } from "../api/legalTypes";

const LEGAL_COMMENT_QUESTION_ID = 80;

/**
 * Ported from the source app's Resellers/ResellerDashboard/Legal/CommentInputs.js
 * — like Finance's comment thread, but each comment can carry its own file
 * attachments (only on question 80, and only when `attachSubQuestion` — the
 * "choose file" sub-question, id 104 — is present). Only a legalApprover may
 * add a comment here (there is no creator/reviewer split like Finance's).
 */
export default function LegalCommentInputs({
  companyId,
  applicantEmail,
  comments,
  files,
  attachSubQuestion,
}: {
  companyId: string;
  applicantEmail: string;
  comments: LegalComment[];
  files: LegalFileSubmission[];
  attachSubQuestion?: LegalSubQuestion;
}) {
  const gate = useDueDiligenceGate();
  const user = useAsgardeoUser();
  const addComment = useAddLegalComment(companyId);
  const editComment = useEditLegalComment(companyId);
  const uploadFile = useUploadPartnerFile();
  const deleteFile = useDeletePartnerFile();

  const [showNewCommentField, setShowNewCommentField] = useState(false);
  const [currentComment, setCurrentComment] = useState("");
  const [newFiles, setNewFiles] = useState<{ fileName: string }[]>([]);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editedComment, setEditedComment] = useState("");
  const [editNewFiles, setEditNewFiles] = useState<{ fileName: string }[]>([]);
  const [snack, setSnack] = useState<{ open: boolean; severity: "success" | "error" | "warning"; message: string }>({
    open: false,
    severity: "success",
    message: "",
  });
  const newFileInput = useRef<HTMLInputElement>(null);
  const editFileInput = useRef<HTMLInputElement>(null);

  const questionComments = comments.filter((c) => c.questionId === LEGAL_COMMENT_QUESTION_ID);
  const canAddComment = gate.hasRole("legalApprover");
  const showFileAttachment = attachSubQuestion !== undefined;

  const openFile = (fileName: string) => {
    const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
    const path = extension === "pdf" ? "/due-diligence/view-pdf" : ["jpg", "jpeg", "png"].includes(extension) ? "/due-diligence/view-image" : null;
    // `from=legal` — see the identical note in FinanceSubQuestionDetails.tsx;
    // a new tab has no history entry to carry `fromPerspective` on, so the
    // URL itself has to say which perspective opened it.
    if (path)
      window.open(
        `${path}?fileName=${encodeURIComponent(fileName)}&extension=${encodeURIComponent(extension)}&from=legal`,
        "_blank",
        "noopener,noreferrer",
      );
  };

  const uploadFiles = async (fileList: FileList | null, current: { fileName: string }[], setFiles: (f: { fileName: string }[]) => void) => {
    if (!fileList || fileList.length === 0) return;
    if (current.length + fileList.length > FILE_UPLOAD_LIMIT) {
      setSnack({ open: true, severity: "warning", message: `Cannot upload more than ${FILE_UPLOAD_LIMIT} files` });
      return;
    }
    const next = [...current];
    for (const file of Array.from(fileList)) {
      try {
        const res = await uploadFile.mutateAsync({ email: applicantEmail, file });
        next.push({ fileName: res.data.fileName });
      } catch (err) {
        setSnack({ open: true, severity: "error", message: `Upload failed: ${humanizeHttpError(err)}` });
      }
    }
    setFiles(next);
  };

  const removeFile = (fileName: string, current: { fileName: string }[], setFiles: (f: { fileName: string }[]) => void) => {
    setFiles(current.filter((f) => f.fileName !== fileName));
    void deleteFile.mutateAsync({ email: applicantEmail, fileName }).catch(() => undefined);
  };

  const saveNewComment = () => {
    if (currentComment.trim() === "") return;
    addComment.mutate(
      {
        sortIndex: questionComments.length,
        userEmail: user.email ?? "",
        comment: currentComment,
        questionId: LEGAL_COMMENT_QUESTION_ID,
        companyId: Number(companyId),
        newPartnerFileData: newFiles.map((f) => ({
          companyId: Number(companyId),
          questionId: LEGAL_COMMENT_QUESTION_ID,
          subQuestionId: attachSubQuestion?.subQuestionId ?? null,
          fileName: f.fileName,
          fileType: f.fileName.split(".").pop()?.toLowerCase() ?? "",
        })),
      },
      {
        onSuccess: () => {
          setCurrentComment("");
          setNewFiles([]);
          setShowNewCommentField(false);
        },
        onError: (err) => setSnack({ open: true, severity: "error", message: humanizeHttpError(err) }),
      },
    );
  };

  const startEdit = (item: LegalComment) => {
    setEditingCommentId(item.commentId);
    setEditedComment(item.comment);
    setEditNewFiles([]);
  };

  const saveEditedComment = (commentId: number) => {
    const existing = comments.find((c) => c.commentId === commentId);
    const savedCommentFiles = files.filter((f) => f.legalCommentId === commentId);
    const actuallyNewFiles = editNewFiles.filter((f) => !savedCommentFiles.some((sf) => sf.fileName === f.fileName));
    editComment.mutate(
      {
        commentId,
        sortIndex: existing?.sortIndex ?? 0,
        userEmail: user.email ?? "",
        comment: editedComment,
        questionId: LEGAL_COMMENT_QUESTION_ID,
        companyId: Number(companyId),
        ...(actuallyNewFiles.length > 0
          ? {
              newPartnerFileData: actuallyNewFiles.map((f) => ({
                companyId: Number(companyId),
                questionId: LEGAL_COMMENT_QUESTION_ID,
                subQuestionId: attachSubQuestion?.subQuestionId ?? null,
                fileName: f.fileName,
                fileType: f.fileName.split(".").pop()?.toLowerCase() ?? "",
              })),
            }
          : {}),
      },
      {
        onSuccess: () => {
          setEditingCommentId(null);
          setEditedComment("");
          setEditNewFiles([]);
        },
        onError: (err) => setSnack({ open: true, severity: "error", message: humanizeHttpError(err) }),
      },
    );
  };

  return (
    <Box sx={{ mt: 1, mb: 2 }}>
      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.message}
        </Alert>
      </Snackbar>

      <Stack spacing={1.5}>
        {questionComments.map((item) => {
          const isEditing = editingCommentId === item.commentId;
          const savedCommentFiles = files.filter((f) => f.legalCommentId === item.commentId);
          const commentFiles = isEditing ? [...savedCommentFiles, ...editNewFiles] : savedCommentFiles;

          return (
            <Box key={item.commentId} sx={{ bgcolor: "background.default", border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
              <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Tooltip title={item.userEmail}>
                  <Chip avatar={<Avatar sx={{ width: 20, height: 20, fontSize: 13 }} />} label={item.userEmail} variant="outlined" size="small" />
                </Tooltip>
                {!isEditing && (
                  <IconButton size="small" onClick={() => startEdit(item)}>
                    <EditIcon size={15} />
                  </IconButton>
                )}
              </Stack>

              {isEditing ? (
                <Stack spacing={1.5}>
                  <TextField
                    autoFocus
                    value={editedComment}
                    onChange={(e) => setEditedComment(e.target.value)}
                    multiline
                    minRows={3}
                    fullWidth
                    size="small"
                    sx={{ "& .MuiInputBase-root": { p: 1.5 } }}
                  />
                  {showFileAttachment && commentFiles.length < FILE_UPLOAD_LIMIT && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={uploadFile.isPending ? <CircularProgress size={15} /> : <UploadIcon size={15} />}
                      disabled={uploadFile.isPending}
                      onClick={() => editFileInput.current?.click()}
                      sx={{ alignSelf: "flex-start", textTransform: "none" }}
                    >
                      {uploadFile.isPending ? "Uploading…" : "Attach file"}
                    </Button>
                  )}
                  <input ref={editFileInput} type="file" multiple hidden accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => void uploadFiles(e.target.files, editNewFiles, setEditNewFiles)} />
                  <FileList files={commentFiles} savedFiles={savedCommentFiles} onOpen={openFile} onRemove={(f) => removeFile(f, editNewFiles, setEditNewFiles)} />
                  <Stack direction="row" spacing={1}>
                    <Button variant="contained" size="small" onClick={() => saveEditedComment(item.commentId)} disabled={editComment.isPending}>
                      Save
                    </Button>
                    <Button variant="outlined" size="small" onClick={() => setEditingCommentId(null)}>
                      Cancel
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                <Stack spacing={1}>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    {item.comment}
                  </Typography>
                  <FileList files={commentFiles} savedFiles={savedCommentFiles} onOpen={openFile} />
                </Stack>
              )}
            </Box>
          );
        })}

        {canAddComment && !showNewCommentField && (
          <Box onClick={() => setShowNewCommentField(true)} sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5, cursor: "pointer", color: "text.disabled" }}>
            Add your comment…
          </Box>
        )}
        {showNewCommentField && (
          <Stack spacing={1.5}>
            <TextField
              autoFocus
              placeholder="Add your comment…"
              value={currentComment}
              onChange={(e) => setCurrentComment(e.target.value)}
              multiline
              minRows={3}
              fullWidth
              size="small"
              sx={{ "& .MuiInputBase-root": { p: 1.5 } }}
            />
            {showFileAttachment && newFiles.length < FILE_UPLOAD_LIMIT && (
              <Button
                size="small"
                variant="outlined"
                startIcon={uploadFile.isPending ? <CircularProgress size={15} /> : <UploadIcon size={15} />}
                disabled={uploadFile.isPending}
                onClick={() => newFileInput.current?.click()}
                sx={{ alignSelf: "flex-start", textTransform: "none" }}
              >
                {uploadFile.isPending ? "Uploading…" : "Attach file"}
              </Button>
            )}
            <input ref={newFileInput} type="file" multiple hidden accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => void uploadFiles(e.target.files, newFiles, setNewFiles)} />
            <FileList files={newFiles} savedFiles={[]} onOpen={openFile} onRemove={(f) => removeFile(f, newFiles, setNewFiles)} />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" size="small" onClick={saveNewComment} disabled={currentComment.trim() === "" || addComment.isPending}>
                {addComment.isPending ? <CircularProgress size={16} /> : "Save"}
              </Button>
              <Button variant="outlined" size="small" onClick={() => { setShowNewCommentField(false); setCurrentComment(""); setNewFiles([]); }}>
                Cancel
              </Button>
            </Stack>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

function FileList({
  files,
  savedFiles,
  onOpen,
  onRemove,
}: {
  files: { fileName: string }[];
  savedFiles: { fileName: string }[];
  onOpen: (fileName: string) => void;
  onRemove?: (fileName: string) => void;
}) {
  if (files.length === 0) return null;
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color="text.secondary">
        Attached files:
      </Typography>
      {files.map((f) => {
        const isNew = !savedFiles.some((sf) => sf.fileName === f.fileName);
        return (
          <Stack key={f.fileName} direction="row" spacing={1} sx={{ alignItems: "center", bgcolor: "background.paper", border: 1, borderColor: "divider", borderRadius: 1, p: 1 }}>
            <FileIcon size={16} />
            <Typography variant="body2" sx={{ flex: 1, cursor: "pointer" }} onClick={() => onOpen(f.fileName)}>
              {f.fileName}
            </Typography>
            {isNew && onRemove && <XIcon size={14} style={{ cursor: "pointer" }} onClick={() => onRemove(f.fileName)} />}
          </Stack>
        );
      })}
    </Stack>
  );
}
