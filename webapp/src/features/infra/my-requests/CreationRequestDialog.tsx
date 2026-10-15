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

import { useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import {
  BanIcon,
  BugIcon,
  Building2Icon,
  CalendarIcon,
  CircleHelpIcon,
  CloudIcon,
  ContactRoundIcon,
  EyeIcon,
  FileTextIcon,
  FolderIcon,
  GlobeIcon,
  HashIcon,
  MailIcon,
  ShieldCheckIcon,
  ShieldIcon,
  UserIcon,
  UserRoundIcon,
  UsersIcon,
  WrenchIcon,
  XIcon,
  type LucideIcon,
} from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { primaryBtnSx } from "../components/infraUi";
import { useInfraUserInfo } from "../api/useInfraUserInfo";
import {
  useAddRepositoryRequestComment,
  useRepositoryRequestComments,
} from "../api/useInfraRequests";
import type { InfraRepositoryRequest, InfraRequestState } from "../api/infraTypes";

export function formatRequestDateTime(value: string | null | undefined): string {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CreationRequestDialog({
  request,
  onClose,
}: {
  request: InfraRepositoryRequest;
  onClose: () => void;
}) {
  const stateColor = stateChipColor(request.state);
  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth={false}
      slotProps={{
        paper: {
          sx: {
            width: { xs: "95%", md: "min(1180px, 92vw)" },
            height: { xs: "92%", md: "84vh" },
            maxWidth: "none",
            display: "flex",
            flexDirection: "column",
          },
        },
      }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pr: 1 }}>
        <Stack direction="row" spacing={1} sx={{ flex: 1, flexWrap: "wrap", alignItems: "center" }}>
          <Chip
            size="small"
            variant="outlined"
            color={stateColor}
            icon={<UserRoundIcon size={14} />}
            label={request.state}
          />
          <Chip
            size="small"
            variant="outlined"
            color="info"
            icon={<CalendarIcon size={14} />}
            label={`Created: ${formatRequestDateTime(request.timestamp)}`}
          />
          <Chip
            size="small"
            variant="outlined"
            color="info"
            icon={<CalendarIcon size={14} />}
            label={`Updated: ${formatRequestDateTime(request.updatedAt)}`}
          />
        </Stack>
        <IconButton aria-label="Close" color="primary" onClick={onClose}>
          <XIcon size={16} />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1.55fr 1fr" },
            gap: 1.5,
            flex: 1,
            minHeight: 0,
          }}
        >
          <Box
            sx={{
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              overflow: "auto",
              p: 1.5,
            }}
          >
            <RequestDetails request={request} />
          </Box>
          <Box
            sx={{
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              minHeight: { xs: 360, md: 0 },
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <CommentThread request={request} />
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

function RequestDetails({ request }: { request: InfraRepositoryRequest }) {
  const privateOrg = request.organizationVisibility === "Private";
  const triageDisabled =
    request.enableTriageWso2All === "No" || request.enableTriageWso2AllInterns === "No";
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1fr 1.15fr" },
        gap: 1.5,
        alignItems: "start",
      }}
    >
      <Stack spacing={1}>
        <SectionTitle title="Request Details" />
        <FieldCard>
          <Field icon={UserIcon} label="Requested By" value={request.email} />
          <Field icon={ContactRoundIcon} label="Requested From" value={request.leadEmail} />
          <Field icon={MailIcon} label="CC List" value={listText(request.ccList)} />
        </FieldCard>
        <FieldCard>
          <Field icon={CircleHelpIcon} label="Requirement" value={request.requirement} />
        </FieldCard>
        <SectionTitle title="CI/CD Configuration" />
        <FieldCard>
          <Field icon={WrenchIcon} label="CI/CD Configuration" value={request.cicdRequirement} />
          {request.cicdRequirement === "Jenkins" && (
            <>
              <Field icon={WrenchIcon} label="Jenkins Job Type" value={request.jenkinsJobType} />
              <Field icon={WrenchIcon} label="Jenkins Group ID" value={request.jenkinsGroupId} />
            </>
          )}
          {request.cicdRequirement === "Azure" && (
            <>
              <Field icon={CloudIcon} label="Azure DevOps Org" value={request.azureDevopsOrg} />
              <Field icon={CloudIcon} label="Azure DevOps Project" value={request.azureDevopsProject} />
            </>
          )}
        </FieldCard>
      </Stack>
      <Stack spacing={1}>
        <SectionTitle title="Repository Details" />
        <FieldCard columns={2}>
          <Field icon={FolderIcon} label="Repository Name" value={request.repoName} />
          <Field icon={Building2Icon} label="Organization" value={request.organizationName} />
          <Field icon={BugIcon} label="Enable Issues" value={request.enableIssues} />
          <Field icon={EyeIcon} label="Type" value={request.repoType} />
          <Field icon={HashIcon} label="Topics" value={listText(request.topics)} />
          <Field icon={GlobeIcon} label="Website URL" value={request.websiteUrl} />
        </FieldCard>
        <FieldCard>
          <Field icon={FileTextIcon} label="Description" value={request.description} />
        </FieldCard>
        <SectionTitle title="Security and Access" />
        <FieldCard columns={2}>
          <Field icon={ShieldIcon} label="Branch Protection" value={request.prProtection} />
          <Field icon={UsersIcon} label="Teams" value={listText(request.teams)} />
          {privateOrg && (
            <>
              <Field
                icon={ShieldCheckIcon}
                label="Enable triage access to wso2-all Team?"
                value={request.enableTriageWso2All}
              />
              <Field
                icon={ShieldCheckIcon}
                label="Enable triage access to wso2-all-interns Team?"
                value={request.enableTriageWso2AllInterns}
              />
            </>
          )}
        </FieldCard>
        {triageDisabled && (
          <FieldCard>
            <Field
              icon={BanIcon}
              label="Reason for disabling triage access"
              value={request.disableTriageReason}
            />
          </FieldCard>
        )}
      </Stack>
    </Box>
  );
}

