import ShipmentList from "@/features/shipments/components/ShipmentList";
import { lockedFeature } from "@/features/billing/gate";
import { NewShipmentLinkButton } from "@/features/shipments/components/NewShipmentLinkButton";
import { getOpenPurchaseOrders, getShipments } from "@/features/shipments/queries";
import { getShopSettings } from "@/features/settings/queries";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("Shipments");
  return { title: t("title") };
}

export default async function ShipmentsPage() {
  const locked = await lockedFeature("shipments");
  if (locked) return locked;
  const [t, shipments, openPurchaseOrders, settings] = await Promise.all([
    getTranslations("Shipments"),
    getShipments(),
    getOpenPurchaseOrders(),
    getShopSettings(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("subtitle")}</p>
        </div>
        <NewShipmentLinkButton
          openPurchaseOrders={openPurchaseOrders}
          defaultPhoneCountryCode={settings?.default_phone_country_code || "+237"}
          shopName={settings?.shop_name || ""}
        />
      </div>

      <ShipmentList shipments={shipments} />
    </div>
  );
}
