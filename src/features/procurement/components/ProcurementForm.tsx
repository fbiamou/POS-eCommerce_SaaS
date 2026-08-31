"use client";

import { useState, useEffect } from "react";
import { useProcurementStore } from "../store/useProcurementStore";
import { useTranslations } from "next-intl";
import { Camera, Plus, Trash2, CheckCircle2 } from "lucide-react";

export default function ProcurementForm({ procurementId }: { procurementId: string }) {
  const t = useTranslations("Procurement");
  const { items, addItem, removeItem, clearCart } = useProcurementStore();
  const [mounted, setMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [category, setCategory] = useState("");
  const [type, setType] = useState("");
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !type || !name || !price || !quantity) return;

    addItem({
      id: crypto.randomUUID(),
      category,
      type,
      brand,
      name,
      unit_price: Number(price),
      quantity: Number(quantity),
    });

    // Reset some fields for quick next entry
    setName("");
    setPrice("");
    setQuantity("1");
  };

  const handleSubmitColis = () => {
    // Simulated upload and submission
    const confirmed = window.confirm(t("confirm_photo_upload"));
    if (confirmed) {
      setIsSubmitting(true);
      setTimeout(() => {
        alert(t("submit_success"));
        clearCart();
        setIsSubmitting(false);
      }, 1500);
    }
  };

  if (!mounted) return null; // Avoid hydration mismatch

  const totalColis = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

  return (
    <div className="max-w-xl mx-auto p-4 space-y-8 pb-24">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("ref_label", { id: procurementId })}</p>
      </div>

      {/* Formulaire d'ajout */}
      <form onSubmit={handleAddItem} className="space-y-4 bg-card p-4 rounded-xl border shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("category")}</label>
            <input 
              type="text" 
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border p-2 text-sm" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("type")}</label>
            <input 
              type="text" 
              required
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-md border p-2 text-sm" 
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("brand_optional")}</label>
            <input 
              type="text" 
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full rounded-md border p-2 text-sm" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("item_name")}</label>
            <input 
              type="text" 
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border p-2 text-sm" 
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("unit_price")}</label>
            <input 
              type="number" 
              required
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full rounded-md border p-2 text-sm" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("quantity")}</label>
            <input 
              type="number" 
              required
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-md border p-2 text-sm" 
            />
          </div>
        </div>

        <button 
          type="submit" 
          className="w-full mt-2 flex items-center justify-center gap-2 rounded-md bg-secondary text-secondary-foreground py-2 font-medium hover:bg-secondary/80 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t("add_item")}
        </button>
      </form>

      {/* Liste des articles du colis */}
      <div className="space-y-3">
        <h2 className="font-semibold text-lg flex items-center justify-between">
          {t("cart")}
          <span className="text-sm font-normal text-muted-foreground bg-accent px-2 py-1 rounded-full">
            {t("items_count", { count: items.length })}
          </span>
        </h2>

        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground bg-muted/50 rounded-lg border border-dashed">
            {t("no_items")}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border bg-card shadow-sm">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.category} &gt; {item.type} {item.brand && `> ${item.brand}`}
                  </p>
                  <p className="text-sm text-primary font-medium mt-1">
                    {item.quantity} x {item.unit_price.toLocaleString()} FCFA
                  </p>
                </div>
                <button 
                  onClick={() => removeItem(item.id)}
                  className="p-2 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            <div className="flex justify-between items-center pt-4 border-t mt-4 font-bold text-lg">
              <span>{t("total_colis")}</span>
              <span>{totalColis.toLocaleString()} FCFA</span>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Button pour clôturer */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-10 flex justify-center">
          <button 
            onClick={handleSubmitColis}
            disabled={isSubmitting}
            className="w-full max-w-xl flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground py-4 font-bold text-lg hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="animate-pulse">{t("sending")}</span>
            ) : (
              <>
                <Camera className="h-5 w-5" />
                {t("submit")}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
