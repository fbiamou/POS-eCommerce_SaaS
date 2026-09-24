"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getCurrentProfile } from "@/features/auth/actions";
import { feedbackFromError, type FeedbackCode } from "@/lib/feedback";

function buildPhone(formData: FormData): string | null {
  const countryCode = (formData.get("phone_country_code") as string) || "";
  const digits = ((formData.get("phone") as string) || "").replace(/\D/g, "");
  return digits ? `${countryCode}${digits}` : null;
}

function revalidateShipmentPages(id?: string) {
  revalidatePath("/shipments");
  if (id) revalidatePath(`/shipments/${id}`);
  revalidatePath("/purchase-orders");
  revalidatePath("/stock");
  revalidatePath("/sales");
  revalidatePath("/dashboard");
}

// Creates an expected parcel and returns the token of its one-time link.
export async function createShipmentLink(
  formData: FormData
): Promise<{ success?: true; token?: string; reference?: string; error?: FeedbackCode }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "unauthorized" };

  const supabase = await createClient();
  const purchaseOrderId = (formData.get("purchase_order_id") as string) || null;
  const { data, error } = await supabase.rpc("create_shipment_link", {
    _shop_id: profile.shop_id,
    _intermediary_name: (formData.get("intermediary_name") as string) || "",
    _intermediary_phone: buildPhone(formData) ?? "",
    _purchase_order_id: purchaseOrderId,
  });

  const created = (data as { intake_token: string; reference: string }[] | null)?.[0];
  if (error || !created) {
    console.error("create_shipment_link failed:", error);
    return { error: feedbackFromError(error) };
  }

  revalidateShipmentPages();
  return { success: true, token: created.intake_token, reference: created.reference };
}

export async function cancelShipment(id: string): Promise<{ success?: true; error?: FeedbackCode }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_shipment", { _shop_id: profile.shop_id, _shipment_id: id });
  if (error) {
    console.error("cancel_shipment failed:", error);
    return { error: feedbackFromError(error) };
  }
  revalidateShipmentPages(id);
  return { success: true };
}

export type ReceivedEntry = { item_id: string; received_quantity: number; selling_price: number | null };

// Checking off the parcel: the only way supplier goods enter the stock.
export async function receiveShipment(
  id: string,
  entries: ReceivedEntry[]
): Promise<{ success?: true; error?: FeedbackCode }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "unauthorized" };

  if (entries.some((e) => !Number.isInteger(e.received_quantity) || e.received_quantity < 0)) {
    return { error: "invalid_quantity" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_shipment", {
    _shop_id: profile.shop_id,
    _shipment_id: id,
    _received: entries,
  });
  if (error) {
    console.error("receive_shipment failed:", error);
    return { error: feedbackFromError(error) };
  }
  revalidateShipmentPages(id);
  return { success: true };
}
