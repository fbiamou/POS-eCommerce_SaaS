"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useLocale } from "next-intl";
import { routing, usePathname } from "@/i18n/routing";
import { APP_PAGES, firstOpenPath, isPageAllowed } from "@/lib/appPages";
import { forgetPages } from "../serviceWorker";
import { useTillState } from "../useTillAccess";

const noSubscription = () => () => {};

// A colleague holding the till only sees the pages the owner opened to her
// (decided 26/09/2026). The server enforces it online (proxy, signed
// cookie); this guard does it on the device, offline included. Until the
// device knows her exact rights, the content stays hidden (globals.css,
// data-till). A closed page typed in the address bar sends her straight
// back to her own first page, as the server does online.
export function CashierGuard({ children }: { children: React.ReactNode }) {
  const { holder, ready } = useTillState();
  const mounted = useSyncExternalStore(noSubscription, () => true, () => false);
  const pathname = usePathname();
  const locale = useLocale();

  // The kept copies of her closed pages go, so they cannot show offline.
  useEffect(() => {
    if (!holder || !ready) return;
    const closed = ["/admin", ...APP_PAGES.map((p) => p.path).filter((path) => !isPageAllowed(holder.role, holder.allowed_pages, path))];
    void forgetPages(routing.locales.flatMap((l) => closed.map((path) => `/${l}${path}`)));
  }, [holder, ready]);

  const allowed = !holder || (!pathname.startsWith("/admin") && isPageAllowed(holder.role, holder.allowed_pages, pathname));
  const home = holder && ready && !allowed ? firstOpenPath(holder.role, holder.allowed_pages) : null;

  // A full page load, not an in-app move: it works the same online (the
  // server checks it too) and offline (the device serves its kept copy).
  useEffect(() => {
    if (home) window.location.replace(`/${locale}${home}`);
  }, [home, locale]);

  if (!allowed) return null;
  return (
    <div data-till-guard="" data-till-ok={mounted && ready ? "" : undefined}>
      {children}
    </div>
  );
}
