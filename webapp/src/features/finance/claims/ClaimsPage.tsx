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

import { useState } from "react";
import { Navigate, Outlet, useNavigate } from "react-router";
import {
  Box,
  Button,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from "@wso2/oxygen-ui";
import { ChevronDownIcon } from "@wso2/oxygen-ui-icons-react";
import RoutedTabs from "@components/routed-tabs/RoutedTabs";
import { CLAIMS_PATH, defaultClaimTab, visibleClaimTypes } from "./claimsTabs";
import { useSriLankaEmployee } from "@hooks/useSriLankaEmployee";

/**
 * Whether this employee is offered the OPD tab.
 *
 * Unresolved reads as false, which fails closed — the tab appears a moment
 * later rather than flashing and being withdrawn. That is right for the tab
 * BAR; see ClaimsIndex for why the same unresolved `false` is not right for
 * choosing where to land.
 */
function useIsSriLanka(): boolean {
  return useSriLankaEmployee().isSriLanka;
}

// One screen for both kinds of claim you file for yourself.
//
// The two histories are near enough the same — claim id, when it was
// submitted, how much, where it got to — which is what makes one screen with a
// tab each work. The two FORMS are not: an expense line carries a job number
// and a currency to convert, an OPD bill counts against an annual limit and
// every bill in a claim must fall in one year. So there is no single form to
// send people to, and the type has to be chosen before the form opens.
//
// That choice sits on the New claim button rather than in a dialog of its own:
// one button, in the same place on both tabs, whose menu explains the two
// options where the choice is actually made.
export default function ClaimsPage() {
  const types = visibleClaimTypes(useIsSriLanka());
  return (
    // A fill column: the history table below can run long, and without this
    // scrolling it carried the header and the tab switcher away with it
    // instead of staying put while just the list scrolled.
    <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {/* Centred against the title block, not level with the eyebrow: the
          header is three lines tall and a button pinned to the top of it reads
          as unanchored. Stays on the right, where every primary action in the
          app lives, so the page still reads title → tabs → list. */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2, flexShrink: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* No parent chip: "Claims" already names the app, so a chip above
              it said the same thing twice — and said "Me", the perspective,
              where every other chip in this app names the app. A chip earns its
              place only above a title that would not identify the screen alone
              ("Dashboard", "History", "Settings"). */}
          <Typography variant="h5" sx={{ mb: 0.5 }}>
            Claims
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: "70ch" }}>
            What you have claimed and where each one has got to. Approving other people&apos;s
            claims is under Finance.
          </Typography>
        </Box>
        <AddClaimButton />
      </Box>

      <Box sx={{ flexShrink: 0 }}>
        <RoutedTabs basePath={CLAIMS_PATH} tabs={types} ariaLabel="Claim types" />
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <Outlet />
      </Box>
    </Box>
  );
}

/**
 * New claim, and the choice of what kind.
 *
 * A menu rather than a split button whose primary action follows the open tab:
 * that would save a click, but the button's label and meaning would shift as
 * you move between tabs, and one button that always means one thing is worth
 * more than the click.
 */
function AddClaimButton() {
  const navigate = useNavigate();
  const types = visibleClaimTypes(useIsSriLanka());
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <Button
        variant="contained"
        size="medium"
        onClick={(e) => setAnchor(e.currentTarget)}
        endIcon={<ChevronDownIcon size={15} />}
        aria-haspopup="menu"
        aria-expanded={anchor ? true : undefined}
        sx={{ textTransform: "none", flexShrink: 0 }}
      >
        New claim
      </Button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { maxWidth: 320 } } }}
      >
        {types.map((type) => (
          <MenuItem
            key={type.segment}
            onClick={() => {
              setAnchor(null);
              navigate(type.newClaimPath);
            }}
            sx={{ alignItems: "flex-start", py: 1.25 }}
          >
            <ListItemText
              primary={type.menuLabel}
              secondary={type.menuDescription}
              slotProps={{
                primary: { sx: { fontSize: 13, fontWeight: 600 } },
                // Wraps: the description is a sentence, and MUI truncates
                // secondary text to one line by default.
                secondary: { sx: { fontSize: 11.5, whiteSpace: "normal", lineHeight: 1.45 } },
              }}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

/**
 * `/me/claims` itself opens on the type people file most often — of the ones
 * they are offered. OPD is first and is Sri-Lanka-only, so a fixed default
 * would have landed everyone else on a tab that is not there.
 *
 * Held until /user-info answers, which is the half `defaultClaimTab`'s own
 * tests could not cover. Unresolved reads as "not Sri Lanka", and on a cold
 * load — a bookmark, a refresh, a link into Claims — that sent a Colombo
 * employee to Expense and then unmounted this route, so the real answer
 * arriving a moment later had nothing left to correct.
 *
 * `null` rather than a spinner: the tab bar above is already on screen, and
 * this resolves in the time it takes /user-info to return.
 */
export function ClaimsIndex() {
  const { isSriLanka, isResolving } = useSriLankaEmployee();
  if (isResolving) return null;
  return <Navigate to={`${CLAIMS_PATH}/${defaultClaimTab(isSriLanka).segment}`} replace />;
}
