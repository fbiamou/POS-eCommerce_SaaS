"use client";

import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { useOptionalOfflineContext } from "../OfflineProvider";

// A newer version of WISHOP is out while this page was kept for offline use:
// one tap reloads it with the internet (the sales waiting to be sent stay on
// the device, they are not lost by a reload).
export function UpdateBanner() {
  const offline = useOptionalOfflineContext();
  const t = useTranslations("Offline");
  if (!offline?.status.updateAvailable || !offline.status.online) return null;

  const reload = () => {
    try {
      sessionStorage.removeItem("wishop-pages-warmed");
    } catch {
      // Storage blocked: the pages are kept again as they are visited.
    }
    window.location.reload();
  };

  return (
    <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-violet-50 px-4 py-3 text-[14px] text-violet-900 ring-1 ring-violet-200 dark:bg-violet-900/20 dark:text-violet-200 dark:ring-violet-900/40">
      <p className="font-semibold">{t("update_available")}</p>
      <button type="button" onClick={reload} className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-violet-700">
        <RefreshCw className="h-4 w-4" /> {t("update_now")}
      </button>
    </div>
  );
}
