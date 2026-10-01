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

// The company's reporting hierarchy, as a collapsible outline.
//
// Ported from the standalone org-chart app, whose canvas-and-pan-zoom UI is
// deliberately NOT carried over. Its original
// four-endpoint, lazy-per-manager backend contract isn't available either —
// this now reads the people-app backend's employee directory
// (useEmployeeDirectory) in one request and builds the whole tree client-side
// (buildOrgTree).
//
// Row visibility (`openEmails`) is lifted here so Expand all / Reset view can
// act on every row at once.
import { useMemo, useState } from "react";
import { Alert, Box, Button, Skeleton, Typography } from "@wso2/oxygen-ui";
import { Download } from "@wso2/oxygen-ui-icons-react";
import { HttpError } from "@api/http";
import { describeError } from "@api/errors";
import { isOrgChartConfigured, useEmployeeDirectory } from "../api/useOrgChart";
import { buildOrgTree, companyNames, indexByEmail } from "../util/buildOrgTree";
import { ancestorChain } from "../util/expandPathToEmployee";
import { departmentStats } from "../util/departmentColors";
import { downloadOrgChartHtml } from "../util/exportOrgChartHtml";
import type { OrgChartNode } from "../api/orgChartTypes";
import OrgChartRow from "../components/OrgChartRow";
import OrgChartSidebar from "../components/OrgChartSidebar";
import OrgChartShell from "../components/OrgChartShell";

function collectExpandableEmails(node: OrgChartNode, into: Set<string>): void {
  if (node.children.length === 0) return;
  into.add(node.workEmail);
  node.children.forEach((child) => collectExpandableEmails(child, into));
}

