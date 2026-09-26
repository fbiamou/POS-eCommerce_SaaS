"use client";

import { useSyncExternalStore } from "react";
import { useOptionalOfflineContext, type TillHolder } from "./OfflineProvider";

const noSubscription = () => () => {};

// The colleague holding the till on this device, once the page runs in the
// browser (the choice is kept on the device, so the server's first render
// cannot know it offline).
export function useTillHolder(): TillHolder | null {
  const offline = useOptionalOfflineContext();
  const mounted = useSyncExternalStore(noSubscription, () => true, () => false);
  return mounted ? offline?.tillHolder ?? null : null;
}

/** The holder, and whether her exact rights are known yet on this device. */
export function useTillState(): { holder: TillHolder | null; ready: boolean } {
  const offline = useOptionalOfflineContext();
  const holder = useTillHolder();
  return { holder, ready: !holder || Boolean(offline?.tillReady) };
}

type Access = { role?: string; allowed_pages?: string[]; full_name?: string | null; session_user?: unknown } | null | undefined;

/** Role and pages the menus follow: the till holder's, else the profile's. */
export function useNavAccess(profile: Access) {
  const holder = useTillHolder();
  if (holder) return { role: holder.role, allowedPages: holder.allowed_pages, name: holder.name, holdsTill: true };
  return {
    role: profile?.role || "SELLER",
    allowedPages: profile?.allowed_pages ?? [],
    name: profile?.full_name ?? null,
    // The server already applies a colleague's rights (signed cookie).
    holdsTill: Boolean(profile?.session_user),
  };
}
