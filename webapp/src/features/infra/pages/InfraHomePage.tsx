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

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button, Chip, Typography } from "@wso2/oxygen-ui";
import { GitHub } from "@wso2/oxygen-ui-icons-react";
import { authedPost, authedPut } from "@api/http";
import { describeError } from "@api/errors";
import { infraServiceUrls, isGitHubOAuthConfigured } from "@config/apiConfig";
import { authConfig } from "@config/authConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import { useIdTokenClaims } from "@features/security/grc/hooks/useIdTokenClaims";
import InfraShell from "../components/InfraShell";
import InfraConfirmDialog from "../components/InfraConfirmDialog";
import GitHubConnectionGuide from "../github/GitHubConnectionGuide";
import { useInfraGate } from "../api/useInfraGate";
import { useInfraUserInfo } from "../api/useInfraUserInfo";
import type { GitHubVerifyResponse } from "../api/infraTypes";
import { primaryBtnSx } from "../components/infraUi";
import {
    consumePendingOAuthCode,
    consumeStoredGitHubConnectResult,
    DEFAULT_REPOSITORY_ACCESS_PENDING_KEY,
    resolveGitHubConnection,
    restorePendingOAuthCode,
    startGitHubOAuth,
    type GitHubConnectResult,
} from "../github/githubOAuth";

const DEFAULT_ACCESS_RETRY_MESSAGE = "Default repository access was not granted.";

interface PendingDefaultAccess {
    verified: GitHubConnectResult;
    tokenReady: boolean;
    idToken?: string;
}

function readPendingDefaultAccess(): PendingDefaultAccess | null {
    const raw = sessionStorage.getItem(DEFAULT_REPOSITORY_ACCESS_PENDING_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as PendingDefaultAccess;
        return parsed.verified?.status === "verified" ? parsed : null;
    } catch {
        return null;
    }
}

function writePendingDefaultAccess(pending: PendingDefaultAccess): void {
    sessionStorage.setItem(DEFAULT_REPOSITORY_ACCESS_PENDING_KEY, JSON.stringify(pending));
}

function findAsgardeoSessionKey(): string | null {
    for (let index = 0; index < sessionStorage.length; index += 1) {
        const key = sessionStorage.key(index);
        if (key?.includes("session_data")) return key;
    }
    return null;
}

function retainedAccessToken(): string | null {
    if (!readPendingDefaultAccess()?.tokenReady) return null;
    const key = findAsgardeoSessionKey();
    if (!key) return null;
    const session = JSON.parse(sessionStorage.getItem(key) || "{}") as Record<string, unknown>;
    return typeof session.access_token === "string" ? session.access_token : null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
    const segment = token.split(".")[1];
    if (!segment) return null;
    try {
        const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
        return JSON.parse(atob(padded)) as Record<string, unknown>;
    } catch {
        return null;
    }
}

// The access token does not carry the custom githubUserId attribute. The ID token
// does when Asgardeo releases it, and the local backend reads x-jwt-assertion first.
function idTokenForGithubClaim(): string | null {
    const idToken = readPendingDefaultAccess()?.idToken;
    if (!idToken) return null;
    const payload = decodeJwtPayload(idToken);
    const githubUserId = payload?.githubUserId;
    const groups = payload?.groups;
    if (typeof githubUserId !== "string" || githubUserId.length === 0) return null;
    if (!Array.isArray(groups) || groups.length === 0) return null;
    return idToken;
}

async function resolveTokenEndpoint(): Promise<string> {
    const wellKnown = authConfig.wellKnownEndpoint;
    if (!wellKnown) {
        return `${authConfig.baseUrl.replace(/\/$/, "")}/oauth2/token`;
    }
    const response = await fetch(wellKnown, { headers: { Accept: "application/json" } });
    const document = (await response.json()) as { token_endpoint?: string };
    if (!response.ok || !document.token_endpoint) {
        throw new Error("Could not read the token endpoint.");
    }
    return document.token_endpoint;
}

async function refreshAccessToken(): Promise<string> {
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
    const payload = (await response.json()) as {
        access_token?: string;
        id_token?: string;
        refresh_token?: string;
        expires_in?: number;
        error?: string;
    };
    if (!response.ok || !payload.access_token) {
        throw new Error(payload.error || "Could not refresh the access token.");
    }

    session.access_token = payload.access_token;
    if (payload.id_token) session.id_token = payload.id_token;
    if (payload.refresh_token) session.refresh_token = payload.refresh_token;
    if (payload.expires_in) session.expires_in = payload.expires_in;
    // The SDK checks created_at + expires_in * 1000 against Date.now().
    session.created_at = Date.now();
    sessionStorage.setItem(key, JSON.stringify(session));

    const pending = readPendingDefaultAccess();
    if (pending) {
        writePendingDefaultAccess({
            ...pending,
            tokenReady: true,
            ...(payload.id_token ? { idToken: payload.id_token } : {}),
        });
    }
    return payload.access_token;
}

