"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import type { FeedbackCode } from "@/lib/feedback";
import { formatMoney } from "@/lib/format";
import { getWhatsAppCredentials } from "./credentials";
import { buildWhatsAppClickToChatUrl, sendWhatsAppTemplateMessage } from "./whatsapp";

export type OverdueInvoice = {
  id: string;
  invoice_number: string | null;
  client_id: string;
  client_name: string;
  client_phone: string | null;
  total_amount: number;
  paid_amount: number;
  created_at: string;
  days_overdue: number;
  last_reminder_at: string | null;
  reminder_count: number;
};

type OverdueInvoiceRow = Omit<OverdueInvoice, "id"> & { invoice_id: string };

async function getShopId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, shopId: null };
  const { data: profile } = await supabase.from("profiles").select("shop_id").eq("id", user.id).single();
  return { supabase, shopId: (profile?.shop_id as string | undefined) ?? null };
}

export async function getOverdueInvoices(): Promise<OverdueInvoice[]> {
  const { supabase, shopId } = await getShopId();
  if (!shopId) return [];

  const { data, error } = await supabase.rpc("get_overdue_invoices_for_reminders", {
    _shop_id: shopId,
  });

  if (error) {
    console.error("Error fetching overdue invoices:", error);
    return [];
  }

  return ((data ?? []) as OverdueInvoiceRow[]).map(({ invoice_id, ...row }) => ({ id: invoice_id, ...row }));
}

// Used when a shop hasn't connected its own WhatsApp credentials yet — per
// AGENTS.md a template name must never be invented, so reminders stay
// logged as SIMULATED (nothing is sent) until the shop configures its own
// approved template and API credentials in the Reminders settings.
const DRY_RUN_TEMPLATE = "DRY_RUN_NO_APPROVED_TEMPLATE";

// Only the invoice id comes from the browser: the client's name, phone and
// the amount due are re-read from the database, so a crafted call cannot
// make the shop's WhatsApp account message an arbitrary number.
export async function sendReminder(
  invoiceId: string
): Promise<{ success?: true; error?: FeedbackCode; whatsappUrl?: string; amountDue?: number }> {
  const { supabase, shopId } = await getShopId();
  if (!shopId) return { error: "unauthorized" };

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, total_amount, paid_amount, status, client_id, clients(name, phone)")
    .eq("id", invoiceId)
    .single();

  const client = invoice?.clients as unknown as { name: string; phone: string | null } | null;
  if (!invoice || !invoice.client_id || !client) return { error: "invoice_not_found" };
  if (invoice.status === "PAID") return { error: "invoice_already_paid" };

  const [{ data: shop }, credentials, locale] = await Promise.all([
    supabase.from("settings").select("shop_name, currency_symbol").single(),
    getWhatsAppCredentials(shopId),
    getLocale(),
  ]);

  const amountDue = invoice.total_amount - invoice.paid_amount;
  let templateName = DRY_RUN_TEMPLATE;
  let status: "SENT" | "FAILED" | "SIMULATED" | "MANUAL" = "SIMULATED";
  let whatsappUrl: string | undefined;

  if (credentials && client.phone) {
    // Real Cloud API path — shop has connected its own WhatsApp Business credentials.
    templateName = credentials.templateName;
    const result = await sendWhatsAppTemplateMessage({
      phoneNumberId: credentials.phoneNumberId,
      apiToken: credentials.apiToken,
      templateName,
      to: client.phone,
      clientName: client.name,
      amountDue,
    });
    status = result.ok ? "SENT" : "FAILED";
    if (!result.ok) console.error("WhatsApp send failed:", result.error);
  } else if (client.phone) {
    // No Cloud API credentials yet — open a pre-filled wa.me link so a staff
    // member sends the message themselves from their own WhatsApp.
    const t = await getTranslations("Reminders");
    const shopName = shop?.shop_name || t("manual_message_shop_fallback");
    const message = t("manual_message", {
      name: client.name,
      amount: formatMoney(amountDue, shop?.currency_symbol ?? "", locale),
      shop: shopName,
    });
    whatsappUrl = buildWhatsAppClickToChatUrl(client.phone, message);
    templateName = "MANUAL_CLICK_TO_CHAT";
    status = "MANUAL";
  }

  const { error } = await supabase.rpc("log_reminder", {
    _shop_id: shopId,
    _client_id: invoice.client_id,
    _invoice_id: invoice.id,
    _template_name: templateName,
    _status: status,
  });

  if (error) {
    console.error("Error logging reminder:", error);
    return { error: "reminder_failed" };
  }

  revalidatePath("/reminders");

  if (status === "FAILED") return { error: "reminder_failed" };
  return { success: true, whatsappUrl, amountDue };
}

export async function updateReminderSettings(
  formData: FormData
): Promise<{ success?: true; error?: FeedbackCode }> {
  const { supabase, shopId } = await getShopId();
  if (!shopId) return { error: "unauthorized" };

  const firstDelay = parseInt((formData.get("reminder_first_delay_days") as string) || "7", 10);
  const recurringDelay = parseInt((formData.get("reminder_recurring_delay_days") as string) || "3", 10);

  if (Number.isNaN(firstDelay) || firstDelay < 0 || Number.isNaN(recurringDelay) || recurringDelay < 0) {
    return { error: "delays_invalid" };
  }

  // Settings are writable by the Propriétaire only (RLS): for anyone else the
  // update matches no row, which is reported instead of a silent success.
  const { data, error } = await supabase
    .from("settings")
    .update({
      reminder_first_delay_days: firstDelay,
      reminder_recurring_delay_days: recurringDelay,
    })
    .eq("shop_id", shopId)
    .select("shop_id");

  if (error) {
    console.error("Error updating reminder settings:", error);
    return { error: "update_failed" };
  }
  if (!data || data.length === 0) return { error: "access_denied" };

  revalidatePath("/reminders");
  return { success: true };
}
