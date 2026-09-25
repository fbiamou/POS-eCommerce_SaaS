"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/Modal";
import { createClient } from "@/utils/supabase/client";
import { feedbackFromError, type FeedbackCode } from "@/lib/feedback";

const REASONS = ["COUNTERFEIT", "PROHIBITED", "MISLEADING", "OTHER"] as const;
type Reason = (typeof REASONS)[number];

const inputClass =
  "w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-[15px] outline-none transition-colors placeholder:text-zinc-400 focus:border-[var(--accent-bg)] focus:ring-1 focus:ring-[var(--accent-bg)]";

// The "Signaler" link promised by the terms of use (article 13): anyone can
// report an illegal content on a storefront. The report goes to WISHOP, which
// hosts the page, not to the shop (see report_storefront_content).
export function ReportContent({
  slug,
  product,
  isOpen,
  onClose,
}: {
  slug: string;
  product: { product_id: string; name: string } | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("Storefront");
  const tFeedback = useTranslations("Feedback");
  const [reason, setReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState("");
  const [contact, setContact] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<FeedbackCode | null>(null);

  const close = () => {
    onClose();
    setReason(null);
    setDetails("");
    setContact("");
    setSent(false);
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    setError(null);
    setSending(true);
    const { error: rpcError } = await createClient().rpc("report_storefront_content", {
      _shop_slug: slug,
      _reason: reason,
      _details: details,
      _product_id: product?.product_id ?? null,
      _reporter_contact: contact,
    });
    setSending(false);
    if (rpcError) setError(feedbackFromError(rpcError));
    else setSent(true);
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title={t("report_title")}>
      {sent ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <CheckCircle2 className="h-14 w-14 text-emerald-600" />
          <h3 className="store-heading text-xl font-bold">{t("report_sent_title")}</h3>
          <p className="px-4 text-[15px] text-zinc-600">{t("report_sent_body")}</p>
          <button type="button" onClick={close} className="mt-2 rounded-xl bg-zinc-100 px-6 py-3 text-[14px] font-semibold text-zinc-900 hover:bg-zinc-200">
            {t("report_close")}
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <p className="text-[14px] text-zinc-600">{t("report_intro")}</p>
          {product && (
            <p className="rounded-xl bg-zinc-100 px-4 py-3 text-[14px] text-zinc-800">{t("report_about", { name: product.name })}</p>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] font-semibold text-zinc-700">{t("report_reason")}</legend>
            {REASONS.map((value) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 px-4 py-3 text-[15px] has-[:checked]:border-[var(--accent-bg)] has-[:checked]:bg-[var(--accent-light)]"
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={value}
                  required
                  checked={reason === value}
                  onChange={() => setReason(value)}
                  className="h-4 w-4 accent-[var(--accent-bg)]"
                />
                {t(`report_reason_${value}`)}
              </label>
            ))}
          </fieldset>

          <label htmlFor="report-details" className="text-[13px] font-semibold text-zinc-700">{t("report_details")}</label>
          <textarea
            id="report-details"
            rows={3}
            maxLength={1000}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder={t("report_details_placeholder")}
            className={inputClass}
          />

          <label htmlFor="report-contact" className="text-[13px] font-semibold text-zinc-700">{t("report_contact")}</label>
          <input id="report-contact" type="text" maxLength={120} value={contact} onChange={(e) => setContact(e.target.value)} className={inputClass} />
          <p className="-mt-2 text-[12.5px] text-zinc-500">{t("report_contact_hint")}</p>

          {error && <p role="alert" className="text-center text-[14px] font-semibold text-red-600">{tFeedback(error)}</p>}

          <button
            type="submit"
            disabled={sending || !reason}
            className="rounded-xl bg-zinc-900 py-4 text-[15px] font-bold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
          >
            {sending ? t("report_sending") : t("report_send")}
          </button>
        </form>
      )}
    </Modal>
  );
}
