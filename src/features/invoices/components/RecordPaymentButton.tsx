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
        className="flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 transition-colors"
      >
        <Banknote className="h-4 w-4" /> {t("record_payment")}
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={t("record_payment")}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {t("remaining_due")} : <span className="font-bold tabular-nums">{format.money(remaining)}</span>
          </p>
          <div className="flex flex-col gap-1">
            <label htmlFor="payment_amount" className="text-sm font-medium">
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
              className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
            {value > 0 && value < remaining && (
              <p className="text-xs text-zinc-500">{t("remaining_after", { amount: format.money(remaining - value) })}</p>
            )}
          </div>
          {error && <p className="text-sm font-medium text-red-600">{tFeedback(error)}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsOpen(false)} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800">
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={isPending || value <= 0 || value > remaining}
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {isPending ? t("saving") : t("confirm_payment")}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
