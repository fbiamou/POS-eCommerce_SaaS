import { getTranslations } from "next-intl/server";
import { PauseCircle } from "lucide-react";
import { WishopMark } from "@/components/brand/WishopMark";
import { PausedLogout } from "@/features/billing/components/PausedLogout";

export async function generateMetadata() {
  const t = await getTranslations("Plans");
  return { title: t("paused_title") };
}

// Where a team account lands when the shop's plan has fewer accounts than
// its team (supabase: current_member_paused). Access comes back on its own
// once the owner moves to a plan that includes this account.
export default async function PausedPage() {
  const t = await getTranslations("Plans");
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl bg-[var(--surface-1)] px-6 py-10 text-center shadow-card">
        <WishopMark className="h-7 w-auto text-violet-700" />
        <PauseCircle className="h-12 w-12 text-amber-600" />
        <h1 className="text-xl font-bold">{t("paused_title")}</h1>
        <p className="text-[15px] text-zinc-600 dark:text-zinc-300">{t("paused_body")}</p>
        <PausedLogout label={t("paused_logout")} />
      </div>
    </main>
  );
}
