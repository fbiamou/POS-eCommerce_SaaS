"use client";

import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, Clock, FileText, Send } from "lucide-react";

export default function PurchaseOrderList() {
  const t = useTranslations("PurchaseOrders");
  const locale = useLocale();
  const formatDate = (isoDate: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(isoDate));

  const lowStockItems: { id: string; name: string; stock: number; threshold: number }[] = [];

  const handleGenerate = () => {
    alert(t("generate_success"));
  };

  return (
    <div className="space-y-6">
      {/* Alert zone for pending PO */}
      <div className="bg-orange-50 border-orange-200 border rounded-xl p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex gap-4 items-start">
            <div className="bg-orange-100 p-2 rounded-full mt-1">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-orange-900">{t("low_stock_items")}</h2>
              <p className="text-orange-800 text-sm mt-1 max-w-xl">
                {t("low_stock_description")}
              </p>
              
              <ul className="mt-4 space-y-2">
                {lowStockItems.map(item => (
                  <li key={item.id} className="text-sm text-orange-800 font-medium flex items-center justify-between bg-orange-100/50 px-3 py-2 rounded-md">
                    <span>{item.name}</span>
                    <span className="text-orange-900 bg-orange-200 px-2 py-0.5 rounded-full text-xs">
                      {t("stock_count", { stock: item.stock, threshold: item.threshold })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          <button 
            onClick={handleGenerate}
            className="shrink-0 flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-3 sm:px-4 py-2 rounded-md font-medium text-sm transition-colors"
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{t("generate")}</span>
          </button>
        </div>
      </div>

      {/* History */}
      <div>
        <h2 className="text-lg font-bold mb-4">{t("history")}</h2>
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm text-left min-w-[600px]">
            <thead className="bg-muted text-muted-foreground uppercase text-xs">
              <tr>
                <th className="px-4 py-3">{t("ref")}</th>
                <th className="px-4 py-3">{t("date")}</th>
                <th className="px-4 py-3">{t("articles")}</th>
                <th className="px-4 py-3">{t("status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                  {t("no_history")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
