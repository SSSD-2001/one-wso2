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

import { Alert, Box } from "@wso2/oxygen-ui";
import { useAsgardeoUser } from "@hooks/useAsgardeoUser";
import { SERVICES } from "../api/subscriptionTypes";
import { useSubscriptionGate } from "../api/useSubscriptionGate";
import { useSubscriptionsMetaInfo } from "../api/useSubscriptionData";
import { useMidnightClock } from "../util/useMidnightClock";
import ServiceCard from "../components/ServiceCard";
import SubscriptionsShell from "../components/SubscriptionsShell";

// Opt yourself in and out of the two paid staff services.
//
// Ported from the digiops-hr subscription-app, which until now existed only as
// a mobile microapp — this is its first web view.
//
// Two things worth knowing here specifically:
//
//  - `now` comes from useMidnightClock and flows down as a prop. Nothing
//    below this page reads the clock, which is what makes the opt-in/opt-out
//    window rules testable (see util/subscriptionWindows). A tab left open
//    across midnight with no other reason to re-render would otherwise keep
//    showing a window that just opened as closed — or one that just closed
//    as still open — until something else happened to force a re-render;
//    the clock schedules its own update at the boundary instead of waiting
//    for one.
//  - The subject of every call is the signed-in user's own email, taken from
//    the id_token. The backend compares it with the token's own address and
//    applies the self-service rules; the same components with a different
//    email are what the admin screen renders.
export default function MySubscriptionsPage() {
  const gate = useSubscriptionGate();
  const meta = useSubscriptionsMetaInfo();
  const user = useAsgardeoUser();
  const now = useMidnightClock();

  return (
    <SubscriptionsShell
      title="My subscriptions"
      subtitle="Opt in and out of PickMe Commute and LaaS. Each has a monthly window — the card tells you which one applies and when it's open."
      gate={gate}
    >
      {/* The shell has already cleared the gate, so meta.data is loaded by the
          time anything below renders — but the type doesn't know that, and a
          non-null assertion would be a worse way to say so than a guard that
          can never fire. */}
      {!meta.data ? null : !user.email ? (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          Your session doesn&apos;t carry a work email, so we can&apos;t look up
          your subscriptions. Signing out and back in usually fixes this.
        </Alert>
      ) : (
        <Box
          sx={{
            display: "grid",
            // One column on a phone, two side by side once there's room. The
            // cards are independent of each other, so neither order nor
            // alignment between them carries meaning.
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
            gap: 2,
            // Stretch (the grid default — spelled out because ServiceCard's
            // internal layout depends on it): LaaS has far less to show than
            // Commute, and without this each card would size to its own
            // content and sit at a different height. ServiceCard's own
            // flex-grow content area is what turns the matched box height
            // into a matched button position too.
            alignItems: "stretch",
            maxWidth: 900,
          }}
        >
          {SERVICES.map((service) => (
            <ServiceCard
              key={service.key}
              service={service}
              meta={meta.data}
              gate={gate}
              email={user.email}
              now={now}
            />
          ))}
        </Box>
      )}
    </SubscriptionsShell>
  );
}
