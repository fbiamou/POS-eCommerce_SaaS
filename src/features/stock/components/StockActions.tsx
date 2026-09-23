"use client";

import { useRef, useState, useTransition } from "react";
import { Download, Upload, FileDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { importProductsCsv } from "../actions";

export function StockActions() {
  const t = useTranslations("Stock");
  const tFeedback = useTranslations("Feedback");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setFeedback(null);
    startTransition(async () => {
      const result = await importProductsCsv(formData);
      e.target.value = "";

      if (result.error) {
        setFeedback({ type: "error", message: tFeedback(result.error) });
        return;
      }

      if (result.summary) {
        const { created, restocked, errors } = result.summary;
        let message = t("import_success", { created, restocked });
        if (errors.length > 0) {
          const details = errors
            .map((err) => t("import_row_error", { line: err.line, message: t(`import_row_${err.code}`, { value: err.value ?? "" }) }))
            .join(" · ");
          message += " " + t("import_errors_count", { count: errors.length, details });
        }
        setFeedback({ type: errors.length > 0 ? "error" : "success", message });
      } else {
        setFeedback({ type: "error", message: t("import_error_generic") });
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {/* File downloads served by API routes, not page navigations: a plain link is intended. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/stock/csv-template"
          className="flex items-center gap-2 rounded-xl bg-zinc-100 dark:bg-white/5 px-3 sm:px-4 py-2.5 text-[13px] font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors"
        >
          <FileDown className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">{t("download_template")}</span>
        </a>

        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/stock/csv-export"
          className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 sm:px-4 py-2.5 text-[13px] font-bold text-zinc-700 hover:bg-zinc-50 dark:border-[#2d2936] dark:bg-[#1C1A22] dark:text-zinc-300 dark:hover:bg-white/[0.02] transition-colors shadow-sm"
        >
          <Download className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">{t("export_csv")}</span>
        </a>

        <button
          type="button"
          disabled={isPending}
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 sm:px-4 py-2.5 text-[13px] font-bold text-zinc-700 hover:bg-zinc-50 dark:border-[#2d2936] dark:bg-[#1C1A22] dark:text-zinc-300 dark:hover:bg-white/[0.02] transition-colors shadow-sm disabled:opacity-50"
        >
          <Upload className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">{isPending ? t("importing") : t("import_csv")}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {feedback && (
        <div
          className={`max-w-md rounded-xl p-3 text-right text-[13px] font-bold shadow-sm ${
            feedback.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30"
              : "bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30"
          }`}
        >
          {feedback.message}
        </div>
      )}
    </div>
  );
}