function CommentThread({ request }: { request: InfraRepositoryRequest }) {
  const userInfo = useInfraUserInfo();
  const comments = useRepositoryRequestComments(request.id);
  const addComment = useAddRepositoryRequestComment(request.id);
  const [draft, setDraft] = useState("");
  const canPost = request.state === "Pending";

  const post = () => {
    const commentText = draft.trim();
    const authorEmail = userInfo.data?.workEmail ?? "";
    if (!commentText || !authorEmail) return;
    addComment.mutate({ authorEmail, commentText }, { onSuccess: () => setDraft("") });
  };

  return (
    <Stack sx={{ height: "100%", minHeight: 0, p: 2 }}>
      <Typography sx={{ fontWeight: 600, mb: 1.5, textAlign: "center" }}>Comments</Typography>
      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", pr: 0.5 }}>
        {comments.isLoading ? (
          <CircularProgress size={22} />
        ) : comments.isError ? (
          <Alert severity="error">{describeError(comments.error)}</Alert>
        ) : (comments.data ?? []).length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No comments yet.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {(comments.data ?? []).map((comment) => (
              <Box
                key={comment.commentId}
                sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 1.5 }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.75 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      bgcolor: "info.main",
                      color: "info.contrastText",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <UserIcon size={16} />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2">{comment.authorEmail}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatRequestDateTime(comment.createdAt)}
                    </Typography>
                  </Box>
                </Stack>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                  {comment.commentText}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Box>
      {canPost && (
        <Stack spacing={1} sx={{ pt: 1.5 }}>
          {addComment.isError && <Alert severity="error">{describeError(addComment.error)}</Alert>}
          <Stack direction="row" spacing={1} sx={{ alignItems: "flex-end" }}>
            <TextField
              label="Add a comment"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              multiline
              minRows={2}
              fullWidth
              size="small"
            />
            <Button
              variant="contained"
              color="primary"
              sx={{ ...primaryBtnSx, minWidth: 80, mb: 0.5 }}
              disabled={!draft.trim() || addComment.isPending}
              onClick={post}
            >
              {addComment.isPending ? "Posting…" : "Post"}
            </Button>
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2, px: 2, py: 1.25 }}>
      <Typography sx={{ fontWeight: 700, textAlign: "center" }}>{title}</Typography>
    </Box>
  );
}

function FieldCard({ columns = 1, children }: { columns?: 1 | 2; children: ReactNode }) {
  return (
    <Box
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        p: 2,
        display: "grid",
        gridTemplateColumns: columns === 2 ? { xs: "1fr", sm: "1fr 1fr" } : "1fr",
        gap: 1.5,
      }}
    >
      {children}
    </Box>
  );
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value?: string | null;
}) {
  const text = value?.trim() ? value : "N/A";
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start", minWidth: 0 }}>
      <Box sx={{ color: "info.main", display: "flex", mt: 0.25, flexShrink: 0 }}>
        <Icon size={18} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {label}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {text}
        </Typography>
      </Box>
    </Stack>
  );
}

function listText(value: string | null | undefined): string {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n");
}

function stateChipColor(state: InfraRequestState): "success" | "error" | "warning" {
  if (state === "Approved") return "success";
  if (state === "Rejected") return "error";
  return "warning";
}
