import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/routing";
import { getPurchaseOrderDetail } from "@/features/purchase-orders/queries";
import { PurchaseOrderEditor } from "@/features/purchase-orders/components/PurchaseOrderEditor";
import { PURCHASE_ORDER_STATUS_STYLES } from "@/features/purchase-orders/status";
import { NewShipmentLinkButton } from "@/features/shipments/components/NewShipmentLinkButton";
import { getFormatters, getShopSettings } from "@/features/settings/queries";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, order] = await Promise.all([getTranslations("PurchaseOrders"), getPurchaseOrderDetail(id)]);
  return { title: order ? `${t("order")} ${order.reference}` : t("title") };
}

export default async function PurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, tShipments, order, format, settings] = await Promise.all([
    getTranslations("PurchaseOrders"),
    getTranslations("Shipments"),
    getPurchaseOrderDetail(id),
    getFormatters(),
    getShopSettings(),
  ]);
  if (!order) notFound();

  const canAttachShipment = order.status === "DRAFT" || order.status === "SENT";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/purchase-orders" className="flex items-center gap-1 text-sm text-zinc-500 hover:underline">
        <ArrowLeft className="h-4 w-4" /> {t("back")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("order")} <span className="font-mono">{order.reference}</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {order.supplier_name || t("no_supplier")}
            {order.supplier_phone ? ` · ${order.supplier_phone}` : ""}
          </p>
          <p className="text-xs text-zinc-500">
            {t("created_on", { date: format.date(order.created_at) })}
            {order.sent_at ? ` · ${t("sent_on", { date: format.date(order.sent_at) })}` : ""}
            {order.received_at ? ` · ${t("received_on", { date: format.date(order.received_at) })}` : ""}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${PURCHASE_ORDER_STATUS_STYLES[order.status]}`}>
          {t(`status_${order.status}`)}
        </span>
      </div>

      <PurchaseOrderEditor order={order} shopName={settings?.shop_name || ""} />

      <section className="flex flex-col gap-3 rounded-2xl border border-zinc-100 bg-white p-4 dark:border-[#2d2936] dark:bg-[#1C1A22]">
        <h2 className="font-bold">{t("reception_title")}</h2>
        <p className="text-sm text-zinc-500">{t("reception_explanation")}</p>
        {order.shipments.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {order.shipments.map((shipment) => (
              <li key={shipment.id}>
                <Link href={`/shipments/${shipment.id}`} className="font-mono text-violet-700 hover:underline dark:text-violet-300">
                  {shipment.reference}
                </Link>{" "}
                <span className="text-xs text-zinc-500">· {tShipments(`status_${shipment.status}`)}</span>
              </li>
            ))}
          </ul>
        )}
        {canAttachShipment && (
          <div>
            <NewShipmentLinkButton
              openPurchaseOrders={[{ id: order.id, reference: order.reference, supplier_name: order.supplier_name }]}
              presetPurchaseOrderId={order.id}
              defaultPhoneCountryCode={settings?.default_phone_country_code || "+237"}
              shopName={settings?.shop_name || ""}
              label={t("create_collection_link")}
            />
          </div>
        )}
      </section>
    </div>
  );
}
