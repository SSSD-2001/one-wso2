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

import type { ReactNode } from "react";
import { Alert, Box, CircularProgress, Stack, Typography } from "@wso2/oxygen-ui";
import { isInfraBackendConfigured } from "@config/apiConfig";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useInfraGate } from "../api/useInfraGate";

export default function InfraShell({
  title,
  subtitle,
  requireAuthorized = true,
  center = false,
  children,
}: {
  title: string;
  subtitle?: string;
  requireAuthorized?: boolean;
  center?: boolean;
  children: ReactNode;
}) {
  const configured = isInfraBackendConfigured();
  const gate = useInfraGate(configured);

  const isLocked =
    configured &&
    requireAuthorized &&
    !gate.isResolving &&
    !gate.isError &&
    !gate.isAuthorized;

  return (
    <Box
      sx={
        center
          ? {
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-start",
              textAlign: "center",
            }
          : undefined
      }
    >
      <Typography component="h1" variant="h5" sx={{ mb: 0.5, mt: 0 }}>
        {title}
      </Typography>
      {subtitle && !isLocked && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.25, maxWidth: "70ch" }}>
          {subtitle}
        </Typography>
      )}
      <InfraBody configured={configured} gate={gate} requireAuthorized={requireAuthorized}>
        {children}
      </InfraBody>
    </Box>
  );
}

function InfraBody({
  configured,
  gate,
  requireAuthorized,
  children,
}: {
  configured: boolean;
  gate: ReturnType<typeof useInfraGate>;
  requireAuthorized: boolean;
  children: ReactNode;
}) {
  if (!configured) {
    return (
      <Alert severity="info" sx={{ mt: 1.5 }}>
        Infra Portal isn't connected yet. Set{" "}
        <code>ONE_WSO2_INFRA_BACKEND_URL</code> in <code>public/config.js</code>{" "}
        (the backend URL) and reload.
      </Alert>
    );
  }

  if (requireAuthorized && gate.isResolving) {
    return (
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mt: 2 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Checking your Infra Portal access…
        </Typography>
      </Stack>
    );
  }

  if (requireAuthorized && gate.isError) {
    return (
      <ErrorNotice onRetry={gate.retry} sx={{ mt: 1.5 }}>
        Couldn't check your Infra Portal access. {gate.errorMessage}
      </ErrorNotice>
    );
  }

  if (requireAuthorized && !gate.isAuthorized) {
    return (
      <Alert severity="warning" sx={{ mt: 1.5 }}>
        You don't have access to Infra Portal. You need an infra-portal
        employee, approver, or admin group.
      </Alert>
    );
  }

  return <>{children}</>;
}