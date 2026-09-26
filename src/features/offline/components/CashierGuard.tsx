"use client";

import { useEffect, useSyncExternalStore } from "react";
import { routing, usePathname, useRouter } from "@/i18n/routing";
import { APP_PAGES, firstAllowedPath, isPageAllowed } from "@/lib/appPages";
import { forgetPages } from "../serviceWorker";
import { useTillHolder } from "../useTillAccess";

const noSubscription = () => () => {};

// A colleague holding the till only sees the pages the owner opened to her
// (decided 26/09/2026). The server enforces it online (proxy, signed
// cookie); this guard does it on the device, offline included. Until the
// device has checked, the content stays hidden (globals.css, data-till).
// A closed page typed in the address bar sends her straight back to her own
// pages, as the server does online.
export function CashierGuard({ children }: { children: React.ReactNode }) {
  const holder = useTillHolder();
  const mounted = useSyncExternalStore(noSubscription, () => true, () => false);
  const pathname = usePathname();
  const router = useRouter();

  // The kept copies of her closed pages go, so they cannot show offline.
  useEffect(() => {
    if (!holder) return;
    const closed = ["/admin", ...APP_PAGES.map((p) => p.path).filter((path) => !isPageAllowed(holder.role, holder.allowed_pages, path))];
    void forgetPages(routing.locales.flatMap((locale) => closed.map((path) => `/${locale}${path}`)));
  }, [holder]);

  const allowed = !holder || (!pathname.startsWith("/admin") && isPageAllowed(holder.role, holder.allowed_pages, pathname));
  const home = holder ? (holder.role === "MANAGER" ? "/dashboard" : firstAllowedPath(holder.allowed_pages)) : null;

  useEffect(() => {
    if (!allowed && home) router.replace(home);
  }, [allowed, home, router]);

  // Nothing of a closed page shows while she is sent back.
  if (!allowed) return null;
  return (
    <div data-till-guard="" data-till-ok={mounted ? "" : undefined}>
      {children}
    </div>
  );
}
