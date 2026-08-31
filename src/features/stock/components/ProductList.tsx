"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/Modal";

export type Product = {
  id: string;
  name: string;
  category: { name: string } | null;
  quantity_in_stock: number;
  purchase_price: number;
  selling_price: number;
};

export default function ProductList({ products }: { products: Product[] }) {
  const t = useTranslations("Stock");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Editing product...", editingProduct);
    alert(t("update_success"));
    setEditingProduct(null);
  };

  return (
    <>
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900/50">
              <tr>
                <th className="p-4 font-medium">{t("name")}</th>
                <th className="p-4 font-medium">{t("category")}</th>
                <th className="p-4 font-medium text-right">{t("stock_qty")}</th>
                <th className="p-4 font-medium text-right">{t("price")}</th>
                <th className="p-4 font-medium text-right">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                  <td className="p-4 font-medium">{product.name}</td>
                  <td className="p-4 text-zinc-500">{product.category?.name || "-"}</td>
                  <td className="p-4 text-right">
                    {product.quantity_in_stock <= 5 ? (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-900/30 dark:text-red-400">
                        {product.quantity_in_stock}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        {product.quantity_in_stock}
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">{product.selling_price.toLocaleString("fr-FR")} FCFA</td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => setEditingProduct(product)}
                      className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {t("edit")}
                    </button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-500">
                    {t("not_found")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={!!editingProduct} onClose={() => setEditingProduct(null)} title={t("edit_product_title")}>
        {editingProduct && (
          <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t("item_name")}</label>
              <input required type="text" defaultValue={editingProduct.name} className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">{t("category")}</label>
                <input required type="text" defaultValue={editingProduct.category?.name} className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">{t("type_brand")}</label>
                <input type="text" placeholder={t("optional")} className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">{t("purchase_price")}</label>
                <input required type="number" defaultValue={editingProduct.purchase_price} className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">{t("selling_price")}</label>
                <input required type="number" defaultValue={editingProduct.selling_price} className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t("quantity_in_stock")}</label>
              <input required type="number" defaultValue={editingProduct.quantity_in_stock} className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setEditingProduct(null)} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800">
                {t("cancel")}
              </button>
              <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 dark:bg-white dark:text-black">
                {t("update")}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
