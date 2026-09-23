"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Plus, Minus, Trash2, ShoppingBag, CheckCircle2, X, ShoppingCart } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { createClient } from "@/utils/supabase/client";
import { PhoneCountryCodeSelect } from "@/components/PhoneCountryCodeSelect";
import { formatMoney } from "@/lib/format";
import { feedbackFromError, type FeedbackCode } from "@/lib/feedback";
import type { PublicProduct, PublicShopProfile } from "../actions";

type CartItem = { productId: string; quantity: number };

export default function StorefrontShop({
  shop,
  products,
}: {
  shop: PublicShopProfile;
  products: PublicProduct[];
}) {
  const t = useTranslations("Storefront");
  const tFeedback = useTranslations("Feedback");
  const locale = useLocale();
  const cartKey = `storefront-cart-${shop.shop_id}`;

  const categories = useMemo(() => {
    const cats: Record<string, number> = {};
    products.forEach((p) => {
      const name = p.category_name || t("uncategorized");
      cats[name] = (cats[name] || 0) + 1;
    });
    return Object.entries(cats).map(([name, count]) => ({ name, count }));
  }, [products, t]);


  const [customerName, setCustomerName] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState(shop.default_phone_country_code || "+237");
  const [customerPhone, setCustomerPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<FeedbackCode | null>(null);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(cartKey);
        if (raw) return JSON.parse(raw);
      } catch {
        // ignore
      }
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(cartKey, JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart, cartKey]);

  const addToCart = (productId: string) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (existing) {
        return prev.map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { productId, quantity: 1 }];
    });
    setIsCartOpen(true); // Open cart automatically when adding
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  };

  const totalAmount = useMemo(() => {
    return cart.reduce((sum, item) => {
      const product = products.find((p) => p.product_id === item.productId);
      return sum + (product?.selling_price ?? 0) * item.quantity;
    }, 0);
  }, [cart, products]);

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return products;
    return products.filter((p) => (p.category_name || t("uncategorized")) === selectedCategory);
  }, [products, selectedCategory, t]);

  const format = (n: number) => formatMoney(n, shop.currency_symbol, locale);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const items = cart.map((item) => ({ product_id: item.productId, quantity: item.quantity }));

      const fullPhone = `${phoneCountryCode}${customerPhone.replace(/\D/g, "")}`;

      const { error: rpcError } = await supabase.rpc("place_online_order", {
        _shop_id: shop.shop_id,
        _customer_name: customerName,
        _customer_phone: fullPhone,
        _items: items,
      });

      if (rpcError) {
        console.error("place_online_order failed:", rpcError);
        setError(feedbackFromError(rpcError));
        return;
      }

      setCart([]);
      setOrderPlaced(true);
    } catch (err) {
      console.error("Online order failed:", err);
      setError("generic_error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col font-sans">
      {/* HEADER: Sticky, Glassmorphism */}
      <header className="sticky top-0 z-40 border-b bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg px-4 py-3 sm:px-6 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            {shop.shop_logo_url ? (
              <Image src={shop.shop_logo_url} alt={shop.shop_name || ""} width={48} height={48} className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 rounded-full object-cover border border-zinc-200 dark:border-zinc-800 shadow-sm" />
            ) : (
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full bg-violet-600 text-lg font-bold text-white shadow-sm">
                {(shop.shop_name || "B")[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{shop.shop_name || t("default_shop_name")}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="hidden sm:block">
              <LocaleSwitcher variant="dropdown" />
            </div>
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              <ShoppingCart className="h-6 w-6 text-zinc-800 dark:text-zinc-200" />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white shadow-sm">
                  {cartItemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION / BANNER — gradient built from the shop's own accent color, not a fixed violet.
          bg/bgHover alone (two adjacent Tailwind shades) read as almost flat — lightened one end and
          darkened the other via color-mix so the band stays vivid regardless of which accent is picked. */}
      <div
        className="w-full py-12 px-4 text-center"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--accent-bg) 65%, white), color-mix(in srgb, var(--accent-bg-hover) 85%, black))",
        }}
      >
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-2">{t("catalog_title")}</h2>
          <p className="text-white/80 text-sm sm:text-base">
            {shop.shop_address ? shop.shop_address : t("default_shop_name")}
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-7xl flex-1 w-full p-4 sm:p-6 lg:p-8 -mt-6">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-4 sm:p-6 border border-zinc-100 dark:border-zinc-800">
          
          {/* CATEGORIES FILTERS (Pills) */}
          <div className="mb-8">
            <h3 className="mb-4 text-sm font-bold tracking-widest text-zinc-400 uppercase">{t("categories_title")}</h3>
            <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 hide-scrollbar" style={{ scrollbarWidth: 'none' }}>
              <button
                onClick={() => setSelectedCategory(null)}
                className={`shrink-0 rounded-full px-5 py-2 text-sm font-medium transition-colors border ${
                  selectedCategory === null 
                    ? "bg-violet-600 text-white border-violet-600 shadow-md" 
                    : "bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                }`}
              >
                {t("all_categories")}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`shrink-0 rounded-full px-5 py-2 text-sm font-medium transition-colors border ${
                    selectedCategory === cat.name 
                      ? "bg-violet-600 text-white border-violet-600 shadow-md" 
                      : "bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  }`}
                >
                  {cat.name} <span className="ml-1 opacity-70 text-xs">({cat.count})</span>
                </button>
              ))}
            </div>
          </div>

          {/* PRODUCTS GRID */}
          <div className="mb-6">
            <h3 className="mb-4 text-sm font-bold tracking-widest text-zinc-400 uppercase">
              {selectedCategory ? selectedCategory : t("popular_this_week")}
            </h3>
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700">
                <ShoppingBag className="h-12 w-12 text-zinc-300 dark:text-zinc-600 mb-4" />
                <p className="text-zinc-500">{t("no_products")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {filteredProducts.map((product) => (
                  <div key={product.product_id} className="group flex flex-col rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 shadow-sm hover:shadow-xl transition-all duration-300 relative overflow-hidden">
                    <div className="mb-3 flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900 relative">
                      {product.image_url ? (
                        <Image src={product.image_url} alt={product.name} fill className="object-cover transition-transform duration-500 group-hover:scale-110" />
                      ) : (
                        <ShoppingBag className="h-8 w-8 text-zinc-300 dark:text-zinc-700" />
                      )}
                      
                      {/* Floating Add Button on image for desktop/hover */}
                      {product.in_stock ? (
                        <div className="absolute inset-x-0 bottom-0 p-3 translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 bg-gradient-to-t from-black/60 to-transparent flex justify-center hidden sm:flex">
                           <button
                             type="button"
                             onClick={() => addToCart(product.product_id)}
                             className="w-full rounded-full bg-violet-600 px-3 py-2 text-xs font-bold text-white shadow-lg hover:bg-violet-700 flex items-center justify-center gap-2"
                           >
                             <Plus className="h-4 w-4"/> {t("add_to_cart")}
                           </button>
                        </div>
                      ) : null}
                    </div>
                    
                    <div className="flex-1 flex flex-col">
                      <span className="line-clamp-2 text-sm font-medium leading-tight text-zinc-800 dark:text-zinc-200">{product.name}</span>
                      {product.category_name && <span className="mt-1 text-xs text-zinc-400 truncate">{product.category_name}</span>}
                      <div className="mt-auto pt-3 flex items-center justify-between">
                        <span className="font-bold text-violet-600 dark:text-violet-400">{format(product.selling_price)}</span>
                      </div>
                    </div>
                    
                    {/* Add Button for mobile (always visible) or Out of stock badge */}
                    <div className="mt-3">
                      {!product.in_stock ? (
                        <span className="block text-center w-full rounded-lg bg-red-50 dark:bg-red-900/20 py-2 text-xs font-medium text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30">
                          {t("out_of_stock")}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addToCart(product.product_id)}
                          className="sm:hidden w-full flex items-center justify-center gap-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 py-2 text-xs font-bold text-zinc-800 dark:text-zinc-200 hover:bg-violet-600 hover:text-white transition-colors"
                        >
                          <Plus className="h-3 w-3" /> {t("add_to_cart")}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="mt-auto py-8 text-center text-sm text-zinc-400 border-t bg-white dark:bg-zinc-950">
        <p>© {new Date().getFullYear()} {shop.shop_name || "Boutique POS"}. {t("footer_rights")}</p>
        <div className="mt-4 sm:hidden flex justify-center">
           <LocaleSwitcher variant="dropdown" />
        </div>
      </footer>

      {/* CART DRAWER */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsCartOpen(false)}
          />
          <div className="relative z-50 w-full max-w-md h-full bg-white dark:bg-zinc-900 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            
            <div className="flex items-center justify-between border-b p-4 sm:p-6 bg-zinc-50 dark:bg-zinc-950">
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <ShoppingBag className="h-6 w-6 text-violet-600" /> {t("cart_title")}
              </h2>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="rounded-full p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="h-5 w-5 text-zinc-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {orderPlaced ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <div className="h-20 w-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-500" />
                  </div>
                  <h3 className="text-xl font-bold">{t("order_success_title")}</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 px-4">{t("order_success_body")}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setOrderPlaced(false);
                      setIsCartOpen(false);
                    }}
                    className="mt-4 rounded-full bg-zinc-100 dark:bg-zinc-800 px-6 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    {t("back_to_shop")}
                  </button>
                </div>
              ) : cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center opacity-70">
                  <ShoppingCart className="h-16 w-16 text-zinc-300 dark:text-zinc-700" />
                  <p className="text-zinc-500 dark:text-zinc-400">{t("empty_cart")}</p>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-4">
                    {cart.map((item) => {
                      const product = products.find((p) => p.product_id === item.productId);
                      if (!product) return null;
                      return (
                        <div key={item.productId} className="flex gap-4 items-center">
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800 border dark:border-zinc-700 relative">
                            {product.image_url ? (
                              <Image src={product.image_url} alt={product.name} fill className="object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ShoppingBag className="h-5 w-5 text-zinc-300" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-bold">{product.name}</p>
                            <p className="text-sm text-violet-600 dark:text-violet-400 font-medium">{format(product.selling_price)}</p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-2">
                             <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800 rounded-full px-2 py-1 border dark:border-zinc-700">
                                <button type="button" onClick={() => updateQuantity(item.productId, -1)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white p-1">
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="text-sm font-medium w-3 text-center">{item.quantity}</span>
                                <button type="button" onClick={() => updateQuantity(item.productId, 1)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white p-1">
                                  <Plus className="h-3 w-3" />
                                </button>
                             </div>
                             <button type="button" onClick={() => removeFromCart(item.productId)} className="text-xs text-red-500 flex items-center gap-1 hover:underline">
                               <Trash2 className="h-3 w-3" />
                             </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t dark:border-zinc-800 pt-4">
                    <div className="flex justify-between text-lg font-black">
                      <span>{t("total")}</span>
                      <span>{format(totalAmount)}</span>
                    </div>
                  </div>

                  <form onSubmit={handleCheckout} className="flex flex-col gap-4 mt-2">
                    <div className="flex flex-col gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border dark:border-zinc-800">
                      <h4 className="font-bold text-sm mb-1">{t("your_name")}</h4>
                      <input
                        required
                        type="text"
                        placeholder={t("your_name")}
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="rounded-lg border-zinc-200 dark:border-zinc-700 p-2.5 text-sm dark:bg-zinc-900 w-full focus:ring-2 focus:ring-violet-600 outline-none"
                      />
                      <div className="flex flex-col gap-1 mt-2">
                        <div className="flex gap-2">
                          <PhoneCountryCodeSelect
                            value={phoneCountryCode}
                            onChange={setPhoneCountryCode}
                            label={t("phone_country_code")}
                          />
                          <input
                            required
                            type="tel"
                            placeholder={t("your_phone")}
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            className="min-w-0 flex-1 rounded-lg border-zinc-200 dark:border-zinc-700 p-2.5 text-sm dark:bg-zinc-900 focus:ring-2 focus:ring-violet-600 outline-none"
                          />
                        </div>
                        <p className="text-[11px] text-zinc-500">{t("phone_country_hint")}</p>
                      </div>
                    </div>

                    <p className="text-[11px] text-center text-zinc-500 bg-zinc-100 dark:bg-zinc-800 p-2 rounded-lg">{t("pickup_notice")}</p>

                    {error && <p className="text-sm text-red-600 text-center font-medium">{tFeedback(error)}</p>}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="rounded-full bg-violet-600 py-4 text-sm font-bold text-white shadow-lg hover:bg-violet-700 hover:shadow-xl transition-all disabled:opacity-50 mt-2"
                    >
                      {isSubmitting ? t("submitting") : t("place_order")}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
