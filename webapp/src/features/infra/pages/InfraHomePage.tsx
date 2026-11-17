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
import { authedPost, authedPut, HttpError } from "@api/http";
import { describeError } from "@api/errors";
import { decodeJwtPayload } from "@api/tokenExpiry";
import { findAsgardeoSessionKey, forceRefreshAccessToken } from "@api/forceRefreshAccessToken";
import { infraServiceUrls, isGitHubOAuthConfigured } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import { useIdTokenClaims } from "@features/security/grc/hooks/useIdTokenClaims";
import InfraShell from "../components/InfraShell";
import InfraConfirmDialog from "../components/InfraConfirmDialog";
import GitHubConnectionGuide from "../github/GitHubConnectionGuide";
import { useInfraGate } from "../api/useInfraGate";
import { useInfraUserInfo } from "../api/useInfraUserInfo";
import type { GitHubVerifyResponse } from "../api/infraTypes";
import { infraLocalAssertionHeaders } from "../api/infraLocalBackend";
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

/** GitHub connect whose default-access grant has not finished. */
interface PendingDefaultAccess {
    /** Verified GitHub account to show while the grant is unfinished. */
    verified: GitHubConnectResult;
    /** True after a refresh has been stored. A 4xx from the grant clears it. */
    tokenReady: boolean;
    /** `sub` of the session that stored this record. */
    sub: string;
    /** ID token from the refresh. Sent only to a local backend. */
    idToken?: string;
}

/** Asgardeo session object, or null when this tab has no session record. */
function readAsgardeoSession(): Record<string, unknown> | null {
    const key = findAsgardeoSessionKey();
    if (!key) return null;
    return JSON.parse(sessionStorage.getItem(key) || "{}") as Record<string, unknown>;
}

/** `sub` of the current session, or null when no session token carries one. */
function currentSessionSubject(): string | null {
    const session = readAsgardeoSession();
    if (!session) return null;
    for (const token of [session.id_token, session.access_token]) {
        if (typeof token !== "string") continue;
        const sub = decodeJwtPayload(token)?.sub;
        if (typeof sub === "string" && sub.length > 0) return sub;
    }
    return null;
}

/**
 * Pending grant for the current session.
 * Null when nothing is stored, the JSON is unreadable, or `sub` does not match.
 */
function readPendingDefaultAccess(): PendingDefaultAccess | null {
    const raw = sessionStorage.getItem(DEFAULT_REPOSITORY_ACCESS_PENDING_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as PendingDefaultAccess;
        const subject = currentSessionSubject();
        if (!subject || parsed.sub !== subject || parsed.verified?.status !== "verified") return null;
        return parsed;
    } catch {
        return null;
    }
}

/** Stores `pending` until the grant succeeds or the user signs out. */
function writePendingDefaultAccess(pending: PendingDefaultAccess): void {
    sessionStorage.setItem(DEFAULT_REPOSITORY_ACCESS_PENDING_KEY, JSON.stringify(pending));
}

/** True when `created_at + expires_in` is still ahead of now. Both values come from the session record. */
function accessTokenIsCurrent(session: Record<string, unknown>): boolean {
    const createdAt = Number(session.created_at);
    const expiresIn = Number(session.expires_in);
    return (
        Number.isFinite(createdAt) &&
        Number.isFinite(expiresIn) &&
        expiresIn > 0 &&
        createdAt + expiresIn * 1000 > Date.now()
    );
}

/**
 * Stored access token for a finished refresh that has not expired.
 * Null when the grant must refresh again.
 */
function retainedAccessToken(): string | null {
    if (!readPendingDefaultAccess()?.tokenReady) return null;
    const session = readAsgardeoSession();
    const token = session?.access_token;
    if (!session || typeof token !== "string" || !accessTokenIsCurrent(session)) return null;
    return token;
}

/**
 * ID token that carries `githubUserId` and a non-empty `groups` claim.
 * Null when either is missing.
 */
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

/** Refreshes the session and marks the pending grant ready. Returns the new access token. */
async function refreshConnectAccessToken(): Promise<string> {
    const tokens = await forceRefreshAccessToken();
    const pending = readPendingDefaultAccess();
    if (pending) {
        writePendingDefaultAccess({
            ...pending,
            tokenReady: true,
            ...(tokens.idToken ? { idToken: tokens.idToken } : {}),
        });
    }
    return tokens.accessToken;
}

/** True when the grant was rejected with HTTP 400–499. */
function isClientError(error: unknown): boolean {
    return error instanceof HttpError && error.status >= 400 && error.status < 500;
}

export default function InfraHomePage() {
    const gate = useInfraGate();
    const userInfo = useInfraUserInfo();
    const claims = useIdTokenClaims();
    const getAccessToken = useAccessToken();
    const queryClient = useQueryClient();
    const [pendingOnLoad] = useState(readPendingDefaultAccess);
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
            const token = retainedAccessToken() ?? (await refreshConnectAccessToken());
            const idToken = idTokenForGithubClaim();
            await authedPut(
                infraServiceUrls.setDefaultRepositoryAccess,
                token,
                {},
                idToken ? infraLocalAssertionHeaders(idToken) : undefined,
            );
            sessionStorage.removeItem(DEFAULT_REPOSITORY_ACCESS_PENDING_KEY);
            setDefaultAccessPending(false);
            await queryClient.invalidateQueries({ queryKey: ["infra-default-repository-access"] });
        } catch (error) {
            if (isClientError(error)) {
                const pending = readPendingDefaultAccess();
                if (pending?.tokenReady) {
                    writePendingDefaultAccess({ ...pending, tokenReady: false });
                }
            }
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
                const subject = currentSessionSubject();
                if (subject) {
                    writePendingDefaultAccess({
                        verified: verifiedResult,
                        tokenReady: false,
                        sub: subject,
                    });
                }
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

        {gate.isEmployee && !isConnected && <GitHubConnectionGuide />}

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
