"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Copy, MessageCircle, Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { PhoneCountryCodeSelect } from "@/components/PhoneCountryCodeSelect";
import { buildWhatsAppClickToChatUrl } from "@/features/reminders/whatsapp";
import type { FeedbackCode } from "@/lib/feedback";
import { createShipmentLink } from "../actions";
import { buildIntakeUrl } from "../matching";
import type { OpenPurchaseOrder } from "../queries";

const inputClass =
  "w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[#2d2936] dark:bg-[#1C1A22]";

export function NewShipmentLinkButton({
  openPurchaseOrders,
  defaultPhoneCountryCode,
  shopName,
  presetPurchaseOrderId,
  label,
}: {
  openPurchaseOrders: OpenPurchaseOrder[];
  defaultPhoneCountryCode: string;
  shopName: string;
  presetPurchaseOrderId?: string;
  label?: string;
}) {
  const t = useTranslations("Shipments");
  const tFeedback = useTranslations("Feedback");
  const locale = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState(defaultPhoneCountryCode);
  const [purchaseOrderId, setPurchaseOrderId] = useState(presetPurchaseOrderId ?? "");
  const [created, setCreated] = useState<{ url: string; reference: string; phone: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<FeedbackCode | null>(null);
  const [isPending, startTransition] = useTransition();

  const open = () => {
    setName("");
    setPhone("");
    setPurchaseOrderId(presetPurchaseOrderId ?? "");
    setCreated(null);
    setCopied(false);
    setError(null);
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.set("intermediary_name", name);
    formData.set("phone", phone);
    formData.set("phone_country_code", countryCode);
    if (purchaseOrderId) formData.set("purchase_order_id", purchaseOrderId);
    startTransition(async () => {
      const result = await createShipmentLink(formData);
      if (result.error || !result.token || !result.reference) {
        setError(result.error ?? "generic_error");
        return;
      }
      const digits = phone.replace(/\D/g, "");
      setCreated({
        url: buildIntakeUrl(window.location.origin, locale, result.token),
        reference: result.reference,
        phone: digits ? `${countryCode}${digits}` : null,
      });
    });
  };

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const whatsappMessage = created
    ? t("link_whatsapp_message", { reference: created.reference, url: created.url, shop: shopName })
    : "";
  // Without the intermediary's number, WhatsApp opens its contact picker.
  const whatsappUrl = created
    ? created.phone
      ? buildWhatsAppClickToChatUrl(created.phone, whatsappMessage)
      : `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`
    : "";

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-violet-700"
      >
        <Plus className="h-4 w-4" /> {label ?? t("new_link")}
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={created ? t("link_ready", { reference: created.reference }) : t("new_link")}>
        {created ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">{t("link_explanation")}</p>
            <input readOnly value={created.url} onFocus={(e) => e.currentTarget.select()} className={`${inputClass} font-mono text-xs`} />
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={copy}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-[13px] font-bold hover:bg-zinc-50 dark:border-[#2d2936] dark:hover:bg-white/5"
              >
                <Copy className="h-4 w-4" /> {copied ? t("copied") : t("copy_link")}
              </button>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#128C7E] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#0e6f63]"
              >
                <MessageCircle className="h-4 w-4" /> {t("share_whatsapp")}
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">{t("new_link_explanation")}</p>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="intermediary_name" className="text-[13px] font-bold">{t("intermediary_name")}</label>
              <input id="intermediary_name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("optional")} className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="intermediary_phone" className="text-[13px] font-bold">{t("intermediary_phone")}</label>
              <div className="flex gap-2">
                <PhoneCountryCodeSelect value={countryCode} onChange={setCountryCode} label={t("phone_country_code")} />
                <input
                  id="intermediary_phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t("optional")}
                  className={`${inputClass} min-w-0 flex-1`}
                />
              </div>
            </div>
            {openPurchaseOrders.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="purchase_order_id" className="text-[13px] font-bold">{t("linked_purchase_order")}</label>
                <select id="purchase_order_id" value={purchaseOrderId} onChange={(e) => setPurchaseOrderId(e.target.value)} className={inputClass}>
                  <option value="">{t("no_purchase_order")}</option>
                  {openPurchaseOrders.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.reference}
                      {po.supplier_name ? ` · ${po.supplier_name}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {error && <p className="text-sm text-red-600">{tFeedback(error)}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsOpen(false)} className="rounded-xl px-4 py-2.5 text-[13px] font-bold hover:bg-zinc-100 dark:hover:bg-white/5">
                {t("cancel")}
              </button>
              <button type="submit" disabled={isPending} className="rounded-xl bg-violet-600 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-violet-700 disabled:opacity-50">
                {t("create_link")}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
