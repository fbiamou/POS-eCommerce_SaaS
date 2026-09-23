import ShipmentList from "@/features/shipments/components/ShipmentList";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("Shipments");
  return { title: t("title") };
}

export default async function ShipmentsPage() {
  const t = await getTranslations("Shipments");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      </div>
      
      <ShipmentList />
    </div>
  );
}
