import "server-only";

import { createClient } from "@/utils/supabase/server";

export type ShopMessage = {
  id: string;
  shop_id: string | null;
  title: string;
  body: string;
  tone: "INFO" | "WARNING";
  created_at: string;
};

// Messages from WISHOP the owner has not marked as read yet: those written to
// her shop, and those written to every shop since she joined (a new shop does
// not inherit old announcements).
export async function getUnreadMessages(joinedAt: string | null): Promise<ShopMessage[]> {
  const supabase = await createClient();
  const [{ data: messages, error }, { data: reads }] = await Promise.all([
    supabase.from("shop_messages").select("id, shop_id, title, body, tone, created_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("shop_message_reads").select("message_id"),
  ]);
  if (error) return [];
  const read = new Set((reads ?? []).map((r) => r.message_id as string));
  return ((messages ?? []) as ShopMessage[]).filter(
    (m) => !read.has(m.id) && (m.shop_id !== null || !joinedAt || m.created_at >= joinedAt),
  );
}

export type SentMessage = ShopMessage & { read_at: string | null; read_count: number };

// Console: what was written to one shop (shopId) or to every shop (null).
export async function listSentMessages(shopId: string | null): Promise<SentMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_messages", { _shop_id: shopId });
  if (error) {
    console.error("admin_list_messages failed:", error);
    return [];
  }
  return (data ?? []) as SentMessage[];
}
