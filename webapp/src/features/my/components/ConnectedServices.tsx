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
import { Box, Button, Card, Skeleton, Stack, Tooltip, Typography } from "@wso2/oxygen-ui";
import { Link as RouterLink } from "react-router";
import { useUserInfo } from "@api/useUserInfo";
import { useAsgardeoUser } from "@hooks/useAsgardeoUser";
import VehiclesCard from "./VehiclesCard";
import {
  isPromotionBackendConfigured,
  usePromotionEmployeeInfo,
} from "../api/usePromotionEmployeeInfo";
import { formatDate } from "../api/derive";
import PromotionHistoryDialog from "./PromotionHistoryDialog";
import PerformanceStages from "./PerformanceStages";
import BankAccountsCard from "./BankAccountsCard";

// Three cards surfacing adjacent people-ops-suite services inside the
// profile: Vehicles, Time off, Performance & growth. Vehicles is live
// against people-app's GET/POST/DELETE /employees/{email}/vehicles;
// Time off + Performance are still sample data until those backends land.
export default function ConnectedServices() {
  const userInfo = useUserInfo();
  const asgardeoUser = useAsgardeoUser();
  // Vehicle + promotion endpoints key on the caller's email. Prefer
  // /user-info's workEmail (canonical), fall back to the id_token email
  // claim.
  const ownerEmail = userInfo.data?.workEmail ?? asgardeoUser.email;
  const promotionInfo = usePromotionEmployeeInfo(ownerEmail);
  const promotionConfigured = isPromotionBackendConfigured();
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 1.75 }}>
        {/* Performance */}
        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography sx={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "text.secondary", fontWeight: 600, mb: 1.5 }}>
            Performance &amp; growth
          </Typography>
          <Stack direction="row" spacing={1.25} sx={{ py: 1.125, alignItems: "center", borderBottom: 1, borderColor: "divider" }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 500, fontSize: 13 }}>Last promoted date</Typography>
              <PromotedDateValue
                configured={promotionConfigured}
                isLoading={promotionInfo.isLoading}
                isError={promotionInfo.isError}
                date={promotionInfo.data?.employeeInfo?.lastPromotedDate ?? null}
              />
            </Box>
            <Tooltip
              title={promotionConfigured ? "" : "Set ONE_WSO2_PROMOTION_BACKEND_URL to enable this."}
              placement="top"
            >
              <span>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={!promotionConfigured || !ownerEmail}
                  onClick={() => setHistoryOpen(true)}
                >
                  View promotion history
                </Button>
              </span>
            </Tooltip>
          </Stack>
          <PerformanceStages workEmail={ownerEmail} />
          <Box sx={{ mt: 1.25 }}>
            <Button variant="outlined" size="small" component={RouterLink} to="/me/performance" fullWidth>
              Open employee feedback
            </Button>
          </Box>
        </Card>

        <BankAccountsCard ownerEmail={ownerEmail} />

        <VehiclesCard ownerEmail={ownerEmail} />
      </Box>

      <PromotionHistoryDialog
        open={historyOpen}
        workEmail={ownerEmail}
        onClose={() => setHistoryOpen(false)}
      />
    </>
  );
}

// Sub-line under the "Last promoted date" label. Renders one of:
//   - not configured hint (promotion backend URL absent)
//   - skeleton (loading)
//   - error dash (fetch failed; hover for reason)
//   - "Never promoted" (no date on record — new joiner / no promotion yet)
//   - formatted date (happy path)
function PromotedDateValue({
  configured,
  isLoading,
  isError,
  date,
}: {
  configured: boolean;
  isLoading: boolean;
  isError: boolean;
  date: string | null;
}) {
  const base = { fontSize: 12, color: "text.secondary" as const };
  if (!configured) {
    return (
      <Tooltip title="Set ONE_WSO2_PROMOTION_BACKEND_URL to enable this." placement="top">
        <Typography sx={{ ...base, color: "text.disabled", fontStyle: "italic" }}>
          Not configured
        </Typography>
      </Tooltip>
    );
  }
  if (isLoading) {
    return <Skeleton variant="text" width={90} sx={{ fontSize: 12 }} />;
  }
  if (isError) {
    return (
      <Tooltip title="Couldn't reach the promotion backend." placement="top">
        <Typography sx={{ ...base, color: "error.main" }}>Couldn't load</Typography>
      </Tooltip>
    );
  }
  if (!date || date.trim() === "") {
    return <Typography sx={{ ...base, color: "text.disabled" }}>Never promoted</Typography>;
  }
  return (
    <Typography sx={{ ...base, fontVariantNumeric: "tabular-nums" }}>
      {formatDate(date)}
    </Typography>
  );
}

