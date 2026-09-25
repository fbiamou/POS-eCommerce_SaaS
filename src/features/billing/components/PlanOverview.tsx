import { getTranslations } from "next-intl/server";
import { Check, MessageCircle } from "lucide-react";
import { getFormatters } from "@/features/settings/queries";
import { WISHOP_PAYMENT_WHATSAPP, wishopWhatsAppUrl } from "@/lib/wishopContact";
import { PLAN_LIMITS, PLAN_PRICES, PLANS, type Plan, type ShopAccess } from "../plans";
import { ChooseStandard } from "./ChooseStandard";

// The same bullets as the public pricing grid (public/landing, "p.*" keys).
const PLAN_POINTS: Record<Plan, string[]> = {
  STANDARD: ["s2", "s3"],
  ESSENTIEL: ["e0", "e2", "e3", "e4"],
  PRO: ["p0", "p2", "p3", "p4", "p6", "p5"],
  PRO_PLUS: ["x0", "x2", "x3", "x4", "x5"],
};

// "Ma formule": where the shop stands, what it uses, and the four plans side
// by side. Choosing a paid plan opens a WhatsApp message to WISHOP (payment by
// Muni Dinero, transfer or cash, then activation in the admin console).
export async function PlanOverview({
  access,
  shopName,
  usage,
}: {
  access: ShopAccess;
  shopName: string;
  usage: { items: number; accounts: number };
}) {
  const [t, format] = await Promise.all([getTranslations("Plans"), getFormatters()]);
  const current = access.plan;
  const limits = PLAN_LIMITS[current];
  const statusValues = {
    date: access.paidUntil ? format.date(access.paidUntil, "long") : "",
    since: access.readOnlySince ? format.date(access.readOnlySince) : "",
  };
  const status =
    current === "STANDARD" ? t("status_standard") : t(`status_${access.mode}`, statusValues);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl bg-[var(--surface-1)] p-5 shadow-card sm:p-6">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-zinc-500">{t("current")}</p>
        <p className="mt-1 text-2xl font-bold">{t(`plan_${current}`)}</p>
        <p className={`mt-1 text-[14px] ${access.mode === "read_only" ? "font-semibold text-red-700 dark:text-red-400" : "text-zinc-600 dark:text-zinc-300"}`}>{status}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-[14px]">
          <div>
            <dt className="text-[12px] font-semibold text-zinc-500">{t("usage_items_label")}</dt>
            <dd className="font-mono tabular-nums">
              {limits.items === null ? t("usage_unlimited", { count: usage.items }) : t("usage_of", { count: usage.items, limit: limits.items })}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] font-semibold text-zinc-500">{t("usage_accounts_label")}</dt>
            <dd className="font-mono tabular-nums">
              {limits.accounts === null
                ? t("usage_unlimited", { count: usage.accounts })
                : t("usage_of", { count: usage.accounts, limit: limits.accounts })}
            </dd>
          </div>
        </dl>
        {access.mode === "read_only" && (
          <div className="mt-4">
            <ChooseStandard />
          </div>
        )}
      </section>

      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => {
          const isCurrent = plan === current;
          const planLimits = PLAN_LIMITS[plan];
          return (
            <li
              key={plan}
              className={`flex flex-col gap-3 rounded-2xl bg-[var(--surface-1)] p-5 shadow-card ${isCurrent ? "ring-2 ring-violet-600" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-lg font-bold">{t(`plan_${plan}`)}</p>
                {isCurrent && (
                  <span className="rounded-full bg-violet-600 px-2.5 py-0.5 text-[11px] font-bold text-white">{t("current_badge")}</span>
                )}
              </div>
              {plan === "STANDARD" ? (
                <p className="font-mono text-xl font-semibold">{t("free")}</p>
              ) : (
                <div>
                  <p className="font-mono text-xl font-semibold tabular-nums">
                    {format.money(PLAN_PRICES[plan].launch)}
                    <span className="font-sans text-[13px] font-normal text-zinc-500"> {t("per_month")}</span>
                  </p>
                  <p className="text-[12px] text-zinc-500">{t("launch_then", { price: format.money(PLAN_PRICES[plan].normal) })}</p>
                </div>
              )}
              <ul className="flex flex-1 flex-col gap-1.5 text-[13.5px]">
                <li className="flex gap-2 font-semibold">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                  {planLimits.accounts === null
                    ? t("limits_unlimited")
                    : t("limits", { accounts: planLimits.accounts, items: planLimits.items ?? 0 })}
                </li>
                {PLAN_POINTS[plan].map((point) => (
                  <li key={point} className={`flex gap-2 ${point.endsWith("0") ? "font-semibold text-zinc-500" : ""}`}>
                    {!point.endsWith("0") && <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />}
                    {t(`point_${point}`)}
                  </li>
                ))}
              </ul>
              {plan !== "STANDARD" && (
                <a
                  href={wishopWhatsAppUrl(t("whatsapp_message", { shop: shopName, plan: t(`plan_${plan}`) }))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-bold ${
                    isCurrent
                      ? "text-violet-700 ring-1 ring-violet-300 hover:bg-violet-50 dark:text-violet-300 dark:ring-violet-800"
                      : "bg-violet-600 text-white hover:bg-violet-700"
                  }`}
                >
                  <MessageCircle className="h-4 w-4" />
                  {isCurrent ? t("renew") : t("choose", { plan: t(`plan_${plan}`) })}
                </a>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-[13px] text-zinc-500">
        {t("how_to_pay", { phone: WISHOP_PAYMENT_WHATSAPP })} {t("launch_kept")}
      </p>
    </div>
  );
}
