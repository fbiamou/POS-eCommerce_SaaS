"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { feedbackFromError, type FeedbackCode } from "@/lib/feedback";

type Result = { success?: true; error?: FeedbackCode };

// The owner has read a message from WISHOP: it leaves the top of her app.
export async function markMessageRead(messageId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_shop_message_read", { _message_id: messageId });
  if (error) return { error: feedbackFromError(error) };
  revalidatePath("/", "layout");
  return { success: true };
}

// Console: write to one shop, or to every shop (shopId null).
export async function sendShopMessage(input: {
  shopId: string | null;
  title: string;
  body: string;
  tone: string;
}): Promise<Result> {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || title.length > 120 || !body || body.length > 2000 || !["INFO", "WARNING"].includes(input.tone)) {
    return { error: "admin_invalid" };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_send_message", {
    _shop_id: input.shopId,
    _title: title,
    _body: body,
    _tone: input.tone,
  });
  if (error) {
    console.error("admin_send_message failed:", error);
    return { error: feedbackFromError(error) };
  }
  revalidatePath("/admin", "layout");
  return { success: true };
}

export async function deleteShopMessage(messageId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_message", { _message_id: messageId });
  if (error) return { error: feedbackFromError(error) };
  revalidatePath("/admin", "layout");
  return { success: true };
}
