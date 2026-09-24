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

import type { ReactNode } from "react";
import { Alert, Box, CircularProgress, IconButton, Stack, Typography } from "@wso2/oxygen-ui";
import { ArrowLeftIcon } from "@wso2/oxygen-ui-icons-react";
import { Link as RouterLink } from "react-router";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { isUmtBackendConfigured } from "@config/apiConfig";
import { useUmtGate } from "../api/useUmtGate";
import { useUmtMeta } from "../api/useUmtMeta";
import UmtLocked from "./UmtLocked";

// Shared frame for every UMT screen and the one owner of its access-state
// ladder:
//
//   1. backend URL missing       → name the required runtime config
//   2. /update/user-info pending → wait, never flash a denial
//   3. access request failed     → show a retryable error
//   4. no recognised UMT role    → show the locked-access panel
//
// Keeping the last two states separate matters: a gateway failure leaves us
// without roles too, but it does not mean the person lacks permission. Children
// mount only after the decision succeeds, so denied users make no feature calls.
export default function UmtShell({
  title,
  backTo,
  requireAdmin = false,
  children,
}: {
  title: string;
  backTo?: string;
  /** Page-level gate for UMT_ADMIN-only screens (e.g. Product Management). Hiding
   * a rail item alone is not an authorization boundary, so admin-only pages
   * must opt into this rather than relying on navigation alone. */
  requireAdmin?: boolean;
  children: ReactNode;
}) {
  const configured = isUmtBackendConfigured();
  const gate = useUmtGate(configured);

  return (
    <Box sx={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2.25, mt: 0 }}>
        {backTo && (
          <IconButton component={RouterLink} to={backTo} size="small" aria-label="Back">
            <ArrowLeftIcon size={18} />
          </IconButton>
        )}
        <Typography component="h1" variant="h5" sx={{ m: 0 }}>
          {title}
        </Typography>
      </Stack>

      <UmtBody configured={configured} gate={gate} requireAdmin={requireAdmin} title={title}>
        {children}
      </UmtBody>
    </Box>
  );
}

function UmtBody({
  configured,
  gate,
  requireAdmin,
  title,
  children,
}: {
  configured: boolean;
  gate: ReturnType<typeof useUmtGate>;
  requireAdmin: boolean;
  title: string;
  children: ReactNode;
}) {
  // Metadata is shared by UMT workflows. Keeping its failure at this boundary
  // avoids every metadata consumer rendering the same retry banner.
  const meta = useUmtMeta(gate.isAuthorized);

  // No backend means there is nothing useful to ask; stop before rendering a
  // spinner for a query that is deliberately disabled.
  if (!configured) {
    return (
      <Alert severity="info" sx={{ mt: 1.5 }}>
        UMT isn&apos;t connected yet. Set <code>ONE_WSO2_UMT_BACKEND_URL</code> in{" "}
        <code>public/config.js</code> (the Updates Manager backend URL) and reload.
      </Alert>
    );
  }

  // Hold the page until /update/user-info makes a decision. Rendering the
  // locked card first would flash a false denial on every cold load.
  if (gate.isResolving) {
    return (
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mt: 2 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Checking your UMT access…
        </Typography>
      </Stack>
    );
  }

  // Checked before denial because a failed request also produces no roles.
  if (gate.isError) {
    return (
      <ErrorNotice onRetry={gate.retry} sx={{ mt: 1.5 }}>
        Couldn&apos;t check your UMT access. {gate.errorMessage}
      </ErrorNotice>
    );
  }

  // This is a completed authorization decision, not a request failure.
  if (!gate.isAuthorized) {
    return <UmtLocked />;
  }

  // A recognized UMT user/product-lead still isn't an admin. Kept distinct
  // from UmtLocked above: this person does have UMT access, just not to this
  // specific screen.
  if (requireAdmin && !gate.isAdmin) {
    return (
      <Alert severity="warning" sx={{ mt: 1.5 }}>
        {title} is limited to UMT administrators. Ask a UMT admin if you need access.
      </Alert>
    );
  }

  return (
    <Stack spacing={3}>
      {meta.isError && (
        <ErrorNotice
          error={meta.error}
          onRetry={() => void meta.refetch()}
          retrying={meta.isFetching}
        >
          Couldn&apos;t load UMT reference data.
        </ErrorNotice>
      )}
      {children}
    </Stack>
  );
}
