import { getTranslations } from "next-intl/server";
import ProcurementForm from "@/features/procurement/components/ProcurementForm";

// Page publique : sans sidebar ni dashboard
export default async function ProcurementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("Procurement");

  return (
    <main className="min-h-screen bg-gray-50/50">
      <div className="bg-primary text-primary-foreground p-4 shadow-md sticky top-0 z-20">
        <h1 className="text-xl font-bold text-center">{t("supplier_space")}</h1>
      </div>
      <ProcurementForm procurementId={id} />
    </main>
  );
}
