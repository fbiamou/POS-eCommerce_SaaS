"use client";

import { useState, useTransition } from "react";
import { Settings } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useTranslations } from "next-intl";
import { updateReminderSettings } from "../actions";

export function ReminderSettingsButton({
  label,
  firstDelayDays,
  recurringDelayDays,
}: {
  label: string;
  firstDelayDays: number;
  recurringDelayDays: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("Reminders");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await updateReminderSettings(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      alert(t("save_success"));
      setIsOpen(false);
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-bold text-zinc-700 hover:bg-zinc-50 dark:border-[#2d2936] dark:bg-[#1C1A22] dark:text-zinc-300 dark:hover:bg-white/[0.02] transition-colors shadow-sm"
      >
        <Settings className="h-4 w-4" />
        {label}
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={t("settings_title")}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && <p className="text-[13px] font-medium text-red-500">{error}</p>}

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300">{t("delay_label")}</label>
            <input
              required
              name="reminder_first_delay_days"
              type="number"
              min={0}
              defaultValue={firstDelayDays}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[#2d2936] dark:bg-[#1C1A22]"
            />
            <span className="text-[11px] text-zinc-500">{t("delay_hint")}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300">{t("frequency_label")}</label>
            <input
              required
              name="reminder_recurring_delay_days"
              type="number"
              min={0}
              defaultValue={recurringDelayDays}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[#2d2936] dark:bg-[#1C1A22]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="flex cursor-pointer items-center gap-2 text-[13px] font-bold text-zinc-400">
              <input type="checkbox" disabled className="rounded border-zinc-300 dark:border-[#2d2936]" />
              {t("auto_send")}
            </label>
            <span className="ml-6 text-[11px] text-zinc-500">{t("auto_send_hint")}</span>
          </div>

          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-xl px-5 py-2.5 text-[13px] font-bold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-[#2d2936] transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-[13px] font-bold text-white hover:bg-violet-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              {isPending ? t("sending") : t("save")}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
