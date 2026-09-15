"use client";

import { useState, useMemo, useEffect } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { Plus, Minus, Trash2 } from "lucide-react";
import { useMessages, useTranslations } from "next-intl";
import { useCartStore } from "../store/useCartStore";
import { createClient } from "@/utils/supabase/client";
import { PhoneCountryCodeSelect } from "@/components/PhoneCountryCodeSelect";

export type Product = {
  id: string;
  name: string;
  category: string;
  sub_category: string;
  brand: string;
  selling_price: number;
  quantity_in_stock: number;
};

export type Client = {
  id: string;
  name: string;
};

export default function CreateSaleForm({
  products,
  clients,
  defaultPhoneCountryCode = "+237",
}: {
  products: Product[];
  clients: Client[];
  defaultPhoneCountryCode?: string;
}) {
  const t = useTranslations("Sales");
  const router = useRouter();
  const messages = useMessages();
  const dataMessages = (messages.Data ?? {}) as Record<string, string>;
  const translateData = (value: string) => dataMessages[value] ?? value;

  // Local state for filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<string>("");

  // Hydration check for Zustand
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Zustand state
  const {
    cart,
    selectedClientId,
    paidAmount,
    isCreatingClient,
    newClientName,
    newClientPhone,
    newClientPhoneCountryCode,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    setSelectedClientId,
    setPaidAmount,
    setIsCreatingClient,
    setNewClientName,
    setNewClientPhone,
    setNewClientPhoneCountryCode,
  } = useCartStore();

  // Seed the country code with the shop's configured default the first
  // time it's needed, without overwriting a value the cashier already set.
  useEffect(() => {
    if (!newClientPhoneCountryCode) {
      setNewClientPhoneCountryCode(defaultPhoneCountryCode);
    }
  }, [newClientPhoneCountryCode, defaultPhoneCountryCode, setNewClientPhoneCountryCode]);

  const totalAmount = cart.reduce((sum, item) => {
    const product = products.find(p => p.id === item.productId);
    return sum + (product?.selling_price || 0) * item.quantity;
  }, 0);

  // Derive filter options based on current selection
  const categories = useMemo(() => Array.from(new Set(products.map(p => p.category))), [products]);
  
  const types = useMemo(() => {
    if (!selectedCategory) return [];
    return Array.from(new Set(products.filter(p => p.category === selectedCategory).map(p => p.sub_category)));
  }, [products, selectedCategory]);

  const brands = useMemo(() => {
    if (!selectedType) return [];
    return Array.from(new Set(products.filter(p => p.category === selectedCategory && p.sub_category === selectedType).map(p => p.brand)));
  }, [products, selectedCategory, selectedType]);

  // Handle cascaded filter resets
  useEffect(() => {
    setSelectedType("");
    setSelectedBrand("");
  }, [selectedCategory]);

  useEffect(() => {
    setSelectedBrand("");
  }, [selectedType]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = selectedCategory ? p.category === selectedCategory : true;
      const matchType = selectedType ? p.sub_category === selectedType : true;
      const matchBrand = selectedBrand ? p.brand === selectedBrand : true;
      return matchSearch && matchCategory && matchType && matchBrand;
    });
  }, [products, searchTerm, selectedCategory, selectedType, selectedBrand]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastInvoiceId, setLastInvoiceId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    setLastInvoiceId(null);

    try {
      const supabase = createClient();

      // Get current user's shop_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("shop_id")
        .single();

      if (!profile?.shop_id) {
        throw new Error(t("error_no_shop"));
      }

      let finalClientId: string | null = selectedClientId || null;

      // Create new client if needed
      if (isCreatingClient && newClientName) {
        const digits = newClientPhone.replace(/\D/g, "");
        const fullPhone = digits ? `${newClientPhoneCountryCode || defaultPhoneCountryCode}${digits}` : null;
        const { data: newClient, error: clientError } = await supabase
          .from("clients")
          .insert({
            shop_id: profile.shop_id,
            name: newClientName,
            phone: fullPhone,
          })
          .select("id")
          .single();

        if (clientError) throw new Error(t("error_client_create", { message: clientError.message }));
        finalClientId = newClient.id;
      }

      // Prepare items
      const items = cart.map((item) => {
        const product = products.find((p) => p.id === item.productId);
        return {
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: product?.selling_price ?? 0,
        };
      });

      // Call the record_sale RPC
      const { data: invoiceId, error: rpcError } = await supabase.rpc("record_sale", {
        _shop_id: profile.shop_id,
        _client_id: finalClientId,
        _items: items,
        _paid_amount: paidAmount ? parseInt(paidAmount) : 0,
      });

      if (rpcError) throw new Error(t("error_record_sale", { message: rpcError.message }));

      setLastInvoiceId(invoiceId as string);
      clearCart();
      router.refresh();
    } catch (err: any) {
      setSubmitError(err.message ?? t("error_unknown"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted) return null; // Avoid hydration mismatch

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Liste des produits disponibles */}
      <div className="col-span-1 lg:col-span-2 rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">{t("available_products")}</h2>
        
        {/* Filtres de recherche */}
        <div className="mb-6 flex flex-col gap-4">
          <input 
            type="text" 
            placeholder={t("search")} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="">-- {t("category")} --</option>
              {categories.map(c => <option key={c} value={c}>{translateData(c)}</option>)}
            </select>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              disabled={!selectedCategory}
              className="rounded-md border border-zinc-300 p-2 text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="">-- {t("type")} --</option>
              {types.map(tOption => <option key={tOption} value={tOption}>{translateData(tOption)}</option>)}
            </select>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              disabled={!selectedType}
              className="rounded-md border border-zinc-300 p-2 text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="">-- {t("brand")} --</option>
              {brands.map(b => <option key={b} value={b}>{translateData(b)}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map((product) => {
            const cartItem = cart.find(c => c.productId === product.id);
            const qtyInCart = cartItem ? cartItem.quantity : 0;
            const remainingStock = product.quantity_in_stock - qtyInCart;
            const isOutOfStock = remainingStock <= 0;

            return (
              <div key={product.id} className="flex flex-col rounded-md border p-4 hover:border-zinc-400 relative overflow-hidden">
                <span className="font-medium text-sm line-clamp-2">{product.name}</span>
                <span className="text-xs text-zinc-500 mt-1">{product.category} &gt; {product.sub_category} &gt; {product.brand}</span>
                
                <span className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {t("stock")}: <span className={`font-semibold ${isOutOfStock ? 'text-red-500' : ''}`}>{remainingStock}</span>
                </span>
                
                <span className="mt-2 font-bold">{product.selling_price.toLocaleString("fr-FR")} FCFA</span>
                
                <button
                  type="button"
                  onClick={() => addToCart(product.id, product.quantity_in_stock)}
                  disabled={isOutOfStock}
                  className="mt-4 rounded-md bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
                >
                  {isOutOfStock ? t("out_of_stock") : t("add")}
                </button>
              </div>
            );
          })}
          {filteredProducts.length === 0 && (
            <div className="col-span-full py-8 text-center text-zinc-500">
              {t("no_results")}
            </div>
          )}
        </div>
      </div>

      {/* Panier et Validation */}
      <div className="col-span-1 rounded-lg border bg-zinc-50 p-6 shadow-sm dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold">{t("cart")}</h2>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="block text-sm font-medium">{t("client")}</label>
            <div className="flex gap-2">
              <select
                value={isCreatingClient ? "new" : selectedClientId}
                onChange={(e) => {
                  if (e.target.value === "new") {
                    setIsCreatingClient(true);
                    setSelectedClientId("");
                  } else {
                    setIsCreatingClient(false);
                    setSelectedClientId(e.target.value);
                  }
                }}
                className="w-full rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              >
                <option value="">{t("default_client")}</option>
                <option value="new">{t("add_client")}</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {isCreatingClient && (
                <button 
                  type="button" 
                  onClick={() => setIsCreatingClient(false)}
                  className="rounded-md border px-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  {t("cancel")}
                </button>
              )}
            </div>

            {isCreatingClient && (
              <div className="mt-2 flex flex-col gap-3 rounded-md bg-zinc-100 p-3 dark:bg-zinc-800">
                <input
                  type="text"
                  placeholder={t("full_name")}
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  required
                />
                <div className="flex gap-2">
                  <PhoneCountryCodeSelect
                    value={newClientPhoneCountryCode || defaultPhoneCountryCode}
                    onChange={setNewClientPhoneCountryCode}
                    label={t("phone_country_code")}
                  />
                  <input
                    type="tel"
                    placeholder={t("phone")}
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    className="min-w-0 flex-1 rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {cart.length === 0 ? (
              <p className="text-sm text-zinc-500">{t("empty_cart")}</p>
            ) : (
              cart.map((item) => {
                const product = products.find(p => p.id === item.productId);
                if (!product) return null;

                return (
                  <div key={item.productId} className="flex items-center justify-between border-b pb-2">
                    <div className="flex flex-col flex-1 min-w-0 pr-2">
                      <span className="text-sm font-medium truncate">{product.name}</span>
                      <span className="text-xs text-zinc-500">{(product.selling_price * item.quantity).toLocaleString("fr-FR")} FCFA</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button type="button" onClick={() => updateQuantity(item.productId, -1, product.quantity_in_stock)} className="rounded-full bg-zinc-200 p-1 dark:bg-zinc-700"><Minus className="h-3 w-3" /></button>
                      <span className="text-sm w-4 text-center">{item.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(item.productId, 1, product.quantity_in_stock)} className="rounded-full bg-zinc-200 p-1 dark:bg-zinc-700"><Plus className="h-3 w-3" /></button>
                      <button type="button" onClick={() => removeFromCart(item.productId)} className="ml-2 text-red-500"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between text-lg font-bold">
              <span>{t("total")}:</span>
              <span>{totalAmount.toLocaleString("fr-FR")} FCFA</span>
            </div>
            
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium">{t("paid_amount")}</label>
              <input
                type="number"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder={t("paid_amount_placeholder")}
                className="w-full rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>

            {submitError && (
              <div className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {submitError}
              </div>
            )}

            {lastInvoiceId && (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
                <span>{t("success")}</span>
                <Link href={`/invoices/${lastInvoiceId}`} className="shrink-0 font-medium underline">
                  {t("view_invoice")}
                </Link>
              </div>
            )}

            <button
              type="submit"
              disabled={cart.length === 0 || isSubmitting}
              className="mt-6 w-full rounded-md bg-black py-3 text-sm font-bold text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {isSubmitting ? t("submitting") : t("submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
