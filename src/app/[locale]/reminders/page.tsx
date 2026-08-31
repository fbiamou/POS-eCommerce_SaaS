import ReminderList from "@/features/reminders/components/ReminderList";
import { ReminderSettingsButton } from "@/features/reminders/components/ReminderSettingsButton";
import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { getOverdueInvoices } from "@/features/reminders/actions";
import { getShopSettings } from "@/features/settings/actions";
import { hasWhatsAppCredentials } from "@/features/reminders/whatsapp";

export default async function RemindersPage() {
  const [t, invoices, shopSettings] = await Promise.all([
    getTranslations("Reminders"),
    getOverdueInvoices(),
    getShopSettings(),
  ]);

  const isLive = Boolean(shopSettings && hasWhatsAppCredentials(shopSettings));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <ReminderSettingsButton
          label={t("settings")}
          firstDelayDays={shopSettings?.reminder_first_delay_days ?? 7}
          recurringDelayDays={shopSettings?.reminder_recurring_delay_days ?? 3}
        />
      </div>

      <div
        className={`rounded-lg border p-4 text-sm ${
          isLive
            ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-300"
            : "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900/50 dark:bg-orange-900/20 dark:text-orange-300"
        }`}
      >
        <p className="font-semibold">{t("config_info")}</p>
        <ul className="mt-1 ml-4 list-disc space-y-1">
          <li>
            <strong>
              {t("delay_first_dynamic", { days: shopSettings?.reminder_first_delay_days ?? 7 })}
            </strong>
          </li>
          <li>
            <strong>
              {t("frequency_dynamic", { days: shopSettings?.reminder_recurring_delay_days ?? 3 })}
            </strong>
          </li>
          <li>
            <strong>{isLive ? t("mode_live") : t("mode")}</strong>
            {!isLive && (
              <>
                {" — "}
                <Link href="/settings" className="underline">
                  {t("configure_whatsapp_link")}
                </Link>
              </>
            )}
          </li>
        </ul>
      </div>

      <ReminderList invoices={invoices} />
    </div>
  );
}
