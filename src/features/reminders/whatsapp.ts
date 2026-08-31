// Sends a WhatsApp Cloud API template message using a shop's own connected
// credentials (per-tenant — never a global env var, since each shop on this
// SaaS has its own WhatsApp Business account).
//
// Assumption to verify once a shop has a real approved template: the
// template is expected to take exactly 2 body variables, in this order —
// (1) client name, (2) amount due — and to be approved in French ("fr").
// This is a working default, not a hard requirement from Meta; adjust if a
// shop's real template differs.
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
                { type: "text", text: amountDue.toLocaleString("fr-FR") },
              ],
            },
          ],
        },
      }),
    });

    const data: any = await response.json().catch(() => null);

    if (!response.ok) {
      return { ok: false, error: data?.error?.message || `HTTP ${response.status}` };
    }

    const messageId = data?.messages?.[0]?.id ?? "unknown";
    return { ok: true, messageId };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Erreur réseau" };
  }
}

export function hasWhatsAppCredentials(shop: {
  whatsapp_phone_number_id: string | null;
  whatsapp_api_token: string | null;
  whatsapp_template_name: string | null;
}): boolean {
  return Boolean(shop.whatsapp_phone_number_id && shop.whatsapp_api_token && shop.whatsapp_template_name);
}
