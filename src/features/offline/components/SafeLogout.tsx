"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { logout } from "@/app/[locale]/login/actions";
import { Modal } from "@/components/ui/Modal";
import { useOptionalOfflineContext } from "../OfflineProvider";
import { unsentCount, wipeDevice } from "../localActions";

// Logging out with sales made offline and not sent yet would lose them, like
// Loyverse, WISHOP refuses and says why. Once everything is sent, the shop's
// data leaves the device (a phone or a computer shared by the shop).
export function useSafeLogout() {
  const offline = useOptionalOfflineContext();
  const [loggingOut, setLoggingOut] = useState(false);
  const [blocked, setBlocked] = useState(0);

  const run = async () => {
    if (offline) {
      const unsent = await unsentCount(offline.db);
      if (unsent > 0) {
        setBlocked(unsent);
        offline.requestSync();
        return;
      }
    }
    setLoggingOut(true);
    if (offline) await wipeDevice(offline.shopId);
    await logout();
  };

  return { run, loggingOut, blocked, closeBlocked: () => setBlocked(0) };
}

export function LogoutBlockedDialog({ count, onClose }: { count: number; onClose: () => void }) {
  const t = useTranslations("Offline");
  const tCommon = useTranslations("Common");
  if (count === 0) return null;
  return (
    <Modal isOpen onClose={onClose} title={t("panel_title")}>
      <div className="flex flex-col gap-4 text-[14px]">
        <p className="font-semibold text-amber-900 dark:text-amber-200">{t("logout_blocked", { count })}</p>
        <button type="button" onClick={onClose} className="rounded-xl bg-night py-3 text-[14px] font-bold text-white dark:bg-violet-500">
          {tCommon("close")}
        </button>
      </div>
    </Modal>
  );
}
