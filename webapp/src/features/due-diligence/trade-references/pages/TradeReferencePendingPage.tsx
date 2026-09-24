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

import { useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, Snackbar, Typography } from "@wso2/oxygen-ui";
import { FileTextIcon } from "@wso2/oxygen-ui-icons-react";
import { useLocation, useParams } from "react-router";
import DueDiligenceShell from "@features/due-diligence/components/DueDiligenceShell";
import { DUE_DILIGENCE_EYEBROW } from "@constants/dueDiligenceApps";
import { useDueDiligenceGate } from "@features/due-diligence/api/useDueDiligenceGate";
import { useDueDiligenceAppConfig } from "@features/due-diligence/api/useDueDiligenceAppConfig";
import ConfirmationDialog, {
  type ConfirmationContent,
} from "@components/confirmation-dialog/ConfirmationDialog";
import { humanizeHttpError } from "@api/http";
import { TRADE_REFERENCE_STATUS } from "@features/due-diligence/constants";
import type { TradeReferenceRow } from "../api/tradeReferenceTypes";
import { useUpdateTradeReferenceFormStatus } from "../api/useTradeReferences";
import { useDueDiligenceNavigate } from "@features/due-diligence/api/useDueDiligenceNavigate";

// Ported from the source app's TradeReferences/TradeReferenceDashboard/PendingPage2.js.
export default function TradeReferencePendingPage() {
  const { linkId: linkIdParam } = useParams<{ linkId: string }>();
  const location = useLocation();
  const navigate = useDueDiligenceNavigate();
  const gate = useDueDiligenceGate();
  const appConfig = useDueDiligenceAppConfig();
  const updateStatus = useUpdateTradeReferenceFormStatus();

  const row = (location.state as { row?: TradeReferenceRow } | null)?.row;
  const linkId = Number(linkIdParam);

  const [confirmation, setConfirmation] = useState<ConfirmationContent | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; severity: "success" | "error"; message: string }>({
    open: false,
    severity: "success",
    message: "",
  });

  const onDeactivate = () => {
    setConfirmation({
      title: "You are about to make a change to a reseller!",
      text: "Are you sure you want to deactivate this reseller?",
      confirmAction: () =>
        updateStatus.mutate(
          { linkId, formStatus: TRADE_REFERENCE_STATUS.DEACTIVATED, clientUrl: appConfig.data?.clientBaseUrl ?? "" },
          {
            onSuccess: () => {
              setSnack({ open: true, severity: "success", message: "Updated successfully" });
              navigate(`/due-diligence/trade-references/deactivated/${linkId}`, { state: { row } });
            },
            onError: (err) =>
              setSnack({ open: true, severity: "error", message: `Couldn't update. ${humanizeHttpError(err)}` }),
          },
        ),
    });
  };

  const canDeactivate = gate.hasRole("adminRole") || gate.hasRole("channelManager");

  return (
    <DueDiligenceShell
      back={{ label: "Return to Trade References", onClick: () => navigate("/due-diligence/trade-references") }}
      eyebrow={DUE_DILIGENCE_EYEBROW}
      title="Trade reference — pending"
      headerActions={
        canDeactivate && (
          <Button
            variant="outlined"
            startIcon={updateStatus.isPending ? <CircularProgress size={15} /> : undefined}
            disabled={updateStatus.isPending}
            onClick={onDeactivate}
            sx={{ textTransform: "none" }}
          >
            Deactivate
          </Button>
        )
      }
    >
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.message}
        </Alert>
      </Snackbar>

      <Chip variant="outlined" color="warning" label="Form Status: Pending" size="small" sx={{ mb: 3 }} />

      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 8, gap: 2 }}>
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: 3,
            display: "grid",
            placeItems: "center",
            bgcolor: "background.default",
            border: 1,
            borderColor: "divider",
            color: "text.secondary",
          }}
        >
          <FileTextIcon size={32} />
        </Box>
        <Typography sx={{ fontSize: 17, fontWeight: 600 }}>Form not submitted yet</Typography>
        <Typography variant="body2" color="text.secondary">
          {row?.companyName ?? "This company"} has not filled out the form yet.
        </Typography>
      </Box>

      <ConfirmationDialog content={confirmation} onClose={() => setConfirmation(null)} />
    </DueDiligenceShell>
  );
}
