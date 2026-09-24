"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { PhoneCountryCodeSelect } from "@/components/PhoneCountryCodeSelect";
import { splitPhone } from "@/lib/phoneCountryCodes";
import type { FeedbackCode } from "@/lib/feedback";
import { saveSupplier, setSupplierActive } from "../actions";
import type { Supplier } from "../queries";

const inputClass =
  "w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)] dark:bg-[var(--surface-1)]";

export function SupplierManager({
  suppliers,
  defaultPhoneCountryCode,
}: {
  suppliers: Supplier[];
  defaultPhoneCountryCode: string;
}) {
  const t = useTranslations("Suppliers");
  const tFeedback = useTranslations("Feedback");
  const [editing, setEditing] = useState<Supplier | "new" | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState(defaultPhoneCountryCode);
  const [error, setError] = useState<FeedbackCode | null>(null);
  const [isPending, startTransition] = useTransition();

  const open = (supplier: Supplier | "new") => {
    const { code, digits } = splitPhone(supplier === "new" ? null : supplier.phone, defaultPhoneCountryCode);
    setName(supplier === "new" ? "" : supplier.name);
    setPhone(digits);
    setCountryCode(code);
    setError(null);
    setEditing(supplier);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    if (editing && editing !== "new") formData.set("id", editing.id);
    formData.set("name", name);
    formData.set("phone", phone);
    formData.set("phone_country_code", countryCode);
    startTransition(async () => {
      const result = await saveSupplier(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(null);
    });
  };

  const toggleActive = (supplier: Supplier) => {
    startTransition(async () => {
      const result = await setSupplierActive(supplier.id, !supplier.is_active);
      if (result.error) setError(result.error);
    });
  };

  return (
    <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm dark:border-[var(--line)] dark:bg-[var(--surface-1)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{t("title")}</h2>
          <p className="text-xs text-zinc-500">{t("subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => open("new")}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" /> {t("add")}
        </button>
      </div>

      {error && !editing && <p className="mb-3 text-sm text-red-600">{tFeedback(error)}</p>}

      {suppliers.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-white/5">
          {suppliers.map((supplier) => (
            <li key={supplier.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className={`truncate text-sm font-bold ${supplier.is_active ? "" : "text-zinc-400 line-through"}`}>
                  {supplier.name}
                </p>
                <p className="text-xs text-zinc-500">{supplier.phone || t("no_phone")}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleActive(supplier)}
                  disabled={isPending}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5"
                >
                  {supplier.is_active ? t("deactivate") : t("reactivate")}
                </button>
                <button
                  type="button"
                  onClick={() => open(supplier)}
                  title={t("edit")}
                  aria-label={t("edit")}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 hover:bg-violet-600 hover:text-white dark:bg-[var(--line)] dark:text-zinc-300"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? t("add") : t("edit")}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="supplier_name" className="text-[13px] font-bold">{t("name")}</label>
            <input id="supplier_name" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="supplier_phone" className="text-[13px] font-bold">{t("phone")}</label>
            <div className="flex gap-2">
              <PhoneCountryCodeSelect value={countryCode} onChange={setCountryCode} label={t("phone_country_code")} />
              <input
                id="supplier_phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`${inputClass} min-w-0 flex-1`}
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{tFeedback(error)}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(null)} className="rounded-xl px-4 py-2.5 text-[13px] font-bold hover:bg-zinc-100 dark:hover:bg-white/5">
              {t("cancel")}
            </button>
            <button type="submit" disabled={isPending} className="rounded-xl bg-violet-600 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-violet-700 disabled:opacity-50">
              {t("save")}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
