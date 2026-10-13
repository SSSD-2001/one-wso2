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

import type { ReactElement } from "react";
import {
  CsmMark,
  EngineeringMark,
  FinanceMark,
  KnowledgeMark,
  LegalMark,
  SecurityMark,
  MarketingMark,
  MeMark,
  PeopleMark,
  SalesMark,
  InfrastructureMark,
  type MarkProps,
} from "./AppMark";

/**
 * Keyed by `PerspectiveDef.key`. Undefined for a perspective without a mark —
 * the launcher then falls back to its line glyph on the wash.
 */
const APP_MARKS: Record<string, (p: MarkProps) => ReactElement> = {
  me: MeMark,
  people: PeopleMark,
  finance: FinanceMark,
  marketing: MarketingMark,
  csm: CsmMark,
  legal: LegalMark,
  security: SecurityMark,
  sales: SalesMark,
  engineering: EngineeringMark,
  infra: InfrastructureMark,
  "knowledge-base": KnowledgeMark,
};

/**
 * The mark for a perspective, or undefined when none is registered — the caller
 * is expected to fall back to that perspective's line glyph.
 */
export function appMark(key: string): ((p: MarkProps) => ReactElement) | undefined {
  return Object.prototype.hasOwnProperty.call(APP_MARKS, key) ? APP_MARKS[key] : undefined;
}
