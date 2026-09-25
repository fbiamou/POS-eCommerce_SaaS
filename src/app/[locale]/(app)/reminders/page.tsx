import ReminderList from "@/features/reminders/components/ReminderList";
import { ReminderSettingsButton } from "@/features/reminders/components/ReminderSettingsButton";
import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { getOverdueInvoices } from "@/features/reminders/actions";
import { getFormatters, getShopSettings } from "@/features/settings/queries";
import { hasWhatsAppCredentials } from "@/features/reminders/whatsapp";

export async function generateMetadata() {
  const t = await getTranslations("Reminders");
  return { title: t("title") };
}

export default async function RemindersPage() {
  const [t, invoices, shopSettings, format] = await Promise.all([
    getTranslations("Reminders"),
    getOverdueInvoices(),
    getShopSettings(),
    getFormatters(),
  ]);

  const isLive = Boolean(shopSettings && hasWhatsAppCredentials(shopSettings));
  const firstDelay = shopSettings?.reminder_first_delay_days ?? 7;
  const recurringDelay = shopSettings?.reminder_recurring_delay_days ?? 3;
  const overdueTotal = invoices.reduce((sum, invoice) => sum + Math.max(invoice.total_amount - invoice.paid_amount, 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("title")}</h1>
          <p className="mt-1 text-[14px] text-zinc-500">{t("intro")}</p>
        </div>
        <ReminderSettingsButton
          label={t("settings")}
          shortLabel={t("settings_short")}
          firstDelayDays={firstDelay}
          recurringDelayDays={recurringDelay}
        />
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="rounded-2xl bg-[var(--surface-1)] p-4 shadow-card">
          <dt className="text-[12px] font-semibold text-zinc-500">{t("to_remind")}</dt>
          <dd className="mt-1 font-mono text-xl font-semibold tabular-nums">{invoices.length}</dd>
        </div>
        <div className="rounded-2xl bg-[var(--surface-1)] p-4 shadow-card">
          <dt className="text-[12px] font-semibold text-zinc-500">{t("overdue_total")}</dt>
          <dd className={`mt-1 font-mono text-xl font-semibold tabular-nums ${overdueTotal > 0 ? "text-red-700 dark:text-red-400" : ""}`}>
            {format.money(overdueTotal)}
          </dd>
        </div>
        <div className="col-span-2 rounded-2xl bg-[var(--surface-1)] p-4 shadow-card lg:col-span-1">
          <dt className="flex items-center gap-2 text-[12px] font-semibold text-zinc-500">
            <span className={`h-2 w-2 rounded-full ${isLive ? "bg-emerald-500" : "bg-amber-500"}`} aria-hidden="true" />
            {isLive ? t("mode_live_short") : t("mode_manual_short")}
          </dt>
          <dd className="mt-1 text-[13px] text-zinc-600 dark:text-zinc-300">
            {t("rhythm", { first: firstDelay, every: recurringDelay })}{" "}
            {isLive ? t("mode_live_hint") : t("mode_manual_hint")}
            {!isLive && (
              <>
                {" "}
                <Link href="/settings" className="font-semibold text-violet-700 underline underline-offset-2 dark:text-violet-300">
                  {t("configure_whatsapp_link")}
                </Link>
              </>
            )}
          </dd>
        </div>
      </dl>

      <ReminderList invoices={invoices} />
    </div>
  );
}
