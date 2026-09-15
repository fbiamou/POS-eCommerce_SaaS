"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import {
  buildManualReminderMessage,
  buildWhatsAppClickToChatUrl,
  hasWhatsAppCredentials,
  sendWhatsAppTemplateMessage,
} from "./whatsapp";

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

export async function getOverdueInvoices(): Promise<OverdueInvoice[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase.from("profiles").select("shop_id").eq("id", user.id).single();
  if (!profile?.shop_id) return [];

  const { data, error } = await supabase.rpc("get_overdue_invoices_for_reminders", {
    _shop_id: profile.shop_id,
  });

  if (error) {
    console.error("Error fetching overdue invoices:", error);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: row.invoice_id,
    invoice_number: row.invoice_number,
    client_id: row.client_id,
    client_name: row.client_name,
    client_phone: row.client_phone,
    total_amount: row.total_amount,
    paid_amount: row.paid_amount,
    created_at: row.created_at,
    days_overdue: row.days_overdue,
    last_reminder_at: row.last_reminder_at,
    reminder_count: row.reminder_count,
  }));
}

// Used when a shop hasn't connected its own WhatsApp credentials yet — per
// AGENTS.md a template name must never be invented, so reminders stay
// logged as SIMULATED (nothing is sent) until the shop configures its own
// approved template and API credentials in the Reminders settings.
const DRY_RUN_TEMPLATE = "DRY_RUN_NO_APPROVED_TEMPLATE";

export async function sendReminder(invoice: {
  id: string;
  client_id: string;
  client_name: string;
  client_phone: string | null;
  total_amount: number;
  paid_amount: number;
}): Promise<{ success?: true; error?: string; whatsappUrl?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non autorisé." };

  const { data: profile } = await supabase.from("profiles").select("shop_id").eq("id", user.id).single();
  if (!profile?.shop_id) return { error: "Boutique non trouvée." };

  const { data: shopSettings } = await supabase
    .from("settings")
    .select("shop_name, whatsapp_phone_number_id, whatsapp_api_token, whatsapp_template_name")
    .eq("shop_id", profile.shop_id)
    .single();

  const amountDue = invoice.total_amount - invoice.paid_amount;
  let templateName = DRY_RUN_TEMPLATE;
  let status: "SENT" | "FAILED" | "SIMULATED" | "MANUAL" = "SIMULATED";
  let whatsappUrl: string | undefined;

  if (shopSettings && hasWhatsAppCredentials(shopSettings) && invoice.client_phone) {
    // Real Cloud API path — shop has connected its own WhatsApp Business credentials.
    templateName = shopSettings.whatsapp_template_name!;
    const result = await sendWhatsAppTemplateMessage({
      phoneNumberId: shopSettings.whatsapp_phone_number_id!,
      apiToken: shopSettings.whatsapp_api_token!,
      templateName,
      to: invoice.client_phone,
      clientName: invoice.client_name,
      amountDue,
    });
    status = result.ok ? "SENT" : "FAILED";
    if (!result.ok) console.error("WhatsApp send failed:", result.error);
  } else if (invoice.client_phone) {
    // No Cloud API credentials yet — open a pre-filled wa.me link so a staff
    // member sends the message themselves from their own WhatsApp.
    const message = buildManualReminderMessage({
      clientName: invoice.client_name,
      amountDue,
      shopName: shopSettings?.shop_name || "la boutique",
    });
    whatsappUrl = buildWhatsAppClickToChatUrl(invoice.client_phone, message);
    templateName = "MANUAL_CLICK_TO_CHAT";
    status = "MANUAL";
  }

  const { error } = await supabase.rpc("log_reminder", {
    _shop_id: profile.shop_id,
    _client_id: invoice.client_id,
    _invoice_id: invoice.id,
    _template_name: templateName,
    _status: status,
  });

  if (error) {
    console.error("Error logging reminder:", error);
    return { error: "Erreur lors de l'enregistrement de la relance." };
  }

  revalidatePath("/reminders");

  if (status === "FAILED") {
    return { error: "L'envoi WhatsApp a échoué (voir les journaux serveur)." };
  }
  return { success: true, whatsappUrl };
}

export async function updateReminderSettings(
  formData: FormData
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non autorisé." };

  const { data: profile } = await supabase.from("profiles").select("shop_id").eq("id", user.id).single();
  if (!profile?.shop_id) return { error: "Boutique non trouvée." };

  const firstDelay = parseInt((formData.get("reminder_first_delay_days") as string) || "7");
  const recurringDelay = parseInt((formData.get("reminder_recurring_delay_days") as string) || "3");

  if (Number.isNaN(firstDelay) || firstDelay < 0 || Number.isNaN(recurringDelay) || recurringDelay < 0) {
    return { error: "Les délais doivent être des nombres positifs." };
  }

  const { error } = await supabase
    .from("settings")
    .update({
      reminder_first_delay_days: firstDelay,
      reminder_recurring_delay_days: recurringDelay,
    })
    .eq("shop_id", profile.shop_id);

  if (error) {
    console.error("Error updating reminder settings:", error);
    return { error: "Erreur lors de la mise à jour." };
  }

  revalidatePath("/reminders");
  return { success: true };
}
