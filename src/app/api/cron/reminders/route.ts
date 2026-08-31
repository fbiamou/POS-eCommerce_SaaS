import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { hasWhatsAppCredentials, sendWhatsAppTemplateMessage } from "@/features/reminders/whatsapp";

export const runtime = "nodejs";
export const maxDuration = 60;

// Used for shops that haven't connected their own WhatsApp credentials yet
// (Settings > Relances). Per AGENTS.md a template name must never be
// invented, so those shops stay logged as SIMULATED — nothing is sent.
const DRY_RUN_TEMPLATE = "DRY_RUN_NO_APPROVED_TEMPLATE";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  const { data: shops, error: shopsError } = await supabase
    .from("settings")
    .select("shop_id, whatsapp_phone_number_id, whatsapp_api_token, whatsapp_template_name");
  if (shopsError) {
    console.error("[cron/reminders] Failed to list shops:", shopsError);
    return NextResponse.json({ error: shopsError.message }, { status: 500 });
  }

  let shopsProcessed = 0;
  let remindersSent = 0;
  let remindersSimulated = 0;
  let remindersFailed = 0;
  const failures: { shop_id: string; message: string }[] = [];

  for (const shop of shops ?? []) {
    shopsProcessed++;
    const shopHasCredentials = hasWhatsAppCredentials(shop);

    const { data: overdueInvoices, error: rpcError } = await supabase.rpc(
      "get_overdue_invoices_for_reminders",
      { _shop_id: shop.shop_id }
    );

    if (rpcError) {
      failures.push({ shop_id: shop.shop_id, message: rpcError.message });
      continue;
    }

    for (const invoice of overdueInvoices ?? []) {
      const amountDue = invoice.total_amount - invoice.paid_amount;
      let templateName = DRY_RUN_TEMPLATE;
      let status: "SENT" | "FAILED" | "SIMULATED" = "SIMULATED";

      if (shopHasCredentials && invoice.client_phone) {
        templateName = shop.whatsapp_template_name;
        const result = await sendWhatsAppTemplateMessage({
          phoneNumberId: shop.whatsapp_phone_number_id,
          apiToken: shop.whatsapp_api_token,
          templateName,
          to: invoice.client_phone,
          clientName: invoice.client_name,
          amountDue,
        });
        status = result.ok ? "SENT" : "FAILED";
        if (!result.ok) {
          console.error(`[cron/reminders] WhatsApp send failed for shop ${shop.shop_id}:`, result.error);
        }
      } else {
        console.log(
          `[DRY-RUN] Would send WhatsApp reminder to ${invoice.client_phone} ` +
            `for invoice ${invoice.invoice_number ?? invoice.invoice_id} ` +
            `(${amountDue} due, ${invoice.days_overdue} days overdue). ` +
            `Template: ${templateName} (no real Meta template configured for this shop).`
        );
      }

      const { error: logError } = await supabase.rpc("log_reminder", {
        _shop_id: shop.shop_id,
        _client_id: invoice.client_id,
        _invoice_id: invoice.invoice_id,
        _template_name: templateName,
        _status: status,
      });

      if (logError) {
        failures.push({ shop_id: shop.shop_id, message: logError.message });
        continue;
      }

      if (status === "SENT") remindersSent++;
      else if (status === "FAILED") remindersFailed++;
      else remindersSimulated++;
    }
  }

  return NextResponse.json({
    shopsProcessed,
    remindersSent,
    remindersSimulated,
    remindersFailed,
    failures,
  });
}
