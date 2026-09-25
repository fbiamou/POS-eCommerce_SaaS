import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getFormatters } from "@/features/settings/queries";
import type { ShopAccess } from "../plans";

// A line at the top of every page when the plan is about to end, has ended
// (grace period) or has turned the shop read-only.
export async function PlanBanner({ access, isManager }: { access: ShopAccess; isManager: boolean }) {
  if (access.mode === "active" || !access.paidUntil) return null;
  const [t, format] = await Promise.all([getTranslations("Plans"), getFormatters()]);
  const values = {
    plan: t(`plan_${access.plan}`),
    date: format.date(access.paidUntil),
    since: access.readOnlySince ? format.date(access.readOnlySince) : "",
  };
  const tone =
    access.mode === "read_only"
      ? "bg-red-50 text-red-900 ring-red-200 dark:bg-red-900/20 dark:text-red-200 dark:ring-red-900/40"
      : "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:ring-amber-900/40";

  return (
    <div role="status" className={`mb-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3 text-[14px] ring-1 ${tone}`}>
      <p className="min-w-0 flex-1">{t(`banner_${access.mode}`, values)}</p>
      {isManager && (
        <Link href="/settings?tab=formule" className="shrink-0 font-bold underline underline-offset-2">
          {t("banner_link")}
        </Link>
      )}
    </div>
  );
}
