"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import type { FeedbackCode } from "@/lib/feedback";
import { setSuspended } from "../actions";

// Suspending a shop (illegal content, fraud...) closes its app and hides its
// storefront; reactivating gives everything back as it was.
export function SuspendShop({ shopId, suspended }: { shopId: string; suspended: boolean }) {
  const t = useTranslations("Admin");
  const tFeedback = useTranslations("Feedback");
  const showToast = useToast((state) => state.show);
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<FeedbackCode | null>(null);

  const apply = () => {
    setError(null);
    startTransition(async () => {
      const result = await setSuspended(shopId, !suspended, reason);
      setConfirming(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      setReason("");
      showToast(suspended ? t("resumed") : t("suspended"));
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {!suspended && (
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">
          {t("suspension_reason")}
          <textarea
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("suspension_reason_placeholder")}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[15px] outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)] dark:bg-[var(--surface-0)]"
          />
        </label>
      )}
      {error && <p role="alert" className="text-[14px] font-semibold text-red-600">{tFeedback(error)}</p>}
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={isPending}
        className={`self-start rounded-xl px-5 py-3 text-[14px] font-bold disabled:opacity-50 ${
          suspended ? "bg-violet-600 text-white hover:bg-violet-700" : "text-red-600 ring-1 ring-red-200 hover:bg-red-50 dark:ring-red-900/50 dark:hover:bg-red-900/20"
        }`}
      >
        {suspended ? t("resume_button") : t("suspend_button")}
      </button>

      <ConfirmDialog
        isOpen={confirming}
        title={suspended ? t("resume_button") : t("suspend_button")}
        confirmLabel={suspended ? t("resume_button") : t("suspend_button")}
        tone={suspended ? "primary" : "danger"}
        pending={isPending}
        onConfirm={apply}
        onCancel={() => setConfirming(false)}
      >
        {suspended ? t("confirm_resume") : t("confirm_suspend")}
      </ConfirmDialog>
    </div>
  );
}
