import "server-only";

import { cache } from "react";
import { getOwnSubscription } from "@/features/admin/queries";
import { shopAccess, type ShopAccess } from "./plans";

// The signed-in shop's plan and where it stands today (read once per request).
export const getShopAccess = cache(async (): Promise<ShopAccess> => {
  return shopAccess(await getOwnSubscription(), new Date());
});
