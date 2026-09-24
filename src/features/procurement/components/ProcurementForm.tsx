"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Camera, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { formatMoney } from "@/lib/format";
import { feedbackFromError, type FeedbackCode } from "@/lib/feedback";
import { normalizeDeclaredItem, type DeclaredItem } from "@/features/shipments/matching";

const inputClass =
  "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";

const MAX_PHOTO_WIDTH = 1600;

// Phone photos weigh several megabytes: resize before sending, over what may
// be a slow mobile connection. Formats the browser cannot decode (HEIC on
// most Android browsers) are sent as they are.
async function shrinkPhoto(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_PHOTO_WIDTH / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob ?? file;
  } catch {
    return file;
  }
}

// The intermediary's page: no account, one link per parcel. What has been
// typed is kept in this browser until the parcel is submitted, so a lost
// connection or a reload never loses the list.
export default function ProcurementForm({ token, currencySymbol }: { token: string; currencySymbol: string }) {
  const t = useTranslations("Procurement");
  const tFeedback = useTranslations("Feedback");
  const locale = useLocale();
  const storageKey = `parcel-declaration-${token}`;

  const [draft, setDraft] = useState<{ items: DeclaredItem[]; restored: boolean }>({ items: [], restored: false });
  const items = draft.items;
  const setItems = (update: (prev: DeclaredItem[]) => DeclaredItem[]) =>
    setDraft((prev) => ({ ...prev, items: update(prev.items) }));
  const [form, setForm] = useState({ name: "", category: "", type: "", brand: "", unit_price: "", quantity: "1" });
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState<FeedbackCode | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedReference, setSubmittedReference] = useState<string | null>(null);

  useEffect(() => {
    let saved: DeclaredItem[] = [];
    try {
      saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]") as DeclaredItem[];
    } catch {
      // Storage unavailable (private mode): the list simply is not kept.
    }
    // Browser-only storage can only be read after hydration, hence the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft({ items: saved, restored: true });
  }, [storageKey]);

  useEffect(() => {
    if (!draft.restored) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // Storage unavailable: nothing to do.
    }
  }, [items, draft.restored, storageKey]);

  const money = (amount: number) => formatMoney(amount, currencySymbol, locale);
  const total = useMemo(() => items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0), [items]);
  const units = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  const addItem = (e?: React.FormEvent) => {
    e?.preventDefault();
    const item = normalizeDeclaredItem(form);
    if (!item) {
      setError(form.name.trim() ? "invalid_quantity" : "required_fields_missing");
      return;
    }
    setError(null);
    setItems((prev) => [...prev, item]);
    // Keep category, type and brand: parcels usually hold several items of the same family.
    setForm((prev) => ({ ...prev, name: "", unit_price: "", quantity: "1" }));
  };

  const pickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const submit = async () => {
    setError(null);
    if (items.length === 0) {
      setError("empty_cart");
      return;
    }
    if (!photo) {
      setError("photo_required");
      return;
    }
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const blob = await shrinkPhoto(photo);
      const extension = blob.type === "image/jpeg" ? "jpg" : (photo.name.split(".").pop() ?? "jpg").toLowerCase();
      const path = `${token}/${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("shipment-photos")
        .upload(path, blob, { contentType: blob.type || photo.type, upsert: false });
      if (uploadError) {
        console.error("Parcel photo upload failed:", uploadError);
        setError("image_upload_failed");
        return;
      }

      const { data, error: rpcError } = await supabase.rpc("submit_shipment_declaration", {
        _token: token,
        _items: items,
        _photo_path: path,
      });
      if (rpcError) {
        console.error("Declaration failed:", rpcError);
        setError(feedbackFromError(rpcError));
        return;
      }

      try {
        localStorage.removeItem(storageKey);
      } catch {
        // Nothing to clean.
      }
      setSubmittedReference(data as string);
    } catch (err) {
      console.error("Declaration failed:", err);
      setError("generic_error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedReference) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-600" />
        <h2 className="text-xl font-bold">{t("submitted_title")}</h2>
        <p className="text-sm text-zinc-600">{t("submitted_body", { reference: submittedReference })}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 p-4 pb-32">
      {/* method="dialog" outside a <dialog> makes a native submission a no-op:
          pressing Enter before the script has loaded cannot reload the page. */}
      <form method="dialog" onSubmit={addItem} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="font-bold">{t("add_item_title")}</h2>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("item_name")}
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("category")}
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder={t("optional")} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("type")}
            <input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder={t("optional")} className={inputClass} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("brand")}
          <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder={t("optional")} className={inputClass} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("unit_price", { currency: currencySymbol })}
            <input type="number" inputMode="numeric" min={0} value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} placeholder={t("optional")} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("quantity")}
            <input type="number" inputMode="numeric" min={1} required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className={inputClass} />
          </label>
        </div>
        {/* A plain button, not a submit: tapped before the page's script has
            loaded (slow phone), a submit would reload the page and lose what
            was typed. Until then this button simply does nothing. */}
        <button type="button" onClick={() => addItem()} className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 py-3 font-bold text-white hover:bg-zinc-800">
          <Plus className="h-4 w-4" /> {t("add_item")}
        </button>
      </form>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 font-bold">{t("parcel_content", { count: items.length })}</h2>
        {items.length === 0 ? (
          <p className="text-sm text-zinc-500">{t("no_items")}</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {items.map((item, index) => (
              <li key={`${item.name}-${index}`} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{item.name}</p>
                  <p className="text-xs text-zinc-500">
                    {[
                      item.category,
                      item.type,
                      item.brand,
                      `${item.quantity} × ${item.unit_price > 0 ? money(item.unit_price) : t("price_unknown")}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                  aria-label={t("remove_item")}
                  className="rounded-full p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {items.length > 0 && (
          <p className="mt-3 flex justify-between border-t border-zinc-100 pt-3 text-sm font-bold">
            <span>{t("total_units", { units })}</span>
            <span className="tabular-nums">{money(total)}</span>
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="font-bold">{t("photo_title")}</h2>
        <p className="mb-3 text-sm text-zinc-500">{t("photo_hint")}</p>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 p-4 text-sm font-bold text-zinc-700 hover:border-violet-400">
          <Camera className="h-5 w-5" /> {photo ? t("photo_change") : t("photo_take")}
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={pickPhoto} />
        </label>
        {photoPreview && (
          // A local preview of the picked file (blob: URL), never a remote image.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoPreview} alt={t("photo_title")} className="mt-3 max-h-56 w-full rounded-xl object-contain" />
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-md">
          {error && <p className="mb-2 text-sm font-medium text-red-600">{tFeedback(error)}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={isSubmitting}
            className="w-full rounded-xl bg-violet-600 py-3.5 font-bold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {isSubmitting ? t("sending") : t("submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