export default function OrgChartPage() {
  const configured = isOrgChartConfigured();
  const directory = useEmployeeDirectory();

  // Rows other than the root that the user has explicitly opened. The root
  // is tracked separately (rootClosed) rather than seeded into this set once
  // its email is known — that would mean deriving state from data that loads
  // asynchronously via an effect, which just to open one row on first load
  // isn't worth the extra render it costs.
  const [openEmails, setOpenEmails] = useState<Set<string>>(new Set());
  const [rootClosed, setRootClosed] = useState(false);
  // The one department currently isolated, or null to show everyone.
  // Single-select: picking a department hides every row that isn't either a
  // member of it or a Chairman-path ancestor leading to one — a harder cut
  // than the old dim-only filter (see the visibleEmails comment below).
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  // The one company currently isolated, or null to show every company. A
  // dropdown rather than a legend like department — the directory's
  // `company` field (WSO2's legal entities: "WSO2- INDIA", etc.) has no
  // natural color mapping and doesn't need one. Combines with the
  // department filter (AND, not either/or) — see visibleEmails below.
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [hideInterns, setHideInterns] = useState(false);
  const [highlightEmail, setHighlightEmail] = useState<string>();

  const tree = useMemo(() => (directory.data ? buildOrgTree(directory.data) : null), [directory.data]);
  const byEmail = useMemo(() => indexByEmail(directory.data ?? []), [directory.data]);

  // "Department" here is the directory's `team` field — see
  // util/departmentColors.ts for why. Scoped by company and hideInterns —
  // cross-cutting filters that should shrink every team's own headcount —
  // but deliberately NOT by selectedDepartment: that filter IS this legend's
  // own picker, so isolating one team must not also remove every other team
  // from the list of things you could switch to.
  const stats = useMemo(() => {
    const employees = (directory.data ?? []).filter(
      (employee) =>
        (!selectedCompany || employee.company === selectedCompany) &&
        (!hideInterns || employee.designation !== "Intern"),
    );
    return departmentStats(employees.map((employee) => ({ department: employee.team })));
  }, [directory.data, selectedCompany, hideInterns]);

  // Distinct `company` values for the dropdown — shared with the offline
  // export via util/buildOrgTree.ts so the two stay in sync.
  const companies = useMemo(() => companyNames(directory.data ?? []), [directory.data]);

  // Every workEmail that should render while a department and/or company is
  // isolated: each employee matching every active filter, plus everyone on
  // their path back to whichever root they hang off (the Chairman, or their
  // own stray root) — reusing the same upward walk search-jump uses, since
  // "keep the path to the root visible" is exactly the same problem. null
  // means no filter active at all: show everyone. A row not in this set is
  // fully hidden, not dimmed — including an ancestor's OTHER children that
  // don't match (a deliberate change from the original dim-only design).
  const visibleEmails = useMemo(() => {
    if ((!selectedDepartment && !selectedCompany) || !directory.data) return null;
    const visible = new Set<string>();
    directory.data
      .filter(
        (employee) =>
          (!selectedDepartment || employee.team === selectedDepartment) &&
          (!selectedCompany || employee.company === selectedCompany),
      )
      .forEach((employee) => ancestorChain(employee.workEmail, byEmail).forEach((email) => visible.add(email)));
    return visible;
  }, [selectedDepartment, selectedCompany, directory.data, byEmail]);

  // Stray roots aren't reached through a parent's visibleChildren list the
  // way every other filtered row is (see OrgChartRow), so hideInterns has to
  // be applied to them here explicitly — an intern stray root would
  // otherwise stay visible (and counted) with "Hide interns" on, unlike
  // every other intern in the tree.
  const visibleStrayRoots = useMemo(
    () =>
      tree
        ? tree.strayRoots.filter(
            (stray) =>
              (!visibleEmails || visibleEmails.has(stray.workEmail)) &&
              (!hideInterns || stray.designation !== "Intern"),
          )
        : [],
    [tree, visibleEmails, hideInterns],
  );

  // The root counts as open unless the user closed it — folded into the same
  // Set shape OrgChartRow already expects, computed at render time rather
  // than stored, so there's nothing to keep in sync via an effect.
  //
  // rootEmail can end up IN openEmails on its own (handleExpandAll and
  // handleSelectSearchResult's ancestorChain both add it) — rootClosed has
  // to override that membership explicitly rather than short-circuit on it,
  // or collapsing the root after either of those becomes permanently a
  // no-op for the rest of the session.
  const effectiveOpenEmails = useMemo(() => {
    const rootEmail = tree?.root.workEmail;
    if (!rootEmail) return openEmails;
    if (rootClosed) {
      if (!openEmails.has(rootEmail)) return openEmails;
      const next = new Set(openEmails);
      next.delete(rootEmail);
      return next;
    }
    if (openEmails.has(rootEmail)) return openEmails;
    return new Set(openEmails).add(rootEmail);
  }, [openEmails, tree?.root.workEmail, rootClosed]);

  // The service refuses every endpoint outside its authorised group, so one
  // notice covers the whole page.
  const forbidden = directory.error instanceof HttpError && directory.error.status === 403;

  const handleToggle = (workEmail: string) => {
    if (tree && workEmail === tree.root.workEmail) {
      setRootClosed((prev) => !prev);
      return;
    }
    setOpenEmails((prev) => {
      const next = new Set(prev);
      if (next.has(workEmail)) next.delete(workEmail);
      else next.add(workEmail);
      return next;
    });
  };

  const handleSelectDepartment = (department: string | null) => {
    setSelectedDepartment((prev) => (prev === department ? null : department));
  };

  // A plain dropdown, not a toggle-on-click legend row, so this just takes
  // the new value directly — the Select's own "Global" option is what
  // sends null.
  const handleSelectCompany = (company: string | null) => {
    setSelectedCompany(company);
  };

  // Clears both isolate filters — unlike handleSelectDepartment (a toggle),
  // "Show all" has to reach both, or picking a company and then clicking
  // "Show all" silently left the company filter active with no more "Show
  // all" link left to undo it (it only rendered when a department was set).
  const handleClearFilters = () => {
    setSelectedDepartment(null);
    setSelectedCompany(null);
  };

  const handleExpandAll = () => {
    if (!tree) return;
    setRootClosed(false);
    const next = new Set<string>();
    collectExpandableEmails(tree.root, next);
    tree.strayRoots.forEach((stray) => collectExpandableEmails(stray, next));
    setOpenEmails(next);
  };

  // Always the full tree — deliberately ignores the current department
  // filter/collapse state, since a downloaded file is for sharing the whole
  // org chart with someone else, not a snapshot of what's on screen right now.
  // Async and can take a few seconds: it fetches and downscales every
  // available employee photo (while we're still authenticated) so the file
  // is genuinely self-contained — see exportOrgChartHtml.ts.
  const [isPreparingDownload, setIsPreparingDownload] = useState(false);
  // Surfaced, not swallowed: without a catch here, a failure inside
  // downloadOrgChartHtml (network, an OOM building the multi-MB data-URI
  // string, ...) rejected silently — isPreparingDownload still reset via
  // finally, so the button just flipped back to "Download" with no file and
  // no explanation.
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const handleDownload = async () => {
    if (!directory.data) return;
    setIsPreparingDownload(true);
    setDownloadError(null);
    try {
      await downloadOrgChartHtml(directory.data);
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error.message : "Couldn't build the download. Please try again.",
      );
    } finally {
      setIsPreparingDownload(false);
    }
  };

  const handleReset = () => {
    setSelectedDepartment(null);
    setSelectedCompany(null);
    setHideInterns(false);
    setHighlightEmail(undefined);
    setRootClosed(false);
    setOpenEmails(new Set());
  };

  const handleSelectSearchResult = (workEmail: string) => {
    const chain = ancestorChain(workEmail, byEmail);
    if (chain.length === 0) return;
    // A department filter, a company filter, or the interns filter — any of
    // them would otherwise hide the very result being jumped to.
    setSelectedDepartment(null);
    setSelectedCompany(null);
    setHideInterns(false);
    setOpenEmails((prev) => new Set([...prev, ...chain]));
    setRootClosed(false);
    setHighlightEmail(workEmail);
    // Two ticks after the state above: one for React to render the newly
    // opened rows, one for the browser to lay them out, before scrolling.
    window.setTimeout(() => {
      document.querySelector(`[data-work-email="${workEmail}"]`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 60);
    window.setTimeout(() => setHighlightEmail(undefined), 2000);
  };

  return (
    <OrgChartShell
      title="Org Chart"
      subtitle="The company's reporting hierarchy, from the Chairman down."
      configured={configured}
      configKey="ONE_WSO2_PEOPLE_BACKEND_URL"
      action={
        tree && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<Download size={16} />}
            onClick={() => void handleDownload()}
            disabled={isPreparingDownload}
          >
            {isPreparingDownload ? "Preparing…" : "Download"}
          </Button>
        )
      }
    >
      {downloadError && (
        <Alert severity="error" onClose={() => setDownloadError(null)} sx={{ mb: 2 }}>
          {downloadError}
        </Alert>
      )}
      {forbidden ? (
        <Alert severity="warning">
          You don&apos;t have access to the org chart. Ask the internal apps team to add you.
        </Alert>
      ) : directory.isPending ? (
        // isPending, not isLoading: isLoading is isPending && isFetching, and
        // the query is disabled (enabled: ... && Boolean(userSub)) until
        // identity resolves — during that window isFetching is false, so
        // isLoading is false too, and this would otherwise fall straight
        // through to the "Couldn't find the Chairman" error below despite
        // never having actually failed. Same isPending convention as
        // PersonCell.tsx.
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1.5 }} />
      ) : directory.isError ? (
        <Alert severity="error">Couldn&apos;t load the org chart. {describeError(directory.error)}</Alert>
      ) : !tree ? (
        <Alert severity="error">Couldn&apos;t find the company&apos;s root (Chairman) in the directory.</Alert>
      ) : (
        <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
          <OrgChartSidebar
            totalCount={directory.data?.length ?? 0}
            departmentStats={stats}
            selectedDepartment={selectedDepartment}
            onSelectDepartment={handleSelectDepartment}
            onClearFilters={handleClearFilters}
            companies={companies}
            selectedCompany={selectedCompany}
            onSelectCompany={handleSelectCompany}
            directory={directory.data ?? []}
            strayCount={tree.strayRoots.length}
            onSelectSearchResult={handleSelectSearchResult}
            hideInterns={hideInterns}
            onToggleHideInterns={() => setHideInterns((value) => !value)}
            onExpandAll={handleExpandAll}
            onReset={handleReset}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {!visibleEmails || visibleEmails.has(tree.root.workEmail) ? (
              <OrgChartRow
                node={tree.root}
                depth={0}
                openEmails={effectiveOpenEmails}
                onToggle={handleToggle}
                visibleEmails={visibleEmails}
                hideInterns={hideInterns}
                highlightEmail={highlightEmail}
              />
            ) : (
              <Typography variant="body2" color="text.disabled">
                Nobody{" "}
                {[selectedDepartment && `in ${selectedDepartment}`, selectedCompany && `at ${selectedCompany}`]
                  .filter(Boolean)
                  .join(" and ")}{" "}
                is reachable from the Chairman.
              </Typography>
            )}
            {visibleStrayRoots.length > 0 && (
              <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: "divider" }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                  {visibleStrayRoots.length} more, reporting to a manager who has left the company:
                </Typography>
                {visibleStrayRoots.map((stray) => (
                  <OrgChartRow
                    key={stray.workEmail}
                    node={stray}
                    depth={0}
                    openEmails={effectiveOpenEmails}
                    onToggle={handleToggle}
                    visibleEmails={visibleEmails}
                    hideInterns={hideInterns}
                    highlightEmail={highlightEmail}
                  />
                ))}
              </Box>
            )}
          </Box>
        </Box>
      )}
    </OrgChartShell>
  );
}
