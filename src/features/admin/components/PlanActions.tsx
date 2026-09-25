"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Gift, Wallet } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useShopFormat } from "@/components/ShopFormatProvider";
import type { FeedbackCode } from "@/lib/feedback";
import {
  PAID_PLANS,
  PAYMENT_METHODS,
  nextPaidUntil,
  suggestedAmount,
  type PaidPlan,
  type SubscriptionState,
} from "@/features/billing/plans";
import { extendPlan, setStandard } from "../actions";

const MONTH_CHOICES = ["1", "2", "3", "6", "12"];

const inputClass =
  "w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[15px] outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)] dark:bg-[var(--surface-0)]";

// Give free months, or record a payment received by Muni Dinero, transfer or
// cash (no payment aggregator yet). The end date is previewed before saving.
export function PlanActions({ shopId, current }: { shopId: string; current: SubscriptionState | null }) {
  const t = useTranslations("Admin");
  const tFeedback = useTranslations("Feedback");
  const format = useShopFormat();
  const showToast = useToast((state) => state.show);
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"grant" | "payment">("grant");
  const [plan, setPlan] = useState<PaidPlan>("PRO_PLUS");
  const [months, setMonths] = useState("1");
  const [amount, setAmount] = useState(String(suggestedAmount("PRO_PLUS", 1)));
  const [method, setMethod] = useState<string>("MUNI_DINERO");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmStandard, setConfirmStandard] = useState(false);
  const [error, setError] = useState<FeedbackCode | null>(null);

  const monthCount = Number(months);
  const until = nextPaidUntil(current, plan, monthCount, new Date());
  const planOptions = PAID_PLANS.map((value) => ({ value, label: t(`plan_${value}`) }));

  const choosePlan = (value: string) => {
    setPlan(value as PaidPlan);
    setAmount(String(suggestedAmount(value as PaidPlan, monthCount)));
  };
  const chooseMonths = (value: string) => {
    setMonths(value);
    setAmount(String(suggestedAmount(plan, Number(value))));
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await extendPlan({
        shopId,
        plan,
        months: monthCount,
        amount: mode === "payment" ? Number(amount) : null,
        method: mode === "payment" ? method : null,
        note,
      });
      setConfirming(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      setNote("");
      showToast(t("plan_saved", { plan: t(`plan_${plan}`), date: format.date(until.toISOString(), "long") }));
    });
  };

  const backToStandard = () => {
    setError(null);
    startTransition(async () => {
      const result = await setStandard(shopId, note);
      setConfirmStandard(false);
      if (result.error) setError(result.error);
      else showToast(t("standard_saved"));
    });
  };

  const tabClass = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[13px] font-bold transition-colors ${
      active ? "bg-white text-zinc-900 shadow-sm dark:bg-[var(--surface-1)] dark:text-white" : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400"
    }`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-2xl bg-zinc-100 p-1 dark:bg-white/5">
        <button type="button" onClick={() => setMode("grant")} className={tabClass(mode === "grant")}>
          <Gift className="h-4 w-4" /> {t("mode_grant")}
        </button>
        <button type="button" onClick={() => setMode("payment")} className={tabClass(mode === "payment")}>
          <Wallet className="h-4 w-4" /> {t("mode_payment")}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">
          {t("field_plan")}
          <Select options={planOptions} value={plan} onChange={choosePlan} ariaLabel={t("field_plan")} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">
          {t("field_months")}
          <Select
            options={MONTH_CHOICES.map((value) => ({ value, label: t("months_count", { count: Number(value) }) }))}
            value={months}
            onChange={chooseMonths}
            ariaLabel={t("field_months")}
          />
        </label>
        {mode === "payment" && (
          <>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">
              {t("field_amount")}
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inputClass}
              />
              <span className="text-[12px] font-normal text-zinc-500">{t("amount_hint")}</span>
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">
              {t("field_method")}
              <Select
                options={PAYMENT_METHODS.map((value) => ({ value, label: t(`method_${value}`) }))}
                value={method}
                onChange={setMethod}
                ariaLabel={t("field_method")}
              />
            </label>
          </>
        )}
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-zinc-700 dark:text-zinc-300 sm:col-span-2">
          {t("field_note")}
          <input type="text" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("note_placeholder")} className={inputClass} />
        </label>
      </div>

      <p className="rounded-xl bg-violet-50 px-4 py-3 text-[14px] text-violet-900 dark:bg-violet-900/20 dark:text-violet-200">
        {t("preview", { plan: t(`plan_${plan}`), date: format.date(until.toISOString(), "long") })}
      </p>

      {error && <p role="alert" className="text-[14px] font-semibold text-red-600">{tFeedback(error)}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={isPending || (mode === "payment" && amount.trim() === "")}
          className="rounded-xl bg-violet-600 px-5 py-3 text-[14px] font-bold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {mode === "grant" ? t("grant_button") : t("payment_button")}
        </button>
        {current && current.plan !== "STANDARD" && (
          <button
            type="button"
            onClick={() => setConfirmStandard(true)}
            disabled={isPending}
            className="rounded-xl px-4 py-3 text-[14px] font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5"
          >
            {t("back_to_standard")}
          </button>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirming}
        title={mode === "grant" ? t("grant_button") : t("payment_button")}
        confirmLabel={t("confirm")}
        pending={isPending}
        onConfirm={save}
        onCancel={() => setConfirming(false)}
      >
        {mode === "grant"
          ? t("confirm_grant", { count: monthCount, plan: t(`plan_${plan}`), date: format.date(until.toISOString(), "long") })
          : t("confirm_payment", {
              amount: format.money(Number(amount) || 0),
              method: t(`method_${method}`),
              plan: t(`plan_${plan}`),
              date: format.date(until.toISOString(), "long"),
            })}
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={confirmStandard}
        title={t("back_to_standard")}
        confirmLabel={t("back_to_standard")}
        tone="danger"
        pending={isPending}
        onConfirm={backToStandard}
        onCancel={() => setConfirmStandard(false)}
      >
        {t("confirm_standard")}
      </ConfirmDialog>
    </div>
  );
}
