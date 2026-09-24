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

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface GeneralStepValues {
  email: string;
  leadEmail: string;
  requirement: string;
  ccList: string[];
}

export type GeneralStepErrors = Partial<Record<keyof GeneralStepValues, string>>;

function isEmail(value: string): boolean {
  return EMAIL.test(value.trim());
}

export function generalStepErrors(values: GeneralStepValues): GeneralStepErrors {
  const errors: GeneralStepErrors = {};
  if (!values.email.trim()) errors.email = "Member Email is required.";
  if (!values.leadEmail.trim()) errors.leadEmail = "Lead Email is required.";
  else if (!isEmail(values.leadEmail)) errors.leadEmail = "Lead Email must be a valid email.";
  if (!values.requirement.trim()) errors.requirement = "Requirement is required.";
  if (values.ccList.length === 0) errors.ccList = "At least one email is required.";
  else if (values.ccList.some((email) => !isEmail(email))) errors.ccList = "All emails must be valid.";
  return errors;
}