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

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { authedGet } from "@api/http";
import { describeError } from "@api/errors";
import { infraServiceUrls } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import { useIdTokenClaims } from "@features/security/grc/hooks/useIdTokenClaims";
import { useNotifications } from "@context/notifications/NotificationsContext";
import InfraConfirmDialog from "../components/InfraConfirmDialog";
import { primaryBtnSx } from "../components/infraUi";
import {
  useInfraEmployees,
  useInfraOrganizations,
  useOrgGithubRepos,
  useRepositoryLeads,
} from "../api/useInfraDirectory";
import { useCreateAccessRequest, useMyAccessRequests, useMyCreationRequests } from "../api/useInfraRequests";
import { useInfraUserInfo } from "../api/useInfraUserInfo";
import type { DefaultRepositoryAccess, InfraAccessPermission } from "../api/infraTypes";
import { resolveGitHubConnection } from "../github/githubOAuth";
import {
  accessRequestFormErrors,
  emptyAccessRequestForm,
  PERMISSION_LABELS,
  toAccessRequestPayload,
  type AccessRequestFormValues,
} from "./accessRequestStep";

export default function ExistingRepoAccessForm({ onSaved }: { onSaved?: () => void } = {}) {
  const userInfo = useInfraUserInfo();
  const claims = useIdTokenClaims();
  const getAccessToken = useAccessToken();
  const organizations = useInfraOrganizations();
  const employees = useInfraEmployees();
  const accessRequests = useMyAccessRequests();
  const email = userInfo.data?.workEmail ?? "";
  const creationRequests = useMyCreationRequests(email, { limit: 100, offset: 0 });
  const createRequest = useCreateAccessRequest();
  const { showSuccess } = useNotifications();

  const [values, setValues] = useState<AccessRequestFormValues>(emptyAccessRequestForm);
  const [tried, setTried] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const jwtGithubUserId =
    typeof claims?.githubUserId === "string" ? claims.githubUserId : null;
  const { isConnected } = resolveGitHubConnection({
    jwtGithubUserId: jwtGithubUserId ?? userInfo.data?.githubUserId,
    githubUsername: userInfo.data?.githubUsername,
  });

  const defaultAccess = useQuery<DefaultRepositoryAccess>({
    queryKey: ["infra-default-repository-access"],
    enabled: isConnected,
    queryFn: async () =>
      authedGet<DefaultRepositoryAccess>(
        infraServiceUrls.defaultRepositoryAccess,
        await getAccessToken(),
      ),
  });

  const orgRepos = useOrgGithubRepos(values.organizationId, values.organizationId > 0);
  const repoLeads = useRepositoryLeads(
    values.organizationId,
    values.repoName,
    values.organizationId > 0 && Boolean(values.repoName.trim()),
  );

  const errors = accessRequestFormErrors(values);
  const employeeEmails = (employees.data ?? []).map((employee) => employee.workEmail);
  const repoOptions = (orgRepos.data ?? []).map((repo) => repo.name);

  const alreadyHasAccessRepos = useMemo(() => {
    const orgName = values.orgName;
    const names = new Set<string>();
    if (!orgName) return names;

    (accessRequests.data ?? [])
      .filter(
        (request) =>
          request.orgName === orgName &&
          (request.state === "Approved" || request.state === "Pending"),
      )
      .forEach((request) => names.add(request.repoName));

    (creationRequests.data?.repositoryRequests ?? [])
      .filter(
        (request) =>
          request.organizationName === orgName &&
          (request.state === "Approved" || request.state === "Pending"),
      )
      .forEach((request) => names.add(request.repoName));

    defaultAccess.data?.organizations
      .find((org) => org.orgName === orgName)
      ?.repositories.forEach((repo) => names.add(repo.name));

    return names;
  }, [
    accessRequests.data,
    creationRequests.data?.repositoryRequests,
    defaultAccess.data?.organizations,
    values.orgName,
  ]);

  const patch = (next: Partial<AccessRequestFormValues>) => {
    setValues((current) => ({ ...current, ...next }));
  };

  const openConfirm = () => {
    setTried(true);
    if (Object.keys(errors).length > 0) return;
    createRequest.reset();
    setConfirmOpen(true);
  };

  const confirm = () => {
    createRequest.mutate(toAccessRequestPayload(values), {
      onSuccess: () => {
        showSuccess("Access request submitted.");
        setValues(emptyAccessRequestForm);
        setTried(false);
        setConfirmOpen(false);
        onSaved?.();
      },
    });
  };

  if (!isConnected) {
    return (
      <Alert severity="info">
        Connect your GitHub account on GitHub Connection before requesting repository access.
      </Alert>
    );
  }

  if (defaultAccess.isPending) {
    return (
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Checking default repository access…
        </Typography>
      </Stack>
    );
  }

  if (defaultAccess.isError) {
    return <Alert severity="error">{describeError(defaultAccess.error)}</Alert>;
  }

  if (defaultAccess.data?.status !== "granted") {
    return (
      <Alert severity="warning">
        Default repository access must be granted before you can request access to an existing repo.
      </Alert>
    );
  }

  const permissionLabel = PERMISSION_LABELS[values.permission];

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Ask for Read, Triage or Write access to a repository that already exists.
      </Typography>

      <FormControl
        fullWidth
        size="small"
        required
        error={tried && Boolean(errors.organizationId)}
        disabled={organizations.isLoading}
      >
        <InputLabel shrink>Organization</InputLabel>
        <Select
          notched
          label="Organization"
          value={values.organizationId || ""}
          onChange={(event) => {
            const selectedId = Number(event.target.value);
            const selectedOrg = (organizations.data ?? []).find(
              (org) => org.organizationId === selectedId,
            );
            patch({
              organizationId: selectedId,
              orgName: selectedOrg?.organizationName ?? "",
              repoName: "",
              leadEmail: "",
            });
          }}
        >
          {(organizations.data ?? []).map((org) => (
            <MenuItem key={org.organizationId} value={org.organizationId}>
              {org.organizationName}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>
          {organizations.isError
            ? describeError(organizations.error)
            : tried
              ? errors.organizationId
              : organizations.isLoading
                ? "Loading organizations…"
                : (organizations.data ?? []).length === 0
                  ? "No organizations available"
                  : " "}
        </FormHelperText>
      </FormControl>

      <Autocomplete
        options={repoOptions}
        loading={orgRepos.isFetching}
        disabled={!values.organizationId}
        value={values.repoName || null}
        getOptionDisabled={(option) => alreadyHasAccessRepos.has(option)}
        onChange={(_event, value) => {
          if (value && alreadyHasAccessRepos.has(value)) return;
          patch({ repoName: value ?? "", leadEmail: "" });
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            size="small"
            required
            label="Repository name"
            error={tried && Boolean(errors.repoName)}
            helperText={
              orgRepos.isError
                ? describeError(orgRepos.error)
                : (tried && errors.repoName) ||
                  (!values.organizationId
                    ? "Select an organization first"
                    : "Type to search repositories in this org")
            }
            InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
          />
        )}
      />

      <Box>
        <Typography variant="body2" sx={{ mb: 0.5 }}>
          Permission
        </Typography>
        <RadioGroup
          row
          value={values.permission}
          onChange={(event) =>
            patch({ permission: event.target.value as InfraAccessPermission })
          }
        >
          <FormControlLabel value="pull" control={<Radio size="small" />} label="Read" />
          <FormControlLabel value="triage" control={<Radio size="small" />} label="Triage" />
          <FormControlLabel value="push" control={<Radio size="small" />} label="Write" />
        </RadioGroup>
        {tried && errors.permission && (
          <FormHelperText error>{errors.permission}</FormHelperText>
        )}
      </Box>

      <TextField
        label="Justification"
        value={values.justification}
        onChange={(event) => patch({ justification: event.target.value })}
        required
        fullWidth
        multiline
        minRows={3}
        size="small"
        error={tried && Boolean(errors.justification)}
        helperText={tried ? errors.justification : "Why access is needed"}
        InputLabelProps={{ shrink: true }}
      />

      <FormControl
        fullWidth
        size="small"
        required
        error={tried && Boolean(errors.leadEmail)}
        disabled={repoLeads.isFetching || !values.repoName}
      >
        <InputLabel shrink>Lead Email</InputLabel>
        <Select
          notched
          label="Lead Email"
          value={values.leadEmail}
          onChange={(event) => patch({ leadEmail: event.target.value })}
        >
          {repoLeads.isFetching ? (
            <MenuItem disabled>Loading...</MenuItem>
          ) : !values.repoName ? (
            <MenuItem disabled>Select a repository first</MenuItem>
          ) : (repoLeads.data ?? []).length > 0 ? (
            (repoLeads.data ?? []).map((leadEmail) => (
              <MenuItem key={leadEmail} value={leadEmail}>
                {leadEmail}
              </MenuItem>
            ))
          ) : (
            <MenuItem disabled>No leads for this repository</MenuItem>
          )}
        </Select>
        <FormHelperText>
          {repoLeads.isError
            ? describeError(repoLeads.error)
            : tried
              ? errors.leadEmail
              : " "}
        </FormHelperText>
      </FormControl>

      <Autocomplete
        multiple
        freeSolo
        size="small"
        options={employeeEmails}
        value={values.ccList}
        loading={employees.isLoading}
        onChange={(_event, next) =>
          patch({
            ccList: [...new Set(next.map((item) => item.trim()).filter(Boolean))],
          })
        }
        filterOptions={(options, params) => {
          const query = params.inputValue.trim().toLowerCase();
          const filtered = options.filter((option) => option.toLowerCase().includes(query));
          const typed = params.inputValue.trim();
          if (typed && !options.includes(typed)) filtered.push(typed);
          return filtered;
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="CC list (optional)"
            error={tried && Boolean(errors.ccList)}
            helperText={
              employees.isError
                ? describeError(employees.error)
                : tried && errors.ccList
                  ? errors.ccList
                  : "Select employees or type an email"
            }
            InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
          />
        )}
      />

      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="outlined" color="primary" sx={primaryBtnSx} onClick={openConfirm}>
          Submit request
        </Button>
      </Box>

      <InfraConfirmDialog
        open={confirmOpen}
        title="Confirm Access Request"
        busy={createRequest.isPending}
        confirmLabel={createRequest.isPending ? "Submitting…" : "Continue"}
        onConfirm={confirm}
        onCancel={() => setConfirmOpen(false)}
        body={
          <>
            <Typography component="span" display="block" variant="body2">
              Submit access to{" "}
              <strong>
                {values.orgName}/{values.repoName.trim()}
              </strong>{" "}
              with <strong>{permissionLabel}</strong> permission?
            </Typography>
            <Typography component="span" display="block" variant="body2" sx={{ mt: 1 }}>
              You can track this request from My Requests.
            </Typography>
            {createRequest.isError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {describeError(createRequest.error)}
              </Alert>
            )}
          </>
        }
      />
    </Stack>
  );
}
