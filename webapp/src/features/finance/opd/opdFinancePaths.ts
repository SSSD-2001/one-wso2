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

/**
 * Where the OPD Claims app lives under the Finance perspective.
 *
 * Named here rather than written out in the registry and the router
 * separately: those two disagreeing is a 404 nobody notices until someone
 * clicks the menu item.
 *
 * Distinct from the OPD tab under Me → Claims, which is a different screen on
 * a different route and is left alone.
 */
export const OPD_FINANCE_PATH = "/finance/opd";

export const opdFinancePaths = {
  dashboard: `${OPD_FINANCE_PATH}/dashboard`,
} as const;
