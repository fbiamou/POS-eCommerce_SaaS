import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Link } from "@/i18n/routing";
import { getFormatters } from "@/features/settings/queries";
import { isPlatformAdmin, listReports } from "@/features/admin/queries";
import { ReportStatusSelect } from "@/features/admin/components/ReportStatusSelect";

export async function generateMetadata() {
  const t = await getTranslations("Admin");
  return { title: t("reports") };
}

// Reports sent from the storefronts' "Signaler" link (terms of use, article
// 13). New ones first.
export default async function AdminReportsPage() {
  if (!(await isPlatformAdmin())) notFound();

  const [t, tStorefront, format, reports] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("Storefront"),
    getFormatters(),
    listReports(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin" className="flex items-center gap-1.5 text-[13px] font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
        <ArrowLeft className="h-4 w-4" /> {t("back")}
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("reports")}</h1>
        <p className="mt-1 text-[14px] text-zinc-500">{t("reports_intro")}</p>
      </div>

      {reports.length === 0 ? (
        <p className="rounded-2xl bg-[var(--surface-1)] p-8 text-center text-[14px] text-zinc-500 shadow-card">{t("no_reports")}</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {reports.map((report) => (
            <li key={report.id} className="flex flex-col gap-3 rounded-2xl bg-[var(--surface-1)] p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{tStorefront(`report_reason_${report.reason}`)}</p>
                  <p className="truncate text-[13px] text-zinc-500">
                    {[report.shop_name, report.product_name].filter(Boolean).join(" · ")}
                  </p>
                  <p className="text-[12px] text-zinc-500">{format.date(report.created_at, "dateTime")}</p>
                </div>
                {report.shop_slug && (
                  <Link
                    href={`/boutique/${report.shop_slug}`}
                    target="_blank"
                    aria-label={t("view_storefront")}
                    className="shrink-0 rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                )}
              </div>
              {report.details && <p className="whitespace-pre-line text-[14px] text-zinc-700 dark:text-zinc-300">{report.details}</p>}
              {report.reporter_contact && (
                <p className="text-[13px] text-zinc-500">{t("reporter_contact", { contact: report.reporter_contact })}</p>
              )}
              <ReportStatusSelect reportId={report.id} status={report.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
