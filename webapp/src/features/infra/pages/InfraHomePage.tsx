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

import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button, Card, Chip, Typography } from "@wso2/oxygen-ui";
import { GitHub } from "@wso2/oxygen-ui-icons-react";
import { Link as RouterLink } from "react-router";
import { authedPost, authedPut } from "@api/http";
import { describeError } from "@api/errors";
import { infraServiceUrls, isGitHubOAuthConfigured } from "@config/apiConfig";
import { INFRA_APPS } from "@constants/infraApps";
import { useAccessToken } from "@hooks/useAccessToken";
import { useIdTokenClaims } from "@features/security/grc/hooks/useIdTokenClaims";
import InfraShell from "../components/InfraShell";
import InfraConfirmDialog from "../components/InfraConfirmDialog";
import { useInfraGate } from "../api/useInfraGate";
import { useInfraUserInfo } from "../api/useInfraUserInfo";
import type { GitHubVerifyResponse } from "../api/infraTypes";
import { primaryBtnSx } from "../components/infraUi";
import {
    consumePendingOAuthCode,
    consumeStoredGitHubConnectResult,
    resolveGitHubConnection,
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

    const visible = INFRA_APPS.map((app) => ({
        app,
        items: app.items.filter((it) => gate.canSee(it.id)),
    })).filter(({ items }) => items.length > 0);

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
            try {
                const accessToken = await getAccessToken();
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
        title="Infra Portal"
        subtitle="GitHub requests, repository access and the Security Dashboard."
        >
        {connectError && (
            <Alert severity="error" sx={{ mb: 2 }}>
            {connectError}
            </Alert>
        )}

        {gate.isEmployee && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
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

        <InfraConfirmDialog
            open={confirmOpen}
            title="Connect with GitHub"
            confirmLabel="Continue"
            busy={connecting}
            onCancel={() => setConfirmOpen(false)}
            onConfirm={() => {
            setConfirmOpen(false);
            startGitHubOAuth("/infra");
            }}
            body={
            <>
                Before connecting, ensure your company email is added and verified on
                your GitHub account. Do not close this tab while the page loads.
            </>
            }
        />

        {visible.map(({ app, items }) => (
            <Box key={app.key}>
            <SectionHeader>
                <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                <app.icon size={14} />
                <Box component="span">{app.name}</Box>
                </Box>
            </SectionHeader>
            <Card variant="outlined" sx={{ p: 3, maxWidth: 480 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {app.purpose}
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {items.map((it) => (
                    <Box key={it.id} id={it.id} sx={{ scrollMarginTop: 14 }}>
                    <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{it.label}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {it.desc}
                    </Typography>
                    {it.path ? (
                        <Button
                        component={RouterLink}
                        to={it.path}
                        variant="outlined"
                        size="small"
                        sx={primaryBtnSx}
                        >
                        Open {it.label.toLowerCase()}
                        </Button>
                    ) : (
                        <Typography variant="body2" color="text.disabled">
                        Not here yet
                        </Typography>
                    )}
                    </Box>
                ))}
                </Box>
            </Card>
            </Box>
        ))}
        </InfraShell>
    );
}

function SectionHeader({ children }: { children: ReactNode }) {
    return (
        <Typography
        component="h2"
        sx={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "text.disabled",
            fontWeight: 700,
            mt: 3,
            mb: 1.25,
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            "&::before": { content: '""', width: 14, height: "1px", bgcolor: "divider" },
            "&::after": { content: '""', flex: 1, height: "1px", bgcolor: "divider" },
        }}
        >
        {children}
        </Typography>
    );
}