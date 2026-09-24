/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { CircularProgress } from "@wso2/oxygen-ui";
import type { AutocompleteRenderInputParams } from "@wso2/oxygen-ui";

// A picker whose options are still arriving.
//
// MUI's own `loading` prop only puts a spinner in the DROPDOWN, so it says
// nothing until the list is opened — and a picker that opens onto "no options"
// while its request is in flight reads as an empty directory rather than a slow
// one. Worse, someone can type into it and be told there is no such person.
//
// So the field is disabled while its options load, with the spinner in the
// field itself where it can be seen without opening anything. Failure is not
// this state: a request that errored is no longer loading, the field re-enables,
// and the picker's own `noOptionsText` explains what happened.

/**
 * Adds a spinner to a picker's input while its options load.
 *
 * Keeps whatever MUI already put in the end adornment — the clear button and
 * the dropdown arrow — rather than replacing it, so the control does not change
 * shape as the list arrives.
 */
export function withLoadingAdornment(
  params: AutocompleteRenderInputParams,
  loading: boolean,
): AutocompleteRenderInputParams {
  if (!loading) return params;
  return {
    ...params,
    InputProps: {
      ...params.InputProps,
      endAdornment: (
        <>
          {/* Named, because it is the only cue that survives: the field it sits
              in is disabled while loading, and a disabled input is not in the
              tab order, so its placeholder is never announced. */}
          <CircularProgress size={15} sx={{ mr: 0.5 }} aria-label="Loading options" />
          {params.InputProps.endAdornment}
        </>
      ),
    },
  };
}
