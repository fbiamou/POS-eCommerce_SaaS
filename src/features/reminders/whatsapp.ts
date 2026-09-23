// Sends a WhatsApp Cloud API template message using a shop's own connected
// credentials (per-tenant — never a global env var, since each shop on this
// SaaS has its own WhatsApp Business account).
//
// Assumption to verify once a shop has a real approved template: the
// template is expected to take exactly 2 body variables, in this order —
// (1) client name, (2) amount due — and to be approved in French ("fr").
// This is a working default, not a hard requirement from Meta; adjust if a
// shop's real template differs.
import { formatNumber } from "@/lib/format";

export type WhatsAppSendResult = { ok: true; messageId: string } | { ok: false; error: string };

export async function sendWhatsAppTemplateMessage({
  phoneNumberId,
  apiToken,
  templateName,
  to,
  clientName,
  amountDue,
}: {
  phoneNumberId: string;
  apiToken: string;
  templateName: string;
  to: string;
  clientName: string;
  amountDue: number;
}): Promise<WhatsAppSendResult> {
  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: "fr" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: clientName },
                // The template is approved in French (see above): French grouping.
                { type: "text", text: formatNumber(amountDue, "fr") },
              ],
            },
          ],
        },
      }),
    });

    const data = (await response.json().catch(() => null)) as
      | { error?: { message?: string }; messages?: { id?: string }[] }
      | null;

    if (!response.ok) {
      return { ok: false, error: data?.error?.message || `HTTP ${response.status}` };
    }

    const messageId = data?.messages?.[0]?.id ?? "unknown";
    return { ok: true, messageId };
  } catch (err) {
    // Server log only, never shown to a user.
    return { ok: false, error: err instanceof Error ? err.message : "network_error" };
  }
}

export function hasWhatsAppCredentials(shop: {
  whatsapp_phone_number_id: string | null;
  whatsapp_token_set: boolean;
  whatsapp_template_name: string | null;
}): boolean {
  return Boolean(shop.whatsapp_phone_number_id && shop.whatsapp_token_set && shop.whatsapp_template_name);
}

// Fallback used while a shop has no Cloud API credentials connected: a
// wa.me "click to chat" link opens the staff member's own WhatsApp with the
// message (Reminders.manual_message) already typed. This isn't the Business
// API, so the "approved template" rule doesn't apply — it's the same as a
// person typing the message themselves.
export function buildWhatsAppClickToChatUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
