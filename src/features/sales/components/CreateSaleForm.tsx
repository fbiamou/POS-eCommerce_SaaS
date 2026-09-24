"use client";

import { useState, useMemo, useEffect, useSyncExternalStore } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { Plus, Minus, Trash2, Search, ShoppingBag, X, Printer, FileText, CheckCircle2 } from "lucide-react";
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
  image_url?: string | null;
};

export type Client = {
  id: string;
  name: string;
};

type PayMode = "full" | "credit";

const inputClass =
  "w-full rounded-xl border border-zinc-200 bg-[var(--surface-1)] px-4 py-2.5 text-[14px] font-medium transition-colors focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 placeholder:text-zinc-400 dark:border-[var(--line)]";

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
  const tCommon = useTranslations("Common");
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

  // Payment: most sales are paid in full, so that is the default. "credit"
  // covers both a partial payment and a sale left entirely on credit.
  const [payMode, setPayMode] = useState<PayMode>("full");
  const [cashReceived, setCashReceived] = useState("");
  // On phones the cart is a sheet that slides up over the product list.
  const [cartOpen, setCartOpen] = useState(false);

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

  const totalAmount = cart.reduce((sum, item) => {
    const product = products.find(p => p.id === item.productId);
    return sum + (product?.selling_price || 0) * item.quantity;
  }, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const creditPaid = Math.max(0, parseInt(paidAmount, 10) || 0);
  const paidValue = payMode === "full" ? totalAmount : Math.min(creditPaid, totalAmount);
  const received = Math.max(0, parseInt(cashReceived, 10) || 0);
  const hasClient = Boolean(selectedClientId) || (isCreatingClient && newClientName.trim().length > 0);
  // A debt nobody can be reminded of is lost money: a sale that is not paid
  // in full must name its customer.
  const creditNeedsClient = cart.length > 0 && paidValue < totalAmount && !hasClient;

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
    const term = searchTerm.trim().toLowerCase();
    return products.filter((p) => {
      const matchSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.brand.toLowerCase().includes(term) ||
        p.sub_category.toLowerCase().includes(term);
      const matchCategory = selectedCategory ? p.category === selectedCategory : true;
      const matchType = selectedType ? p.sub_category === selectedType : true;
      const matchBrand = selectedBrand ? p.brand === selectedBrand : true;
      return matchSearch && matchCategory && matchType && matchBrand;
    });
  }, [products, searchTerm, selectedCategory, selectedType, selectedBrand]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<FeedbackCode | null>(null);
  const [lastInvoiceId, setLastInvoiceId] = useState<string | null>(null);

  const selectCategory = (value: string) => {
    // Narrowing the category invalidates the type and brand picks.
    setSelectedCategory(value);
    setSelectedType("");
    setSelectedBrand("");
  };

  const handleAdd = (product: Product) => {
    setLastInvoiceId(null);
    setSubmitError(null);
    addToCart(product.id, product.quantity_in_stock);
  };

  const closeCart = () => {
    setCartOpen(false);
    setLastInvoiceId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creditNeedsClient) return;
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
      setPayMode("full");
      setCashReceived("");
      router.refresh();
    } catch (err) {
      console.error("Sale failed:", err);
      setSubmitError("generic_error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted) return null; // Avoid hydration mismatch

  const chipClass = (active: boolean) =>
    `shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
      active
        ? "bg-night text-white dark:bg-violet-500"
        : "bg-[var(--surface-1)] text-zinc-700 shadow-[inset_0_0_0_1px_var(--line)] hover:bg-zinc-100 dark:text-zinc-300"
    }`;

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6">
      {/* Products */}
      <section aria-label={t("available_products")} className="min-w-0">
        <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-4 bg-background/95 px-4 pb-3 pt-1 backdrop-blur md:top-0 md:-mx-8 md:px-8 lg:mx-0 lg:px-0">
          <label htmlFor="sale-search" className="sr-only">{t("search")}</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-zinc-400" />
            <input
              id="sale-search"
              type="search"
              placeholder={t("search")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`${inputClass} h-12 pl-11 text-[15px]`}
            />
          </div>

          {categories.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              <button type="button" onClick={() => selectCategory("")} className={chipClass(!selectedCategory)}>
                {t("all_categories")}
              </button>
              {categories.map((c) => (
                <button key={c} type="button" onClick={() => selectCategory(c)} className={chipClass(selectedCategory === c)}>
                  {translateData(c)}
                </button>
              ))}
            </div>
          )}

          {(types.length > 1 || brands.length > 1) && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <select
                aria-label={t("type")}
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value);
                  setSelectedBrand("");
                }}
                disabled={types.length === 0}
                className={`${inputClass} py-2 text-[13px] disabled:opacity-50`}
              >
                <option value="">{t("type")}</option>
                {types.map(tOption => <option key={tOption} value={tOption}>{translateData(tOption)}</option>)}
              </select>
              <select
                aria-label={t("brand")}
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                disabled={brands.length === 0}
                className={`${inputClass} py-2 text-[13px] disabled:opacity-50`}
              >
                <option value="">{t("brand")}</option>
                {brands.map(b => <option key={b} value={b}>{translateData(b)}</option>)}
              </select>
            </div>
          )}
        </div>

        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-2">
          {filteredProducts.map((product) => {
            const cartItem = cart.find(c => c.productId === product.id);
            const qtyInCart = cartItem ? cartItem.quantity : 0;
            const remainingStock = product.quantity_in_stock - qtyInCart;
            const isOutOfStock = remainingStock <= 0;
            const meta = [product.sub_category, product.brand].filter(Boolean).map(translateData).join(" · ");

            return (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => handleAdd(product)}
                  disabled={isOutOfStock}
                  aria-label={`${t("add")} ${product.name}`}
                  className={`group relative flex w-full items-center gap-3 rounded-2xl bg-[var(--surface-1)] p-3 text-left shadow-card transition-[box-shadow,transform] active:scale-[0.99] disabled:cursor-not-allowed ${
                    qtyInCart > 0 ? "ring-2 ring-violet-500" : "hover:ring-1 hover:ring-violet-300"
                  } ${isOutOfStock && qtyInCart === 0 ? "opacity-55" : ""}`}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-100 font-display text-lg font-bold text-zinc-400 dark:bg-[var(--surface-2)]">
                    {product.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      product.name.trim()[0]?.toUpperCase()
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-zinc-900 dark:text-white">{product.name}</span>
                    {meta && <span className="block truncate text-[12px] text-zinc-500">{meta}</span>}
                    <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                      <span className="font-mono text-[14px] font-semibold tabular-nums text-violet-700 dark:text-violet-300">
                        {format.money(product.selling_price)}
                      </span>
                      <span className={`text-[12px] tabular-nums ${isOutOfStock ? "font-semibold text-red-600 dark:text-red-400" : "text-zinc-500"}`}>
                        {isOutOfStock ? t("out_of_stock") : t("in_stock_count", { count: remainingStock })}
                      </span>
                    </span>
                  </span>
                  {qtyInCart > 0 ? (
                    <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 px-2 font-mono text-[13px] font-semibold text-white tabular-nums">
                      {qtyInCart}
                    </span>
                  ) : (
                    !isOutOfStock && (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition-colors group-hover:bg-violet-600 group-hover:text-white dark:bg-[var(--surface-2)] dark:text-zinc-300">
                        <Plus className="h-4 w-4" />
                      </span>
                    )
                  )}
                </button>
              </li>
            );
          })}
          {filteredProducts.length === 0 && (
            <li className="col-span-full rounded-2xl bg-[var(--surface-1)] py-10 text-center text-zinc-500 shadow-card">
              {t("no_results")}
            </li>
          )}
        </ul>
      </section>

      {/* Phone: cart summary bar above the tab bar */}
      {(cart.length > 0 || lastInvoiceId) && !cartOpen && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 rounded-2xl bg-night px-4 py-3 text-white shadow-[0_14px_30px_-12px_rgba(20,28,69,0.7)] lg:hidden dark:bg-violet-500"
        >
          <ShoppingBag className="h-5 w-5 shrink-0" />
          <span className="text-[14px] font-semibold">
            {lastInvoiceId && cart.length === 0 ? t("success") : t("cart_items", { count: itemCount })}
          </span>
          {cart.length > 0 && (
            <span className="ml-auto flex items-center gap-3">
              <span className="font-mono text-[15px] font-semibold tabular-nums">{format.money(totalAmount)}</span>
              <span className="rounded-full bg-saffron px-3 py-1 text-[13px] font-bold text-night">{t("open_cart")}</span>
            </span>
          )}
        </button>
      )}

      {/* Phone: dim the list behind the open cart sheet */}
      {cartOpen && (
        <div aria-hidden="true" onClick={closeCart} className="fixed inset-0 z-40 bg-[#141C45]/55 backdrop-blur-[2px] lg:hidden" />
      )}

      {/* Cart: sheet on phones, sticky panel from lg */}
      <aside
        aria-label={t("cart")}
        className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-3xl bg-[var(--surface-1)] shadow-2xl transition-transform duration-300 lg:sticky lg:inset-auto lg:top-8 lg:z-auto lg:max-h-[calc(100dvh-4rem)] lg:translate-y-0 lg:rounded-2xl lg:shadow-card ${
          cartOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-[var(--line)]">
          <h2 className="font-display text-lg font-bold">
            {t("cart")}
            {itemCount > 0 && <span className="ml-2 font-mono text-sm font-medium text-zinc-500 tabular-nums">{itemCount}</span>}
          </h2>
          <div className="flex items-center gap-1">
            {cart.length > 0 && (
              <button type="button" onClick={clearCart} className="rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-red-600">
                {t("clear_cart")}
              </button>
            )}
            <button type="button" onClick={closeCart} aria-label={tCommon("close")} className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 lg:hidden">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {lastInvoiceId && cart.length === 0 ? (
          <div className="flex flex-col items-center gap-4 px-5 py-8 text-center pb-[calc(2rem+env(safe-area-inset-bottom))]">
            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            <p className="font-display text-xl font-bold">{t("success")}</p>
            <div className="grid w-full gap-2">
              <Link
                href={`/invoices/${lastInvoiceId}/ticket`}
                className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-3.5 text-[15px] font-bold text-white hover:bg-violet-700"
              >
                <Printer className="h-4.5 w-4.5" /> {t("print_ticket")}
              </Link>
              <Link
                href={`/invoices/${lastInvoiceId}`}
                className="flex items-center justify-center gap-2 rounded-xl bg-zinc-100 py-3 text-[14px] font-semibold text-zinc-800 hover:bg-zinc-200 dark:bg-[var(--surface-2)] dark:text-zinc-200"
              >
                <FileText className="h-4 w-4" /> {t("view_invoice")}
              </Link>
              <button type="button" onClick={closeCart} className="py-2 text-[14px] font-semibold text-violet-700 dark:text-violet-300">
                {t("new_sale")}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-5">
              {cart.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500">{t("empty_cart")}</p>
              ) : (
                <ul className="divide-y divide-zinc-200 dark:divide-[var(--line)]">
                  {cart.map((item) => {
                    const product = products.find(p => p.id === item.productId);
                    if (!product) return null;

                    return (
                      <li key={item.productId} className="py-3">
                        <div className="flex items-start gap-2">
                          <p className="min-w-0 flex-1 text-[14px] font-semibold leading-snug text-zinc-900 line-clamp-2 dark:text-white">{product.name}</p>
                          <button type="button" aria-label={t("remove_item")} onClick={() => removeFromCart(item.productId)} className="-mt-1 shrink-0 rounded-full p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <div className="flex shrink-0 items-center rounded-full bg-zinc-100 dark:bg-[var(--surface-2)]">
                            <button type="button" aria-label={t("decrease")} onClick={() => updateQuantity(item.productId, -1, product.quantity_in_stock)} className="rounded-full p-2 hover:bg-zinc-200 dark:hover:bg-[var(--surface-3)]"><Minus className="h-3.5 w-3.5" /></button>
                            <span className="w-6 text-center font-mono text-[13px] font-semibold tabular-nums">{item.quantity}</span>
                            <button type="button" aria-label={t("increase")} onClick={() => updateQuantity(item.productId, 1, product.quantity_in_stock)} className="rounded-full p-2 hover:bg-zinc-200 dark:hover:bg-[var(--surface-3)]"><Plus className="h-3.5 w-3.5" /></button>
                          </div>
                          <span className="min-w-0 truncate font-mono text-[12px] text-zinc-500 tabular-nums">
                            {t("unit_price", { price: format.money(product.selling_price) })}
                          </span>
                          <span className="ml-auto shrink-0 font-mono text-[14px] font-semibold tabular-nums">{format.money(product.selling_price * item.quantity)}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="border-t border-zinc-200 px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] dark:border-[var(--line)] lg:pb-5">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-semibold uppercase tracking-wider text-zinc-500">{t("total")}</span>
                <span className="font-mono text-[26px] font-semibold tabular-nums">{format.money(totalAmount)}</span>
              </div>

              <div role="radiogroup" aria-label={t("payment")} className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-[var(--surface-2)]">
                {(["full", "credit"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={payMode === mode}
                    onClick={() => setPayMode(mode)}
                    className={`rounded-lg px-2 py-2 text-[13px] font-semibold transition-colors ${
                      payMode === mode ? "bg-[var(--surface-1)] text-zinc-900 shadow-card dark:bg-[var(--surface-3)] dark:text-white" : "text-zinc-500"
                    }`}
                  >
                    {mode === "full" ? t("pay_full") : t("pay_credit")}
                  </button>
                ))}
              </div>

              {payMode === "full" ? (
                <div className="mt-3">
                  <label htmlFor="cash-received" className="text-[12px] font-semibold text-zinc-600 dark:text-zinc-300">
                    {t("cash_received", { currency: format.currencySymbol })}
                  </label>
                  <input
                    id="cash-received"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder={String(totalAmount || "")}
                    className={`${inputClass} mt-1 font-mono`}
                  />
                  {cart.length > 0 && received > totalAmount && (
                    <p className="mt-1.5 text-[13px] font-semibold text-emerald-700 dark:text-emerald-400">
                      {t("change_due", { amount: format.money(received - totalAmount) })}
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-3 flex flex-col gap-3">
                  <div>
                    <label htmlFor="paid-now" className="text-[12px] font-semibold text-zinc-600 dark:text-zinc-300">
                      {t("paid_now", { currency: format.currencySymbol })}
                    </label>
                    <input
                      id="paid-now"
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      placeholder="0"
                      className={`${inputClass} mt-1 font-mono`}
                    />
                    {cart.length > 0 && paidValue < totalAmount && (
                      <p className="mt-1.5 text-[13px] font-semibold text-amber-700 dark:text-amber-400">
                        {t("balance_due", { amount: format.money(totalAmount - paidValue) })}
                      </p>
                    )}
                  </div>

                </div>
              )}

              <div className="mt-3">
                <label htmlFor="sale-client" className="text-[12px] font-semibold text-zinc-600 dark:text-zinc-300">{t("client")}</label>
                <div className="mt-1 flex gap-2">
                  <select
                    id="sale-client"
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
                    className={inputClass}
                  >
                    <option value="">{payMode === "full" ? t("default_client") : t("choose_client")}</option>
                    <option value="new">{t("add_client")}</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {isCreatingClient && (
                    <button
                      type="button"
                      onClick={() => setIsCreatingClient(false)}
                      className="shrink-0 rounded-xl px-3 text-[13px] font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300"
                    >
                      {t("cancel")}
                    </button>
                  )}
                </div>

                {isCreatingClient && (
                  <div className="mt-2 flex flex-col gap-2 rounded-xl bg-zinc-50 p-3 dark:bg-[var(--surface-2)]">
                    <input
                      type="text"
                      aria-label={t("full_name")}
                      placeholder={t("full_name")}
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      className={inputClass}
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
                        aria-label={t("phone")}
                        placeholder={t("phone")}
                        value={newClientPhone}
                        onChange={(e) => setNewClientPhone(e.target.value)}
                        className={`${inputClass} min-w-0 flex-1`}
                      />
                    </div>
                  </div>
                )}
              </div>

              {creditNeedsClient && (
                <p className="mt-2 text-[13px] text-zinc-600 dark:text-zinc-300">{t("client_required_credit")}</p>
              )}

              {submitError && (
                <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-[13px] font-semibold text-red-700 dark:bg-red-900/20 dark:text-red-400">
                  {tFeedback(submitError)}
                </p>
              )}

              <button
                type="submit"
                disabled={cart.length === 0 || isSubmitting || creditNeedsClient}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
              >
                {isSubmitting ? t("submitting") : payMode === "full" ? t("submit_amount", { amount: format.money(totalAmount) }) : t("submit")}
              </button>
            </div>
          </form>
        )}
      </aside>
    </div>
  );
}
