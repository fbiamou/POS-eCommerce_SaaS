"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useShopFormat } from "@/components/ShopFormatProvider";
import { updateProduct, uploadProductImage } from "../actions";

export type Product = {
  id: string;
  name: string;
  brand: string | null;
  product_type: string | null;
  category: { name: string } | null;
  quantity_in_stock: number;
  purchase_price: number;
  selling_price: number;
  description: string | null;
  image_url: string | null;
  is_published_online: boolean;
};

export default function ProductList({ products, hasShopSlug }: { products: Product[]; hasShopSlug: boolean }) {
  const t = useTranslations("Stock");
  const tFeedback = useTranslations("Feedback");
  const format = useShopFormat();
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isUploadingImage, startImageUpload] = useTransition();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const openEdit = (product: Product) => {
    setError(null);
    setPreviewUrl(product.image_url);
    setEditingProduct(product);
  };

  const closeEdit = () => {
    setEditingProduct(null);
    setPreviewUrl(null);
  };

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await updateProduct(formData);
      if (result.error) {
        setError(tFeedback(result.error));
        return;
      }
      alert(t("update_success"));
      closeEdit();
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingProduct) return;

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    const formData = new FormData();
    formData.append("image", file);

    startImageUpload(async () => {
      const result = await uploadProductImage(editingProduct.id, formData);
      if (result.error) {
        setError(tFeedback(result.error));
      } else if (result.imageUrl) {
        setPreviewUrl(result.imageUrl);
      }
    });
  };

  return (
    <>
      <div className="rounded-2xl border border-zinc-100 bg-white dark:border-[#2d2936] dark:bg-[#1C1A22] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="bg-zinc-50/50 dark:bg-white/5 border-b border-zinc-100 dark:border-[#2d2936]">
              <tr>
                <th className="p-4 text-[11px] font-bold text-zinc-400 tracking-widest uppercase">{t("name")}</th>
                <th className="p-4 text-[11px] font-bold text-zinc-400 tracking-widest uppercase">{t("category")}</th>
                <th className="p-4 text-[11px] font-bold text-zinc-400 tracking-widest uppercase text-right">{t("stock_qty")}</th>
                <th className="p-4 text-[11px] font-bold text-zinc-400 tracking-widest uppercase text-right">{t("price")}</th>
                <th className="p-4 text-[11px] font-bold text-zinc-400 tracking-widest uppercase text-center">{t("published_online_column")}</th>
                <th className="p-4 text-[11px] font-bold text-zinc-400 tracking-widest uppercase text-right">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-white/5">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="p-4">
                    <span className="block text-sm font-bold text-zinc-900 dark:text-white">{product.name}</span>
                    {(product.brand || product.product_type) && (
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        {[product.product_type, product.brand].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-sm text-zinc-500 dark:text-zinc-400">{product.category?.name || "-"}</td>
                  <td className="p-4 text-right">
                    {format.isLowStock(product.quantity_in_stock) ? (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800 dark:bg-red-900/30 dark:text-red-400 tabular-nums">
                        {product.quantity_in_stock}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 tabular-nums">
                        {product.quantity_in_stock}
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <span className="font-mono text-[13px] sm:text-sm font-bold text-zinc-900 dark:text-white tabular-nums">
                      {format.money(product.selling_price)}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    {product.is_published_online && (
                      <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-800 dark:bg-violet-900/30 dark:text-violet-300">
                        {t("published")}
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => openEdit(product)}
                      className="text-sm font-medium text-violet-600 hover:underline dark:text-violet-400"
                    >
                      {t("edit")}
                    </button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-500">
                    {t("not_found")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={!!editingProduct} onClose={closeEdit} title={t("edit_product_title")}>
        {editingProduct && (
          <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
            {error && <p className="text-sm font-medium text-red-500">{error}</p>}
            <input type="hidden" name="id" value={editingProduct.id} />

            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800 flex-shrink-0">
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
                disabled={isUploadingImage}
                className="flex items-center gap-2 rounded-md border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-500 hover:border-violet-400 hover:text-violet-600 disabled:opacity-50 dark:border-zinc-600"
              >
                <Upload className="h-4 w-4" />
                {isUploadingImage ? t("uploading") : t("choose_image")}
              </button>
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t("item_name")}</label>
              <input required name="name" type="text" defaultValue={editingProduct.name} className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">{t("category")}</label>
                <input name="category" type="text" defaultValue={editingProduct.category?.name ?? ""} placeholder={t("optional")} className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">{t("type")}</label>
                <input name="type" type="text" defaultValue={editingProduct.product_type ?? ""} placeholder={t("optional")} className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">{t("brand")}</label>
                <input name="brand" type="text" defaultValue={editingProduct.brand ?? ""} placeholder={t("optional")} className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">{t("purchase_price")}</label>
                <input name="purchase_price" type="number" defaultValue={editingProduct.purchase_price} className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">{t("selling_price")}</label>
                <input name="selling_price" type="number" min="0" defaultValue={editingProduct.selling_price} className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">{t("quantity_in_stock")}</label>
                <input required name="quantity_in_stock" type="number" min="0" defaultValue={editingProduct.quantity_in_stock} className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t("description")}</label>
              <textarea name="description" rows={2} defaultValue={editingProduct.description || ""} placeholder={t("optional")} className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 resize-none" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input type="checkbox" name="is_published_online" value="true" defaultChecked={editingProduct.is_published_online} className="rounded border-zinc-300" />
                {t("publish_online")}
              </label>
              {!hasShopSlug && (
                <p className="ml-6 text-xs text-amber-600 dark:text-amber-400">{t("publish_online_no_slug_hint")}</p>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={closeEdit} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800">
                {t("cancel")}
              </button>
              <button type="submit" disabled={isPending} className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors disabled:opacity-50">
                {isPending ? "..." : t("update")}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
