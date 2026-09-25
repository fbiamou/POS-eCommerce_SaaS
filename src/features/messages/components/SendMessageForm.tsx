"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Send } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import type { FeedbackCode } from "@/lib/feedback";
import { sendShopMessage } from "../actions";

const inputClass =
  "w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[15px] outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)] dark:bg-[var(--surface-0)]";

// Console: write to one shop (shopId) or to every shop (shopId null). The
// message shows at the top of the owner's app until she marks it as read.
export function SendMessageForm({ shopId }: { shopId: string | null }) {
  const t = useTranslations("Messages");
  const tFeedback = useTranslations("Feedback");
  const showToast = useToast((state) => state.show);
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tone, setTone] = useState("INFO");
  const [error, setError] = useState<FeedbackCode | null>(null);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await sendShopMessage({ shopId, title, body, tone });
      if (result.error) {
        setError(result.error);
        return;
      }
      setTitle("");
      setBody("");
      setTone("INFO");
      showToast(shopId ? t("sent_one") : t("sent_all"));
    });
  };

  return (
    <form onSubmit={send} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">
          {t("field_title")}
          <input type="text" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">
          {t("field_tone")}
          <Select
            value={tone}
            onChange={setTone}
            ariaLabel={t("field_tone")}
            options={[
              { value: "INFO", label: t("tone_INFO") },
              { value: "WARNING", label: t("tone_WARNING") },
            ]}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">
        {t("field_body")}
        <textarea required rows={4} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} className={inputClass} />
      </label>
      {error && <p role="alert" className="text-[14px] font-semibold text-red-600">{tFeedback(error)}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-2 self-start rounded-xl bg-violet-600 px-5 py-3 text-[14px] font-bold text-white hover:bg-violet-700 disabled:opacity-50"
      >
        <Send className="h-4 w-4" /> {shopId ? t("send_one") : t("send_all")}
      </button>
    </form>
  );
}
