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
import { useGlCodes, useMasterDataList } from "../useMasterData";

/**
 * Departments and the GL code each maps to — `pages/Departments.tsx`.
 *
 * The GL codes are fetched alongside the rows rather than when the dialog
 * opens: they are the form's one dropdown, and the source's "load on mount,
 * spinner over the whole dialog" makes opening the form a wait every time.
 */
export default function DepartmentsPage() {
  const query = useMasterDataList("departments");
  const glCodes = useGlCodes();
  const { showError } = useNotifications();

  // DepartmentFormContent.tsx:34-39 reports this failure. Here it cannot be
  // reported from the dialog, because the fetch no longer happens there — so
  // it is said once, when it happens, rather than on each open.
  useEffect(() => {
    if (glCodes.isError) showError(MASTER_DATA_SNACK.error.glCodes);
  }, [glCodes.isError, showError]);

  return (
    <MasterDataScreen
      tab="departments"
      rows={query.data ?? []}
      loading={query.isLoading}
      error={query.isError ? query.error : undefined}
      onRetry={() => void query.refetch()}
      glCodes={glCodes.data}
    />
  );
}
