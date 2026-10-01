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

/**
 * The replay route. The tour is offered exactly once, so this menu item is the
 * only way back to it — a dead entry here would strand anyone who declined.
 */
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TourProvider } from "@features/tour/TourProvider";
import { useTour } from "@features/tour/tourContext";
import UserProfileMenu from "./UserProfileMenu";

vi.mock("@config/authConfig", () => ({
  authConfig: { myAccountUrl: "https://myaccount.example.test" },
}));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "user-under-test" }, retry: () => {} }),
}));
vi.mock("@asgardeo/react", () => ({
  useAsgardeo: () => ({ isSignedIn: true }),
}));
vi.mock("@hooks/useAsgardeoUser", () => ({
  useAsgardeoUser: () => ({ initials: "NK", email: "n@example.com", ready: true }),
}));
vi.mock("@hooks/useSecureSignOut", () => ({ useSecureSignOut: () => () => {} }));
vi.mock("@api/useUserInfo", () => ({
  useUserInfo: () => ({ data: undefined }),
}));

/** Reports whether the tour is running, so the click can be observed. */
function Probe() {
  const tour = useTour();
  return <span data-testid="running">{String(tour.running)}</span>;
}

describe("taking the tour from the profile menu", () => {
  it("offers an entry that starts it", async () => {
    render(
      <TourProvider>
        <UserProfileMenu />
        <Probe />
      </TourProvider>,
    );
    expect(screen.getByTestId("running").textContent).toBe("false");

    // The menu is closed until its trigger is used.
    const triggers = screen.getAllByRole("button");
    await userEvent.click(triggers[0]);

    const item = await screen.findByText("Take the tour");
    await userEvent.click(item);
    expect(screen.getByTestId("running").textContent).toBe("true");
  });

});
