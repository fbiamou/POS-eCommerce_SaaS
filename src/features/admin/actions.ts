"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { feedbackFromError, type FeedbackCode } from "@/lib/feedback";
import { MAX_MONTHS, isPaidPlan, isPaymentMethod } from "@/features/billing/plans";

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
