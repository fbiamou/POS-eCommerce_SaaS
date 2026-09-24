"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getCurrentProfile } from "@/features/auth/actions";
import type { FeedbackCode } from "@/lib/feedback";

function buildPhone(formData: FormData): string | null {
  const countryCode = (formData.get("phone_country_code") as string) || "";
  const digits = ((formData.get("phone") as string) || "").replace(/\D/g, "");
  return digits ? `${countryCode}${digits}` : null;
}

function revalidateSupplierPages() {
  revalidatePath("/purchase-orders");
  revalidatePath("/stock");
}

// Creates a supplier, or updates it when the form carries an id.
export async function saveSupplier(formData: FormData): Promise<{ success?: true; error?: FeedbackCode }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "unauthorized" };

  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return { error: "name_required" };

  const supabase = await createClient();
  const id = formData.get("id") as string | null;
  const values = { name, phone: buildPhone(formData) };

  const { error } = id
    ? await supabase.from("suppliers").update(values).eq("id", id).eq("shop_id", profile.shop_id)
    : await supabase.from("suppliers").insert({ ...values, shop_id: profile.shop_id });

  if (error) {
    console.error("Error saving supplier:", error);
    return { error: "update_failed" };
  }

  revalidateSupplierPages();
  return { success: true };
}

// A supplier is deactivated, never deleted: past purchase orders keep it.
export async function setSupplierActive(id: string, isActive: boolean): Promise<{ success?: true; error?: FeedbackCode }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("suppliers")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("shop_id", profile.shop_id);

  if (error) {
    console.error("Error updating supplier status:", error);
    return { error: "update_failed" };
  }

  revalidateSupplierPages();
  return { success: true };
}
