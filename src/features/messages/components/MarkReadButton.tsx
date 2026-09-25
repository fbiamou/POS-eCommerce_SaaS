"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { markMessageRead } from "../actions";

export function MarkReadButton({ messageId }: { messageId: string }) {
  const t = useTranslations("Messages");
  const tFeedback = useTranslations("Feedback");
  const showToast = useToast((state) => state.show);
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await markMessageRead(messageId);
          if (result.error) showToast(tFeedback(result.error), "error");
        })
      }
      className="inline-flex items-center gap-1.5 rounded-xl bg-white/80 px-4 py-2 text-[13px] font-bold text-zinc-800 ring-1 ring-black/10 hover:bg-white disabled:opacity-50 dark:bg-white/10 dark:text-white dark:ring-white/10"
    >
      <Check className="h-4 w-4" /> {t("mark_read")}
    </button>
  );
}
