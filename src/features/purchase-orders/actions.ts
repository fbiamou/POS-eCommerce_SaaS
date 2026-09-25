"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getCurrentProfile } from "@/features/auth/actions";
import { feedbackFromError, type FeedbackCode } from "@/lib/feedback";
import type { PurchaseOrderStatus } from "./queries";
import type { ReceivedEntry } from "./reception";

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

// Draft -> sent, or cancelled before reception. None of these touches the
// stock: goods enter it only when the order (or its shipment) is checked off.
export async function setPurchaseOrderStatus(
  orderId: string,
  status: Exclude<PurchaseOrderStatus, "DRAFT" | "RECEIVED">
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

// A draft or cancelled order the shop no longer wants to see. Soft delete:
// the row stays in the database (see delete_purchase_order).
export async function deletePurchaseOrder(orderId: string): Promise<{ success?: true; error?: FeedbackCode }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_purchase_order", {
    _shop_id: profile.shop_id,
    _order_id: orderId,
  });
  if (error) {
    console.error("delete_purchase_order failed:", error);
    return { error: feedbackFromError(error) };
  }
  revalidateOrderPages(orderId);
  return { success: true };
}

// The supplier delivered: only the quantities checked off enter the stock,
// each with a logged RESTOCK movement (receive_purchase_order).
export async function receivePurchaseOrder(
  orderId: string,
  entries: ReceivedEntry[]
): Promise<{ success?: true; error?: FeedbackCode }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "unauthorized" };
  if (entries.some((e) => !Number.isInteger(e.received_quantity) || e.received_quantity < 0)) {
    return { error: "invalid_quantity" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_purchase_order", {
    _shop_id: profile.shop_id,
    _order_id: orderId,
    _received: entries,
  });
  if (error) {
    console.error("receive_purchase_order failed:", error);
    return { error: feedbackFromError(error) };
  }
  revalidateOrderPages(orderId);
  revalidatePath("/stock");
  return { success: true };
}
