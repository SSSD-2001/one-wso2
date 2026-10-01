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

// Stats, search, department legend, company filter, and view controls for
// the org chart. Pure presentational + callback props — all state lives in
// OrgChartPage.
//
// The department legend is single-select "isolate": clicking a department
// hides everyone who isn't a member of it or a Chairman-path ancestor
// leading to one (see OrgChartPage's visibleEmails) — clicking the same one
// again clears the filter. A hard cut, not a dim.
//
// The company filter is a plain dropdown over the same visibleEmails
// mechanism, combined with the department filter by AND rather than
// replacing it — picking both isolates people matching both at once.

import { useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Divider,
  FormControlLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { RotateCcwIcon, SearchIcon, UnfoldVerticalIcon } from "@wso2/oxygen-ui-icons-react";
import { departmentColor, type DepartmentStat } from "../util/departmentColors";
import type { EmployeeDirectoryRecord } from "../api/orgChartTypes";

export interface OrgChartSidebarProps {
  totalCount: number;
  departmentStats: DepartmentStat[];
  /** The one department currently isolated, or null when showing everyone. */
  selectedDepartment: string | null;
  /** Always pass the clicked department's name — OrgChartPage handles
   *  toggling it back off when the same one is clicked again. */
  onSelectDepartment: (department: string) => void;
  /** Clears both the department and company filters — what "Show all"
   *  calls, since either filter on its own can hide the very thing "Show
   *  all" promises to reveal. */
  onClearFilters: () => void;
  /** Distinct `company` values from the directory, alphabetical. */
  companies: string[];
  /** The one company currently isolated, or null when showing everyone. */
  selectedCompany: string | null;
  /** Always the new value directly — null for "Global", unlike
   *  onSelectDepartment this isn't a toggle-on-click, it's a plain select. */
  onSelectCompany: (company: string | null) => void;
  directory: EmployeeDirectoryRecord[];
  /** People whose manager isn't in the directory (almost always because that
   *  manager has left) — rendered as their own section below the main tree
   *  rather than dropped. See util/buildOrgTree.ts. */
  strayCount: number;
  onSelectSearchResult: (workEmail: string) => void;
  hideInterns: boolean;
  onToggleHideInterns: () => void;
  onExpandAll: () => void;
  onReset: () => void;
}

export default function OrgChartSidebar({
  totalCount,
  departmentStats,
  selectedDepartment,
  onSelectDepartment,
  onClearFilters,
  companies,
  selectedCompany,
  onSelectCompany,
  directory,
  strayCount,
  onSelectSearchResult,
  hideInterns,
  onToggleHideInterns,
  onExpandAll,
  onReset,
}: OrgChartSidebarProps) {
  const [query, setQuery] = useState("");
  // Whether the dropdown should show at all — decoupled from `query` itself
  // so clicking away dismisses it (standard search-dropdown behaviour,
  // matching browser address bars/MUI's own Autocomplete) without losing
  // what was typed: refocusing the input re-opens it against the same text.
  const [isFocused, setIsFocused] = useState(false);
  // Wraps the input AND the dropdown, so the input's own onBlur can tell a
  // Tab into a result (focus staying inside this box) apart from focus
  // actually leaving the widget (see the onBlur handler below).
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];
    return directory
      .filter(
        (employee) =>
          `${employee.firstName} ${employee.lastName}`.toLowerCase().includes(trimmed) ||
          employee.workEmail.toLowerCase().includes(trimmed),
      )
      .slice(0, 12);
  }, [query, directory]);

  return (
    <Box sx={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: 1.75, pr: 2.5 }}>
      <Stack direction="row" spacing={1.5}>
        <Box sx={{ flex: 1, border: 1, borderColor: "divider", borderRadius: 1, px: 1.25, py: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            {totalCount}
          </Typography>
          {/* "in directory", not "employees" — this counts every row from
              /employees/basic-info, which includes Marked-leavers, not just
              Active headcount. See peopleOpsTypes.ts's EmployeeBasicInfo doc. */}
          <Typography variant="caption" color="text.secondary">
            in directory
          </Typography>
        </Box>
        <Box sx={{ flex: 1, border: 1, borderColor: "divider", borderRadius: 1, px: 1.25, py: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            {departmentStats.length}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            teams
          </Typography>
        </Box>
      </Stack>

      <Box
        ref={searchBoxRef}
        sx={{ position: "relative" }}
        // On the container, not just the input: React's onBlur tracks the
        // native focusout event, which bubbles, so this also catches focus
        // leaving a ListItemButton — needed because once Tab has moved focus
        // past the input and into the results, further Tabs (between
        // results, or off the far end) never blur the input again. Only
        // relatedTarget outside this whole container counts as "left the
        // widget"; moving from the input onto a result, or from one result
        // to the next, stays inside it and keeps the dropdown open.
        onBlur={(event) => {
          if (searchBoxRef.current?.contains(event.relatedTarget as Node | null)) return;
          setIsFocused(false);
        }}
      >
        <TextField
          fullWidth
          size="small"
          placeholder="Find a person by name or email…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsFocused(true)}
          slotProps={{
            input: { startAdornment: <SearchIcon size={16} style={{ marginRight: 8, opacity: 0.5 }} /> },
          }}
        />
        {query.trim() !== "" && isFocused && (
          <Box
            // Clicking a result would otherwise blur the input a tick before
            // its own onClick fires (mousedown shifts focus, and that blur
            // flips isFocused to false and unmounts this Box before the
            // click ever reaches ListItemButton) — preventDefault on
            // mousedown keeps focus on the input instead, so the dropdown
            // stays mounted through the click. Clicking OUTSIDE this Box
            // entirely still blurs the input normally and closes it.
            onMouseDown={(event) => event.preventDefault()}
            sx={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              zIndex: 20,
              maxHeight: 320,
              overflowY: "auto",
              // Not background.paper: the Acrylic theme's own paper token is
              // a translucent surface by design (#ffffffc5/#000000c5 —
              // ~77% opacity, see @wso2/oxygen-ui's AcrylicBaseTheme), which
              // reads as a visible bug on a floating overlay stacked on top
              // of the row list — you can see the rows through it. `default`
              // is the theme's own fully-opaque token in both light and dark,
              // so this stays theme-driven rather than a hardcoded color.
              bgcolor: "background.default",
              border: 1,
              borderColor: "divider",
              borderRadius: 1,
              boxShadow: 4,
            }}
          >
            {matches.length === 0 ? (
              <Typography variant="caption" color="text.disabled" sx={{ p: 1.5, display: "block" }}>
                No one matches &ldquo;{query}&rdquo;
              </Typography>
            ) : (
              <List dense disablePadding>
                {matches.map((employee) => (
                  <ListItemButton
                    key={employee.workEmail}
                    onClick={() => {
                      setQuery("");
                      onSelectSearchResult(employee.workEmail);
                    }}
                  >
                    <ListItemText
                      primary={`${employee.firstName} ${employee.lastName}`}
                      secondary={`${employee.designation ?? ""} · ${employee.workEmail}`}
                      slotProps={{
                        primary: { variant: "body2", fontWeight: 600 },
                        secondary: { variant: "caption" },
                      }}
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
          </Box>
        )}
      </Box>

      {companies.length > 0 && (
        <Select
          fullWidth
          size="small"
          displayEmpty
          value={selectedCompany ?? ""}
          onChange={(event) => onSelectCompany(event.target.value || null)}
          aria-label="Filter by company"
        >
          <MenuItem value="">Global</MenuItem>
          {companies.map((company) => (
            <MenuItem key={company} value={company}>
              {company}
            </MenuItem>
          ))}
        </Select>
      )}

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button size="small" variant="outlined" startIcon={<UnfoldVerticalIcon size={16} />} onClick={onExpandAll}>
          Expand all
        </Button>
        <Button size="small" variant="outlined" startIcon={<RotateCcwIcon size={16} />} onClick={onReset}>
          Reset view
        </Button>
      </Stack>

      <FormControlLabel
        control={<Switch size="small" checked={hideInterns} onChange={onToggleHideInterns} />}
        label={<Typography variant="body2">Hide interns</Typography>}
      />

      {departmentStats.length > 0 && (
        <>
          <Divider />
          <Stack direction="row" alignItems="baseline" justifyContent="space-between">
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: "0.04em" }}>
              TEAMS · CLICK TO ISOLATE
            </Typography>
            {(selectedDepartment || selectedCompany) && (
              <Button
                variant="text"
                size="small"
                onClick={onClearFilters}
                sx={{ minWidth: 0, p: 0, fontSize: "inherit", fontWeight: 600, lineHeight: "inherit" }}
              >
                Show all
              </Button>
            )}
          </Stack>
          <Stack spacing={0.25}>
            {departmentStats.map((department) => {
              const isSelected = selectedDepartment === department.name;
              return (
                <Box
                  key={department.name}
                  onClick={() => onSelectDepartment(department.name)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    px: 0.75,
                    py: 0.5,
                    borderRadius: 1,
                    cursor: "pointer",
                    bgcolor: isSelected ? "action.selected" : "transparent",
                    "&:hover": { bgcolor: isSelected ? "action.selected" : "action.hover" },
                  }}
                >
                  <Box
                    sx={{
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      flexShrink: 0,
                      bgcolor: departmentColor(department.name),
                    }}
                  />
                  <Typography variant="body2" noWrap sx={{ flex: 1, fontWeight: isSelected ? 700 : 400 }}>
                    {department.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {department.count}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        </>
      )}

      {strayCount > 0 && (
        <>
          <Divider />
          <Typography variant="caption" color="text.secondary">
            {strayCount} more {strayCount === 1 ? "person's" : "people's"} manager has left the company — shown
            separately below the main tree.
          </Typography>
        </>
      )}
    </Box>
  );
}
