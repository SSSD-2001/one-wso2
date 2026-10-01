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
import {
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import type { AccountStatus, BankAccount } from "@features/my/api/types";
import type { BankAccountsTableColumn } from "../bankAccountsColumns";

// Report and Employee Operations both render the same underlying dataset
// (BankAccount[]) as a plain table — this is the one shared piece, per the
// spec's own rationale for bundling these two tabs into one ticket. Each
// caller supplies its own column set (they overlap but aren't identical:
// Report adds Branch Name, Employee Operations adds a Status chip and a
// per-row action) — see bankAccountsColumns.ts for the shared ones.

// Same page-size choices across every tab that lists bank accounts (Report
// and Employee Operations), so the control feels consistent between them.
const ROWS_PER_PAGE_OPTIONS = [6, 10, 25, 50];

type ChipColor = "default" | "success" | "warning" | "error";

// Same colour assignments SummaryTab already uses for this same field —
// duplicated here rather than shared, since it's a 4-entry map and the two
// tabs live in different feature folders (my/banking vs. banking-admin);
// not worth a cross-feature import for four lines.
const ACCOUNT_STATUS_COLOR: Record<AccountStatus, ChipColor> = {
  ACTIVE: "success",
  REQUESTED: "warning",
  REJECTED: "error",
  INACTIVE: "default",
};

export function AccountStatusChip({ status }: { status: AccountStatus }) {
  return <Chip label={status} color={ACCOUNT_STATUS_COLOR[status]} variant="outlined" size="small" />;
}

export default function BankAccountsTable({
  accounts,
  columns,
  emptyMessage,
}: {
  accounts: BankAccount[];
  columns: BankAccountsTableColumn[];
  emptyMessage: string;
}) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE_OPTIONS[0]);

  if (accounts.length === 0) {
    return <Typography color="text.secondary">{emptyMessage}</Typography>;
  }

  const lastPage = Math.max(0, Math.ceil(accounts.length / rowsPerPage) - 1);
  const currentPage = Math.min(page, lastPage);
  const visible = accounts.slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage);

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map((c) => (
              <TableCell key={c.label} sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                {c.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {visible.map((a) => (
            <TableRow key={a.accountId} hover>
              {columns.map((c) => (
                <TableCell key={c.label}>{c.render(a)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePagination
        component="div"
        count={accounts.length}
        page={currentPage}
        rowsPerPage={rowsPerPage}
        rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
        onPageChange={(_, next) => setPage(next)}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
      />
    </TableContainer>
  );
}
