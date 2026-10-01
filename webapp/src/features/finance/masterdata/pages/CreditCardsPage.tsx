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

import { useEffect } from "react";
import { useNotifications } from "@context/notifications/NotificationsContext";
import MasterDataScreen from "../MasterDataScreen";
import { MASTER_DATA_SNACK } from "../masterDataCopy";
import { useEmployeeEmails, useMasterDataList } from "../useMasterData";

/**
 * The corporate card register — `pages/CreditCards.tsx`.
 *
 * Work emails feed both the Employee Email picker and the Lead Emails one,
 * so they are fetched once here rather than twice inside the dialog.
 */
export default function CreditCardsPage() {
  const query = useMasterDataList("creditCards");
  const emails = useEmployeeEmails();
  const { showError } = useNotifications();

  // Without emails, neither the employee nor the lead picker can be used.
  // Said once here, when the fetch fails, rather than on every dialog open.
  useEffect(() => {
    if (emails.isError) showError(MASTER_DATA_SNACK.error.employeeEmails);
  }, [emails.isError, showError]);

  return (
    <MasterDataScreen
      tab="creditCards"
      rows={query.data ?? []}
      loading={query.isLoading}
      error={query.isError ? query.error : undefined}
      onRetry={() => void query.refetch()}
      employeeEmails={emails.data}
    />
  );
}
