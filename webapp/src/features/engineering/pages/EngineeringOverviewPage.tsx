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

import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Card,
  CircularProgress,
  ListingTable,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { JSX } from "react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { isPreviewEnabled } from "@config/previewFeatures";
import { useAccessToken } from "@hooks/useAccessToken";
import {
  dailyRange,
  getDaily,
  getRepositories,
  getSummary,
  isCredentialedProductDownloadStatsUrl,
  isProductDownloadStatsConfigured,
  productDownloadStatsBackendUrl,
  type DailySeries,
} from "@features/engineering/api/productDownloadStats";
import { dailyChartModel } from "./dailyChartModel";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function formatCount(value: number): string {
  return compact.format(value);
}

function productLabel(productName: string | null, repoName: string): string {
  return productName && productName.trim() !== "" ? productName : repoName;
}

export default function EngineeringOverviewPage(): JSX.Element {
  const preview = isPreviewEnabled("engineering");
  const base = productDownloadStatsBackendUrl();
  const configured = isProductDownloadStatsConfigured();
  const allowed = isCredentialedProductDownloadStatsUrl(base);
  const getToken = useAccessToken();
  const enabled = preview && configured && allowed;

  const summary = useQuery({
    queryKey: ["product-download-stats", "summary", base],
    enabled,
    queryFn: async () => getSummary(await getToken()),
  });
  const daily = useQuery({
    queryKey: ["product-download-stats", "daily", base],
    enabled,
    queryFn: async () => getDaily(await getToken()),
  });
  const repositories = useQuery({
    queryKey: ["product-download-stats", "repositories", base],
    enabled,
    queryFn: async () => getRepositories(await getToken()),
  });

  if (!preview) {
    return <Typography>Engineering isn't available yet.</Typography>;
  }

  if (!configured) {
    return (
      <Typography>
        Product Download Stats isn't connected yet. Set{" "}
        <code>ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL</code> in config.js.
      </Typography>
    );
  }

  if (!allowed) {
    return (
      <Typography>
        Product Download Stats needs an https address. An http address is only accepted for
        localhost.
      </Typography>
    );
  }

  if (summary.isPending) {
    return (
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mt: 2 }}>
        <CircularProgress size={16} />
        <Typography>Loading release downloads…</Typography>
      </Stack>
    );
  }

  if (summary.isError || summary.data == null) {
    return (
      <ErrorNotice onRetry={() => void summary.refetch()} error={summary.error}>
        Couldn't load release downloads.
      </ErrorNotice>
    );
  }

  const names = new Map(
    (repositories.data?.repositories ?? []).map((repository) => [
      repository.id,
      productLabel(repository.productName, repository.repoName),
    ]),
  );
  const series = daily.data?.series ?? [];
  const totals = summary.data;

  return (
    <Box>
      <Typography component="h1" variant="h5">
        Overview
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
        Download activity and repository stats across all WSO2 products.
      </Typography>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(5, 1fr)" },
          mb: 2,
        }}
      >
        <Figure
          label="Yesterday's Downloads"
          value={formatCount(totals.todayDownloads)}
          trend={totals.todayDeltaPct}
        />
        <Figure label="This Month's Downloads" value={formatCount(totals.monthDownloads)} />
        <Figure label="Total Downloads" value={formatCount(totals.totalDownloads)} />
        <Figure label="Products Tracked" value={formatCount(totals.trackedRepositories)} />
        <Figure label="Clones (14d)" value={formatCount(totals.totalClonesLast14d)} />
      </Box>

      <Card sx={{ p: 2, mb: 2 }}>
        <Typography component="h2" variant="h6" id="daily-downloads">
          Daily Downloads (last 30 days)
        </Typography>
        {daily.isPending ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Loading the daily chart…
          </Typography>
        ) : daily.isError ? (
          <ErrorNotice onRetry={() => void daily.refetch()} error={daily.error} sx={{ mt: 2 }}>
            Couldn't load the daily chart.
          </ErrorNotice>
        ) : series.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            No data for the selected range
          </Typography>
        ) : (
          <DailyChart series={series} names={names} />
        )}
      </Card>

      <Card sx={{ p: 2 }}>
        <Typography component="h2" variant="h6" sx={{ mb: 1 }}>
          Top Products (Downloads)
        </Typography>
        <ListingTable.Provider>
          <ListingTable.Container>
            <ListingTable bordered>
              <ListingTable.Head>
                <ListingTable.Row>
                  <ListingTable.Cell>Product</ListingTable.Cell>
                  <ListingTable.Cell align="right">Total</ListingTable.Cell>
                </ListingTable.Row>
              </ListingTable.Head>
              <ListingTable.Body>
                {totals.topProducts.map((product) => (
                  <ListingTable.Row key={product.repoId}>
                    <ListingTable.Cell>
                      {productLabel(product.productName, product.repoName)}
                    </ListingTable.Cell>
                    <ListingTable.Cell align="right">
                      {formatCount(product.totalDownloads)}
                    </ListingTable.Cell>
                  </ListingTable.Row>
                ))}
              </ListingTable.Body>
            </ListingTable>
          </ListingTable.Container>
        </ListingTable.Provider>
      </Card>
    </Box>
  );
}

function Figure({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend?: number | null;
}): JSX.Element {
  return (
    <Card sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
        <Typography variant="h4">{value}</Typography>
        {trend != null && !Number.isNaN(trend) && (
          <Typography
            component="span"
            sx={{ fontWeight: 700, color: trend >= 0 ? "success.main" : "error.main" }}
          >
            {trend.toFixed(1)}%
          </Typography>
        )}
      </Box>
    </Card>
  );
}

function DailyChart({
  series,
  names,
}: {
  series: DailySeries[];
  names: Map<number, string>;
}): JSX.Element {
  const { data, lines } = dailyChartModel(series, names, dailyRange());

  return (
    <Box sx={{ width: "100%", height: 280, mt: 1 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          {lines.map((line) => (
            <Line
              key={line.repoId}
              name={line.name}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.stroke}
              dot={false}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}
