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
        className="flex items-center gap-2 rounded-md border bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      >
        <Settings className="h-4 w-4" />
        {label}
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={t("settings_title")}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <p className="text-sm font-medium text-red-500">{error}</p>}

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t("delay_label")}</label>
            <input
              required
              name="reminder_first_delay_days"
              type="number"
              min={0}
              defaultValue={firstDelayDays}
              className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
            <span className="text-xs text-zinc-500">{t("delay_hint")}</span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t("frequency_label")}</label>
            <input
              required
              name="reminder_recurring_delay_days"
              type="number"
              min={0}
              defaultValue={recurringDelayDays}
              className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-400">
              <input type="checkbox" disabled className="rounded border-zinc-300" />
              {t("auto_send")}
            </label>
            <span className="ml-6 text-xs text-zinc-500">{t("auto_send_hint")}</span>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {isPending ? t("sending") : t("save")}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
