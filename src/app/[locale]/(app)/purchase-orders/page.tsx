import PurchaseOrderList from "@/features/purchase-orders/components/PurchaseOrderList";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("PurchaseOrders");
  return { title: t("title") };
}

export default async function PurchaseOrdersPage() {
  const t = await getTranslations("PurchaseOrders");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      </div>
      
      <PurchaseOrderList />
    </div>
  );
}
