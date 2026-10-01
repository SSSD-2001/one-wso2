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
import { Alert, Box, Button, Card, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { MEAL_OPTIONS, isMealOption, type DinnerOrder, type MenuUserInfo } from "../api/menuTypes";
import { useUpsertDinnerOrder } from "../api/useMenuMutations";
import { describeError } from "../util/menuError";
import { formatMenuDate } from "../util/menuTime";
import { DINNER_WINDOW, isDinnerOrderingOpen } from "../util/menuWindows";
import { buildDinnerPayload } from "../util/menuWire";
import CancelDinnerDialog from "./CancelDinnerDialog";
import WindowNotice from "./WindowNotice";

// Dinner on Demand.
//
// The ordering window gates the WRITE affordances only — an existing order stays
// visible at any hour. The standalone app returned early outside the window and
// took the order summary with it, so you could not even see what you had ordered.
//
// Cancelling stays inside the window by decision: the kitchen's window is the
// point of the rule.
export default function DinnerSection({
  now,
  order,
  user,
  userError,
  isLoading,
  error,
}: {
  now: Date;
  order: DinnerOrder | null | undefined;
  // The orderer's own profile. Dinner is distributed by department and
  // reporting line, so an order placed without it is filed against nobody —
  // which makes this required to submit, not decoration.
  user: MenuUserInfo | undefined;
  // Why `user` is missing, when that is known. Absent `user` with no error is
  // simply "not loaded yet", which is transient and says nothing worth showing;
  // absent `user` WITH an error is a state the reader has to be told about,
  // because ordering stays unavailable until it is fixed.
  userError?: unknown;
  isLoading: boolean;
  error: unknown;
}) {
  const [selection, setSelection] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const upsert = useUpsertDinnerOrder();
  const { showSuccess, showError } = useNotifications();

  const orderingOpen = isDinnerOrderingOpen(now);
  const ordered = order?.mealOption ?? null;
  // Before any choice is made, the tiles reflect what is already on order.
  const effective = selection ?? ordered;
  const changed = effective !== null && effective !== ordered;

  const pick = (value: string) => {
    if (!orderingOpen) return;
    // Deselecting is allowed, except back to nothing when an order exists —
    // there is no "no meal" state to submit once you have ordered.
    if (effective === value) {
      if (ordered === value) return;
      setSelection(null);
      return;
    }
    setSelection(value);
  };

  // `buildDinnerPayload` substitutes empty strings for a missing profile and
  // the backend accepts them, so nothing downstream will refuse the order —
  // it just files it with no department and no manager. The guard has to be
  // here, and it has to cover the button as well as this function.
  const canOrder = Boolean(user);

  const submit = () => {
    if (!effective || !isMealOption(effective) || !canOrder) return;
    const payload = buildDinnerPayload({ now, mealOption: effective, user, existing: order ?? null });
    const updating = ordered !== null;
    upsert.mutate(payload, {
      onSuccess: () => {
        showSuccess(updating ? "Dinner order updated" : `${effective} dinner ordered`);
        setSelection(null);
      },
      onError: (err) => showError(describeError(err)),
    });
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Typography component="h2" variant="h5" sx={{ fontSize: 16, mb: 0.5 }}>
        Dinner on Demand
      </Typography>
      <WindowNotice window={DINNER_WINDOW}>
        {(range) =>
          orderingOpen
            ? `Ordering and changes are open until ${range.split(" – ")[1]}.`
            : `Ordering and changes are open ${range}.`
        }
      </WindowNotice>

      {isLoading ? (
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rectangular" height={72} sx={{ borderRadius: 1.5, flex: 1 }} />
          ))}
        </Stack>
      ) : error ? (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          Couldn&apos;t load your dinner order. {describeError(error)}
        </Alert>
      ) : (
        <>
          <Box
            sx={{
              mt: 1.5,
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
              gap: 1.5,
            }}
          >
            {MEAL_OPTIONS.map((opt) => {
              const isSelected = effective === opt.value;
              return (
                <Card
                  key={opt.value}
                  component="button"
                  type="button"
                  onClick={() => pick(opt.value)}
                  disabled={!orderingOpen || upsert.isPending}
                  aria-pressed={isSelected}
                  variant="outlined"
                  sx={{
                    all: "unset",
                    boxSizing: "border-box",
                    width: "100%",
                    p: 1.5,
                    border: 1,
                    borderStyle: "solid",
                    borderColor: isSelected ? "primary.main" : "divider",
                    borderRadius: 1.5,
                    bgcolor: isSelected ? "action.selected" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    cursor: orderingOpen ? "pointer" : "not-allowed",
                    color: "text.primary",
                    "&:hover:not(:disabled)": { bgcolor: "action.hover" },
                    "&:focus-visible": {
                      outline: 2,
                      outlineStyle: "solid",
                      outlineColor: "primary.main",
                      outlineOffset: 2,
                    },
                  }}
                >
                  <Box component="span" sx={{ display: "inline-flex", color: "text.secondary" }}>
                    <opt.icon size={20} />
                  </Box>
                  <Typography sx={{ fontSize: 13.5, fontWeight: isSelected ? 600 : 400 }}>
                    {opt.label}
                  </Typography>
                </Card>
              );
            })}
          </Box>

          {order && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              You have a <strong>{order.mealOption.toLowerCase()}</strong> dinner ordered
              {order.date ? ` for ${formatMenuDate(order.date)}` : ""}. Collect it from the ground
              floor.
            </Typography>
          )}

          {upsert.isError && (
            <Alert severity="error" sx={{ mt: 1.5 }}>
              {describeError(upsert.error)}
            </Alert>
          )}

          {/* Only once the profile is known to have failed. While it is merely
              in flight the button is disabled and this stays quiet, since the
              wait is normally imperceptible and a warning about it would be
              noise. The page as a whole only refuses on a 403, so every other
              failure lands here rather than being caught upstream. */}
          {!canOrder && userError !== undefined && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              Ordering needs your department and reporting line, which couldn&apos;t be
              loaded, so dinner can&apos;t be assigned to anyone yet.{" "}
              {describeError(userError)}
            </Alert>
          )}

          <Stack direction="row" spacing={1} sx={{ mt: 1.5, justifyContent: "flex-end" }}>
            {order && (
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={() => setCancelOpen(true)}
                disabled={!orderingOpen || upsert.isPending}
                sx={{ textTransform: "none", fontWeight: 600 }}
              >
                Cancel order
              </Button>
            )}
            <Button
              size="small"
              variant="contained"
              onClick={submit}
              disabled={!orderingOpen || upsert.isPending || !effective || !changed || !canOrder}
              sx={{ fontWeight: 600 }}
            >
              {upsert.isPending
                ? order
                  ? "Updating…"
                  : "Ordering…"
                : order
                  ? "Update dinner"
                  : "Order dinner"}
            </Button>
          </Stack>
        </>
      )}

      <CancelDinnerDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        mealLabel={order?.mealOption ?? "dinner"}
      />
    </Box>
  );
}
