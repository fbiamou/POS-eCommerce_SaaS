"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { useTranslations } from "next-intl";
import { addProduct } from "../actions";

export function AddProductButton({ label }: { label: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("Stock");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await addProduct(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        alert(t("add_success"));
        setIsOpen(false);
      }
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

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={t("add_product")}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <p className="text-sm font-medium text-red-500">{error}</p>}
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
            <button type="button" onClick={() => setIsOpen(false)} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800">
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
