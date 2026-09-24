"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getCurrentProfile } from "@/features/auth/actions";
import { feedbackFromError, type FeedbackCode } from "@/lib/feedback";
import type { PurchaseOrderStatus } from "./queries";

function revalidateOrderPages(id?: string) {
  revalidatePath("/purchase-orders");
  if (id) revalidatePath(`/purchase-orders/${id}`);
  revalidatePath("/shipments");
}

// One draft per supplier for the items at or under the low-stock threshold
// that are not already in an open order. Nothing is sent automatically.
export async function generatePurchaseOrders(): Promise<{ created?: number; error?: FeedbackCode }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "unauthorized" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_purchase_orders", { _shop_id: profile.shop_id });
  if (error) {
    console.error("create_purchase_orders failed:", error);
    return { error: feedbackFromError(error) };
  }
  revalidateOrderPages();
  return { created: data as number };
}

export async function updatePurchaseOrderLine(
  orderId: string,
  lineId: string,
  quantity: number,
  excluded: boolean
): Promise<{ success?: true; error?: FeedbackCode }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "unauthorized" };
  if (!Number.isInteger(quantity) || quantity <= 0) return { error: "invalid_quantity" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_purchase_order_item", {
    _shop_id: profile.shop_id,
    _item_id: lineId,
    _quantity: quantity,
    _excluded: excluded,
  });
  if (error) {
    console.error("update_purchase_order_item failed:", error);
    return { error: feedbackFromError(error) };
  }
  revalidateOrderPages(orderId);
  return { success: true };
}

// Draft -> sent -> received, or cancelled before reception. None of these
// touches the stock: goods enter it only when a shipment is checked off.
export async function setPurchaseOrderStatus(
  orderId: string,
  status: Exclude<PurchaseOrderStatus, "DRAFT">
): Promise<{ success?: true; error?: FeedbackCode }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_purchase_order_status", {
    _shop_id: profile.shop_id,
    _order_id: orderId,
    _status: status,
  });
  if (error) {
    console.error("set_purchase_order_status failed:", error);
    return { error: feedbackFromError(error) };
  }
  revalidateOrderPages(orderId);
  return { success: true };
}
