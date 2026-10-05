import { getTranslations } from "next-intl/server";
import { SearchX } from "lucide-react";
import { Link } from "@/i18n/routing";

// A page that does not exist. "Back to WISHOP" leads to the dashboard: the
// proxy sends a colleague holding the till on to the till, and a visitor who
// is not signed in to the login page.
export default async function NotFound() {
  const t = await getTranslations("Errors");
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <div className="flex w-full max-w-[420px] flex-col items-start gap-4 rounded-2xl bg-[var(--surface-1)] p-6 shadow-card">
        <SearchX className="h-8 w-8 text-violet-600" />
        <h1 className="font-display text-[24px] font-extrabold tracking-tight">{t("not_found_title")}</h1>
        <p className="text-[15px] text-zinc-500">{t("not_found_body")}</p>
        <Link href="/dashboard" className="rounded-xl bg-violet-600 px-5 py-3 text-[15px] font-bold text-white hover:bg-violet-700">
          {t("back_home")}
        </Link>
      </div>
    </main>
  );
}
