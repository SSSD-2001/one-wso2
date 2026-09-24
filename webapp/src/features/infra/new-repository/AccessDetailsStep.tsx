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

import {
    Autocomplete,
    Box,
    FormControlLabel,
    Radio,
    RadioGroup,
    Stack,
    TextField,
    Typography,
  } from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { useInfraTeams } from "../api/useInfraDirectory";
import { triageReasonRequired, type AccessStepValues } from "./accessStep";
  
    export default function AccessDetailsStep({
        organizationName,
        values,
        showErrors,
        onChange,
    }: {
        organizationName: string;
        values: AccessStepValues;
        showErrors: boolean;
        onChange: (patch: Partial<AccessStepValues>) => void;
    }) {
    const teams = useInfraTeams(organizationName);
    const teamError = showErrors && values.teams.length === 0 ? "Teams are required." : undefined;
    const reasonRequired = triageReasonRequired(values);
  
    const setTriage = (field: "enableTriageWso2All" | "enableTriageWso2AllInterns", value: "Yes" | "No") => {
        const next = { ...values, [field]: value };
        const needsReason = triageReasonRequired(next);
        onChange({
            [field]: value,
            disableTriageReason: needsReason
            ? values.disableTriageReason === "N/A"
                ? ""
                : values.disableTriageReason
            : values.disableTriageReason.trim()
                ? values.disableTriageReason
                : "N/A",
        });
    };
  
    return (
        <Stack spacing={2}>
            <Autocomplete
            multiple
            size="small"
            options={teams.data ?? []}
            value={values.teams}
            loading={teams.isLoading}
            disabled={!organizationName}
            onChange={(_event, next) => onChange({ teams: next })}
            renderInput={(params) => (
                <TextField
                {...params}
                InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
                label="Give write access to"
                required
                error={Boolean(teamError) || teams.isError}
                helperText={
                    teams.isError
                    ? describeError(teams.error)
                    : teamError
                        ? teamError
                        : teams.isLoading
                        ? "Loading teams…"
                        : "Internal committer teams for this organization"
                }
                />
            )}
            />
  
        {values.repoType === "Private" && (
            <>
                <Box>
                <Typography variant="body1">Enable triage access to wso2-all group</Typography>
                <RadioGroup
                    row
                    sx={{ ml: 2 }}
                    value={values.enableTriageWso2All}
                    onChange={(event) => setTriage("enableTriageWso2All", event.target.value as "Yes" | "No")}
                >
                    <FormControlLabel value="Yes" control={<Radio />} label="Yes" />
                    <FormControlLabel value="No" control={<Radio />} label="No" />
                </RadioGroup>
                </Box>
                <Box>
                <Typography variant="body1">Enable triage access to wso2-all-interns group</Typography>
                <RadioGroup
                    row
                    sx={{ ml: 2 }}
                    value={values.enableTriageWso2AllInterns}
                    onChange={(event) => setTriage("enableTriageWso2AllInterns", event.target.value as "Yes" | "No")}
                >
                    <FormControlLabel value="Yes" control={<Radio />} label="Yes" />
                    <FormControlLabel value="No" control={<Radio />} label="No" />
                </RadioGroup>
                </Box>
                {reasonRequired && (
                <TextField
                    label="Reason to select 'No' for any of the above options"
                    InputLabelProps={{ shrink: true }}
                    value={values.disableTriageReason}
                    onChange={(event) => onChange({ disableTriageReason: event.target.value })}
                    required
                    fullWidth
                    multiline
                    rows={3}
                    size="small"
                    error={showErrors && (!values.disableTriageReason.trim() || values.disableTriageReason.trim() === "N/A")}
                    helperText={
                    showErrors && !values.disableTriageReason.trim()
                        ? "Disable Triage Reason is required."
                        : showErrors && values.disableTriageReason.trim() === "N/A"
                        ? "Please provide a reason for disabling triage access."
                        : " "
                    }
                />
                )}
            </>
        )}
        </Stack>
    );
}