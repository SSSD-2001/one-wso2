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

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Typography,
} from "@wso2/oxygen-ui";
import { ExternalLinkIcon, FileIcon } from "@wso2/oxygen-ui-icons-react";
import type { Meeting } from "../api/salesTypes";
import { useMeetingAttachments } from "../api/useSalesData";
import { describeError } from "../util/salesError";

/**
 * The Drive files attached to one meeting.
 *
 * These are LINKS, not content: the backend returns fileUrl/iconLink/mimeType
 * and nothing else, so the recording opens in Drive rather than playing here.
 * An in-app player needs endpoints that do not exist yet.
 */
export default function AttachmentsDialog({
  meeting,
  onClose,
}: {
  /** The meeting whose files to show, or null when the dialog is closed. */
  meeting: Meeting | null;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useMeetingAttachments(meeting?.meetingId ?? null);
  const attachments = data?.attachments ?? [];

  return (
    <Dialog open={meeting !== null} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Files</DialogTitle>
      <DialogContent dividers>
        {meeting && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {meeting.title}
          </Typography>
        )}

        {isLoading ? (
          <Box>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} variant="text" height={32} />
            ))}
          </Box>
        ) : error ? (
          // The backend's own sentence, not a generic line: it distinguishes
          // "you didn't host this meeting" from a genuine outage, and only it
          // knows which happened.
          <Alert severity="error">{describeError(error)}</Alert>
        ) : attachments.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No files are attached to this meeting. Recordings appear here once
            they have finished processing.
          </Typography>
        ) : (
          <List dense disablePadding>
            {attachments.map((attachment) => (
              <ListItem key={attachment.fileId} disableGutters>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {/* A local glyph, never `attachment.iconLink`. Pointing an <img> at
                      Drive's own icon URL makes the BROWSER fetch from Google, which
                      tells Google that this viewer is looking at this meeting and is
                      the one place this app would talk to anything but meet-app-backend.
                      The file name beside it already says what the thing is. */}
                  <FileIcon size={18} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Link
                      href={attachment.fileUrl}
                      target="_blank"
                      // noopener/noreferrer with target=_blank: without it the
                      // opened tab can reach back through window.opener.
                      rel="noopener noreferrer"
                      sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
                    >
                      {attachment.title}
                      <ExternalLinkIcon size={13} />
                    </Link>
                  }
                  secondary={attachment.mimeType}
                  slotProps={{ secondary: { variant: "caption" } }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
