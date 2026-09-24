"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useShopFormat } from "@/components/ShopFormatProvider";
import type { FeedbackCode } from "@/lib/feedback";
import { receiveShipment } from "../actions";
import type { ShipmentItem } from "../queries";

// Checking off a parcel: for each declared line, the quantity actually found
// in the box (pre-filled with the declared one). A line that matches no
// existing product becomes a new product: its selling price can be set here.
export function ShipmentReceiveForm({ shipmentId, items }: { shipmentId: string; items: ShipmentItem[] }) {
  const t = useTranslations("Shipments");
  const tFeedback = useTranslations("Feedback");
  const format = useShopFormat();
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [item.id, String(item.declared_quantity)]))
  );
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [error, setError] = useState<FeedbackCode | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const entries = items.map((item) => ({
      item_id: item.id,
      received_quantity: Number(quantities[item.id]),
      selling_price: !item.existing_product && prices[item.id] ? Number(prices[item.id]) : null,
    }));
    if (entries.some((entry) => !Number.isInteger(entry.received_quantity) || entry.received_quantity < 0)) {
      setError("invalid_quantity");
      return;
    }
    if (!confirm(t("confirm_receive"))) return;
    startTransition(async () => {
      const result = await receiveShipment(shipmentId, entries);
      // On success the server action's revalidation re-renders this page
      // (status "Reçu", quantities read-only): nothing else to do here.
      if (result.error) setError(result.error);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-300">{t("receive_instruction")}</p>
      <ul className="flex flex-col divide-y divide-zinc-100 rounded-2xl border border-zinc-100 bg-white dark:divide-white/5 dark:border-[#2d2936] dark:bg-[#1C1A22]">
        {items.map((item) => {
          const received = Number(quantities[item.id]);
          const gap = Number.isInteger(received) ? received - item.declared_quantity : 0;
          return (
            <li key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{item.name}</p>
                <p className="text-xs text-zinc-500">
                  {[
                    item.category_name,
                    item.product_type,
                    item.brand,
                    item.unit_purchase_price > 0 ? t("purchase_price_value", { price: format.money(item.unit_purchase_price) }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className={`mt-1 text-xs font-bold ${item.existing_product ? "text-zinc-500" : "text-violet-700 dark:text-violet-300"}`}>
                  {item.existing_product
                    ? t("existing_product", { stock: item.existing_product.quantity_in_stock })
                    : t("new_product")}
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{t("declared")}</span>
                  <span className="py-2 text-sm font-bold tabular-nums">{item.declared_quantity}</span>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{t("received")}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    required
                    value={quantities[item.id] ?? ""}
                    onChange={(e) => setQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    className="w-24 rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-[#2d2936] dark:bg-[#14121a]"
                  />
                </label>
                {!item.existing_product && (
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                      {t("selling_price", { currency: format.currencySymbol })}
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={prices[item.id] ?? ""}
                      onChange={(e) => setPrices((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder={t("optional")}
                      className="w-32 rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-[#2d2936] dark:bg-[#14121a]"
                    />
                  </label>
                )}
                {gap !== 0 && (
                  <span className={`pb-2 text-xs font-bold ${gap < 0 ? "text-red-600" : "text-amber-700"}`}>
                    {gap > 0 ? `+${gap}` : gap}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {error && <p className="text-sm font-medium text-red-600">{tFeedback(error)}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="self-end rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
      >
        {isPending ? t("saving") : t("validate_reception")}
      </button>
    </form>
  );
}
