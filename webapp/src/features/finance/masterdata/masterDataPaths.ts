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

import type { MasterDataTab } from "./masterDataTypes";

/**
 * Where the master-data screens live.
 *
 * Under Finance, not Me: this is the reference data the finance apps are
 * keyed against — subsidiaries, GL-coded departments, the expense-type
 * catalogue, the corporate card register — and it is maintained by finance
 * rather than used by an employee.
 *
 * Named rather than written out at each call site, for the same reason
 * `CC_PATH` is: the registry, the routes and the tab strip all have to agree,
 * and a hardcoded copy is what survives a move as a dead link.
 */
export const MASTER_DATA_PATH = "/finance/master-data";

export const masterDataPaths: Record<MasterDataTab, string> = {
  subsidiaries: `${MASTER_DATA_PATH}/subsidiaries`,
  departments: `${MASTER_DATA_PATH}/departments`,
  expenseTypes: `${MASTER_DATA_PATH}/expense-types`,
  creditCards: `${MASTER_DATA_PATH}/credit-cards`,
};
