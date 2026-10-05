"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";

// A page that failed on the server: said in the shop's language, with a
// button to try again (Next's own page is in English).
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("Errors");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <div className="flex w-full max-w-[420px] flex-col items-start gap-4 rounded-2xl bg-[var(--surface-1)] p-6 shadow-card">
        <TriangleAlert className="h-8 w-8 text-amber-500" />
        <h1 className="font-display text-[24px] font-extrabold tracking-tight">{t("error_title")}</h1>
        <p className="text-[15px] text-zinc-500">{t("error_body")}</p>
        <button type="button" onClick={reset} className="rounded-xl bg-violet-600 px-5 py-3 text-[15px] font-bold text-white hover:bg-violet-700">
          {t("retry")}
        </button>
        {error.digest && <p className="font-mono text-[12px] text-zinc-400">{error.digest}</p>}
      </div>
    </main>
  );
}
