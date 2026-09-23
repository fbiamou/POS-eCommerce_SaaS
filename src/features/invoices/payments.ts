"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { feedbackFromError, type FeedbackCode } from "@/lib/feedback";

// Records a payment made after the sale (a client settling all or part of a
// debt). Everything happens in the record_payment RPC, in one transaction:
// the payment is logged and the invoice's paid amount and status updated.
export async function recordPayment(
  invoiceId: string,
  amount: number
): Promise<{ success?: true; remaining?: number; error?: FeedbackCode }> {
  if (!Number.isInteger(amount) || amount <= 0) return { error: "invalid_amount" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" };

  const { data: profile } = await supabase.from("profiles").select("shop_id").eq("id", user.id).single();
  if (!profile?.shop_id) return { error: "shop_not_found" };

  const { data: remaining, error } = await supabase.rpc("record_payment", {
    _shop_id: profile.shop_id,
    _invoice_id: invoiceId,
    _amount: amount,
  });

  if (error) {
    console.error("record_payment failed:", error);
    return { error: feedbackFromError(error) };
  }

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/clients");
  revalidatePath("/reminders");
  revalidatePath("/dashboard");
  return { success: true, remaining: remaining as number };
}
