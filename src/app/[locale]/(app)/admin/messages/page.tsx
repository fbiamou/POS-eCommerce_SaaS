import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/routing";
import { isPlatformAdmin } from "@/features/admin/queries";
import { listSentMessages } from "@/features/messages/queries";
import { SendMessageForm } from "@/features/messages/components/SendMessageForm";
import { SentMessages } from "@/features/messages/components/SentMessages";

export async function generateMetadata() {
  const t = await getTranslations("Messages");
  return { title: t("to_all_title") };
}

// Console: an announcement to every shop (new feature, maintenance, price
// change announced 30 days ahead...). Shops that join later do not see it.
export default async function AdminMessagesPage() {
  if (!(await isPlatformAdmin())) notFound();
  const [t, tAdmin, sent] = await Promise.all([getTranslations("Messages"), getTranslations("Admin"), listSentMessages(null)]);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin" className="flex items-center gap-1.5 text-[13px] font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
        <ArrowLeft className="h-4 w-4" /> {tAdmin("back")}
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("to_all_title")}</h1>
        <p className="mt-1 text-[14px] text-zinc-500">{t("to_all_intro")}</p>
      </div>
      <section className="rounded-2xl bg-[var(--surface-1)] p-5 shadow-card sm:p-6">
        <SendMessageForm shopId={null} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{t("history")}</h2>
        <SentMessages messages={sent} toAll />
      </section>
    </div>
  );
}
