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

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button, Chip, Typography } from "@wso2/oxygen-ui";
import { GitHub } from "@wso2/oxygen-ui-icons-react";
import { authedPost, authedPut } from "@api/http";
import { describeError } from "@api/errors";
import { infraServiceUrls, isGitHubOAuthConfigured } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import { useIdTokenClaims } from "@features/security/grc/hooks/useIdTokenClaims";
import InfraShell from "../components/InfraShell";
import InfraConfirmDialog from "../components/InfraConfirmDialog";
import GitHubConnectionGuide from "../github/GitHubConnectionGuide";
import { DefaultRepositoryAccess } from "./InfraRepositoryAccessPage";
import { useInfraGate } from "../api/useInfraGate";
import { useInfraUserInfo } from "../api/useInfraUserInfo";
import type { GitHubVerifyResponse } from "../api/infraTypes";
import { primaryBtnSx } from "../components/infraUi";
import {
    consumePendingOAuthCode,
    consumeStoredGitHubConnectResult,
    resolveGitHubConnection,
    restorePendingOAuthCode,
    startGitHubOAuth,
    type GitHubConnectResult,
} from "../github/githubOAuth";

export default function InfraHomePage() {
    const gate = useInfraGate();
    const userInfo = useInfraUserInfo();
    const claims = useIdTokenClaims();
    const getAccessToken = useAccessToken();
    const queryClient = useQueryClient();
    const [connectError, setConnectError] = useState<string | null>(null);
    const [connecting, setConnecting] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [verified, setVerified] = useState<GitHubConnectResult | null>(null);

    const jwtGithubUserId =
        typeof claims?.githubUserId === "string" ? claims.githubUserId : null;
    const { isConnected, githubUsername } = resolveGitHubConnection({
        verified,
        jwtGithubUserId: jwtGithubUserId ?? userInfo.data?.githubUserId,
        githubUsername: verified?.githubUsername ?? userInfo.data?.githubUsername,
    });

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
                setVerified({
                    status: "verified",
                    githubUserId: result.githubUserId ?? undefined,
                    githubUsername: result.githubUsername ?? undefined,
                });
                await queryClient.invalidateQueries({ queryKey: ["infra-user-info"] });
                try {
                    await authedPut(
                        infraServiceUrls.setDefaultRepositoryAccess,
                        await getAccessToken(),
                        {},
                    );
                    await queryClient.invalidateQueries({
                        queryKey: ["infra-default-repository-access"],
                    });
                } catch (error) {
                    setConnectError(describeError(error));
                }
            } catch (error) {
                setConnectError(describeError(error));
            } finally {
                setConnecting(false);
            }
        })();
    }, [getAccessToken, queryClient]);

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
            {isConnected ? (
                <Chip
                icon={<GitHub size={14} />}
                label={githubUsername ? `@${githubUsername}` : "Connected"}
                color="success"
                variant="outlined"
                size="small"
                />
            ) : (
                <>
                <Chip label="Not Connected" variant="outlined" size="small" />
                {isGitHubOAuthConfigured() ? (
                    <Button
                    variant="contained"
                    size="small"
                    disabled={connecting}
                    onClick={() => setConfirmOpen(true)}
                    sx={primaryBtnSx}
                    >
                    {connecting ? "Connecting…" : "Connect with GitHub"}
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

        {gate.isEmployee && isConnected && (
            <Box sx={{ textAlign: "left", width: "min(100%, 40rem)", mt: 4 }}>
                <DefaultRepositoryAccess connected />
            </Box>
        )}

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
