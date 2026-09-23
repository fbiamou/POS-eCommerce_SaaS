import "server-only";

import { createServiceRoleClient } from "@/utils/supabase/service";

export type WhatsAppCredentials = {
  phoneNumberId: string;
  apiToken: string;
  templateName: string;
};

// The WhatsApp API token is never readable by shop accounts (not even the
// Propriétaire, who can only replace it): it is read here, server-side, with
// the service role, and only at the moment a message is actually sent.
export async function getWhatsAppCredentials(shopId: string): Promise<WhatsAppCredentials | null> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("settings")
    .select("whatsapp_phone_number_id, whatsapp_api_token, whatsapp_template_name")
    .eq("shop_id", shopId)
    .single();

  if (error || !data) {
    if (error) console.error("Error reading WhatsApp credentials:", error);
    return null;
  }
  if (!data.whatsapp_phone_number_id || !data.whatsapp_api_token || !data.whatsapp_template_name) return null;

  return {
    phoneNumberId: data.whatsapp_phone_number_id,
    apiToken: data.whatsapp_api_token,
    templateName: data.whatsapp_template_name,
  };
}
