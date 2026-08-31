import { getTranslations } from "next-intl/server";
import { getOnlineOrders } from "@/features/online-orders/actions";
import { getShopSettings } from "@/features/settings/actions";
import OnlineOrderList from "@/features/online-orders/components/OnlineOrderList";

export default async function OnlineOrdersPage() {
  const [t, orders, shopSettings] = await Promise.all([
    getTranslations("OnlineOrders"),
    getOnlineOrders(),
    getShopSettings(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      </div>

      <OnlineOrderList orders={orders} currencySymbol={shopSettings?.currency_symbol ?? "FCFA"} />
    </div>
  );
}
