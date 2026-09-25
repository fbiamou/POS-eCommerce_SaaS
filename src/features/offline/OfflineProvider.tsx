"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { createClient } from "@/utils/supabase/client";
import { openShopDatabase, type ShopDatabase } from "./db";
import { deviceLabel, readDevice, reconcileDevice, writeDevice } from "./device";
import { registerDevice, supabaseBackend } from "./backend";
import { outboxCounts } from "./records";
import { syncNow, type SyncBackend } from "./sync";
import { registerServiceWorker } from "./serviceWorker";

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
};

type OfflineContextValue = {
  shopId: string;
  userId: string;
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

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({ shopId, userId, children }: { shopId: string; userId: string; children: React.ReactNode }) {
  const db = useMemo(() => openShopDatabase(shopId), [shopId]);
  const supabase = useMemo(() => createClient(), []);
  const backend = useMemo(() => supabaseBackend(supabase, shopId), [supabase, shopId]);
  const tillBackend = useMemo(() => supabaseBackend(supabase, shopId, { timeoutMs: TILL_TIMEOUT_MS }), [supabase, shopId]);

  const [browserOnline, setBrowserOnline] = useState(true);
  const [serverReachable, setServerReachable] = useState(true);
  const [syncing, setSyncing] = useState(false);
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
          if (reached) fullDone.current = true;
        };
        if (navigator.locks) await navigator.locks.request(`wishop-sync-${shopId}`, work);
        else await work();
      } while (again.current);
    } finally {
      running.current = false;
      setSyncing(false);
    }
  }, [db, backend, shopId, ensureDevice]);

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
      },
      requestSync: () => void runSync(),
      markOffline: () => setServerReachable(false),
    }),
    [shopId, userId, db, backend, tillBackend, browserOnline, serverReachable, syncing, counts.pending, counts.failed, lastPullAt, runSync]
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
