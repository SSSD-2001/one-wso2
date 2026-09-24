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
    Alert,
    Autocomplete,
    Box,
    Checkbox,
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
import { describeError } from "@api/errors";
import { useInfraOrganizations, useInfraTopics } from "../api/useInfraDirectory";
import {
    DESCRIPTION_MAX,
    fieldsFromOrganization,
    organizationAllowsIssues,
    repoTypeRestriction,
    repositoryStepErrors,
    sanitizeTopics,
    sortOrganizations,
    type RepositoryStepValues,
} from "./repositoryStep";
  
export default function RepositoryStep({
    values,
    showErrors,
    onChange,
}: {
    values: RepositoryStepValues;
    showErrors: boolean;
    onChange: (patch: Partial<RepositoryStepValues>) => void;
}) {
    const organizations = useInfraOrganizations();
    const topics = useInfraTopics();
    const orgs = sortOrganizations(organizations.data ?? []);
    const selected = orgs.find((org) => org.organizationId === values.organizationId);
    const issuesAllowed = selected ? organizationAllowsIssues(selected) : false;
    const restriction = repoTypeRestriction(values);
    const errors = repositoryStepErrors(values);
    const topicOptions = (topics.data ?? []).map((topic) => topic.topicName);
  
    return (
        <Stack spacing={2}>
            <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
            <FormControl
                sx={{ flex: 1 }}
                size="small"
                required
                disabled={organizations.isLoading}
                error={showErrors && Boolean(errors.organizationId)}
            >
                <InputLabel shrink>Organization</InputLabel>
                <Select
                    notched
                    label="Organization"
                value={values.organizationId || ""}
                onChange={(event) => {
                    const org = orgs.find((item) => item.organizationId === Number(event.target.value));
                    if (org) onChange(fieldsFromOrganization(org));
                }}
                >
                {orgs.map((org) => (
                    <MenuItem key={org.organizationId} value={org.organizationId}>
                    {org.organizationName} - {org.organizationVisibility}
                    </MenuItem>
                ))}
                </Select>
                <FormHelperText>
                {organizations.isError
                    ? describeError(organizations.error)
                    : showErrors
                    ? errors.organizationId
                    : organizations.isLoading
                        ? "Loading organizations…"
                        : orgs.length === 0
                        ? "No organizations available"
                        : "Changing this resets issues and the repository type"}
                </FormHelperText>
            </FormControl>
            <Typography sx={{ pt: 1 }}>/</Typography>
            <TextField
                sx={{ flex: 1 }}
                label="Repository Name"
                InputLabelProps={{ shrink: true }}
                value={values.repoName}
                onChange={(event) => onChange({ repoName: event.target.value })}
                required
                size="small"
                error={showErrors && Boolean(errors.repoName)}
                helperText={showErrors ? errors.repoName : " "}
            />
            </Box>
    
            <Box>
            <Typography variant="body1">Enable Issues</Typography>
            <FormControlLabel
                sx={{ ml: 1 }}
                control={
                <Checkbox
                    checked={values.enableIssues === "Yes"}
                    disabled={!issuesAllowed}
                    onChange={(event) => onChange({ enableIssues: event.target.checked ? "Yes" : "No" })}
                />
                }
                label={issuesAllowed ? "Enable Issues" : "Issues cannot be enabled for this organization"}
            />
            </Box>
    
            <Box>
            <Typography variant="body1" gutterBottom>
                Repository Type
            </Typography>
            {restriction && (
                <Alert severity="warning" variant="outlined" sx={{ mb: 1 }}>
                {restriction.message}
                </Alert>
            )}
            <RadioGroup
                row
                value={values.repoType}
                onChange={(event) => onChange({ repoType: event.target.value as RepositoryStepValues["repoType"] })}
            >
                <FormControlLabel
                    sx={{ ml: 1 }}
                    value="Private"
                    control={<Radio />}
                    label="Private"
                    disabled={values.organizationPlan === "Free" || values.organizationVisibility === "Public"}
                />
                <FormControlLabel
                    value="Public"
                    control={<Radio />}
                    label="Public"
                    disabled={values.organizationVisibility === "Private"}
                />
            </RadioGroup>
            </Box>
    
            <TextField
                label="Description"
                InputLabelProps={{ shrink: true }}
                value={values.description}
                onChange={(event) => onChange({ description: event.target.value.replace(/\r?\n/g, " ") })}
                required
                fullWidth
                multiline
                minRows={1}
                maxRows={5}
                size="small"
                error={showErrors && Boolean(errors.description)}
                helperText={
                    showErrors && errors.description
                    ? `${values.description.length}/${DESCRIPTION_MAX} characters. ${errors.description}`
                    : `${values.description.length}/${DESCRIPTION_MAX} characters`
                }
            />
    
            <Autocomplete
                multiple
                freeSolo
                size="small"
                options={topicOptions}
                value={values.topics}
                loading={topics.isLoading}
                onChange={(_event, next) => onChange({ topics: sanitizeTopics(next) })}
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
                    label="Topics"
                    InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
                    required
                    error={showErrors && Boolean(errors.topics)}
                    helperText={
                        topics.isError
                        ? describeError(topics.error)
                        : showErrors && errors.topics
                            ? errors.topics
                            : "Lowercase letters, numbers, and hyphens. Example: ballerina, api-management"
                    }
                    onPaste={(event) => {
                        const text = event.clipboardData.getData("text");
                        if (!text.includes(",")) return;
                        event.preventDefault();
                        onChange({ topics: sanitizeTopics([...values.topics, ...text.split(",")]) });
                    }}
                />
            )}
            />
    
            <TextField
                label="Website URL"
                InputLabelProps={{ shrink: true }}
                value={values.websiteUrl}
                onChange={(event) => onChange({ websiteUrl: event.target.value })}
                fullWidth
                size="small"
                error={showErrors && Boolean(errors.websiteUrl)}
                helperText={showErrors ? errors.websiteUrl : "Optional. http:// or https://"}
            />
        </Stack>
    );
  }