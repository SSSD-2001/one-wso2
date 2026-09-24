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

import { useMeProfile } from "@features/my/api/useMeProfile";
import { useParEmployeeInfo } from "./useParData";

// Like useParIsTeamLead, a wrapper around useParEmployeeInfo: the backend's
// GET /employees/{workEmail} now returns isAdmin on a self-lookup, re-using
// the same adminLdapGroup check every admin endpoint already enforces
// server-side, instead of this reproducing that check client-side against a
// separately configured group name. Presentation only — every admin
// endpoint still re-derives isAdmin from the JWT, so a stale or slow fetch
// here can only hide the screen from a real admin, never grant access it
// shouldn't.
export function useParIsAdmin() {
  const profile = useMeProfile();
  const workEmail = profile.data?.userInfo.workEmail;
  const employeeInfo = useParEmployeeInfo(workEmail, Boolean(workEmail));
  return {
    isAdmin: employeeInfo.data?.isAdmin ?? false,
    isLoading: profile.isLoading || employeeInfo.isLoading,
    isError: profile.isError || employeeInfo.isError,
    error: profile.error ?? employeeInfo.error,
    retry: profile.isError ? profile.refetch : employeeInfo.refetch,
  };
}
