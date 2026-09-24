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

// Ambient types for the Google Identity Services + Picker API globals
// useGoogleDrivePicker.ts loads at runtime — ported verbatim from par-app's
// own types/google-picker.d.ts (no @types/google.picker package exists to
// depend on instead).

declare namespace google.accounts.oauth2 {
  interface TokenClientConfig {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type: string }) => void;
  }

  interface TokenResponse {
    access_token: string;
    expires_in: number;
    error?: string;
    error_description?: string;
  }

  interface TokenClient {
    requestAccessToken(overrideConfig?: { prompt?: string }): void;
  }

  function initTokenClient(config: TokenClientConfig): TokenClient;
}

declare namespace google.picker {
  enum Action {
    PICKED = "picked",
    CANCEL = "cancel",
  }

  enum Feature {
    MULTISELECT_ENABLED = "multiselect",
  }

  enum ViewId {
    RECENTLY_PICKED = "recently-picked",
  }

  interface DocumentObject {
    id: string;
    name: string;
    url: string;
    mimeType: string;
  }

  interface ResponseObject {
    action: Action;
    docs: DocumentObject[];
  }

  class DocsView {
    setIncludeFolders(include: boolean): DocsView;
  }

  class PickerBuilder {
    addView(view: DocsView | ViewId): PickerBuilder;
    enableFeature(feature: Feature): PickerBuilder;
    setOAuthToken(token: string): PickerBuilder;
    setDeveloperKey(key: string): PickerBuilder;
    setCallback(callback: (data: ResponseObject) => void): PickerBuilder;
    build(): Picker;
  }

  interface Picker {
    setVisible(visible: boolean): void;
  }
}

declare const gapi: {
  load(api: string, callback: () => void): void;
};
