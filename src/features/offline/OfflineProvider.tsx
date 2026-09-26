"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { restrictToCashier, switchCashier } from "@/features/team/cashierActions";
import { createClient } from "@/utils/supabase/client";
import { openShopDatabase, type ShopDatabase } from "./db";
import { deviceLabel, readDevice, reconcileDevice, writeDevice } from "./device";
import { registerDevice, supabaseBackend } from "./backend";
import { outboxCounts } from "./records";
import { syncNow, type SyncBackend } from "./sync";
import { registerServiceWorker, warmOfflinePages } from "./serviceWorker";
import { readCashier, writeCashier, writeTillRights, type Cashier } from "./pin";

// Runs the offline mode for every page of the app: keeps this device's copy
// of the shop up to date, sends what was done without internet as soon as
// the connection returns, and tells the screens where things stand.

const SYNC_EVERY_MS = 60_000;
/** A sale at the till waits less than the background sync before going offline. */
const TILL_TIMEOUT_MS = 8_000;

export type OfflineStatus = {
  /** The browser has a network and the last exchange with the server worked. */
  online: boolean;
  syncing: boolean;
  /** Operations waiting to be sent, and operations the server refused. */
  pending: number;
  failed: number;
  lastSyncAt: string | null;
  /** The device has a full copy of the shop (first sync done). */
  ready: boolean;
  /** A newer version of the app is out: the page should be reloaded. */
  updateAvailable: boolean;
};

export type OfflineContextValue = {
  shopId: string;
  userId: string;
  /** Printed on the ticket of a sale made on this device. */
  userName: string | null;
  /** Who is selling on this device: the account, or a colleague who typed their till code. */
  cashier: Cashier;
  setCashier: (cashier: Cashier) => void;
  /**
   * A colleague holding the till: her rights apply to the menu and the
   * pages (null while the signed-in account holds it).
   */
  tillHolder: TillHolder | null;
  /**
   * False while the team kept on the device is still being read: the
   * holder's exact rights are not known yet (pages wait, CashierGuard).
   */
  tillReady: boolean;
  /** A code checked on the device, kept in memory to tell the server once online. */
  rememberSwitch: (memberId: string, pin: string) => void;
  db: ShopDatabase;
  status: OfflineStatus;
  /** Background exchanges (long timeout) and till exchanges (short timeout). */
  backend: SyncBackend;
  tillBackend: SyncBackend;
  /** Sends and receives now (after a sale, a payment...). */
  requestSync: () => void;
  /** Marks the server unreachable after a failed exchange at the till. */
  markOffline: () => void;
};

