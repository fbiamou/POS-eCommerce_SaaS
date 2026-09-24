"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Banknote } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useShopFormat } from "@/components/ShopFormatProvider";
import type { FeedbackCode } from "@/lib/feedback";
import { recordPayment } from "../payments";

export function RecordPaymentButton({ invoiceId, remaining }: { invoiceId: string; remaining: number }) {
  const t = useTranslations("Invoices");
  const tFeedback = useTranslations("Feedback");
  const format = useShopFormat();
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState(String(remaining));
  const [error, setError] = useState<FeedbackCode | null>(null);
  const [isPending, startTransition] = useTransition();

  const value = parseInt(amount, 10) || 0;

  const open = () => {
    setAmount(String(remaining));
    setError(null);
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await recordPayment(invoiceId, value);
      if (result.error) {
        setError(result.error);
        return;
      }
      setIsOpen(false);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-[15px] font-bold text-white transition-colors hover:bg-emerald-800 sm:w-auto"
      >
        <Banknote className="h-4 w-4" /> {t("record_payment")}
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={t("record_payment")}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {t("remaining_due")} : <span className="font-bold tabular-nums">{format.money(remaining)}</span>
          </p>
          <div className="flex flex-col gap-1">
            <label htmlFor="payment_amount" className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">
              {t("payment_amount", { currency: format.currencySymbol })}
            </label>
            <input
              id="payment_amount"
              type="number"
              inputMode="numeric"
              min={1}
              max={remaining}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-[var(--surface-1)] px-4 py-3 font-mono text-[16px] focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)]"
            />
            {value > 0 && value < remaining && (
              <p className="text-xs text-zinc-500">{t("remaining_after", { amount: format.money(remaining - value) })}</p>
            )}
          </div>
          {error && <p className="text-sm font-medium text-red-600">{tFeedback(error)}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsOpen(false)} className="rounded-xl px-4 py-2.5 text-[14px] font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300">
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={isPending || value <= 0 || value > remaining}
              className="rounded-xl bg-emerald-700 px-5 py-2.5 text-[14px] font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {isPending ? t("saving") : t("confirm_payment")}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
