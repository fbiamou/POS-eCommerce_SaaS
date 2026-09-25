"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import type { FeedbackCode } from "@/lib/feedback";
import { deleteShop } from "../actions";

// Permanent deletion of a test or fictitious shop: the button only unlocks
// once the shop's name is typed, then asks one last time.
export function DeleteShop({ shopId, shopName, memberCount }: { shopId: string; shopName: string; memberCount: number }) {
  const t = useTranslations("Admin");
  const tFeedback = useTranslations("Feedback");
  const showToast = useToast((state) => state.show);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [typed, setTyped] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<FeedbackCode | null>(null);
  const matches = typed.trim().toLocaleLowerCase() === shopName.trim().toLocaleLowerCase();

  const remove = () => {
    setError(null);
    startTransition(async () => {
      const result = await deleteShop(shopId, typed);
      setConfirming(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      showToast(t("deleted"));
      router.replace("/admin");
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">
        {t("delete_type_name", { name: shopName })}
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[15px] outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 dark:border-[var(--line)] dark:bg-[var(--surface-0)] sm:max-w-sm"
        />
      </label>
      {error && <p role="alert" className="text-[14px] font-semibold text-red-600">{tFeedback(error)}</p>}
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={!matches || isPending}
        className="inline-flex items-center gap-2 self-start rounded-xl bg-red-600 px-5 py-3 text-[14px] font-bold text-white hover:bg-red-700 disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" /> {t("delete_button")}
      </button>

      <ConfirmDialog
        isOpen={confirming}
        title={t("delete_confirm_title", { name: shopName })}
        confirmLabel={t("delete_button")}
        tone="danger"
        pending={isPending}
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      >
        {t("delete_confirm_body", { count: memberCount })}
      </ConfirmDialog>
    </div>
  );
}
