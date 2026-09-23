import InvoiceList from "@/features/invoices/components/InvoiceList";
import { getTranslations } from "next-intl/server";
import { getInvoices } from "@/features/invoices/actions";

export async function generateMetadata() {
  const t = await getTranslations("Invoices");
  return { title: t("list_title") };
}

export default async function InvoicesPage() {
  const [t, invoices] = await Promise.all([getTranslations("Invoices"), getInvoices()]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("list_title")}</h1>
      </div>

      <InvoiceList invoices={invoices} />
    </div>
  );
}
