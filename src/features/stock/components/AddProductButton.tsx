"use client";

import { useRef, useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useTranslations } from "next-intl";
import { addProduct, uploadProductImage } from "../actions";

export function AddProductButton({ label }: { label: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations("Stock");

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
      if (result?.error || !result?.productId) {
        setError(result?.error ?? "Erreur lors de l'enregistrement du produit.");
        return;
      }

      if (imageFile) {
        const imageFormData = new FormData();
        imageFormData.append("image", imageFile);
        const uploadResult = await uploadProductImage(result.productId, imageFormData);
        if (uploadResult.error) {
          setError(uploadResult.error);
          return;
        }
      }

      alert(t("add_success"));
      close();
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
      >
        {label}
      </button>

      <Modal isOpen={isOpen} onClose={close} title={t("add_product")}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <p className="text-sm font-medium text-red-500">{error}</p>}

          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-zinc-400">{t("no_image")}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="flex items-center gap-2 rounded-md border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-500 hover:border-violet-400 hover:text-violet-600 dark:border-zinc-600"
            >
              <Upload className="h-4 w-4" />
              {t("choose_image")}
            </button>
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t("name")}</label>
            <input required type="text" name="name" className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t("category")}</label>
              <input required type="text" name="category" className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t("type")}</label>
              <input type="text" name="type" placeholder={t("optional")} className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t("brand")}</label>
            <input type="text" name="brand" placeholder={t("optional")} className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t("purchase_price")}</label>
              <input type="number" name="purchase_price" placeholder={t("optional")} className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t("price")}</label>
              <input type="number" name="price" placeholder={t("optional")} className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t("stock_qty")}</label>
            <input required type="number" name="stock_qty" className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t("description")}</label>
            <textarea name="description" rows={2} placeholder={t("optional")} className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 resize-none" />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input type="checkbox" name="is_published_online" value="true" className="rounded border-zinc-300" />
            {t("publish_online")}
          </label>

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={close} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800">
              {t("cancel")}
            </button>
            <button type="submit" disabled={isPending} className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 dark:bg-white dark:text-black disabled:opacity-50">
              {isPending ? "..." : t("submit")}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
