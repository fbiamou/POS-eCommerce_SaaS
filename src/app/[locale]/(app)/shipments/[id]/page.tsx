import { notFound } from "next/navigation";
import { lockedFeature } from "@/features/billing/gate";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/routing";
import { getShipmentDetail } from "@/features/shipments/queries";
import { getFormatters } from "@/features/settings/queries";
import { ShipmentReceiveForm } from "@/features/shipments/components/ShipmentReceiveForm";
import { SHIPMENT_STATUS_STYLES } from "@/features/shipments/status";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, shipment] = await Promise.all([getTranslations("Shipments"), getShipmentDetail(id)]);
  return { title: shipment ? `${t("shipment")} ${shipment.reference}` : t("title") };
}

export default async function ShipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const locked = await lockedFeature("shipments");
  if (locked) return locked;
  const { id } = await params;
  const [t, shipment, format] = await Promise.all([getTranslations("Shipments"), getShipmentDetail(id), getFormatters()]);
  if (!shipment) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/shipments" className="flex items-center gap-1 text-sm text-zinc-500 hover:underline">
        <ArrowLeft className="h-4 w-4" /> {t("back")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("shipment")} <span className="font-mono">{shipment.reference}</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {shipment.intermediary_name || t("unknown_intermediary")}
            {shipment.intermediary_phone ? ` · ${shipment.intermediary_phone}` : ""}
            {shipment.purchase_order_reference ? ` · ${shipment.purchase_order_reference}` : ""}
          </p>
          {shipment.declared_at && (
            <p className="text-xs text-zinc-500">{t("declared_on", { date: format.date(shipment.declared_at, "dateTime") })}</p>
          )}
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${SHIPMENT_STATUS_STYLES[shipment.status]}`}>
          {t(`status_${shipment.status}`)}
        </span>
      </div>

      {shipment.photo_url && (
        <figure className="overflow-hidden rounded-2xl border border-zinc-100 bg-white dark:border-[var(--line)] dark:bg-[var(--surface-1)]">
          {/* A signed, short-lived URL to a private bucket: not optimizable by next/image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shipment.photo_url} alt={t("parcel_photo")} className="max-h-96 w-full object-contain" />
          <figcaption className="p-3 text-xs text-zinc-500">{t("parcel_photo")}</figcaption>
        </figure>
      )}

      {shipment.status === "IN_TRANSIT" ? (
        <ShipmentReceiveForm shipmentId={shipment.id} items={shipment.items} />
      ) : shipment.items.length > 0 ? (
        <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-100 bg-white dark:divide-white/5 dark:border-[var(--line)] dark:bg-[var(--surface-1)]">
          {shipment.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <div className="min-w-0">
                <p className="font-bold">{item.name}</p>
                <p className="text-xs text-zinc-500">{[item.category_name, item.product_type, item.brand].filter(Boolean).join(" · ")}</p>
              </div>
              <p className="shrink-0 text-right text-xs tabular-nums text-zinc-600 dark:text-zinc-300">
                {t("declared")} {item.declared_quantity}
                {item.received_quantity !== null && (
                  <>
                    <br />
                    {t("received")} <strong>{item.received_quantity}</strong>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-zinc-100 bg-white p-6 text-sm text-zinc-500 dark:border-[var(--line)] dark:bg-[var(--surface-1)]">
          {t("awaiting_declaration")}
        </p>
      )}
    </div>
  );
}
