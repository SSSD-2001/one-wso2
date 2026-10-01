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
import { Box, Card, Typography } from "@wso2/oxygen-ui";

// The outlined-card + icon-header (+ optional tab strip) chrome every
// promotion-app screen shares (promotion.tsx, lead.tsx, functionalLead.tsx,
// promotionBoard.tsx, administration.tsx all render this exact frame around
// their own content). Kept visually close to source rather than using this
// app's usual bare-title page or a generic shell like PAR's ParShell.
export default function PromotionPageShell({
  icon,
  title,
  tabs,
  children,
}: {
  icon: ReactNode;
  title: string;
  /** Rendered as source's own tab strip — a PromotionTabs element, or
   *  omitted entirely for a single-screen page like /me/promotion. */
  tabs?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: "5px", m: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", px: 2.5, pt: 2.5, pb: 1 }}>
        {icon}
        <Typography variant="h5" sx={{ ml: 1.25 }}>
          {title}
        </Typography>
      </Box>

      {tabs && (
        <Box sx={{ borderBottom: 1, borderColor: "divider", px: "30px" }}>
          {tabs}
        </Box>
      )}

      <Box sx={{ p: "30px" }}>{children}</Box>
    </Card>
  );
}
