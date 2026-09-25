import "server-only";

import { getCurrentProfile } from "@/features/auth/actions";
import { getShopAccess } from "./access";
import { planAllows, type PlanFeature } from "./plans";
import { LockedFeature, ReadOnlyNotice } from "./components/LockedFeature";

// At the top of a page that needs a plan feature:
//   const locked = await lockedFeature("purchase_orders");
//   if (locked) return locked;
export async function lockedFeature(feature: PlanFeature) {
  const access = await getShopAccess();
  if (planAllows(access.plan, feature)) return null;
  const profile = await getCurrentProfile();
  return <LockedFeature feature={feature} currentPlan={access.plan} isManager={profile?.role === "MANAGER"} />;
}

// The till while the shop is read-only.
export async function readOnlyTill() {
  const access = await getShopAccess();
  if (access.mode !== "read_only") return null;
  const profile = await getCurrentProfile();
  return <ReadOnlyNotice isManager={profile?.role === "MANAGER"} />;
}
