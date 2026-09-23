"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { FeedbackCode } from "@/lib/feedback";
import { Link } from "@/i18n/routing";
import { ExternalLink } from "lucide-react";
import { updateShopSlug } from "../actions";

export function ShopSlugField({ initialSlug }: { initialSlug: string | null }) {
  const t = useTranslations("Settings");
  const tFeedback = useTranslations("Feedback");
  const [slug, setSlug] = useState(initialSlug);
  const [inputValue, setInputValue] = useState(initialSlug || "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<FeedbackCode | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await updateShopSlug(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.slug) {
        setSlug(result.slug);
        setInputValue(result.slug);
        setSaved(true);
      }
    });
  };

  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1" htmlFor="shop_slug">
        {t("shop_slug")}
      </label>
      <p className="text-xs text-zinc-400 mb-2">{t("shop_slug_hint")}</p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <div className="flex items-center flex-1 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 overflow-hidden">
          <span className="px-3 py-2 text-sm text-zinc-400 whitespace-nowrap">/boutique/</span>
          <input
            id="shop_slug"
            name="shop_slug"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="ma-boutique"
            className="flex-1 min-w-0 py-2 pr-3 bg-transparent text-sm focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="w-full sm:w-auto px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
        >
          {isPending ? t("saving") : t("save")}
        </button>
      </form>
      {error && <p className="text-xs text-red-600 mt-1">{tFeedback(error)}</p>}
      {saved && !error && <p className="text-xs text-green-600 mt-1">{t("shop_slug_saved")}</p>}
      {slug && (
        <Link
          href={`/boutique/${slug}`}
          target="_blank"
          className="mt-2 inline-flex items-center gap-1 text-xs text-violet-600 hover:underline"
        >
          {t("view_online_shop")} <ExternalLink className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
