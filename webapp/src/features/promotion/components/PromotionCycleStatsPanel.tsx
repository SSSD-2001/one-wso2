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

import { Box, Skeleton, Typography } from "@wso2/oxygen-ui";
import type { LucideIcon } from "@wso2/oxygen-ui-icons-react";
import {
  CheckIcon,
  ClockIcon,
  CopyIcon,
  FileTextIcon,
  SendIcon,
  Trash2Icon,
  XIcon,
} from "@wso2/oxygen-ui-icons-react";
import type { PromotionRequestFull, PromotionRequestStatus } from "../api/types";

function count(data: PromotionRequestFull[], statuses: PromotionRequestStatus[]): number {
  return data.filter((r) => statuses.includes(r.status)).length;
}

function Tile({ icon: Icon, color, value, label }: { icon: LucideIcon; color: string; value: number; label: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flex: 1, minWidth: 0 }}>
      <Icon size={22} color={color} />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</Typography>
        <Typography sx={{ fontSize: 12, color: "text.secondary", whiteSpace: "nowrap" }}>{label}</Typography>
      </Box>
    </Box>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1.5, color: "text.secondary" }}>{title}</Typography>
      <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>{children}</Box>
    </Box>
  );
}

// Ports promotion-app's own component/statistics/promotionCycle/endStat.tsx
// — three breakdowns of the same request list, from each stage's own point
// of view (Promotion Board / Functional Lead / overall). CloseStat, the
// sibling component source also imports here, is never actually rendered
// in source's own JSX (confirmed dead code) and isn't ported.
export default function PromotionCycleStatsPanel({
  loading,
  data,
}: {
  loading: boolean;
  data: PromotionRequestFull[];
}) {
  if (loading) return <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1 }} />;

  return (
    <Box>
      <Section title="Promotion Board Stats">
        <Tile icon={FileTextIcon} color="#0065FF" value={count(data, ["APPROVED", "REJECTED", "FL_APPROVED"])} label="Total Requests" />
        <Tile icon={ClockIcon} color="#5243AA" value={count(data, ["FL_APPROVED"])} label="Pending Applications" />
        <Tile icon={CheckIcon} color="#00A3BF" value={count(data, ["APPROVED"])} label="Approved Applications" />
        <Tile icon={XIcon} color="#DE350B" value={count(data, ["REJECTED"])} label="Rejected Applications" />
      </Section>
      <Section title="Functional Lead Stats">
        <Tile
          icon={FileTextIcon}
          color="#2684FF"
          value={count(data, ["SUBMITTED", "FL_REJECTED", "FL_APPROVED", "APPROVED", "REJECTED"])}
          label="Total Requests"
        />
        <Tile icon={ClockIcon} color="#6554C0" value={count(data, ["SUBMITTED"])} label="Pending Applications" />
        <Tile icon={CheckIcon} color="#008DA6" value={count(data, ["FL_APPROVED", "APPROVED", "REJECTED"])} label="Approved Applications" />
        <Tile icon={XIcon} color="#DE350B" value={count(data, ["FL_REJECTED"])} label="Rejected Applications" />
      </Section>
      <Section title="Stats">
        <Tile icon={FileTextIcon} color="#0065FF" value={data.length} label="Total Requests" />
        <Tile icon={SendIcon} color="#00A3BF" value={count(data, ["SUBMITTED", "FL_REJECTED", "FL_APPROVED", "REJECTED", "APPROVED"])} label="Submitted Applications" />
        <Tile icon={CopyIcon} color="#5243AA" value={count(data, ["DRAFT"])} label="Pending Applications" />
        <Tile icon={Trash2Icon} color="#DE350B" value={count(data, ["REMOVED"])} label="Removed Applications" />
      </Section>
    </Box>
  );
}
