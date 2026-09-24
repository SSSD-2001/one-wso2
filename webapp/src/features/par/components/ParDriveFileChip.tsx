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

import { Box, IconButton, Typography } from "@wso2/oxygen-ui";
import { FileIcon, FileTextIcon, PresentationIcon, SheetIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import type { DriveFile } from "../util/parDriveFile";

function DriveIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.includes("document")) return <FileTextIcon size={16} color="#4285F4" />;
  if (mimeType.includes("spreadsheet")) return <SheetIcon size={16} color="#0F9D58" />;
  if (mimeType.includes("presentation")) return <PresentationIcon size={16} color="#F4B400" />;
  return <FileIcon size={16} color="#5F6368" />;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "drive.google.com";
  }
}

// Ports DriveFileChip.tsx: one attached evidence file, shown while editing
// (removable) or read-only (a plain link), oxygen-ui only per this port's
// own convention.
export default function ParDriveFileChip({ file, onRemove, disabled = false }: { file: DriveFile; onRemove?: () => void; disabled?: boolean }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        bgcolor: "action.hover",
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        px: 1.5,
        py: 1,
        minWidth: 0,
      }}
    >
      <Box
        component="a"
        href={file.url}
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          flex: 1,
          minWidth: 0,
          textDecoration: "none",
          cursor: "pointer",
          "&:hover .file-name": { textDecoration: "underline" },
        }}
      >
        <DriveIcon mimeType={file.mimeType} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography className="file-name" variant="body2" fontWeight={500} noWrap title={file.name} color="text.primary">
            {file.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {getDomain(file.url)}
          </Typography>
        </Box>
      </Box>
      {!disabled && onRemove && (
        <IconButton size="small" onClick={onRemove} aria-label={`Remove ${file.name}`} sx={{ color: "text.disabled", flexShrink: 0 }}>
          <XIcon size={16} />
        </IconButton>
      )}
    </Box>
  );
}
