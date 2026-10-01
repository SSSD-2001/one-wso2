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

import type { VisibilityAnswer } from "@components/side-rail/visibilityFold";
import { PAR_EMPLOYEE_ITEM_ID } from "@constants/parApps";
import { PAR_ADMIN_PORTAL_ITEM_ID, PAR_LEAD_PORTAL_ITEM_ID } from "@constants/perspectives";

/**
 * One PAR answer for the rail and the landing.
 * Admin, lead, and the employee item keep their own rules here.
 * A failed read hides the section. The landing does not retry it.
 */
export function parVisibility(input: {
  admin: { isAdmin: boolean; isLoading: boolean };
  lead: { canSee: boolean; isLoading: boolean };
  employee: { canSee: boolean; isLoading: boolean };
  profileFailed: boolean;
}): VisibilityAnswer {
  return {
    canSee: (id) => {
      if (id === PAR_ADMIN_PORTAL_ITEM_ID) return input.admin.isAdmin;
      if (id === PAR_LEAD_PORTAL_ITEM_ID) return input.lead.canSee;
      if (id === PAR_EMPLOYEE_ITEM_ID) {
        return input.employee.canSee && !input.employee.isLoading && !input.profileFailed;
      }
      return false;
    },
    resolving: input.admin.isLoading || input.lead.isLoading || input.employee.isLoading,
    retry: () => undefined,
  };
}
