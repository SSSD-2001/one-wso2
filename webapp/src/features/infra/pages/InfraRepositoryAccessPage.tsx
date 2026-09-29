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

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Link,
    Stack,
    Typography,
} from "@wso2/oxygen-ui";
import { ChevronDownIcon } from "@wso2/oxygen-ui-icons-react";
import { authedGet, authedPut } from "@api/http";
import { describeError } from "@api/errors";
import { infraServiceUrls } from "@config/apiConfig";
import { INFRA_EYEBROW } from "@constants/infraApps";
import { useAccessToken } from "@hooks/useAccessToken";
import { useIdTokenClaims } from "@features/security/grc/hooks/useIdTokenClaims";
import InfraShell from "../components/InfraShell";
import { primaryBtnSx } from "../components/infraUi";
import { useInfraGate } from "../api/useInfraGate";
import { useInfraUserInfo } from "../api/useInfraUserInfo";
import type { DefaultRepositoryAccess } from "../api/infraTypes";
import { resolveGitHubConnection } from "../github/githubOAuth";

const POLL_MS = 3000;
const MAX_POLLS = 20;

export default function InfraRepositoryAccessPage() {
    const gate = useInfraGate();

    return (
        <InfraShell
        eyebrow={INFRA_EYEBROW.github}
        title="Repository Access"
        subtitle="Default org and team repositories granted for your account."
        >
        {gate.isEmployee ? (
            <DefaultRepositoryAccess />
        ) : (
            <Alert severity="warning">Only employees can view repository access.</Alert>
        )}
        </InfraShell>
    );
}

function DefaultRepositoryAccess() {
    const userInfo = useInfraUserInfo();
    const claims = useIdTokenClaims();
    const getAccessToken = useAccessToken();
    const queryClient = useQueryClient();
    const grantAttempted = useRef(false);
    const pollAttempts = useRef(0);
    const [grantError, setGrantError] = useState<string | null>(null);
    const [granting, setGranting] = useState(false);

    const jwtGithubUserId =
        typeof claims?.githubUserId === "string" ? claims.githubUserId : null;
    const { isConnected } = resolveGitHubConnection({
        jwtGithubUserId: jwtGithubUserId ?? userInfo.data?.githubUserId,
    });

    const access = useQuery<DefaultRepositoryAccess>({
        queryKey: ["infra-default-repository-access"],
        enabled: isConnected,
        queryFn: async () => {
        const token = await getAccessToken();
        return authedGet<DefaultRepositoryAccess>(
            infraServiceUrls.defaultRepositoryAccess,
            token,
        );
        },
        refetchInterval: (query) => {
        if (query.state.data?.status !== "granting") return false;
        if (pollAttempts.current >= MAX_POLLS) return false;
        pollAttempts.current += 1;
        return POLL_MS;
        },
    });

    const status = access.data?.status;
    const organizations = access.data?.organizations ?? [];
    const pollTimedOut = status === "granting" && pollAttempts.current >= MAX_POLLS;

    async function grant() {
        setGrantError(null);
        setGranting(true);
        try {
        await authedPut(infraServiceUrls.setDefaultRepositoryAccess, await getAccessToken(), {});
        pollAttempts.current = 0;
        await queryClient.invalidateQueries({
            queryKey: ["infra-default-repository-access"],
        });
        } catch (error) {
        setGrantError(describeError(error));
        } finally {
        setGranting(false);
        }
    }

    useEffect(() => {
        if (!isConnected || !access.data || granting || grantError) return;
        if (status !== "not_granted") return;
        if (grantAttempted.current) return;
        grantAttempted.current = true;
        void grant();
        // grant reads the latest token and query client; status is the trigger.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnected, status, access.data, granting, grantError]);

    if (!isConnected) {
        return (
        <Typography variant="body2" color="text.secondary">
            Connect with GitHub from the home page to see default repository access.
        </Typography>
        );
    }

    if (pollTimedOut) {
        return (
        <Stack spacing={1}>
            <Typography variant="body2" color="error">
            Granting default repository access is taking longer than expected.
            </Typography>
            <Button
            size="small"
            sx={primaryBtnSx}
            onClick={() => {
                pollAttempts.current = 0;
                void access.refetch();
            }}
            >
            Retry
            </Button>
        </Stack>
        );
    }

    if (grantError) {
        return (
        <Stack spacing={1}>
            <Alert severity="error">{grantError}</Alert>
            <Button
            size="small"
            sx={primaryBtnSx}
            disabled={granting}
            onClick={() => {
                grantAttempted.current = false;
                void grant();
            }}
            >
            Retry
            </Button>
        </Stack>
        );
    }

    if (access.isError) {
        return (
        <Stack spacing={1}>
            <Alert severity="error">{describeError(access.error)}</Alert>
            <Button size="small" sx={primaryBtnSx} onClick={() => void access.refetch()}>
            Retry
            </Button>
        </Stack>
        );
    }
    
    if (access.isPending || granting || status === "granting") {
        return (
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">
            {status === "granting" || granting
                ? "Granting default repository access…"
                : "Checking default repository access…"}
            </Typography>
        </Stack>
        );
    }

    if (organizations.length === 0) {
        return (
        <Typography variant="body2" color="text.secondary">
            No default repositories are available for your account.
        </Typography>
        );
    }

    return (
        <Box>
        {organizations.map((org) => (
            <Accordion key={org.orgName} disableGutters>
            <AccordionSummary expandIcon={<ChevronDownIcon size={18} />}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Typography>{org.orgName}</Typography>
                <Chip label="Default" size="small" variant="outlined" />
                <Typography variant="body2" color="text.secondary">
                    {org.repositories.length}{" "}
                    {org.repositories.length === 1 ? "repository" : "repositories"}
                </Typography>
                </Stack>
            </AccordionSummary>
            <AccordionDetails>
                {org.repositories.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                    No repositories available for this organization yet.
                </Typography>
                ) : (
                org.repositories.map((repo) => (
                    <Box key={repo.name} sx={{ py: 0.5 }}>
                    <Link href={repo.htmlUrl} target="_blank" rel="noopener noreferrer">
                        {repo.name}
                    </Link>
                    </Box>
                ))
                )}
            </AccordionDetails>
            </Accordion>
        ))}
        </Box>
    );
}