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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

// GET /update/base-product. Reconciles legacy's two near-duplicate shapes for
// this same entity (`BaseProducts` in types.tsx and `BaseProductResource` in
// updatesSlice.ts, which only differed by `deprecatedBy`) into one real type.
export interface UmtBaseProduct {
  name: string;
  version: string;
  isActive: boolean;
  createdBy: string;
  createdOn: string;
  deprecatedBy?: string | null;
  deprecatedOn?: string | null;
}

// POST /update/product. Legacy typed this payload as `any`; `version` is the
// already-suffixed value built by lib/umtProducts.ts, not the raw form input.
export interface UmtCreateProductRequest {
  name: string;
  version: string;
  leadMail: string;
  edMail: string;
  ftpHost: string;
  ftpPort: string;
  ftpUsername: string;
  ftpPassword: string;
  ftpAbsolutePath: string;
}

// PUT /update/product/deprecate. Legacy allows any BaseProductResource field
// here but only ever sends these two.
export interface UmtDeprecateProductRequest {
  name: string;
  version: string;
}
