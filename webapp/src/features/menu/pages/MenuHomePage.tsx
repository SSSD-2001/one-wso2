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
import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Skeleton, Typography } from "@wso2/oxygen-ui";
import { MessageSquareIcon } from "@wso2/oxygen-ui-icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { HttpError } from "@api/http";
import { MEAL_SLOTS } from "../api/menuTypes";
import {
  isMenuBackendConfigured,
  useDinnerOrder,
  useMenuMetaInfo,
  useMenuUserInfo,
  useTodayMenu,
} from "../api/useMenuData";
import { describeError } from "../util/menuError";
import { formatMenuDate } from "../util/menuTime";
import { DINNER_WINDOW, windowFromMetaInfo } from "../util/menuWindows";
import { useCafeteriaClock } from "../util/useCafeteriaClock";
import DinnerSection from "../components/DinnerSection";
import FeedbackDialog from "../components/FeedbackDialog";
import MealCard from "../components/MealCard";
import MenuShell from "../components/MenuShell";

// The cafeteria screen: today's menu, lunch feedback, and dinner on demand.
//
// Ported from the standalone menu app.
//
// Two things worth knowing here specifically:
//
//  - Both time windows are decided on the cafeteria's clock (IST), matching the
//    server. The original used the browser's, so a user elsewhere could be shown
//    a feedback form whose submission the server then refused.
//  - `now` comes from one clock at the top of this page and flows down as a prop.
//    Nothing below reads the time, which is what makes the window rules testable.
export default function MenuHomePage() {
  const configured = isMenuBackendConfigured();
  const metaInfo = useMenuMetaInfo();
  const feedbackWindow = windowFromMetaInfo(metaInfo.data);
  const { now, cafeteriaDate } = useCafeteriaClock([feedbackWindow, DINNER_WINDOW]);

  const userInfo = useMenuUserInfo();
  const menu = useTodayMenu();
  const dinner = useDinnerOrder();

  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // A tab left open across midnight would otherwise keep showing yesterday's
  // menu and yesterday's order indefinitely.
  const qc = useQueryClient();
  const lastDate = useRef(cafeteriaDate);
  useEffect(() => {
    if (lastDate.current === cafeteriaDate) return;
    lastDate.current = cafeteriaDate;
    void qc.invalidateQueries({ queryKey: ["menu-menu"] });
    void qc.invalidateQueries({ queryKey: ["menu-dinner"] });
  }, [cafeteriaDate, qc]);

  // The service refuses every endpoint for someone outside its authorised
  // groups, so four sections would paint four copies of the same fact. One
  // notice for the page instead.
  const forbidden = userInfo.error instanceof HttpError && userInfo.error.status === 403;

  const served = MEAL_SLOTS.filter((slot) => menu.data?.meals[slot.key].title);
  // Faithful to the original: blank breakfast AND lunch means "no menu", even if
  // another slot is listed. Odd, but changing it is a product decision.
  const nothingPublished =
    Boolean(menu.data) && !menu.data?.meals.breakfast.title && !menu.data?.meals.lunch.title;

  return (
    <MenuShell
      title="Cafeteria"
      subtitle="Today's menu, lunch feedback, and dinner on demand."
      configured={configured}
      configKey="ONE_WSO2_MENU_BACKEND_URL"
    >
      {forbidden ? (
        <Alert severity="warning">
          You don&apos;t have access to the cafeteria app. Ask the internal apps team to add you.
        </Alert>
      ) : (
        <>
          {menu.data?.date && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {formatMenuDate(menu.data.date)}
            </Typography>
          )}

          {menu.isLoading ? (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" },
                gap: 1.5,
              }}
            >
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} variant="rectangular" height={112} sx={{ borderRadius: 1.5 }} />
              ))}
            </Box>
          ) : menu.isError ? (
            <Alert severity="error">Couldn&apos;t load the menu. {describeError(menu.error)}</Alert>
          ) : nothingPublished ? (
            <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>
              No menu published{menu.data?.date ? ` for ${formatMenuDate(menu.data.date)}` : ""}.
            </Typography>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" },
                gap: 1.5,
              }}
            >
              {served.map((slot) => (
                <MealCard
                  key={slot.key}
                  label={slot.label}
                  icon={slot.icon}
                  timeRange={slot.timeRange}
                  meal={menu.data!.meals[slot.key]}
                  action={
                    // Only lunch takes feedback. Absent rather than disabled on
                    // the other slots — the original rendered an invisible
                    // disabled button on all four.
                    slot.feedback ? (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<MessageSquareIcon size={16} />}
                        onClick={() => setFeedbackOpen(true)}
                        sx={{ textTransform: "none", fontWeight: 600 }}
                      >
                        Feedback
                      </Button>
                    ) : undefined
                  }
                />
              ))}
            </Box>
          )}

          <DinnerSection
            now={now}
            order={dinner.data}
            user={userInfo.data}
            // Everything except a 403 reaches DinnerSection rather than the
            // page-level notice above, so it needs the reason itself.
            userError={forbidden || !userInfo.isError ? undefined : userInfo.error}
            isLoading={dinner.isLoading}
            error={dinner.isError ? dinner.error : undefined}
          />

          <FeedbackDialog
            open={feedbackOpen}
            onClose={() => setFeedbackOpen(false)}
            now={now}
            menuDate={menu.data?.date ?? null}
            feedbackWindow={feedbackWindow}
          />
        </>
      )}
    </MenuShell>
  );
}
