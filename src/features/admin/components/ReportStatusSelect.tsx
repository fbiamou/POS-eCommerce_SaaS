"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { setReportStatus } from "../actions";

const STATUSES = ["NEW", "REVIEWED", "REMOVED", "DISMISSED"] as const;

// What WISHOP did about a storefront report.
export function ReportStatusSelect({ reportId, status }: { reportId: string; status: string }) {
  const t = useTranslations("Admin");
  const tFeedback = useTranslations("Feedback");
  const showToast = useToast((state) => state.show);
  const [value, setValue] = useState(status);
  const [isPending, startTransition] = useTransition();

  const change = (next: string) => {
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const result = await setReportStatus(reportId, next);
      if (result.error) {
        setValue(previous);
        showToast(tFeedback(result.error), "error");
      }
    });
  };

  return (
    <Select
      options={STATUSES.map((s) => ({ value: s, label: t(`report_status_${s}`) }))}
      value={value}
      onChange={change}
      disabled={isPending}
      ariaLabel={t("report_status")}
      className="w-full sm:w-56"
    />
  );
}
