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

import { useCallback, useRef, useState } from "react";
import { googleOAuthClientId, googlePickerApiKey } from "@config/apiConfig";
import type { DriveFile } from "../util/parDriveFile";

export type DrivePickerError = "SCRIPT_LOAD_FAILED" | "POPUP_BLOCKED" | "ACCESS_DENIED" | null;

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const GIS_URL = "https://accounts.google.com/gsi/client";
const GAPI_URL = "https://apis.google.com/js/api.js";

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

// Ports par-app's own hooks/useGoogleDrivePicker.ts verbatim — the Lead
// Portal's "attach from Google Drive" evidence picker (ParLeadReviewPanel.tsx).
// Scripts are loaded lazily (only once this is actually invoked, not on
// every Lead Portal page load) and the OAuth token is cached in a ref so a
// second attach in the same session skips the consent popup.
export function useGoogleDrivePicker() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<DrivePickerError>(null);

  const tokenRef = useRef<string | null>(null);
  const tokenClientRef = useRef<google.accounts.oauth2.TokenClient | null>(null);
  const pendingCallbackRef = useRef<((files: DriveFile[]) => void) | null>(null);

  const openPickerWithToken = useCallback((token: string, onFilesSelected: (files: DriveFile[]) => void) => {
    let builder = new google.picker.PickerBuilder()
      .addView(new google.picker.DocsView().setIncludeFolders(false))
      .addView(google.picker.ViewId.RECENTLY_PICKED)
      .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(token);
    // Passed only when actually configured (see apiConfig.ts's
    // googlePickerApiKey) — an empty string here could itself trigger
    // Google's "API developer key is invalid" error.
    if (googlePickerApiKey) {
      builder = builder.setDeveloperKey(googlePickerApiKey);
    }
    const picker = builder
      .setCallback((data: google.picker.ResponseObject) => {
        if (data.action === google.picker.Action.PICKED) {
          const files: DriveFile[] = data.docs.map((doc) => ({
            id: doc.id,
            name: doc.name,
            url: doc.url,
            mimeType: doc.mimeType,
          }));
          onFilesSelected(files);
        }
      })
      .build();
    picker.setVisible(true);
  }, []);

  const openPicker = useCallback(
    async (onFilesSelected: (files: DriveFile[]) => void) => {
      setError(null);
      setIsLoading(true);

      try {
        await Promise.all([loadScript(GIS_URL), loadScript(GAPI_URL)]);
        await new Promise<void>((resolve) => gapi.load("picker", resolve));
      } catch {
        setError("SCRIPT_LOAD_FAILED");
        setIsLoading(false);
        return;
      }

      setIsLoading(false);

      if (tokenRef.current) {
        openPickerWithToken(tokenRef.current, onFilesSelected);
        return;
      }

      pendingCallbackRef.current = onFilesSelected;

      if (!tokenClientRef.current) {
        tokenClientRef.current = google.accounts.oauth2.initTokenClient({
          client_id: googleOAuthClientId,
          scope: DRIVE_SCOPE,
          callback: (response) => {
            if (response.error) {
              setError(response.error === "access_denied" ? "ACCESS_DENIED" : "POPUP_BLOCKED");
              return;
            }
            tokenRef.current = response.access_token;
            // Clear the cached token 60s before it expires.
            setTimeout(() => {
              tokenRef.current = null;
            }, Math.max(0, (response.expires_in - 60) * 1000));
            if (pendingCallbackRef.current) {
              openPickerWithToken(response.access_token, pendingCallbackRef.current);
            }
          },
          error_callback: () => {
            setError("POPUP_BLOCKED");
          },
        });
      }

      // prompt: "" uses the existing Google session silently; falls back to
      // a login popup only if there isn't one.
      tokenClientRef.current.requestAccessToken({ prompt: "" });
    },
    [openPickerWithToken],
  );

  return { openPicker, isLoading, error };
}
