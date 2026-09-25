"use client";

import { useSyncExternalStore } from "react";

// Id of a detail page (/fr/invoices/<id>, /fr/invoices/<id>/ticket), read
// from the address bar. Offline, the service worker answers every detail
// address with one kept copy of the page (public/sw.js), whose server data
// belong to another id: the address is the only reliable source.
const noSubscription = () => () => {};

export function useRouteId(segment: string, fallback: string | null): string | null {
  const pathname = useSyncExternalStore(
    noSubscription,
    () => window.location.pathname,
    () => null
  );
  if (!pathname) return fallback;
  const parts = pathname.split("/").filter(Boolean);
  const index = parts.indexOf(segment);
  const fromPath = index >= 0 ? parts[index + 1] : undefined;
  return fromPath ? decodeURIComponent(fromPath) : fallback;
}