export default function InfraHomePage() {
    const gate = useInfraGate();
    const userInfo = useInfraUserInfo();
    const claims = useIdTokenClaims();
    const getAccessToken = useAccessToken();
    const queryClient = useQueryClient();
    const pendingOnLoad = readPendingDefaultAccess();
    const [connectError, setConnectError] = useState<string | null>(
        pendingOnLoad ? DEFAULT_ACCESS_RETRY_MESSAGE : null,
    );
    const [connecting, setConnecting] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [verified, setVerified] = useState<GitHubConnectResult | null>(pendingOnLoad?.verified ?? null);
    const [defaultAccessPending, setDefaultAccessPending] = useState(pendingOnLoad !== null);

    const jwtGithubUserId =
        typeof claims?.githubUserId === "string" ? claims.githubUserId : null;
    const { isConnected, githubUsername } = resolveGitHubConnection({
        verified,
        jwtGithubUserId: jwtGithubUserId ?? userInfo.data?.githubUserId,
        githubUsername: verified?.githubUsername ?? userInfo.data?.githubUsername,
    });

    const grantDefaultRepositoryAccess = useCallback(async () => {
        try {
            const token = retainedAccessToken() ?? (await refreshAccessToken());
            const idToken = idTokenForGithubClaim();
            await authedPut(
                infraServiceUrls.setDefaultRepositoryAccess,
                token,
                {},
                idToken ? { "x-jwt-assertion": idToken } : undefined,
            );
            sessionStorage.removeItem(DEFAULT_REPOSITORY_ACCESS_PENDING_KEY);
            setDefaultAccessPending(false);
            await queryClient.invalidateQueries({ queryKey: ["infra-default-repository-access"] });
        } catch (error) {
            setConnectError(describeError(error));
        }
    }, [queryClient]);

    const retryDefaultAccess = () => {
        setConnectError(null);
        setConnecting(true);
        void grantDefaultRepositoryAccess().finally(() => setConnecting(false));
    };

    useEffect(() => {
        const stored = consumeStoredGitHubConnectResult();
        if (stored?.status === "error") {
            setConnectError(stored.errorMessage ?? "GitHub connection failed.");
        }

        const code = consumePendingOAuthCode();
        if (!code) return;

        setConnecting(true);
        void (async () => {
            let accessToken: string;
            try {
                accessToken = await getAccessToken();
            } catch (error) {
                restorePendingOAuthCode(code);
                setConnectError(describeError(error));
                setConnecting(false);
                return;
            }

            try {
                const result = await authedPost<GitHubVerifyResponse>(
                    infraServiceUrls.githubVerifyAndPersistUser,
                    accessToken,
                    { code },
                );
                if (result?.status !== "verified") {
                    setConnectError(
                        "GitHub account was not verified. Confirm your company email on GitHub.",
                    );
                    return;
                }
                const verifiedResult: GitHubConnectResult = {
                    status: "verified",
                    githubUserId: result.githubUserId ?? undefined,
                    githubUsername: result.githubUsername ?? undefined,
                };
                setVerified(verifiedResult);
                writePendingDefaultAccess({ verified: verifiedResult, tokenReady: false });
                setDefaultAccessPending(true);
                await queryClient.invalidateQueries({ queryKey: ["infra-user-info"] });
                await grantDefaultRepositoryAccess();
            } catch (error) {
                setConnectError(describeError(error));
            } finally {
                setConnecting(false);
            }
        })();
    }, [getAccessToken, grantDefaultRepositoryAccess, queryClient]);

    const retryButton = (
        <Button
            variant="contained"
            size="small"
            disabled={connecting}
            onClick={retryDefaultAccess}
            sx={primaryBtnSx}
        >
            {connecting ? "Connecting…" : "Retry"}
        </Button>
    );

    return (
        <InfraShell
        title="GitHub Connection"
        subtitle="Connect your GitHub account to request repositories."
        center
        >
        {connectError && (
            <Alert severity="error" sx={{ mb: 2 }}>
            {connectError}
            </Alert>
        )}

        {gate.isEmployee && (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5, mb: 2 }}>
            {connecting ? (
                <Button variant="contained" size="small" disabled sx={primaryBtnSx}>
                    Connecting…
                </Button>
            ) : isConnected ? (
                <>
                <Chip
                icon={<GitHub size={14} />}
                label={githubUsername ? `@${githubUsername}` : "Connected"}
                color="success"
                variant="outlined"
                size="small"
                />
                {defaultAccessPending && retryButton}
                </>
            ) : (
                <>
                <Chip label="Not Connected" variant="outlined" size="small" />
                {defaultAccessPending ? (
                    retryButton
                ) : isGitHubOAuthConfigured() ? (
                    <Button
                    variant="contained"
                    size="small"
                    onClick={() => setConfirmOpen(true)}
                    sx={primaryBtnSx}
                    >
                    Connect with GitHub
                    </Button>
                ) : (
                    <Typography variant="body2" color="text.secondary">
                    GitHub OAuth is not configured.
                    </Typography>
                )}
                </>
            )}
            </Box>
        )}

        {gate.isEmployee && <GitHubConnectionGuide />}

        <InfraConfirmDialog
            open={confirmOpen}
            title="Connect with GitHub"
            confirmLabel="Continue"
            busy={connecting}
            onCancel={() => setConfirmOpen(false)}
            onConfirm={() => {
            setConfirmOpen(false);
            startGitHubOAuth("/infra/github/connection");
            }}
            body={
            <>
                Before connecting, ensure your company email is added and verified on
                your GitHub account. Do not close this tab while the page loads.
            </>
            }
        />
        </InfraShell>
    );
}
