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

import { useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { primaryBtnSx, secondaryBtnSx } from "../components/infraUi";
import { useInfraEmployees, useInfraLeads, useInfraOrganizations } from "../api/useInfraDirectory";
import { useInfraUserInfo } from "../api/useInfraUserInfo";
import type { InfraRepositoryRequest } from "../api/infraTypes";
import RepositoryStep from "./RepositoryDetailsStep";
import { generalStepErrors, type GeneralStepValues } from "./generalStep";
import { emptyRepositoryStep, repositoryStepErrors, type RepoType, type RepositoryStepValues } from "./repositoryStep";
import AccessDetailsStep from "./AccessDetailsStep";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useCreateRepositoryRequest } from "./useCreateRepositoryRequest";
import { useUpdateRepositoryRequest } from "./useUpdateRepositoryRequest";
import { accessStepErrors, emptyAccessStep, type AccessStepValues } from "./accessStep";
import { toRepositoryRequestCreate, toRepositoryRequestUpdate } from "./submitRequest";
import InfraConfirmDialog from "../components/InfraConfirmDialog";

const STEPS = ["General Details", "Repository Details", "Access Details"];

function splitList(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function yesNo(value: string): "Yes" | "No" {
  return value === "No" ? "No" : "Yes";
}

function repoTypeOf(value: string): RepoType {
  return value === "Private" ? "Private" : "Public";
}

function repositoryFromRequest(request: InfraRepositoryRequest): RepositoryStepValues {
  return {
    ...emptyRepositoryStep,
    organizationId: request.organizationId,
    organizationName: request.organizationName,
    repoName: request.repoName,
    repoType: repoTypeOf(request.repoType),
    enableIssues: request.enableIssues === "Yes" ? "Yes" : "No",
    description: request.description,
    topics: splitList(request.topics),
    websiteUrl: request.websiteUrl ?? "",
    prProtection: request.prProtection,
  };
}

function accessFromRequest(request: InfraRepositoryRequest): AccessStepValues {
  return {
    teams: splitList(request.teams),
    repoType: repoTypeOf(request.repoType),
    enableTriageWso2All: yesNo(request.enableTriageWso2All),
    enableTriageWso2AllInterns: yesNo(request.enableTriageWso2AllInterns),
    disableTriageReason: request.disableTriageReason || "N/A",
  };
}

export default function NewRepositoryForm({
  request,
  onSaved,
}: {
  request?: InfraRepositoryRequest;
  onSaved?: () => void;
} = {}) {
  const userInfo = useInfraUserInfo();
  const leads = useInfraLeads();
  const employees = useInfraEmployees();
  const organizations = useInfraOrganizations(Boolean(request));
  const [step, setStep] = useState(0);
  const [generalTried, setGeneralTried] = useState(false);
  const [repositoryTried, setRepositoryTried] = useState(false);
  const [repository, setRepository] = useState<RepositoryStepValues>(
    request ? repositoryFromRequest(request) : emptyRepositoryStep,
  );
  const [leadEmail, setLeadEmail] = useState(request?.leadEmail ?? "");
  const [requirement, setRequirement] = useState(request?.requirement ?? "");
  const [ccList, setCcList] = useState<string[]>(request ? splitList(request.ccList) : []);
  const [access, setAccess] = useState<AccessStepValues>(
    request ? accessFromRequest(request) : emptyAccessStep,
  );
  const [accessTried, setAccessTried] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const createRequest = useCreateRepositoryRequest();
  const updateRequest = useUpdateRepositoryRequest();
  const saving = request ? updateRequest : createRequest;
  const { showSuccess, showWarning } = useNotifications();

  const values: GeneralStepValues = {
    email: userInfo.data?.workEmail ?? "",
    leadEmail,
    requirement,
    ccList,
  };
  const errors = generalStepErrors(values);
  const leadOptions = leads.data ?? [];
  const employeeEmails = (employees.data ?? []).map((employee) => employee.workEmail);
  const editOrg = request
    ? organizations.data?.find((item) => item.organizationId === repository.organizationId)
    : undefined;
  const repositoryValues =
    editOrg && !repository.organizationVisibility
      ? {
          ...repository,
          organizationVisibility: editOrg.organizationVisibility,
          organizationPlan: editOrg.organizationPlan,
        }
      : repository;
  const repositoryErrors = repositoryStepErrors(repositoryValues);
  const accessValues: AccessStepValues = { ...access, repoType: repositoryValues.repoType };
  const accessErrors = accessStepErrors(accessValues);

  const resetForm = () => {
    setStep(0);
    setGeneralTried(false);
    setRepositoryTried(false);
    setAccessTried(false);
    setLeadEmail("");
    setRequirement("");
    setCcList([]);
    setRepository(emptyRepositoryStep);
    setAccess(emptyAccessStep);
    setConfirmOpen(false);
    createRequest.reset();
  };

  const openConfirm = () => {
    if (Object.keys(errors).length > 0) {
      setGeneralTried(true);
      setStep(0);
      return;
    }
    if (Object.keys(repositoryErrors).length > 0) {
      setRepositoryTried(true);
      setStep(1);
      return;
    }
    setAccessTried(true);
    if (Object.keys(accessErrors).length > 0) return;
    saving.reset();
    setConfirmOpen(true);
  };

  const confirm = () => {
    if (request) {
      const body = toRepositoryRequestUpdate(request, values, repositoryValues, accessValues);
      if (!body) {
        setConfirmOpen(false);
        showWarning("No changes were made to the repository request.");
        return;
      }
      updateRequest.mutate(body, {
        onSuccess: () => {
          showSuccess("Repository request updated.");
          setConfirmOpen(false);
          onSaved?.();
        },
      });
      return;
    }
    createRequest.mutate(toRepositoryRequestCreate(values, repositoryValues, accessValues), {
      onSuccess: () => {
        showSuccess("Repository request submitted.");
        resetForm();
      },
    });
  };

  const goNext = () => {
    if (step === 0) {
      setGeneralTried(true);
      if (Object.keys(errors).length === 0) setStep(1);
      return;
    }
    setRepositoryTried(true);
    if (Object.keys(repositoryErrors).length === 0) setStep(2);
  };

  return (
    <Stack spacing={3}>
      <Stepper activeStep={step}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {step === 0 ? (
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Provide the details below to request a new GitHub repository.
          </Typography>
          <TextField
            label="Member Email"
            value={values.email}
            disabled
            required
            fullWidth
            size="small"
            error={userInfo.isError || (generalTried && Boolean(errors.email))}
            helperText={
              userInfo.isError
                ? describeError(userInfo.error)
                : userInfo.isLoading
                ? "Loading your email…"
                : generalTried
                  ? errors.email
                  : undefined
            }
          />
          <FormControl
            fullWidth
            size="small"
            required
            disabled={leads.isLoading}
            error={generalTried && Boolean(errors.leadEmail)}
          >
            <InputLabel shrink>Lead Email</InputLabel>
            <Select
              notched
              label="Lead Email"
              value={leadEmail}
              onChange={(event) => setLeadEmail(event.target.value)}
            >
              {leadOptions.map((lead) => (
                <MenuItem key={lead.leadId} value={lead.leadEmail}>
                  {lead.leadEmail} - {lead.teamName}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              {leads.isError
                ? describeError(leads.error)
                : generalTried
                                  ? errors.leadEmail
                                  : leads.isLoading
                  ? "Loading leads…"
                  : leadOptions.length === 0
                                      ? "No leads available"
                                      : " "}
            </FormHelperText>
          </FormControl>
          <TextField
            label="Requirement"
            value={requirement}
            onChange={(event) => setRequirement(event.target.value)}
            required
            fullWidth
            multiline
            rows={3}
            size="small"
            error={generalTried && Boolean(errors.requirement)}
            helperText={generalTried ? errors.requirement : "Purpose of requesting this repo"}
            InputLabelProps={{ shrink: true }}
          />
          <Autocomplete
            multiple
            freeSolo
            size="small"
            options={employeeEmails}
            value={ccList}
            loading={employees.isLoading}
            onChange={(_event, next) =>
              setCcList([...new Set(next.map((email) => email.trim()).filter(Boolean))])
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
                label="CC List"
                required
                error={generalTried && Boolean(errors.ccList)}
                helperText={
                  employees.isError
                    ? describeError(employees.error)
                    : generalTried && errors.ccList
                                          ? errors.ccList
                                          : "At least one person to inform about this request"
                }
                InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
              />
            )}
          />
        </Stack>
      ) : step === 1 ? (
        <RepositoryStep
          values={repositoryValues}
          showErrors={repositoryTried}
          onChange={(patch) => {
            setRepository((current) => ({ ...current, ...patch }));
            if (patch.organizationName !== undefined && patch.organizationName !== repositoryValues.organizationName) {
              setAccess((current) => ({ ...current, teams: [] }));
            }
          }}
        />
      ) : (
        <AccessDetailsStep
          organizationName={repositoryValues.organizationName}
          values={{ ...access, repoType: repositoryValues.repoType }}
          showErrors={accessTried}
          onChange={(patch) => setAccess((current) => ({ ...current, ...patch }))}
        />
      )}

      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Button sx={secondaryBtnSx} disabled={step === 0} onClick={() => setStep((current) => current - 1)}>
          Back
        </Button>
        {step < 2 ? (
          <Button variant="outlined" color="primary" sx={primaryBtnSx} onClick={goNext}>
            Next
          </Button>
        ) : (
          <Button variant="outlined" color="primary" sx={primaryBtnSx} onClick={openConfirm}>
            {request ? "Save" : "Submit"}
          </Button>
        )}
      </Box>
      <InfraConfirmDialog
        open={confirmOpen}
        title={request ? "Update Repository Request" : "Confirm Repository Request"}
        busy={saving.isPending}
        confirmLabel={
          saving.isPending ? (request ? "Saving…" : "Submitting…") : "Confirm"
        }
        onConfirm={confirm}
        onCancel={() => setConfirmOpen(false)}
        body={
          <>
            <Typography sx={{ fontWeight: 700, color: "text.primary" }}>
              {request
                ? "Are you sure you want to update this request?"
                : "Are you sure you want to create this request?"}
            </Typography>
            <Typography sx={{ mt: 1 }}>
              {repositoryValues.repoName.trim()} - {repositoryValues.organizationName} - {repositoryValues.repoType}
            </Typography>
            {saving.isError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {describeError(saving.error)}
              </Alert>
            )}
          </>
        }
      />
    </Stack>
  );
}