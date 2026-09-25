import { getTranslations } from "next-intl/server";
import { ShieldAlert } from "lucide-react";

// What a suspended shop sees instead of its pages (the menus stay, so its
// members can still sign out). Its storefront is hidden at the same time.
export async function ShopSuspended({ reason }: { reason: string | null }) {
  const t = await getTranslations("Suspension");
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl bg-[var(--surface-1)] px-6 py-10 text-center shadow-card">
      <ShieldAlert className="h-12 w-12 text-red-600" />
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <p className="text-[15px] text-zinc-600 dark:text-zinc-300">{t("body")}</p>
      {reason && <p className="rounded-xl bg-zinc-100 px-4 py-3 text-[14px] text-zinc-700 dark:bg-white/5 dark:text-zinc-300">{t("reason", { reason })}</p>}
    </div>
  );
}
