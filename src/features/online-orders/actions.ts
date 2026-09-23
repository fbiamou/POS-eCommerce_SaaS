"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { feedbackFromError, type FeedbackCode } from "@/lib/feedback";

type OnlineOrderRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  status: OnlineOrder["status"];
  total_amount: number;
  created_at: string;
  online_order_items: { quantity: number; unit_price: number; products: { name: string } | null }[] | null;
};

export type OnlineOrder = {
  id: string;
  customer_name: string;
  customer_phone: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  total_amount: number;
  created_at: string;
  items: { product_name: string; quantity: number; unit_price: number }[];
};

export async function getOnlineOrders(): Promise<OnlineOrder[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase.from("profiles").select("shop_id").eq("id", user.id).single();
  if (!profile?.shop_id) return [];

  const { data, error } = await supabase
    .from("online_orders")
    .select(
      `
      id, customer_name, customer_phone, status, total_amount, created_at,
      online_order_items ( quantity, unit_price, products ( name ) )
    `
    )
    .eq("shop_id", profile.shop_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching online orders:", error);
    return [];
  }

  return ((data ?? []) as unknown as OnlineOrderRow[]).map((order) => ({
    id: order.id,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    status: order.status,
    total_amount: order.total_amount,
    created_at: order.created_at,
    items: (order.online_order_items ?? []).map((item) => ({
      product_name: item.products?.name ?? "—",
      quantity: item.quantity,
      unit_price: item.unit_price,
    })),
  }));
}

export async function confirmOnlineOrder(
  orderId: string,
  paidAmount: number
): Promise<{ success?: true; invoiceId?: string; error?: FeedbackCode }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" };

  const { data: profile } = await supabase.from("profiles").select("shop_id").eq("id", user.id).single();
  if (!profile?.shop_id) return { error: "shop_not_found" };

  const { data, error } = await supabase.rpc("confirm_online_order", {
    _shop_id: profile.shop_id,
    _order_id: orderId,
    _paid_amount: paidAmount,
  });

  if (error) {
    console.error("Error confirming online order:", error);
    return { error: feedbackFromError(error) };
  }

  revalidatePath("/online-orders");
  revalidatePath("/stock");
  revalidatePath("/sales");
  return { success: true, invoiceId: data as string };
}

export async function cancelOnlineOrder(orderId: string): Promise<{ success?: true; error?: FeedbackCode }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" };

  const { data: profile } = await supabase.from("profiles").select("shop_id").eq("id", user.id).single();
  if (!profile?.shop_id) return { error: "shop_not_found" };

  const { error } = await supabase.rpc("cancel_online_order", {
    _shop_id: profile.shop_id,
    _order_id: orderId,
  });

  if (error) {
    console.error("Error cancelling online order:", error);
    return { error: feedbackFromError(error) };
  }

  revalidatePath("/online-orders");
  return { success: true };
}
