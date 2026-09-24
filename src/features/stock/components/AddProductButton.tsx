"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useTranslations } from "next-intl";
import { addProduct, uploadProductImage } from "../actions";

export function AddProductButton({
  label,
  hasShopSlug,
  suppliers,
}: {
  label: string;
  hasShopSlug: boolean;
  suppliers: { id: string; name: string }[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations("Stock");
  const tFeedback = useTranslations("Feedback");

  const close = () => {
    setIsOpen(false);
    setPreviewUrl(null);
  };

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const imageFile = imageInputRef.current?.files?.[0];

    startTransition(async () => {
      const result = await addProduct(formData);
      if (!result?.productId) {
        setError(tFeedback(result?.error ?? "product_save_failed"));
        return;
      }
      if (result.error) {
        // Product created, but its opening stock could not be recorded.
        setError(tFeedback(result.error));
      }

      if (imageFile) {
        const imageFormData = new FormData();
        imageFormData.append("image", imageFile);
        const uploadResult = await uploadProductImage(result.productId, imageFormData);
        if (uploadResult.error) {
          setError(tFeedback(uploadResult.error));
          return;
        }
      }

      // Keep the dialog open on a partial failure so the message stays visible.
      if (result.error) return;
      alert(t("add_success"));
      close();
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-xl bg-violet-600 px-3 sm:px-5 py-2.5 text-[13px] font-bold text-white hover:bg-violet-700 transition-colors shadow-sm"
      >
        <Plus className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">{label}</span>
      </button>

      <Modal isOpen={isOpen} onClose={close} title={t("add_product")}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && <p className="text-[13px] font-medium text-red-500">{error}</p>}

          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-50 dark:bg-[#14121a] border border-zinc-100 dark:border-[#2d2936]">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[11px] font-bold text-zinc-400">{t("no_image")}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="flex items-center gap-2 rounded-xl border border-dashed border-zinc-200 bg-white px-4 py-2 text-[13px] font-bold text-zinc-600 hover:border-violet-400 hover:text-violet-600 dark:border-[#2d2936] dark:bg-[#1C1A22] dark:text-zinc-400 transition-colors"
            >
              <Upload className="h-4 w-4" />
              {t("choose_image")}
            </button>
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300">{t("name")}</label>
            <input required type="text" name="name" className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[#2d2936] dark:bg-[#1C1A22]" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300">{t("category")}</label>
              <input type="text" name="category" placeholder={t("optional")} className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[#2d2936] dark:bg-[#1C1A22]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300">{t("type")}</label>
              <input type="text" name="type" placeholder={t("optional")} className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[#2d2936] dark:bg-[#1C1A22]" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300">{t("brand")}</label>
            <input type="text" name="brand" placeholder={t("optional")} className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[#2d2936] dark:bg-[#1C1A22]" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300">{t("supplier")}</label>
              <select name="supplier_id" defaultValue={""} className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium dark:border-[#2d2936] dark:bg-[#1C1A22]">
                <option value="">{t("no_supplier")}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300">{t("origin_country")}</label>
              <input type="text" name="origin_country" defaultValue={""} placeholder={t("optional")} className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium dark:border-[#2d2936] dark:bg-[#1C1A22]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300">{t("purchase_price")}</label>
              <input type="number" name="purchase_price" placeholder={t("optional")} className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[#2d2936] dark:bg-[#1C1A22]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300">{t("price")}</label>
              <input type="number" name="price" placeholder={t("optional")} className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[#2d2936] dark:bg-[#1C1A22]" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300">{t("stock_qty")}</label>
            <input required type="number" min="0" name="stock_qty" defaultValue={0} className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[#2d2936] dark:bg-[#1C1A22]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300">{t("description")}</label>
            <textarea name="description" rows={2} placeholder={t("optional")} className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[#2d2936] dark:bg-[#1C1A22] resize-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 text-[13px] font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer">
              <input type="checkbox" name="is_published_online" value="true" className="rounded border-zinc-200 dark:border-[#2d2936]" />
              {t("publish_online")}
            </label>
            {!hasShopSlug && (
              <p className="ml-6 text-[11px] font-bold text-amber-600 dark:text-amber-400">{t("publish_online_no_slug_hint")}</p>
            )}
          </div>

          <div className="mt-4 flex justify-end gap-3">
            <button type="button" onClick={close} className="rounded-xl px-5 py-2.5 text-[13px] font-bold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-[#2d2936] transition-colors">
              {t("cancel")}
            </button>
            <button type="submit" disabled={isPending} className="rounded-xl bg-violet-600 px-5 py-2.5 text-[13px] font-bold text-white hover:bg-violet-700 transition-colors disabled:opacity-50 shadow-sm">
              {isPending ? "..." : t("submit")}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
