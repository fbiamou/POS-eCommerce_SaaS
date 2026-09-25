import { getTranslations } from "next-intl/server";
import { Megaphone, TriangleAlert } from "lucide-react";
import { getFormatters } from "@/features/settings/queries";
import type { ShopMessage } from "../queries";
import { MarkReadButton } from "./MarkReadButton";

// Messages from WISHOP at the top of the owner's app, until she marks them
// as read. A warning (e.g. after a report) stands out in amber.
export async function ShopMessages({ messages }: { messages: ShopMessage[] }) {
  if (messages.length === 0) return null;
  const [t, format] = await Promise.all([getTranslations("Messages"), getFormatters()]);
  return (
    <div className="mb-5 flex flex-col gap-3">
      {messages.map((message) => {
        const warning = message.tone === "WARNING";
        return (
          <section
            key={message.id}
            role={warning ? "alert" : "status"}
            className={`rounded-2xl p-4 ring-1 ${
              warning
                ? "bg-amber-50 text-amber-950 ring-amber-300 dark:bg-amber-900/20 dark:text-amber-100 dark:ring-amber-800"
                : "bg-violet-50 text-zinc-900 ring-violet-200 dark:bg-violet-900/20 dark:text-zinc-100 dark:ring-violet-900/40"
            }`}
          >
            <div className="flex items-start gap-3">
              {warning ? <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /> : <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />}
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold uppercase tracking-wider opacity-70">
                  {t("from_wishop")} · {format.date(message.created_at)}
                </p>
                <h2 className="mt-0.5 font-bold">{message.title}</h2>
                <p className="mt-1 whitespace-pre-line text-[14px] leading-relaxed">{message.body}</p>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <MarkReadButton messageId={message.id} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
