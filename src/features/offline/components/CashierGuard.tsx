"use client";

import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { Link, usePathname } from "@/i18n/routing";
import { firstAllowedPath, isPageAllowed } from "@/lib/appPages";
import { useTillHolder } from "../useTillAccess";

// A colleague holding the till only sees the pages the owner opened to her
// (decided 26/09/2026). The server enforces it online (proxy, signed
// cookie); this guard does it on the device, offline included.
export function CashierGuard({ children }: { children: React.ReactNode }) {
  const holder = useTillHolder();
  const pathname = usePathname();
  const t = useTranslations("Cashier");
  if (!holder) return <>{children}</>;

  const allowed = !pathname.startsWith("/admin") && isPageAllowed(holder.role, holder.allowed_pages, pathname);
  if (allowed) return <>{children}</>;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl bg-[var(--surface-1)] p-8 text-center shadow-card">
      <Lock className="h-8 w-8 text-zinc-400" />
      <p className="font-semibold">{t("page_reserved", { name: holder.name || t("no_name") })}</p>
      <p className="text-[13px] text-zinc-500">{t("page_reserved_hint")}</p>
      <Link href={holder.role === "MANAGER" ? "/dashboard" : firstAllowedPath(holder.allowed_pages)} className="mt-2 rounded-xl bg-violet-600 px-4 py-2.5 text-[14px] font-bold text-white hover:bg-violet-700">
        {t("go_to_allowed")}
      </Link>
    </div>
  );
}
