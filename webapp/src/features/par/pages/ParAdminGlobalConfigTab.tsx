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

import { useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  Chip,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useNotifications } from "@context/notifications/NotificationsContext";
import ConfirmationDialog, { type ConfirmationContent } from "@components/confirmation-dialog/ConfirmationDialog";
import { useParGlobalConfig } from "../api/useParAdmin";
import { useUpdateParGlobalConfig } from "../api/useParMutations";

// Ports GlobalSettings.tsx: the org-wide defaults ParCycleCreationDialog.tsx
// prefills new cycles from. Editing here never touches a cycle already
// created — only what the next one starts with. Field set and validation
// mirror that dialog's own "Cycle configuration" section exactly, since it's
// the same four values on the same resource (GET/PUT meta/configurations).
export default function ParAdminGlobalConfigTab() {
  const globalConfig = useParGlobalConfig();
  const updateConfig = useUpdateParGlobalConfig();
  const { showSuccess, showError } = useNotifications();

  const [employeeQuestion, setEmployeeQuestion] = useState("");
  const [reviewQuestion, setReviewQuestion] = useState("");
  const [ratings, setRatings] = useState<string[]>([]);
  const [reviewRatings, setReviewRatings] = useState<string[]>([]);
  const [seeded, setSeeded] = useState(false);
  const [confirmContent, setConfirmContent] = useState<ConfirmationContent | null>(null);

  // Seed once per fetch so a background refetch doesn't stomp an
  // in-progress edit — same approach ParCycleCreationDialog.tsx uses for
  // this same data.
  if (globalConfig.isSuccess && !seeded) {
    setSeeded(true);
    setEmployeeQuestion(globalConfig.data.employeeParQuestion);
    setReviewQuestion(globalConfig.data.threeSixtyReviewQuestion);
    setRatings(globalConfig.data.parRatings);
    setReviewRatings(globalConfig.data.threeSixtyReviewRatings);
  }

  if (globalConfig.isLoading) {
    return <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1.5 }} />;
  }
  if (globalConfig.isError) {
    return (
      <ErrorNotice error={globalConfig.error} onRetry={() => globalConfig.refetch()} retrying={globalConfig.isFetching}>
        Couldn't load the global PAR configurations.
      </ErrorNotice>
    );
  }
  if (!globalConfig.data) {
    return <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1.5 }} />;
  }

  const reset = () => {
    setEmployeeQuestion(globalConfig.data.employeeParQuestion);
    setReviewQuestion(globalConfig.data.threeSixtyReviewQuestion);
    setRatings(globalConfig.data.parRatings);
    setReviewRatings(globalConfig.data.threeSixtyReviewRatings);
  };

  const isValid = employeeQuestion.trim() && reviewQuestion.trim() && ratings.length > 0 && reviewRatings.length > 0;

  const hasChanged =
    employeeQuestion !== globalConfig.data.employeeParQuestion ||
    reviewQuestion !== globalConfig.data.threeSixtyReviewQuestion ||
    JSON.stringify(ratings) !== JSON.stringify(globalConfig.data.parRatings) ||
    JSON.stringify(reviewRatings) !== JSON.stringify(globalConfig.data.threeSixtyReviewRatings);

  const handleSubmit = () => {
    setConfirmContent({
      title: "Update global PAR configurations?",
      text: "This will change the defaults used for new PAR cycles — existing cycles are not affected.",
      confirmAction: () => {
        updateConfig.mutate(
          {
            employeeParQuestion: employeeQuestion.trim(),
            threeSixtyReviewQuestion: reviewQuestion.trim(),
            parRatings: ratings,
            threeSixtyReviewRatings: reviewRatings,
          },
          {
            onSuccess: () => showSuccess("Global PAR configurations updated"),
            onError: (err) => showError(describeError(err)),
          },
        );
      },
    });
  };

  const ratingsField = (label: string, value: string[], setValue: (v: string[]) => void, ariaLabel: string) => (
    <Autocomplete
      multiple
      freeSolo
      options={[]}
      value={value}
      onChange={(_e, newValue) => setValue(newValue as string[])}
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => {
          const { key, ...tagProps } = getTagProps({ index });
          return <Chip key={key} variant="outlined" label={option} {...tagProps} />;
        })
      }
      renderInput={(params) => <TextField {...params} label={label} size="small" aria-label={ariaLabel} />}
    />
  );

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Defaults used to prefill new PAR cycles — editing here doesn't change any cycle already created.
      </Typography>

      <Card variant="outlined" sx={{ borderRadius: 2, p: 2.5 }}>
        <Stack spacing={2.5}>
          <TextField
            label="Employee PAR question"
            size="small"
            fullWidth
            multiline
            minRows={3}
            aria-label="Employee PAR question"
            value={employeeQuestion}
            onChange={(e) => setEmployeeQuestion(e.target.value)}
          />
          <TextField
            label="360° feedback question"
            size="small"
            fullWidth
            multiline
            minRows={3}
            aria-label="360 feedback question"
            value={reviewQuestion}
            onChange={(e) => setReviewQuestion(e.target.value)}
          />
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              PAR ratings
            </Typography>
            {ratingsField("PAR ratings", ratings, setRatings, "PAR ratings")}
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              360° feedback ratings
            </Typography>
            {ratingsField("360° feedback ratings", reviewRatings, setReviewRatings, "360 feedback ratings")}
          </Box>

          {updateConfig.isError && <Alert severity="error">{describeError(updateConfig.error)}</Alert>}
        </Stack>
      </Card>

      <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
        <Button onClick={reset} disabled={!hasChanged || updateConfig.isPending}>
          Cancel
        </Button>
        <Button variant="contained" disabled={!isValid || !hasChanged || updateConfig.isPending} onClick={handleSubmit}>
          {updateConfig.isPending ? "Saving…" : "Save"}
        </Button>
      </Stack>

      <ConfirmationDialog content={confirmContent} onClose={() => setConfirmContent(null)} />
    </Stack>
  );
}
