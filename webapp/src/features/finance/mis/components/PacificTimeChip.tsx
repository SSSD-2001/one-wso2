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

import { Chip } from "@wso2/oxygen-ui";
import { ClockIcon } from "@wso2/oxygen-ui-icons-react";
import { pacificTimeLabel } from "../util/misPacificTime";

// The permanent `Pacific Time (PST|PDT)` chip every MIS screen carries.
//
// It is on screen always, not only when something looks odd, because the whole
// point is that nothing ever looks odd: a reader in Colombo opening a Build at
// 09:00 on 1 January sees last year's closing column and has no way to tell
// whether that is right. The chip is the only thing on the page that says the
// year was decided in California.
//
// The label comes from `pacificTimeLabel`, which is the same module the
// boundaries come from. That is the criterion, and it is the
// reason there is no string constant here: a chip that said "PST" from its own
// source would be wrong for eight months of the year and would still be there,
// looking authoritative, beside dates that had moved.
export default function PacificTimeChip() {
  // ONE clock read, used twice. Two calls would be two instants, and the pair
  // that straddled a transition would put PST on the screen and PDT in the
  // accessible name — the exact drift this chip exists to rule out.
  //
  // Read at render. A session left open across a transition shows the old
  // abbreviation until something re-renders, which is a label an hour stale
  // rather than a figure wrong — not worth a timer.
  const label = pacificTimeLabel();
  return (
    <Chip
      icon={<ClockIcon size={14} />}
      label={label}
      variant="outlined"
      size="small"
      // The label alone is a fact with no claim attached; what a reader needs
      // is what it applies TO.
      aria-label={`Every Period on this screen is measured in ${label}`}
    />
  );
}