export type TillHolder = { id: string; name: string | null; role: "MANAGER" | "SELLER"; allowed_pages: string[] };

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({
  shopId,
  userId,
  userName,
  serverCashierId,
  children,
}: {
  shopId: string;
  /** The account signed in on the device. */
  userId: string;
  userName: string | null;
  /** The colleague the server knows as holding the till (signed cookie), if any. */
  serverCashierId: string | null;
  children: React.ReactNode;
}) {
  const locale = useLocale();
  const db = useMemo(() => openShopDatabase(shopId), [shopId]);
  const supabase = useMemo(() => createClient(), []);
  const backend = useMemo(() => supabaseBackend(supabase, shopId), [supabase, shopId]);
  const tillBackend = useMemo(() => supabaseBackend(supabase, shopId, { timeoutMs: TILL_TIMEOUT_MS }), [supabase, shopId]);

  const [browserOnline, setBrowserOnline] = useState(true);
  const [serverReachable, setServerReachable] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  // The person selling survives a reload of the page, not a change of account.
  const [cashierOverride, setCashierOverride] = useState<Cashier | null>(() =>
    typeof window === "undefined" ? null : readCashier(window.localStorage, shopId, userId)
  );
  const running = useRef(false);
  const again = useRef(false);
  const fullDone = useRef(false);

  const outbox = useLiveQuery(() => db.outbox.toArray(), [db], []);
  const lastPullAt = useLiveQuery(async () => ((await db.meta.get("lastPullAt"))?.value as string | undefined) ?? null, [db], null);
  const counts = outboxCounts(outbox);

  const ensureDevice = useCallback(async () => {
    const local = readDevice(window.localStorage, shopId);
    const server = await registerDevice(supabase, local?.id ?? null, deviceLabel(navigator.userAgent));
    if (server) writeDevice(window.localStorage, shopId, reconcileDevice(local, server));
  }, [supabase, shopId]);

  const runSync = useCallback(async () => {
    if (running.current) {
      again.current = true;
      return;
    }
    if (!navigator.onLine) {
      setBrowserOnline(false);
      return;
    }
    running.current = true;
    setSyncing(true);
    try {
      do {
        again.current = false;
        // One tab at a time: two tabs of the same browser share the data.
        const work = async () => {
          if (!readDevice(window.localStorage, shopId) || !fullDone.current) await ensureDevice();
          const result = await syncNow(db, backend, { full: !fullDone.current });
          const reached = !result.push.offline && result.pull?.ok !== false;
          setServerReachable(reached);
          // A page kept for offline use runs the version it was saved with:
          // once online, it checks whether a newer one is out.
          if (reached) {
            try {
              const response = await fetch("/api/version", { cache: "no-store" });
              const { build } = (await response.json()) as { build?: string };
              if (build && build !== process.env.NEXT_PUBLIC_BUILD_ID) setUpdateAvailable(true);
            } catch {
              // No answer: checked again at the next sync.
            }
          }
          if (reached && !fullDone.current) {
            fullDone.current = true;
            // The main pages are kept now, so they open offline later even
            // if nobody visited them on this device.
            void warmOfflinePages(locale);
          }
        };
        if (navigator.locks) await navigator.locks.request(`wishop-sync-${shopId}`, work);
        else await work();
      } while (again.current);
    } finally {
      running.current = false;
      setSyncing(false);
    }
  }, [db, backend, shopId, ensureDevice, locale]);

  const cashier: Cashier = useMemo(() => cashierOverride ?? { id: userId, name: userName }, [cashierOverride, userId, userName]);

  // The colleague holding the till and her rights (from the team kept on
  // the device, so it also works offline).
  // Until it is read, and for a colleague missing from it, only the till is
  // open: an empty page list would mean "every page but the settings".
  const storedMembers = useLiveQuery(() => db.members.toArray(), [db]);
  const members = useMemo(() => storedMembers ?? [], [storedMembers]);
  const tillReady = cashier.id === userId || storedMembers !== undefined;
  const tillHolder: TillHolder | null = useMemo(() => {
    if (cashier.id === userId) return null;
    const member = members.find((m) => m.id === cashier.id);
    return member
      ? { id: member.id, name: member.full_name, role: member.role, allowed_pages: member.allowed_pages ?? [] }
      : { id: cashier.id, name: cashier.name, role: "SELLER", allowed_pages: ["sales"] };
  }, [cashier, userId, members]);
  // Her rights are kept with her name for the check made before the page is
  // drawn (tillPrecheck.ts), and follow the owner's changes once synced.
  useEffect(() => {
    if (tillHolder && tillReady) writeTillRights(window.localStorage, shopId, userId, tillHolder);
  }, [tillHolder, tillReady, shopId, userId]);
  const setCashier = useCallback(
    (next: Cashier) => {
      writeCashier(window.localStorage, shopId, userId, next);
      setCashierOverride(next.id === userId ? null : next);
    },
    [shopId, userId]
  );

  // The server applies the till holder's rights too (signed cookie). A
  // switch made offline reaches it once online: with the code kept in
  // memory, or, for a seller, as a restriction the server accepts without
  // the code. When neither is possible, the most restricted side wins: the
  // device goes back to the holder the server knows.
  const router = useRouter();
  const pendingSwitch = useRef<{ memberId: string; pin: string } | null>(null);
  const reconciling = useRef(false);
  const rememberSwitch = useCallback((memberId: string, pin: string) => {
    pendingSwitch.current = { memberId, pin };
  }, []);
  const online = browserOnline && serverReachable;
  useEffect(() => {
    if (!online || reconciling.current) return;
    const wanted = cashier.id === userId ? null : cashier.id;
    if (wanted === serverCashierId) {
      pendingSwitch.current = null;
      return;
    }
    reconciling.current = true;
    void (async () => {
      try {
        const pending = pendingSwitch.current;
        if (pending && pending.memberId === cashier.id) {
          const result = await switchCashier(pending.memberId, pending.pin);
          if (result.ok) {
            router.refresh();
            return;
          }
          pendingSwitch.current = null;
        } else if (wanted && tillHolder?.role === "SELLER") {
          const result = await restrictToCashier(wanted);
          if (result.ok) {
            router.refresh();
            return;
          }
        }
        if (serverCashierId) {
          const holder = members.find((m) => m.id === serverCashierId);
          setCashier({ id: serverCashierId, name: holder?.full_name ?? null });
        }
      } catch {
        // No answer: tried again at the next change.
      } finally {
        reconciling.current = false;
      }
    })();
  }, [online, cashier.id, userId, serverCashierId, tillHolder?.role, members, router, setCashier]);

  useEffect(() => {
    const update = () => {
      setBrowserOnline(navigator.onLine);
      if (navigator.onLine) void runSync();
    };
    update();
    registerServiceWorker();
    const onVisible = () => {
      if (document.visibilityState === "visible") void runSync();
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void runSync();
    }, SYNC_EVERY_MS);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [runSync]);

  const value = useMemo<OfflineContextValue>(
    () => ({
      shopId,
      userId,
      userName,
      cashier,
      setCashier,
      tillHolder,
      tillReady,
      rememberSwitch,
      db,
      backend,
      tillBackend,
      status: {
        online: browserOnline && serverReachable,
        syncing,
        pending: counts.pending,
        failed: counts.failed,
        lastSyncAt: lastPullAt,
        ready: lastPullAt !== null,
        updateAvailable,
      },
      requestSync: () => void runSync(),
      markOffline: () => setServerReachable(false),
    }),
    [shopId, userId, userName, cashier, setCashier, tillHolder, tillReady, rememberSwitch, db, backend, tillBackend, browserOnline, serverReachable, syncing, updateAvailable, counts.pending, counts.failed, lastPullAt, runSync]
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOfflineContext(): OfflineContextValue {
  const value = useContext(OfflineContext);
  if (!value) throw new Error("useOfflineContext must be used inside OfflineProvider");
  return value;
}

/** For components that may render outside the app layout (tests, public pages). */
export function useOptionalOfflineContext(): OfflineContextValue | null {
  return useContext(OfflineContext);
}
