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
 * Every user-facing string the master-data screens say.
 *
 * Collected in one file rather than inlined at each call site: the same
 * sentences are said by four tabs, and a snackbar that drifts on one tab and
 * not the others is the kind of difference nobody notices until a support
 * ticket quotes the wrong wording back.
 */
export const MASTER_DATA_SNACK = {
  success: {
    // Typo and all, kept exactly as written rather than corrected — a copy
    // fix like this is easy to slip into a change that was supposed to be
    // about something else, and this file is not the place to do it quietly.
    updated: "Data update successfully",
    added: "Data added successfully",
    deleted: "Data deleted successfully",
  },
  error: {
    updating: "Error updating data. Please try again. If the issue persists, contact Internal Apps Team",
    adding: "Error adding data. Please try again. If the issue persists, contact Internal Apps Team",
    deleting: "Error deleting data. Please try again. If the issue persists, contact Internal Apps Team",
    // The 409 the backend returns when the record is still referenced.
    // Distinct from a generic delete failure because it tells the reader
    // what to do about it.
    deleteConflict:
      "Cannot proceed with this operation due to linked data. Delete other active connections to continue",
    loading: "Error retrieving data. Please try again. If the issue persists, contact Internal Apps Team",
    autoComplete:
      "Error retrieving auto complete data. Please try again. If the issue persists, contact Internal Apps Team",
    glCodes: "Error retrieving Gl Code data. Please try again. If the issue persists, contact Internal Apps Team",
    employeeEmails:
      "Error retrieving employee emails. Please try again. If the issue persists, contact Internal Apps Team",
  },
} as const;

/**
 * The "Add New X" button on each page, and the dialog titles.
 *
 * `isCreate` names what it has always meant — the dialog is either creating a
 * new record or editing an existing one, and every caller reads it as plain
 * boolean logic rather than something that needs re-deriving each time.
 */
export const MASTER_DATA_FORM_COPY: Record<
  MasterDataTab,
  { addButton: string; addTitle: string; editTitle: string }
> = {
  subsidiaries: {
    addButton: "Add New Subsidiary",
    addTitle: "Add New Subsidiary",
    editTitle: "Update Existing Subsidiary",
  },
  departments: {
    addButton: "Add New Department",
    addTitle: "Add New Department",
    editTitle: "Update Existing Department",
  },
  expenseTypes: {
    addButton: "Add New Expense Type",
    addTitle: "Add New Expense Type",
    editTitle: "Update Existing Expense Type",
  },
  creditCards: {
    addButton: "Add New Credit Card",
    addTitle: "Add New Credit Card",
    editTitle: "Update Existing Credit Card",
  },
};

/** The delete-confirmation dialog's title, body, and the two buttons. */
export const MASTER_DATA_DELETE_COPY = {
  title: "Delete Confirmation",
  text: "Are you sure you want to delete this record?",
  confirm: "Yes",
  cancel: "No",
} as const;

/**
 * Subtitles for the page frame.
 *
 * Each tab is a route of its own inside a portal of ~20 apps, so a line
 * saying what the table is for earns its place under the title.
 */
export const MASTER_DATA_SUBTITLES: Record<MasterDataTab, string> = {
  subsidiaries: "WSO2 legal entities and the tax codes claims are booked against.",
  departments: "Employee departments, their engagement codes and the GL code each maps to.",
  expenseTypes: "The expense catalogue — category, GL code, and the engagements each type is valid for.",
  creditCards: "The corporate card register: which card belongs to whom, and who approves its spend.",
};
