import { getTranslations } from "next-intl/server";
import { Lock } from "lucide-react";
import { Link } from "@/i18n/routing";
import { FEATURE_PLAN, type Plan, type PlanFeature } from "../plans";

// Shown in place of a page the shop's plan does not include: what it is, the
// plan that includes it, and the way to the plans (the owner) or to ask the
// owner (a team member).
export async function LockedFeature({ feature, currentPlan, isManager }: { feature: PlanFeature; currentPlan: Plan; isManager: boolean }) {
  const t = await getTranslations("Plans");
  const plan = FEATURE_PLAN[feature];
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl bg-[var(--surface-1)] px-6 py-10 text-center shadow-card">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
        <Lock className="h-6 w-6" />
      </span>
      <h1 className="text-xl font-bold">{t(`feature_${feature}`)}</h1>
      <p className="text-[15px] text-zinc-600 dark:text-zinc-300">
        {t("locked_body", { plan: t(`plan_${plan}`), current: t(`plan_${currentPlan}`) })}
      </p>
      {isManager ? (
        <Link href="/settings?tab=formule" className="rounded-xl bg-violet-600 px-5 py-3 text-[14px] font-bold text-white hover:bg-violet-700">
          {t("locked_cta")}
        </Link>
      ) : (
        <p className="text-[14px] text-zinc-500">{t("locked_ask_owner")}</p>
      )}
    </div>
  );
}

// Shown on the till while the shop is read-only.
export async function ReadOnlyNotice({ isManager }: { isManager: boolean }) {
  const t = await getTranslations("Plans");
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl bg-[var(--surface-1)] px-6 py-10 text-center shadow-card">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300">
        <Lock className="h-6 w-6" />
      </span>
      <h1 className="text-xl font-bold">{t("read_only_sales_title")}</h1>
      <p className="text-[15px] text-zinc-600 dark:text-zinc-300">{t("read_only_sales_body")}</p>
      {isManager && (
        <Link href="/settings?tab=formule" className="rounded-xl bg-violet-600 px-5 py-3 text-[14px] font-bold text-white hover:bg-violet-700">
          {t("banner_link")}
        </Link>
      )}
    </div>
  );
}
