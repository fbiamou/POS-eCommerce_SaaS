import "server-only";

import { cache } from "react";
import { getLocale } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { DEFAULT_TIME_ZONE, formatDate, formatMoney } from "@/lib/format";

// Every column a shop member may read. The WhatsApp API token is deliberately
// absent: only server code sending a message reads it, with the service role
// (see features/reminders/credentials.ts). `whatsapp_token_set` says whether
// one is configured without exposing it.
const SETTINGS_COLUMNS = [
  "id",
  "shop_id",
  "shop_name",
  "shop_phone",
  "shop_address",
  "shop_email",
  "shop_logo_url",
  "currency_code",
  "currency_symbol",
  "theme_accent_color",
  "theme_font",
  "reminder_first_delay_days",
  "reminder_recurring_delay_days",
  "tax_id",
  "trade_register",
  "vat_registered",
  "vat_rate_bps",
  "whatsapp_phone_number_id",
  "whatsapp_template_name",
  "whatsapp_token_set",
  "shop_slug",
  "default_phone_country_code",
  "low_stock_threshold",
  "timezone",
].join(", ");

export type ShopSettings = {
  id: string;
  shop_id: string;
  shop_name: string | null;
  shop_phone: string | null;
  shop_address: string | null;
  shop_email: string | null;
  shop_logo_url: string | null;
  currency_code: string;
  currency_symbol: string;
  theme_accent_color: string;
  theme_font: string;
  reminder_first_delay_days: number;
  reminder_recurring_delay_days: number;
  tax_id: string | null;
  trade_register: string | null;
  vat_registered: boolean;
  vat_rate_bps: number;
  whatsapp_phone_number_id: string | null;
  whatsapp_template_name: string | null;
  whatsapp_token_set: boolean;
  shop_slug: string | null;
  default_phone_country_code: string;
  low_stock_threshold: number;
  timezone: string;
};

// Cached for the duration of one request: the layout and the page both need
// the settings, and should not query them twice.
export const getShopSettings = cache(async (): Promise<ShopSettings | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.from("settings").select(SETTINGS_COLUMNS).single();

  if (error) {
    console.error("Error fetching settings:", error);
    return null;
  }

  return data as unknown as ShopSettings;
});

export type ShopFormat = {
  locale: string;
  currencySymbol: string;
  timeZone: string;
  lowStockThreshold: number;
};

export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

export async function getShopFormat(): Promise<ShopFormat> {
  const [locale, settings] = await Promise.all([getLocale(), getShopSettings()]);
  return {
    locale,
    currencySymbol: settings?.currency_symbol ?? "",
    timeZone: settings?.timezone ?? DEFAULT_TIME_ZONE,
    lowStockThreshold: settings?.low_stock_threshold ?? DEFAULT_LOW_STOCK_THRESHOLD,
  };
}

// Server-component counterpart of useShopFormat().
export async function getFormatters() {
  const format = await getShopFormat();
  return {
    ...format,
    money: (amount: number) => formatMoney(amount, format.currencySymbol, format.locale),
    date: (iso: string | Date, style?: Parameters<typeof formatDate>[3]) =>
      formatDate(iso, format.locale, format.timeZone, style),
    isLowStock: (quantity: number) => quantity <= format.lowStockThreshold,
  };
}
