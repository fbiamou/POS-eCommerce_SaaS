import { getTranslations } from "next-intl/server";
import { getFormatters } from "@/features/settings/queries";
import type { SentMessage } from "../queries";
import { DeleteMessageButton } from "./DeleteMessageButton";

// Console: the messages already sent, with whether they were read (the date
// for one shop, the number of shops for a message to all).
export async function SentMessages({ messages, toAll }: { messages: SentMessage[]; toAll: boolean }) {
  const [t, format] = await Promise.all([getTranslations("Messages"), getFormatters()]);
  if (messages.length === 0) return <p className="text-[14px] text-zinc-500">{t("none_sent")}</p>;
  return (
    <ol className="divide-y divide-zinc-100 rounded-2xl bg-[var(--surface-1)] shadow-card dark:divide-[var(--line)]">
      {messages.map((message) => (
        <li key={message.id} className="flex flex-col gap-1 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{message.title}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                message.tone === "WARNING"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                  : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
              }`}
            >
              {t(`tone_${message.tone}`)}
            </span>
            <span className="ml-auto text-[12px] text-zinc-500">{format.date(message.created_at, "dateTime")}</span>
          </div>
          <p className="whitespace-pre-line text-[13.5px] text-zinc-600 dark:text-zinc-300">{message.body}</p>
          <div className="flex items-center justify-between gap-2 text-[12px]">
            <span className={message.read_at || message.read_count > 0 ? "font-semibold text-emerald-700 dark:text-emerald-400" : "text-zinc-500"}>
              {toAll
                ? t("read_count", { count: message.read_count })
                : message.read_at
                  ? t("read_on", { date: format.date(message.read_at, "dateTime") })
                  : t("not_read")}
            </span>
            <DeleteMessageButton messageId={message.id} />
          </div>
        </li>
      ))}
    </ol>
  );
}
