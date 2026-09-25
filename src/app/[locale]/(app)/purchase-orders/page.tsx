import PurchaseOrderList from "@/features/purchase-orders/components/PurchaseOrderList";
import { lockedFeature } from "@/features/billing/gate";
import { getLowStockProducts, getPurchaseOrders } from "@/features/purchase-orders/queries";
import { SupplierManager } from "@/features/suppliers/components/SupplierManager";
import { getSuppliers } from "@/features/suppliers/queries";
import { getShopFormat, getShopSettings } from "@/features/settings/queries";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("PurchaseOrders");
  return { title: t("title") };
}

export default async function PurchaseOrdersPage() {
  const locked = await lockedFeature("purchase_orders");
  if (locked) return locked;
  const [t, format, settings] = await Promise.all([getTranslations("PurchaseOrders"), getShopFormat(), getShopSettings()]);
  const [lowStock, orders, suppliers] = await Promise.all([
    getLowStockProducts(format.lowStockThreshold),
    getPurchaseOrders(),
    getSuppliers(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("subtitle")}</p>
      </div>

      <PurchaseOrderList lowStock={lowStock} orders={orders} />
      <SupplierManager suppliers={suppliers} defaultPhoneCountryCode={settings?.default_phone_country_code || "+237"} />
    </div>
  );
}
