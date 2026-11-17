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

import { authConfig } from "@config/authConfig";

/** Access token from a forced refresh, plus the ID token when the IdP sent one. */
export interface RefreshedSessionTokens {
  accessToken: string;
  idToken?: string;
}

/**
 * Exchanges the stored refresh token and writes the new session back.
 *
 * `getAccessToken()` returns the stored access token. The SDK refreshes it
 * only once that token is due to expire, so a still-valid token keeps the
 * claims it was issued with. `created_at` is stored in milliseconds, which is
 * what the SDK compares with `Date.now()`.
 *
 * Throws when there is no session, no refresh token, or the token endpoint
 * rejects the grant.
 */
export async function forceRefreshAccessToken(): Promise<RefreshedSessionTokens> {
  const key = findAsgardeoSessionKey();
  if (!key) throw new Error("No Asgardeo session.");
  const session = JSON.parse(sessionStorage.getItem(key) || "{}") as Record<string, unknown>;
  if (typeof session.refresh_token !== "string") throw new Error("No refresh token.");

  const response = await fetch(await resolveTokenEndpoint(), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: authConfig.clientId,
      refresh_token: session.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(textField(payload, "error") || "Could not refresh the access token.");
  }
  const accessToken = textField(payload, "access_token");
  if (!accessToken) throw new Error("Could not refresh the access token.");

  const idToken = textField(payload, "id_token");
  const refreshToken = textField(payload, "refresh_token");
  session.access_token = accessToken;
  if (idToken) session.id_token = idToken;
  if (refreshToken) session.refresh_token = refreshToken;
  if (typeof payload.expires_in === "number") session.expires_in = payload.expires_in;
  session.created_at = Date.now();
  sessionStorage.setItem(key, JSON.stringify(session));

  return { accessToken, ...(idToken ? { idToken } : {}) };
}

/** Asgardeo session record key, or null when this tab has no session. */
export function findAsgardeoSessionKey(): string | null {
  for (let index = 0; index < sessionStorage.length; index += 1) {
    const key = sessionStorage.key(index);
    if (key?.includes("session_data")) return key;
  }
  return null;
}

/** Token endpoint from discovery, or `${baseUrl}/oauth2/token` when discovery is unset. */
async function resolveTokenEndpoint(): Promise<string> {
  const wellKnown = authConfig.wellKnownEndpoint;
  if (!wellKnown) {
    return `${authConfig.baseUrl.replace(/\/$/, "")}/oauth2/token`;
  }
  const response = await fetch(wellKnown, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Could not read the token endpoint.");
  const endpoint = textField(await readJson(response), "token_endpoint");
  if (!endpoint) throw new Error("Could not read the token endpoint.");
  return endpoint;
}

/** Parsed JSON object, or `{}` when the body is empty or not JSON. */
async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** String field of `payload`, or null when it is missing or empty. */
function textField(payload: Record<string, unknown>, field: string): string | null {
  const value = payload[field];
  return typeof value === "string" && value.length > 0 ? value : null;
}
