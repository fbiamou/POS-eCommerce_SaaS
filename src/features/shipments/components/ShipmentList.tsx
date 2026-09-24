"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Copy, PackageCheck } from "lucide-react";
import { useShopFormat } from "@/components/ShopFormatProvider";
import type { FeedbackCode } from "@/lib/feedback";
import { cancelShipment } from "../actions";
import { buildIntakeUrl } from "../matching";
import { SHIPMENT_STATUS_STYLES } from "../status";
import type { ShipmentSummary } from "../queries";

export default function ShipmentList({ shipments }: { shipments: ShipmentSummary[] }) {
  const t = useTranslations("Shipments");
  const tFeedback = useTranslations("Feedback");
  const locale = useLocale();
  const format = useShopFormat();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<FeedbackCode | null>(null);
  const [isPending, startTransition] = useTransition();

  const copyLink = async (shipment: ShipmentSummary) => {
    try {
      await navigator.clipboard.writeText(buildIntakeUrl(window.location.origin, locale, shipment.intake_token));
      setCopiedId(shipment.id);
    } catch {
      setCopiedId(null);
    }
  };

  const cancel = (shipment: ShipmentSummary) => {
    if (!confirm(t("confirm_cancel", { reference: shipment.reference }))) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelShipment(shipment.id);
      if (result.error) setError(result.error);
    });
  };

  if (shipments.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-100 bg-white p-8 text-center text-sm text-zinc-500 dark:border-[var(--line)] dark:bg-[var(--surface-1)]">
        {t("empty")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-red-600">{tFeedback(error)}</p>}
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shipments.map((shipment) => (
          <li
            key={shipment.id}
            className="flex flex-col gap-3 rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm dark:border-[var(--line)] dark:bg-[var(--surface-1)]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-sm font-bold">{shipment.reference}</p>
                <p className="truncate text-xs text-zinc-500">
                  {shipment.intermediary_name || t("unknown_intermediary")}
                  {shipment.purchase_order_reference ? ` · ${shipment.purchase_order_reference}` : ""}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${SHIPMENT_STATUS_STYLES[shipment.status]}`}>
                {t(`status_${shipment.status}`)}
              </span>
            </div>

            <p className="text-xs text-zinc-500">
              {shipment.status === "AWAITING_DECLARATION"
                ? t("created_on", { date: format.date(shipment.created_at) })
                : shipment.status === "RECEIVED" && shipment.received_at
                  ? t("received_summary", {
                      date: format.date(shipment.received_at),
                      received: shipment.received_units ?? 0,
                      declared: shipment.declared_units,
                    })
                  : t("declared_summary", { items: shipment.item_count, units: shipment.declared_units })}
            </p>

            <div className="mt-auto flex flex-wrap gap-2">
              {shipment.status === "AWAITING_DECLARATION" && (
                <button
                  type="button"
                  onClick={() => copyLink(shipment)}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-bold hover:bg-zinc-50 dark:border-[var(--line)] dark:hover:bg-white/5"
                >
                  <Copy className="h-3.5 w-3.5" /> {copiedId === shipment.id ? t("copied") : t("copy_link")}
                </button>
              )}
              {shipment.status === "IN_TRANSIT" && (
                <Link
                  href={`/shipments/${shipment.id}`}
                  className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700"
                >
                  <PackageCheck className="h-3.5 w-3.5" /> {t("check_parcel")}
                </Link>
              )}
              {(shipment.status === "RECEIVED" || shipment.status === "CANCELLED") && (
                <Link
                  href={`/shipments/${shipment.id}`}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-bold hover:bg-zinc-50 dark:border-[var(--line)] dark:hover:bg-white/5"
                >
                  {t("view")}
                </Link>
              )}
              {(shipment.status === "AWAITING_DECLARATION" || shipment.status === "IN_TRANSIT") && (
                <button
                  type="button"
                  onClick={() => cancel(shipment)}
                  disabled={isPending}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  {t("cancel_shipment")}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
