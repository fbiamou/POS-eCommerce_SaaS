"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { deleteShopMessage } from "../actions";

// Withdraws a message (a typo, an announcement no longer true): it also
// disappears from the shops that had not read it yet.
export function DeleteMessageButton({ messageId }: { messageId: string }) {
  const t = useTranslations("Messages");
  const tFeedback = useTranslations("Feedback");
  const showToast = useToast((state) => state.show);
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setConfirming(true)} className="font-semibold text-red-600 hover:underline">
        {t("withdraw")}
      </button>
      <ConfirmDialog
        isOpen={confirming}
        title={t("withdraw")}
        confirmLabel={t("withdraw")}
        tone="danger"
        pending={isPending}
        onConfirm={() =>
          startTransition(async () => {
            const result = await deleteShopMessage(messageId);
            setConfirming(false);
            if (result.error) showToast(tFeedback(result.error), "error");
          })
        }
        onCancel={() => setConfirming(false)}
      >
        {t("withdraw_confirm")}
      </ConfirmDialog>
    </>
  );
}
