"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import type { FeedbackCode } from "@/lib/feedback";
import { chooseStandardPlan } from "../actions";

export function ChooseStandard() {
  const t = useTranslations("Plans");
  const tFeedback = useTranslations("Feedback");
  const showToast = useToast((state) => state.show);
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<FeedbackCode | null>(null);

  const apply = () => {
    setError(null);
    startTransition(async () => {
      const result = await chooseStandardPlan();
      setConfirming(false);
      if (result.error) setError(result.error);
      else showToast(t("back_to_standard_done"));
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={isPending}
        className="self-start rounded-xl px-4 py-2.5 text-[14px] font-semibold text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-50 dark:text-zinc-200 dark:ring-[var(--line)] dark:hover:bg-white/5"
      >
        {t("back_to_standard")}
      </button>
      {error && <p role="alert" className="text-[14px] font-semibold text-red-600">{tFeedback(error)}</p>}
      <ConfirmDialog
        isOpen={confirming}
        title={t("back_to_standard")}
        confirmLabel={t("back_to_standard")}
        pending={isPending}
        onConfirm={apply}
        onCancel={() => setConfirming(false)}
      >
        {t("back_to_standard_confirm")}
      </ConfirmDialog>
    </div>
  );
}
