import "server-only";

import { cache } from "react";
import { getCurrentProfile } from "@/features/auth/actions";
import { createClient } from "@/utils/supabase/server";
import type { Plan } from "@/features/billing/plans";

// The WISHOP console: every read goes through a database function that
// returns nothing unless the signed-in user is a platform admin
// (supabase: is_platform_admin, admin_list_shops...).

export const isPlatformAdmin = cache(async (): Promise<boolean> => {
  // A colleague holding the till on the owner's device is not the owner.
  if ((await getCurrentProfile())?.session_user) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_platform_admin");
  if (error) return false;
  return data === true;
});

export type AdminShop = {
  shop_id: string;
  shop_name: string | null;
  shop_slug: string | null;
  country_code: string | null;
  owner_name: string | null;
  owner_email: string | null;
  signed_up_at: string | null;
  member_count: number;
  product_count: number;
  invoice_count: number;
  last_sale_at: string | null;
  plan: Plan;
  paid_until: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  /** Interface language chosen at sign-up (null for older shops). */
  owner_locale: string | null;
};

export async function listShops(): Promise<AdminShop[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_shops");
  if (error) {
    console.error("admin_list_shops failed:", error);
    return [];
  }
  return (data ?? []) as AdminShop[];
}

export type SubscriptionEvent = {
  id: string;
  kind: "GRANT" | "PAYMENT" | "STANDARD" | "SUSPEND" | "RESUME";
  plan: Plan | null;
  months: number | null;
  amount: number | null;
  method: string | null;
  paid_until: string | null;
  note: string | null;
  created_at: string;
};

export async function getShopEvents(shopId: string): Promise<SubscriptionEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_shop_events", { _shop_id: shopId });
  if (error) {
    console.error("admin_shop_events failed:", error);
    return [];
  }
  return (data ?? []) as SubscriptionEvent[];
}

export type ContentReport = {
  id: string;
  shop_id: string;
  shop_name: string | null;
  shop_slug: string | null;
  product_name: string | null;
  reason: "COUNTERFEIT" | "PROHIBITED" | "MISLEADING" | "OTHER";
  details: string | null;
  reporter_contact: string | null;
  status: "NEW" | "REVIEWED" | "REMOVED" | "DISMISSED";
  created_at: string;
  handled_at: string | null;
};

export async function listReports(): Promise<ContentReport[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_reports");
  if (error) {
    console.error("admin_list_reports failed:", error);
    return [];
  }
  return (data ?? []) as ContentReport[];
}

// The signed-in shop's own subscription (readable by its members): used by
// the app layout to show the suspension notice.
export type OwnSubscription = {
  plan: Plan;
  paid_until: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
};

export const getOwnSubscription = cache(async (): Promise<OwnSubscription | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan, paid_until, suspended_at, suspension_reason")
    .maybeSingle();
  if (error) return null;
  return (data as OwnSubscription | null) ?? null;
});
