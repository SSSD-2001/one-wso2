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

import { useState, type ReactNode } from "react";
import { Button, Stack } from "@wso2/oxygen-ui";
import { PlusIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { FINANCE_EYEBROW } from "@constants/financeApps";
import FinanceShell from "../components/FinanceShell";
import MasterDataDeleteDialog from "./MasterDataDeleteDialog";
import MasterDataFormDialog from "./MasterDataFormDialog";
import MasterDataGrid from "./MasterDataGrid";
import { MASTER_DATA_FORM_COPY, MASTER_DATA_SNACK, MASTER_DATA_SUBTITLES } from "./masterDataCopy";
import { isFinanceMasterDataBackendConfigured } from "./useMasterData";
import {
  MASTER_DATA_LABELS,
  type ExpenseTypeAutoComplete,
  type GlCode,
  type MasterDataRow,
  type MasterDataTab,
} from "./masterDataTypes";

/**
 * The page every master-data tab is: a title, an "Add New …" button, and a
 * table with Edit and Delete on each row.
 *
 * The four screens differ only in which rows they load and, on expense types,
 * a filter bar above the table — so they share this and pass their own data
 * in, rather than each repeating the shell, the two dialogs and the
 * add/edit/delete state machine.
 *
 * Which record a dialog is working on lives here because both dialogs and the
 * grid need it: the grid raises it, the dialog consumes it, and nothing below
 * this point has to thread it around.
 */
export default function MasterDataScreen({
  tab,
  rows,
  loading,
  error,
  onRetry,
  glCodes,
  autoComplete,
  employeeEmails,
  toolbar,
  showTable = true,
  children,
}: {
  tab: MasterDataTab;
  rows: MasterDataRow[];
  loading: boolean;
  error?: unknown;
  onRetry?: () => void;
  glCodes?: GlCode[];
  autoComplete?: ExpenseTypeAutoComplete;
  employeeEmails?: string[];
  /** Extra controls beside "Add New …" — the expense-type filter toggle. */
  toolbar?: ReactNode;
  /**
   * False to leave the table out entirely, so `children` can stand in for
   * it. Expense types does this before its first filter is applied: there is
   * no empty table to show, because nothing has been asked for yet.
   */
  showTable?: boolean;
  /** Rendered between the header and the table — the filter bar, and on the
   *  expense-type tab the placeholder that replaces the table. */
  children?: ReactNode;
}) {
  // `undefined` = closed. `null` = open for a NEW record. A row = editing it.
  // Three states in one value, because "the add dialog" and "the edit dialog"
  // are the same dialog and must never both be open.
  const [formRow, setFormRow] = useState<MasterDataRow | null | undefined>(undefined);
  const [deleteRow, setDeleteRow] = useState<MasterDataRow | null>(null);

  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.masterData}
      title={MASTER_DATA_LABELS[tab]}
      subtitle={MASTER_DATA_SUBTITLES[tab]}
      configured={isFinanceMasterDataBackendConfigured()}
      configKey="ONE_WSO2_FINANCE_MASTER_DATA_BACKEND_URL"
      fill
    >
      <Stack direction="row" justifyContent="flex-end" alignItems="center" gap={1.5} sx={{ mb: 2 }}>
        {toolbar}
        <Button
          variant="contained"
          startIcon={<PlusIcon size={18} />}
          onClick={() => setFormRow(null)}
        >
          {MASTER_DATA_FORM_COPY[tab].addButton}
        </Button>
      </Stack>

      {children}

      {error ? (
        <ErrorNotice error={error} onRetry={onRetry}>
          {MASTER_DATA_SNACK.error.loading}
        </ErrorNotice>
      ) : (
        showTable && (
          <MasterDataGrid
            tab={tab}
            rows={rows}
            loading={loading}
            onEdit={setFormRow}
            onDelete={setDeleteRow}
          />
        )
      )}

      {formRow !== undefined && (
        <MasterDataFormDialog
          // Remounts per record, so the form is seeded from the row being
          // opened rather than keeping the previous one's values.
          key={formRow?.id ?? "new"}
          tab={tab}
          open
          row={formRow ?? undefined}
          glCodes={glCodes}
          autoComplete={autoComplete}
          employeeEmails={employeeEmails}
          onClose={() => setFormRow(undefined)}
        />
      )}

      <MasterDataDeleteDialog tab={tab} row={deleteRow} onClose={() => setDeleteRow(null)} />
    </FinanceShell>
  );
}
