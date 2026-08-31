"use client";

import { useRef, useState, useTransition } from "react";
import { Download, Upload, FileDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { importProductsCsv } from "../actions";

export function StockActions() {
  const t = useTranslations("Stock");
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
        setFeedback({ type: "error", message: result.error });
        return;
      }

      if (result.summary) {
        const { created, restocked, errors } = result.summary;
        let message = t("import_success", { created, restocked });
        if (errors.length > 0) {
          const details = errors.map((err) => (err.line > 0 ? `L${err.line}: ${err.message}` : err.message)).join(" · ");
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
        <a
          href="/api/stock/csv-template"
          className="flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
        >
          <FileDown className="h-4 w-4" />
          {t("download_template")}
        </a>

        <a
          href="/api/stock/csv-export"
          className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Download className="h-4 w-4" />
          {t("export_csv")}
        </a>

        <button
          type="button"
          disabled={isPending}
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {isPending ? t("importing") : t("import_csv")}
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
          className={`max-w-md rounded-md p-2 text-right text-xs ${
            feedback.type === "success"
              ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
              : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
          }`}
        >
          {feedback.message}
        </div>
      )}
    </div>
  );
}
