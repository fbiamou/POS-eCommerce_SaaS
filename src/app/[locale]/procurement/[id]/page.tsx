import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import ProcurementForm from "@/features/procurement/components/ProcurementForm";

type Intake = {
  reference: string;
  status: "AWAITING_DECLARATION" | "IN_TRANSIT" | "RECEIVED" | "CANCELLED";
  shop_name: string | null;
  shop_logo_url: string | null;
  currency_symbol: string;
};

async function getIntake(token: string): Promise<Intake | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_shipment_intake", { _token: token });
  if (error) console.error("get_shipment_intake failed:", error);
  return ((data as Intake[] | null) ?? [])[0] ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, intake] = await Promise.all([getTranslations("Procurement"), getIntake(id)]);
  // A private link: kept out of search engines.
  return {
    title: { absolute: intake ? `${t("page_title")} · ${intake.reference}` : t("page_title") },
    robots: { index: false, follow: false },
  };
}

// Public page, no account: the parcel's intermediary declares its content
// through the one-time link the shop sent. The link (token) is the only key.
export default async function ProcurementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, intake] = await Promise.all([getTranslations("Procurement"), getIntake(id)]);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{intake?.shop_name || t("page_title")}</p>
            {intake && <p className="font-mono text-xs text-zinc-500">{t("parcel_reference", { reference: intake.reference })}</p>}
          </div>
          <LocaleSwitcher variant="dropdown" />
        </div>
      </header>

      {!intake ? (
        <p className="mx-auto max-w-md p-8 text-center text-sm text-zinc-600">{t("link_invalid")}</p>
      ) : intake.status === "AWAITING_DECLARATION" ? (
        <>
          <p className="mx-auto max-w-md px-4 pt-4 text-sm text-zinc-600">{t("intro")}</p>
          <ProcurementForm token={id} currencySymbol={intake.currency_symbol} />
        </>
      ) : (
        <p className="mx-auto max-w-md p-8 text-center text-sm text-zinc-600">
          {intake.status === "CANCELLED" ? t("link_cancelled") : t("already_submitted")}
        </p>
      )}
    </main>
  );
}
