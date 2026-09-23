"use client";

import { useState, useMemo, useEffect, useSyncExternalStore } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { Plus, Minus, Trash2 } from "lucide-react";
import { useMessages, useTranslations } from "next-intl";
import { useCartStore } from "../store/useCartStore";
import { createClient } from "@/utils/supabase/client";
import { PhoneCountryCodeSelect } from "@/components/PhoneCountryCodeSelect";
import { useShopFormat } from "@/components/ShopFormatProvider";
import { feedbackFromError, type FeedbackCode } from "@/lib/feedback";

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
  const tFeedback = useTranslations("Feedback");
  const format = useShopFormat();
  const router = useRouter();
  const messages = useMessages();
  const dataMessages = (messages.Data ?? {}) as Record<string, string>;
  const translateData = (value: string) => dataMessages[value] ?? value;

  // Local state for filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<string>("");

  // The cart is persisted in localStorage (Zustand): render it only in the
  // browser, never during server rendering, to avoid a hydration mismatch.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

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

  const paidValue = Math.max(0, parseInt(paidAmount, 10) || 0);

  const totalAmount = cart.reduce((sum, item) => {
    const product = products.find(p => p.id === item.productId);
    return sum + (product?.selling_price || 0) * item.quantity;
  }, 0);

  // Derive filter options based on current selection
  const categories = useMemo(() => Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort(), [products]);
  
  // Type and brand are optional product fields: only offer the values that
  // actually exist for the current selection, and never an empty option.
  const types = useMemo(() => {
    const scope = selectedCategory ? products.filter(p => p.category === selectedCategory) : products;
    return Array.from(new Set(scope.map(p => p.sub_category).filter(Boolean))).sort();
  }, [products, selectedCategory]);

  const brands = useMemo(() => {
    const scope = products.filter(
      p => (!selectedCategory || p.category === selectedCategory) && (!selectedType || p.sub_category === selectedType)
    );
    return Array.from(new Set(scope.map(p => p.brand).filter(Boolean))).sort();
  }, [products, selectedCategory, selectedType]);

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
  const [submitError, setSubmitError] = useState<FeedbackCode | null>(null);
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
        setSubmitError("shop_not_found");
        return;
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

        if (clientError) {
          console.error("Client creation failed:", clientError);
          setSubmitError("client_save_failed");
          return;
        }
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
        _paid_amount: paidValue,
      });

      if (rpcError) {
        console.error("record_sale failed:", rpcError);
        setSubmitError(feedbackFromError(rpcError));
        return;
      }

      setLastInvoiceId(invoiceId as string);
      clearCart();
      router.refresh();
    } catch (err) {
      console.error("Sale failed:", err);
      setSubmitError("generic_error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted) return null; // Avoid hydration mismatch

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Liste des produits disponibles */}
      <div className="col-span-1 lg:col-span-2 rounded-2xl border border-zinc-100 bg-white dark:border-[#2d2936] dark:bg-[#1C1A22] p-5 sm:p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">{t("available_products")}</h2>
        
        {/* Filtres de recherche */}
        <div className="mb-6 flex flex-col gap-4">
          <input 
            type="text" 
            placeholder={t("search")} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 placeholder:text-zinc-400 dark:border-[#2d2936] dark:bg-[#1C1A22]"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <select
              value={selectedCategory}
              onChange={(e) => {
                // Narrowing the category invalidates the type and brand picks.
                setSelectedCategory(e.target.value);
                setSelectedType("");
                setSelectedBrand("");
              }}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[#2d2936] dark:bg-[#1C1A22]"
            >
              <option value="">-- {t("category")} --</option>
              {categories.map(c => <option key={c} value={c}>{translateData(c)}</option>)}
            </select>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setSelectedBrand("");
              }}
              disabled={types.length === 0}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50 dark:border-[#2d2936] dark:bg-[#1C1A22]"
            >
              <option value="">-- {t("type")} --</option>
              {types.map(tOption => <option key={tOption} value={tOption}>{translateData(tOption)}</option>)}
            </select>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              disabled={brands.length === 0}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50 dark:border-[#2d2936] dark:bg-[#1C1A22]"
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
              <div key={product.id} className="flex flex-col rounded-xl border border-zinc-100 bg-white dark:border-[#2d2936] dark:bg-[#1C1A22] p-4 hover:border-violet-200 dark:hover:border-violet-900/50 transition-colors shadow-sm relative overflow-hidden group">
                <span className="font-bold text-sm line-clamp-2 text-zinc-900 dark:text-white">{product.name}</span>
                {(product.category || product.sub_category || product.brand) && (
                  <span className="text-[11px] font-bold text-zinc-500 tracking-widest uppercase mt-1.5">
                    {[product.category, product.sub_category, product.brand].filter(Boolean).map(translateData).join(" · ")}
                  </span>
                )}
                
                <span className="mt-2 text-[13px] text-zinc-500 dark:text-zinc-400 font-medium">
                  {t("stock")}: <span className={`font-bold tabular-nums ${isOutOfStock ? 'text-red-500' : 'text-zinc-900 dark:text-white'}`}>{remainingStock}</span>
                </span>
                
                <span className="mt-2 font-mono text-[15px] font-bold text-violet-600 dark:text-violet-400 tabular-nums">{format.money(product.selling_price)}</span>
                
                <button
                  type="button"
                  onClick={() => addToCart(product.id, product.quantity_in_stock)}
                  disabled={isOutOfStock}
                  className="mt-4 rounded-xl bg-zinc-100 px-3 py-2 text-sm font-bold text-zinc-900 hover:bg-violet-600 hover:text-white dark:bg-white/5 dark:text-white dark:hover:bg-violet-600 transition-colors disabled:opacity-50 disabled:hover:bg-zinc-100 dark:disabled:hover:bg-white/5 disabled:hover:text-zinc-400"
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
      <div className="col-span-1 rounded-2xl border border-zinc-100 bg-zinc-50/50 p-5 sm:p-6 shadow-sm dark:border-[#2d2936] dark:bg-white/[0.02]">
        <h2 className="mb-4 text-lg font-semibold">{t("cart")}</h2>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <label className="block text-[13px] font-bold text-zinc-700 dark:text-zinc-300">{t("client")}</label>
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
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[#2d2936] dark:bg-[#1C1A22]"
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
                  className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-bold text-zinc-700 hover:bg-zinc-50 dark:border-[#2d2936] dark:bg-[#1C1A22] dark:text-zinc-300 dark:hover:bg-white/[0.02] transition-colors shadow-sm"
                >
                  {t("cancel")}
                </button>
              )}
            </div>

            {isCreatingClient && (
              <div className="mt-2 flex flex-col gap-3 rounded-2xl bg-white dark:bg-[#1C1A22] border border-zinc-100 dark:border-[#2d2936] p-4 shadow-sm">
                <input
                  type="text"
                  placeholder={t("full_name")}
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[#2d2936] dark:bg-[#1C1A22]"
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
                    className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[#2d2936] dark:bg-[#1C1A22]"
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
                  <div key={item.productId} className="flex items-center justify-between border-b border-zinc-100 dark:border-[#2d2936] pb-3 pt-1">
                    <div className="flex flex-col flex-1 min-w-0 pr-2">
                      <span className="text-sm font-bold truncate text-zinc-900 dark:text-white">{product.name}</span>
                      <span className="text-[13px] font-mono font-bold text-violet-600 dark:text-violet-400 mt-0.5 tabular-nums">{format.money(product.selling_price * item.quantity)}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button type="button" onClick={() => updateQuantity(item.productId, -1, product.quantity_in_stock)} className="rounded-full bg-white border border-zinc-200 p-1.5 hover:bg-zinc-100 dark:bg-[#1C1A22] dark:border-[#2d2936] dark:hover:bg-white/5 transition-colors"><Minus className="h-3 w-3" /></button>
                      <span className="text-[13px] font-mono font-bold w-5 text-center tabular-nums">{item.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(item.productId, 1, product.quantity_in_stock)} className="rounded-full bg-white border border-zinc-200 p-1.5 hover:bg-zinc-100 dark:bg-[#1C1A22] dark:border-[#2d2936] dark:hover:bg-white/5 transition-colors"><Plus className="h-3 w-3" /></button>
                      <button type="button" onClick={() => removeFromCart(item.productId)} className="ml-1 rounded-full p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-zinc-200 dark:border-[#2d2936] pt-5">
            <div className="flex justify-between items-center text-lg font-bold">
              <span className="text-zinc-500 dark:text-zinc-400 text-sm">{t("total")}</span>
              <span className="font-mono text-xl tabular-nums text-zinc-900 dark:text-white">{format.money(totalAmount)}</span>
            </div>
            
            <div className="mt-4 flex flex-col gap-1.5">
              <label className="block text-[13px] font-bold text-zinc-700 dark:text-zinc-300">{t("paid_amount", { currency: format.currencySymbol })}</label>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder={t("paid_amount_placeholder")}
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-[#2d2936] dark:bg-[#1C1A22]"
              />
              {/* An empty amount records the whole sale as a debt: say it out loud. */}
              {cart.length > 0 && paidValue < totalAmount && (
                <p className="text-[13px] font-bold text-amber-700 dark:text-amber-400">
                  {t("balance_due", { amount: format.money(totalAmount - paidValue) })}
                </p>
              )}
              {cart.length > 0 && paidValue > totalAmount && (
                <p className="text-[13px] font-bold text-emerald-700 dark:text-emerald-400">
                  {t("change_due", { amount: format.money(paidValue - totalAmount) })}
                </p>
              )}
            </div>

            {submitError && (
              <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] font-bold text-red-600 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400 shadow-sm">
                {tFeedback(submitError)}
              </div>
            )}

            {lastInvoiceId && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-[13px] font-bold text-green-700 dark:border-green-900/30 dark:bg-green-900/20 dark:text-green-400 shadow-sm">
                <span>{t("success")}</span>
                <div className="flex items-center gap-3">
                  <Link href={`/invoices/${lastInvoiceId}/ticket`} className="shrink-0 font-medium underline">
                    {t("print_ticket")}
                  </Link>
                  <Link href={`/invoices/${lastInvoiceId}`} className="shrink-0 font-medium underline">
                    {t("view_invoice")}
                  </Link>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={cart.length === 0 || isSubmitting}
              className="mt-6 w-full rounded-xl bg-violet-600 py-3.5 text-[15px] font-bold text-white hover:bg-violet-700 transition-colors shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? t("submitting") : t("submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
