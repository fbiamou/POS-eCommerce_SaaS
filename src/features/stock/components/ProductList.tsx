"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Upload, Search, Globe, Pencil } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useShopFormat } from "@/components/ShopFormatProvider";
import { updateProduct, uploadProductImage } from "../actions";
import { useToast } from "@/components/ui/Toast";
import { Select } from "@/components/ui/Select";
import { useOptionalOfflineContext } from "@/features/offline/OfflineProvider";
import { useLocalProducts } from "@/features/offline/hooks";

export type Product = {
  id: string;
  name: string;
  brand: string | null;
  product_type: string | null;
  supplier_id: string | null;
  origin_country: string | null;
  category: { name: string } | null;
  quantity_in_stock: number;
  purchase_price: number;
  selling_price: number;
  description: string | null;
  image_url: string | null;
  is_published_online: boolean;
};

export default function ProductList({
  products: serverProducts,
  hasShopSlug,
  suppliers,
}: {
  products: Product[];
  hasShopSlug: boolean;
  suppliers: { id: string; name: string }[];
}) {
  const t = useTranslations("Stock");
  const showToast = useToast((state) => state.show);
  const tFeedback = useTranslations("Feedback");
  const format = useShopFormat();
  const tOffline = useTranslations("Offline");
  // Offline mode: the device's copy of the stock, which already counts the
  // sales made here without internet. Editing an item needs the internet.
  const offline = useOptionalOfflineContext();
  const localProducts = useLocalProducts();
  const products: Product[] = useMemo(
    () =>
      localProducts
        ? localProducts.map((p) => ({
            id: p.id,
            name: p.name,
            brand: p.brand,
            product_type: p.product_type,
            supplier_id: p.supplier_id,
            origin_country: p.origin_country,
            category: p.category_name ? { name: p.category_name } : null,
            quantity_in_stock: p.quantity_in_stock,
            purchase_price: p.purchase_price,
            selling_price: p.selling_price,
            description: p.description,
            image_url: p.image_url,
            is_published_online: p.is_published_online,
          }))
        : serverProducts,
    [localProducts, serverProducts]
  );
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "online">("all");
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
    if (offline && !offline.status.online) {
      setError(tFeedback("needs_connection"));
      return;
    }
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await updateProduct(formData);
      if (result.error) {
        setError(tFeedback(result.error));
        return;
      }
      showToast(t("update_success"));
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

  const lowCount = products.filter((p) => format.isLowStock(p.quantity_in_stock)).length;
  const onlineCount = products.filter((p) => p.is_published_online).length;
  const term = search.trim().toLowerCase();
  const visible = products.filter((p) => {
    if (filter === "low" && !format.isLowStock(p.quantity_in_stock)) return false;
    if (filter === "online" && !p.is_published_online) return false;
    if (!term) return true;
    return [p.name, p.brand, p.product_type, p.category?.name]
      .filter(Boolean)
      .some((v) => (v as string).toLowerCase().includes(term));
  });

  const chipClass = (active: boolean) =>
    `shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
      active
        ? "bg-night text-white dark:bg-violet-500"
        : "bg-[var(--surface-1)] text-zinc-700 shadow-[inset_0_0_0_1px_var(--line)] hover:bg-zinc-100 dark:text-zinc-300"
    }`;

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="relative">
          <label htmlFor="stock-search" className="sr-only">{t("search")}</label>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-zinc-400" />
          <input
            id="stock-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search")}
            className="h-12 w-full rounded-xl border border-zinc-200 bg-[var(--surface-1)] pl-11 pr-4 text-[15px] font-medium transition-colors placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[var(--line)]"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          <button type="button" onClick={() => setFilter("all")} className={chipClass(filter === "all")}>
            {t("filter_all")} <span className="ml-1 font-mono tabular-nums opacity-70">{products.length}</span>
          </button>
          <button type="button" onClick={() => setFilter("low")} className={chipClass(filter === "low")}>
            {t("filter_low")} <span className="ml-1 font-mono tabular-nums opacity-70">{lowCount}</span>
          </button>
          <button type="button" onClick={() => setFilter("online")} className={chipClass(filter === "online")}>
            {t("filter_online")} <span className="ml-1 font-mono tabular-nums opacity-70">{onlineCount}</span>
          </button>
        </div>

        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl bg-[var(--surface-1)] shadow-card dark:divide-[var(--line)]">
          {visible.map((product) => {
            const low = format.isLowStock(product.quantity_in_stock);
            const meta = [product.category?.name, product.product_type, product.brand].filter(Boolean).join(" · ");
            return (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => openEdit(product)}
                  aria-label={`${t("edit")} ${product.name}`}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-[var(--surface-2)]"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-100 font-display text-base font-bold text-zinc-400 dark:bg-[var(--surface-2)]">
                    {product.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      product.name.trim()[0]?.toUpperCase()
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-semibold text-zinc-900 dark:text-white">{product.name}</span>
                      {product.is_published_online && (
                        <span title={t("published")} className="flex shrink-0 items-center text-violet-600 dark:text-violet-300">
                          <Globe className="h-3.5 w-3.5" />
                          <span className="sr-only">{t("published")}</span>
                        </span>
                      )}
                    </span>
                    {meta && <span className="block truncate text-[12px] text-zinc-500">{meta}</span>}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-mono text-[14px] font-semibold tabular-nums">{format.money(product.selling_price)}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[11.5px] font-semibold tabular-nums ${
                        low
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                          : "bg-zinc-100 text-zinc-600 dark:bg-[var(--surface-2)] dark:text-zinc-300"
                      }`}
                    >
                      {t("in_stock_count", { count: product.quantity_in_stock })}
                    </span>
                    {/* Two tills sold the last one during a power cut: both sales were kept. */}
                    {product.quantity_in_stock < 0 && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800 dark:bg-red-900/30 dark:text-red-300">
                        {tOffline("stock_to_check")}
                      </span>
                    )}
                  </span>
                  <Pencil className="hidden h-4 w-4 shrink-0 text-zinc-400 sm:block" />
                </button>
              </li>
            );
          })}
          {visible.length === 0 && (
            <li className="px-4 py-10 text-center text-zinc-500">{t("not_found")}</li>
          )}
        </ul>
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
              <label className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">{t("item_name")}</label>
              <input required name="name" type="text" defaultValue={editingProduct.name} className="rounded-xl border border-zinc-200 bg-[var(--surface-1)] px-3.5 py-2.5 text-[14px] dark:border-[var(--line)]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">{t("category")}</label>
                <input name="category" type="text" defaultValue={editingProduct.category?.name ?? ""} placeholder={t("optional")} className="rounded-xl border border-zinc-200 bg-[var(--surface-1)] px-3.5 py-2.5 text-[14px] dark:border-[var(--line)]" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">{t("type")}</label>
                <input name="type" type="text" defaultValue={editingProduct.product_type ?? ""} placeholder={t("optional")} className="rounded-xl border border-zinc-200 bg-[var(--surface-1)] px-3.5 py-2.5 text-[14px] dark:border-[var(--line)]" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">{t("brand")}</label>
                <input name="brand" type="text" defaultValue={editingProduct.brand ?? ""} placeholder={t("optional")} className="rounded-xl border border-zinc-200 bg-[var(--surface-1)] px-3.5 py-2.5 text-[14px] dark:border-[var(--line)]" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">{t("purchase_price")}</label>
                <input name="purchase_price" type="number" defaultValue={editingProduct.purchase_price} className="rounded-xl border border-zinc-200 bg-[var(--surface-1)] px-3.5 py-2.5 text-[14px] dark:border-[var(--line)]" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">{t("selling_price")}</label>
                <input name="selling_price" type="number" min="0" defaultValue={editingProduct.selling_price} className="rounded-xl border border-zinc-200 bg-[var(--surface-1)] px-3.5 py-2.5 text-[14px] dark:border-[var(--line)]" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">{t("quantity_in_stock")}</label>
                <input required name="quantity_in_stock" type="number" min="0" defaultValue={editingProduct.quantity_in_stock} className="rounded-xl border border-zinc-200 bg-[var(--surface-1)] px-3.5 py-2.5 text-[14px] dark:border-[var(--line)]" />
              </div>
            </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300">{t("supplier")}</label>
              <Select
                name="supplier_id"
                ariaLabel={t("supplier")}
                defaultValue={editingProduct.supplier_id ?? ""}
                options={[{ value: "", label: t("no_supplier") }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300">{t("origin_country")}</label>
              <input type="text" name="origin_country" defaultValue={editingProduct.origin_country ?? ""} placeholder={t("optional")} className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium dark:border-[var(--line)] dark:bg-[var(--surface-1)]" />
            </div>
          </div>
            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">{t("description")}</label>
              <textarea name="description" rows={2} defaultValue={editingProduct.description || ""} placeholder={t("optional")} className="rounded-xl border border-zinc-200 bg-[var(--surface-1)] px-3.5 py-2.5 text-[14px] dark:border-[var(--line)] resize-none" />
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
