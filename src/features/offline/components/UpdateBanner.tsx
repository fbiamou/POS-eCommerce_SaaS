"use client";

import { useCallback, useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { useOptionalOfflineContext } from "../OfflineProvider";
import { autoUpdateAt, autoUpdateDue } from "../updatePolicy";
import { releaseVersion } from "../updateActions";

// Vercel keeps this device on its version until its user updates
// (lib/versionPin.ts). Without it (free Vercel plan) a new version reaches
// the device at its next page load anyway, and the banner only offers to
// reload now.
const PINNED = process.env.NEXT_PUBLIC_VERSION_PINNING === "1";

const ACTIVITY_KEY = "wishop-last-activity";
const SEEN_KEY = "wishop-update-seen";
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "wheel"] as const;
const CHECK_EVERY_MS = 30_000;

function readNumber(key: string): number {
  try {
    return Number(window.localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

/** When this device first saw that version (kept across reloads). */
function seenAt(build: string): Date {
  try {
    const kept = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "null") as { build?: string; at?: number } | null;
    if (kept?.build === build && kept.at) return new Date(kept.at);
    const now = Date.now();
    window.localStorage.setItem(SEEN_KEY, JSON.stringify({ build, at: now }));
    return new Date(now);
  } catch {
    return new Date();
  }
}

// A newer version of WISHOP is out. It only reaches the device when its user
// presses "Mettre à jour" (decided 26/09/2026); otherwise at night, when
// nobody uses the app (updatePolicy.ts), on the date and time announced here.
// The sales waiting to be sent stay on the device: a reload never loses them.
export function UpdateBanner() {
  const offline = useOptionalOfflineContext();
  const t = useTranslations("Offline");
  const format = useFormatter();
  const latest = offline?.status.updateAvailable ? offline.status.latestBuild : null;
  const online = Boolean(offline?.status.online);
  const [plannedAt, setPlannedAt] = useState<Date | null>(null);

  // Someone using the app: the automatic update waits for a quiet night.
  useEffect(() => {
    let last = 0;
    const mark = () => {
      const now = Date.now();
      if (now - last < 15_000) return;
      last = now;
      try {
        window.localStorage.setItem(ACTIVITY_KEY, String(now));
      } catch {
        // Storage blocked: the automatic update then waits for the button.
      }
    };
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, mark, { passive: true }));
    return () => ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, mark));
  }, []);

  const update = useCallback(async () => {
    if (PINNED) {
      try {
        await releaseVersion();
      } catch {
        // No answer: the reload below still tries the latest version.
      }
    }
    // The new version registers its own service worker and keeps its own
    // copies of the pages (serviceWorker.ts): a plain reload is enough.
    window.location.reload();
  }, []);

  useEffect(() => {
    if (!PINNED || !latest || !online) return;
    const seen = seenAt(latest);
    const check = () => {
      const lastActivity = readNumber(ACTIVITY_KEY);
      setPlannedAt(autoUpdateAt(seen, lastActivity));
      if (document.visibilityState === "visible" && autoUpdateDue(Date.now(), seen, lastActivity)) void update();
    };
    check();
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [latest, online, update]);

  if (!latest || !online) return null;

  return (
    <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-violet-50 px-4 py-3 text-[14px] text-violet-900 ring-1 ring-violet-200 dark:bg-violet-900/20 dark:text-violet-200 dark:ring-violet-900/40">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="font-semibold">{t("update_available")}</p>
        {PINNED && (
          <>
            <p className="text-[13px]">{t("update_kept")}</p>
            {plannedAt && (
              <p className="text-[13px] text-violet-800/80 dark:text-violet-200/80">
                {t("update_auto", {
                  date: format.dateTime(plannedAt, { day: "2-digit", month: "2-digit", year: "numeric" }),
                  time: format.dateTime(plannedAt, { hour: "2-digit", minute: "2-digit" }),
                })}
              </p>
            )}
          </>
        )}
      </div>
      <button type="button" onClick={() => void update()} className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-violet-700">
        <RefreshCw className="h-4 w-4" /> {t("update_now")}
      </button>
    </div>
  );
}
