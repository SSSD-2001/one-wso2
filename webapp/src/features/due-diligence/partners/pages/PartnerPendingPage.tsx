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

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Snackbar,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { CheckIcon, FileTextIcon } from "@wso2/oxygen-ui-icons-react";
import { useLocation, useParams } from "react-router";
import DueDiligenceShell from "@features/due-diligence/components/DueDiligenceShell";
import { DUE_DILIGENCE_EYEBROW } from "@constants/dueDiligenceApps";
import { useDueDiligenceGate } from "@features/due-diligence/api/useDueDiligenceGate";
import ConfirmationDialog, {
  type ConfirmationContent,
} from "@components/confirmation-dialog/ConfirmationDialog";
import { authedGet, humanizeHttpError } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { dueDiligenceServiceUrls } from "@config/apiConfig";
import { LINK_STATUS } from "@features/due-diligence/constants";
import {
  joinPartnerLinks,
  type PartnerData,
  type PartnerRow,
} from "../api/partnerTypes";
import {
  useChangeLinkExpiry,
  useChangePartnerLinkStatus,
  useUpdatePartner,
} from "../api/usePartners";
import { useDueDiligenceNavigate } from "@features/due-diligence/api/useDueDiligenceNavigate";

// Ported from the source app's Resellers/ResellerDashboard/PendingPage.js —
// what's shown for a partner link whose form hasn't been submitted yet.
//
// The source component also fetched GET /partners/{id} to populate its own
// "companyData"/"linkData" state, but that fetch treats the response
// (PartnerInfoData[], an array) as a single object with .companyName/.link
// fields — neither exists on an array, so that state was always empty and
// every UI branch reading it was dead code.
//
// This port fixes that: it fetches GET /partners itself (there's no
// per-link endpoint, so the same list PartnersListPage reads is joined and
// filtered down to this one linkId) and re-fetches after every status
// change, rather than only ever showing the row snapshot the Partners list
// happened to pass via navigation state. Without this, Deactivate/Activate,
// Enable/Disable Expiry, and Enable/Disable TR all changed the backend but
// left this page's own header — which button shows, the expired chip —
// frozen at whatever it looked like on arrival, only correcting itself on a
// full page reload.
export default function PartnerPendingPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useDueDiligenceNavigate();
  const gate = useDueDiligenceGate();
  const getAccessToken = useAccessToken();
  const changeStatus = useChangePartnerLinkStatus();
  const changeExpiry = useChangeLinkExpiry();
  const updatePartner = useUpdatePartner();

  const linkId = Number(id);
  const initialRow = (location.state as { row?: PartnerRow } | null)?.row;

  const [row, setRow] = useState<PartnerRow | null>(initialRow ?? null);
  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">(
    initialRow ? "ready" : "loading",
  );
  const [loadError, setLoadError] = useState<unknown>(undefined);
  const [confirmation, setConfirmation] = useState<ConfirmationContent | null>(
    null,
  );
  const [snack, setSnack] = useState<{
    open: boolean;
    severity: "success" | "error";
    message: string;
  }>({
    open: false,
    severity: "success",
    message: "",
  });

  const loadRow = useCallback(async () => {
    try {
      const accessToken = await getAccessToken();
      const data = await authedGet<PartnerData>(
        dueDiligenceServiceUrls.partners,
        accessToken,
      );
      const found = joinPartnerLinks(data).find((r) => r.linkId === linkId);
      if (found) setRow(found);
      setLoadState("ready");
    } catch (err) {
      setLoadError(err);
      setLoadState("error");
    }
  }, [linkId, getAccessToken]);

  useEffect(() => {
    // `loadRow`'s only setState calls happen after an `await` (see above),
    // never synchronously during this effect — the same pattern already used
    // (and already lint-clean) in ApprovalTab.tsx's loadSummary/useEffect
    // pair. This rule's static analysis doesn't trace that far here; the
    // reachable-setState heuristic is a false positive, not a real issue.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRow();
  }, [loadRow]);

  const notify = (severity: "success" | "error", message: string) =>
    setSnack({ open: true, severity, message });

  const confirmChangeExpiry = async (expire: boolean) => {
    try {
      await changeExpiry.mutateAsync({ linkId, expire });
      notify("success", "Updated successfully");
      await loadRow();
    } catch (err) {
      notify("error", `Couldn't update. ${humanizeHttpError(err)}`);
    }
  };

  const onChangeExpiry = (expire: boolean) => {
    setConfirmation({
      title: "You are about to make a change to a reseller!",
      text: `Are you sure you want to ${expire ? "enable" : "disable"} expiry?`,
      confirmAction: () => void confirmChangeExpiry(expire),
    });
  };

  const onChangeStatus = (status: "active" | "inactive") => {
    setConfirmation({
      title: "You are about to make a change to a reseller!",
      text: `Are you sure you want to ${status === "active" ? "activate" : "deactivate"} this reseller?`,
      confirmAction: () =>
        changeStatus.mutate(
          { linkId, status },
          {
            onSuccess: () => {
              notify("success", "Updated successfully");
              navigate("/due-diligence/partners");
            },
            onError: (err) =>
              notify("error", `Couldn't update. ${humanizeHttpError(err)}`),
          },
        ),
    });
  };

  const confirmChangeTradeReference = async (enabled: boolean) => {
    try {
      await updatePartner.mutateAsync({ linkId, isTradeReferenceEnabled: enabled });
      notify("success", "Updated successfully");
      await loadRow();
    } catch (err) {
      notify("error", `Couldn't update. ${humanizeHttpError(err)}`);
    }
  };

  const onChangeTradeReference = (enabled: boolean) => {
    setConfirmation({
      title: "You are about to make a change to a reseller!",
      text: `Are you sure you want to ${enabled ? "enable" : "disable"} Trade Reference for this reseller?`,
      confirmAction: () => void confirmChangeTradeReference(enabled),
    });
  };

  const isExpiring = row?.isExpiring === "true" || row?.isExpiring === "1";
  const isExpired = row?.status === LINK_STATUS.EXPIRED;
  const mutating =
    changeStatus.isPending || changeExpiry.isPending || updatePartner.isPending;

  return (
    <DueDiligenceShell
      back={{
        label: "Return to Partners",
        onClick: () => navigate("/due-diligence/partners"),
      }}
      eyebrow={DUE_DILIGENCE_EYEBROW}
      title="Partner — pending signature"
    >
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
        >
          {snack.message}
        </Alert>
      </Snackbar>

      {loadState === "loading" && !row ? (
        <Stack
          direction="row"
          spacing={1.25}
          sx={{ alignItems: "center", mt: 2 }}
        >
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            Loading…
          </Typography>
        </Stack>
      ) : loadState === "error" && !row ? (
        <Alert severity="error">
          Couldn't load this partner. {humanizeHttpError(loadError)}
        </Alert>
      ) : (
        <>
          <Stack
            direction="row"
            spacing={2}
            sx={{
              alignItems: "flex-start",
              justifyContent: "space-between",
              flexWrap: "wrap",
              mb: 3,
            }}
          >
            <Stack spacing={1}>
              <Chip
                variant="outlined"
                color={isExpired ? "error" : "warning"}
                label={`Form Status: Pending${isExpired ? " (Expired)" : ""}`}
                size="small"
              />
            </Stack>

            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
              {row && (
                <Button
                  variant="outlined"
                  disabled={mutating}
                  startIcon={
                    changeExpiry.isPending ? (
                      <CircularProgress size={14} />
                    ) : undefined
                  }
                  onClick={() => onChangeExpiry(!isExpiring)}
                  sx={{ textTransform: "none" }}
                >
                  {isExpiring ? "Disable Expiry" : "Enable Expiry"}
                </Button>
              )}
              {gate.hasRole("adminRole") && row?.status === "active" && (
                <Button
                  variant="outlined"
                  disabled={mutating}
                  startIcon={
                    changeStatus.isPending ? (
                      <CircularProgress size={14} />
                    ) : undefined
                  }
                  onClick={() => onChangeStatus("inactive")}
                  sx={{ textTransform: "none" }}
                >
                  Deactivate
                </Button>
              )}
              {gate.hasRole("adminRole") && row?.status === "inactive" && (
                <Button
                  variant="outlined"
                  disabled={mutating}
                  startIcon={
                    changeStatus.isPending ? (
                      <CircularProgress size={14} />
                    ) : undefined
                  }
                  onClick={() => onChangeStatus("active")}
                  sx={{ textTransform: "none" }}
                >
                  Activate
                </Button>
              )}
              {(gate.hasRole("financeRole") ||
                gate.hasRole("legalRole") ||
                gate.hasRole("adminRole")) && (
                <Button
                  variant="outlined"
                  disabled={mutating}
                  startIcon={
                    updatePartner.isPending ? (
                      <CircularProgress size={14} />
                    ) : undefined
                  }
                  onClick={() =>
                    onChangeTradeReference(!row?.isTradeReferenceEnabled)
                  }
                  sx={{ textTransform: "none" }}
                >
                  {row?.isTradeReferenceEnabled ? "Disable TR" : "Enable TR"}
                </Button>
              )}
              {gate.hasRole("adminRole") && (
                <Button
                  variant="outlined"
                  startIcon={<CheckIcon size={15} />}
                  disabled
                  sx={{ textTransform: "none" }}
                >
                  Editing Allowed
                </Button>
              )}
            </Stack>
          </Stack>

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              py: 8,
              gap: 2,
            }}
          >
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
            <Typography sx={{ fontSize: 17, fontWeight: 600 }}>
              Form not submitted yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {row?.reseller.companyName ?? row?.companyName ?? "This partner"}{" "}
              has not filled out the form yet.
            </Typography>
          </Box>
        </>
      )}

      <ConfirmationDialog
        content={confirmation}
        onClose={() => setConfirmation(null)}
      />
    </DueDiligenceShell>
  );
}
