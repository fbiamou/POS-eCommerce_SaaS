"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { feedbackFromError, type FeedbackCode } from "@/lib/feedback";
import { MAX_MONTHS, isPaidPlan, isPaymentMethod } from "@/features/billing/plans";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { isPlatformAdmin, listShops } from "./queries";

// Platform admin actions. The database functions check is_platform_admin()
// themselves; the checks here only avoid a pointless round-trip.

type Result = { success?: true; error?: FeedbackCode };

function revalidateAdmin(shopId?: string) {
  revalidatePath("/admin");
  if (shopId) revalidatePath(`/admin/shops/${shopId}`);
}

// Free months (amount null) or a payment received (amount and method).
export async function extendPlan(input: {
  shopId: string;
  plan: string;
  months: number;
  amount: number | null;
  method: string | null;
  note: string;
}): Promise<Result> {
  const { shopId, plan, months, amount, method, note } = input;
  if (!isPaidPlan(plan) || !Number.isInteger(months) || months < 1 || months > MAX_MONTHS) return { error: "admin_invalid" };
  if (amount !== null && (!Number.isInteger(amount) || amount < 0 || !method || !isPaymentMethod(method))) {
    return { error: "admin_invalid" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_extend_plan", {
    _shop_id: shopId,
    _plan: plan,
    _months: months,
    _amount: amount,
    _method: amount === null ? null : method,
    _note: note,
  });
  if (error) {
    console.error("admin_extend_plan failed:", error);
    return { error: feedbackFromError(error) };
  }
  revalidateAdmin(shopId);
  return { success: true };
}

export async function setStandard(shopId: string, note: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_standard", { _shop_id: shopId, _note: note });
  if (error) {
    console.error("admin_set_standard failed:", error);
    return { error: feedbackFromError(error) };
  }
  revalidateAdmin(shopId);
  return { success: true };
}

export async function setSuspended(shopId: string, suspended: boolean, reason: string): Promise<Result> {
  if (reason.length > 500) return { error: "admin_invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_suspended", {
    _shop_id: shopId,
    _suspended: suspended,
    _reason: reason,
  });
  if (error) {
    console.error("admin_set_suspended failed:", error);
    return { error: feedbackFromError(error) };
  }
  revalidateAdmin(shopId);
  return { success: true };
}

const REPORT_STATUSES = ["NEW", "REVIEWED", "REMOVED", "DISMISSED"];

export async function setReportStatus(reportId: string, status: string): Promise<Result> {
  if (!REPORT_STATUSES.includes(status)) return { error: "admin_invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_report_status", { _report_id: reportId, _status: status });
  if (error) {
    console.error("admin_set_report_status failed:", error);
    return { error: feedbackFromError(error) };
  }
  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  return { success: true };
}

// Permanently deletes a shop that has never paid (test or fictitious shops),
// after its name has been typed to confirm. The database function erases the
// data and refuses a shop with a payment or a platform admin; the service
// role then removes its files and its sign-in accounts.
export async function deleteShop(shopId: string, typedName: string): Promise<Result> {
  if (!(await isPlatformAdmin())) return { error: "access_denied" };
  const shop = (await listShops()).find((s) => s.shop_id === shopId);
  if (!shop) return { error: "shop_not_found" };
  if (typedName.trim().toLocaleLowerCase() !== (shop.shop_name ?? "").trim().toLocaleLowerCase()) {
    return { error: "delete_name_mismatch" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_delete_shop", { _shop_id: shopId });
  if (error) {
    console.error("admin_delete_shop failed:", error);
    return { error: feedbackFromError(error) };
  }
  const leftovers = (data ?? {}) as { members?: string[]; shipment_photos?: string[] };

  // The data is gone: what follows only cleans up. A failure is logged and
  // does not undo the deletion.
  const service = createServiceRoleClient();
  for (const bucket of ["shop-assets", "product-images"]) {
    const { data: files } = await service.storage.from(bucket).list(shopId, { limit: 1000 });
    const paths = (files ?? []).map((file) => `${shopId}/${file.name}`);
    if (paths.length > 0) {
      const { error: removeError } = await service.storage.from(bucket).remove(paths);
      if (removeError) console.error(`deleteShop: ${bucket} cleanup failed:`, removeError);
    }
  }
  if (leftovers.shipment_photos?.length) {
    const { error: removeError } = await service.storage.from("shipment-photos").remove(leftovers.shipment_photos);
    if (removeError) console.error("deleteShop: shipment-photos cleanup failed:", removeError);
  }
  for (const userId of leftovers.members ?? []) {
    const { error: userError } = await service.auth.admin.deleteUser(userId);
    if (userError) console.error(`deleteShop: sign-in account ${userId} not deleted:`, userError);
  }

  revalidatePath("/admin");
  return { success: true };
}
