import { getTranslations } from "next-intl/server";
import { getOnlineOrders } from "@/features/online-orders/actions";
import OnlineOrderList from "@/features/online-orders/components/OnlineOrderList";

export async function generateMetadata() {
  const t = await getTranslations("OnlineOrders");
  return { title: t("title") };
}

export default async function OnlineOrdersPage() {
  const [t, orders] = await Promise.all([getTranslations("OnlineOrders"), getOnlineOrders()]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      </div>

      <OnlineOrderList orders={orders} />
    </div>
  );
}
