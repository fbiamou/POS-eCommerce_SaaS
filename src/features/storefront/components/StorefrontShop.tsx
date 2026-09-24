"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Plus, Minus, Trash2, ShoppingBag, CheckCircle2, MapPin, Phone, Store } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { WishopMark } from "@/components/brand/WishopMark";
import { Modal } from "@/components/ui/Modal";
import { createClient } from "@/utils/supabase/client";
import { PhoneCountryCodeSelect } from "@/components/PhoneCountryCodeSelect";
import { formatMoney } from "@/lib/format";
import { feedbackFromError, type FeedbackCode } from "@/lib/feedback";
import type { PublicProduct, PublicShopProfile } from "../actions";

type CartItem = { productId: string; quantity: number };

const inputClass =
  "w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-[15px] outline-none transition-colors placeholder:text-zinc-400 focus:border-[var(--accent-bg)] focus:ring-1 focus:ring-[var(--accent-bg)]";

// The shop's thread: the WISHOP zigzag, drawn in the shop's own accent colour.
function ShopThread() {
  return (
    <svg viewBox="0 0 180 26" aria-hidden="true" className="h-auto w-36">
      <polyline
        points="2,18 11,6 20,18 29,6 38,18 47,6 56,18 65,6 74,18 83,6 92,18 101,6 110,18 119,6 128,18 137,6 146,18 155,6 164,18 173,6"
        fill="none"
        stroke="var(--accent-bg)"
        strokeWidth="3"
      />
      <path d="M119 -2.5 L124 2.5 L119 7.5 L114 2.5Z" fill="#F4B63F" />
    </svg>
  );
}

// A shop's public storefront, for its own customers: its name, logo, accent
// colour and font come first; WISHOP only signs the footer.
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
  const shopName = shop.shop_name || t("default_shop_name");

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
  const [openProduct, setOpenProduct] = useState<PublicProduct | null>(null);

  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(cartKey);
        if (raw) return JSON.parse(raw);
      } catch {
        // Blocked storage: the cart simply starts empty.
      }
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(cartKey, JSON.stringify(cart));
    } catch {
      // Blocked storage: the cart still works for this visit.
    }
  }, [cart, cartKey]);

  const addToCart = (productId: string, quantity = 1) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (existing) {
        return prev.map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + quantity } : i));
      }
      return [...prev, { productId, quantity }];
    });
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
  const qtyInCart = (productId: string) => cart.find((i) => i.productId === productId)?.quantity ?? 0;

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

  const chipClass = (active: boolean) =>
    `shrink-0 rounded-full px-4 py-2 text-[14px] font-semibold transition-colors ${
      active
        ? "bg-[var(--accent-bg)] text-white"
        : "bg-white text-zinc-700 shadow-[inset_0_0_0_1px_var(--line)] hover:bg-zinc-100"
    }`;

  return (
    <div className="storefront flex min-h-dvh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {shop.shop_logo_url ? (
              <Image src={shop.shop_logo_url} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-xl object-cover" />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-bg)] text-lg font-bold text-white">
                {shopName[0]?.toUpperCase()}
              </span>
            )}
            <span className="store-heading truncate text-[18px] font-bold">{shopName}</span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <LocaleSwitcher variant="dropdown" />
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              aria-label={t("cart_title")}
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-800 transition-colors hover:bg-zinc-200"
            >
              <ShoppingBag className="h-5 w-5" />
              {cartItemCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent-bg)] px-1 text-[11px] font-bold text-white">
                  {cartItemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-4 pb-4 pt-8 sm:px-6 sm:pt-12">
        <h1 className="store-heading max-w-[18ch] text-[34px] font-extrabold leading-[1.05] tracking-tight sm:text-[48px]">{shopName}</h1>
        <div className="mt-4">
          <ShopThread />
        </div>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-zinc-600">
          {shop.shop_address && (
            <li className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-[var(--accent-text)]" /> {shop.shop_address}
            </li>
          )}
          {shop.shop_phone && (
            <li className="flex items-center gap-1.5">
              <Phone className="h-4 w-4 text-[var(--accent-text)]" /> <span className="font-mono">{shop.shop_phone}</span>
            </li>
          )}
          <li className="flex items-center gap-1.5">
            <Store className="h-4 w-4 text-[var(--accent-text)]" /> {t("pickup_short")}
          </li>
        </ul>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 sm:px-6">
        {categories.length > 1 && (
          <div className="sticky top-[65px] z-20 -mx-4 mb-4 flex gap-2 overflow-x-auto bg-background/95 px-4 py-3 backdrop-blur [scrollbar-width:none] sm:-mx-6 sm:px-6">
            <button type="button" onClick={() => setSelectedCategory(null)} className={chipClass(selectedCategory === null)}>
              {t("all_categories")}
            </button>
            {categories.map((cat) => (
              <button key={cat.name} type="button" onClick={() => setSelectedCategory(cat.name)} className={chipClass(selectedCategory === cat.name)}>
                {cat.name}
                <span className="ml-1.5 font-mono text-[12px] opacity-70">{cat.count}</span>
              </button>
            ))}
          </div>
        )}

        <h2 className="store-heading mb-4 text-[22px] font-bold">{selectedCategory ?? t("catalog_title")}</h2>

        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-16 text-center shadow-card">
            <ShoppingBag className="mb-4 h-12 w-12 text-zinc-300" />
            <p className="text-zinc-500">{t("no_products")}</p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
            {filteredProducts.map((product) => {
              const inCart = qtyInCart(product.product_id);
              return (
                <li key={product.product_id} className="group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-card">
                  <button
                    type="button"
                    onClick={() => setOpenProduct(product)}
                    className="flex flex-1 flex-col text-left"
                    aria-label={product.name}
                  >
                    <span className="relative block aspect-[4/5] w-full overflow-hidden bg-zinc-100">
                      {product.image_url ? (
                        <Image
                          src={product.image_url}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <span className="store-heading flex h-full w-full items-center justify-center text-[40px] font-bold text-zinc-300">
                          {product.name.trim()[0]?.toUpperCase()}
                        </span>
                      )}
                      {!product.in_stock && (
                        <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-semibold text-zinc-700">
                          {t("out_of_stock")}
                        </span>
                      )}
                    </span>
                    <span className="flex flex-1 flex-col gap-1 p-3">
                      <span className="line-clamp-2 text-[14px] font-semibold leading-snug">{product.name}</span>
                      <span className="mt-auto pt-1 text-[15px] font-bold text-[var(--accent-text)]">{format(product.selling_price)}</span>
                    </span>
                  </button>
                  {product.in_stock && (
                    <button
                      type="button"
                      onClick={() => addToCart(product.product_id)}
                      aria-label={`${t("add_to_cart")} ${product.name}`}
                      className="absolute right-2 top-2 flex h-10 min-w-10 items-center justify-center rounded-full bg-[var(--accent-bg)] px-2 text-white shadow-[0_8px_18px_-8px_rgba(0,0,0,0.5)] transition-transform active:scale-95"
                    >
                      {inCart > 0 ? <span className="font-mono text-[14px] font-bold">{inCart}</span> : <Plus className="h-5 w-5" />}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-[13px] text-zinc-500 sm:flex-row sm:px-6">
          <p>
            © {new Date().getFullYear()} {shopName}. {t("footer_rights")}
          </p>
          {/* The WISHOP site is a static page (public/landing), not an app route. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/landing" className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800">
            {t("powered_by")}
            <WishopMark className="h-3.5 w-auto text-night" />
            <span className="font-display font-extrabold tracking-tight text-night">WISHOP</span>
          </a>
        </div>
      </footer>

      {/* Phone: the basket stays one tap away */}
      {cartItemCount > 0 && !isCartOpen && (
        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 rounded-2xl bg-[var(--accent-bg)] px-4 py-3.5 text-white shadow-[0_14px_30px_-12px_rgba(0,0,0,0.55)] sm:left-auto sm:right-6 sm:w-96"
        >
          <ShoppingBag className="h-5 w-5 shrink-0" />
          <span className="text-[15px] font-semibold">{t("cart_items", { count: cartItemCount })}</span>
          <span className="ml-auto text-[15px] font-bold">{format(totalAmount)}</span>
        </button>
      )}

      {/* Product sheet */}
      <Modal isOpen={openProduct !== null} onClose={() => setOpenProduct(null)} title={openProduct?.name ?? ""}>
        {openProduct && (
          <div className="flex flex-col gap-4">
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-zinc-100">
              {openProduct.image_url ? (
                <Image src={openProduct.image_url} alt="" fill sizes="(max-width: 640px) 100vw, 512px" className="object-cover" />
              ) : (
                <span className="store-heading flex h-full w-full items-center justify-center text-[72px] font-bold text-zinc-300">
                  {openProduct.name.trim()[0]?.toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-[22px] font-bold text-[var(--accent-text)]">{format(openProduct.selling_price)}</p>
            {openProduct.category_name && <p className="text-[13px] text-zinc-500">{openProduct.category_name}</p>}
            {openProduct.description && <p className="whitespace-pre-line text-[15px] leading-relaxed text-zinc-700">{openProduct.description}</p>}
            {openProduct.in_stock ? (
              <button
                type="button"
                onClick={() => {
                  addToCart(openProduct.product_id);
                  setOpenProduct(null);
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-bg)] py-3.5 text-[15px] font-bold text-white hover:bg-[var(--accent-bg-hover)]"
              >
                <Plus className="h-5 w-5" /> {t("add_to_cart")}
              </button>
            ) : (
              <p className="rounded-xl bg-zinc-100 py-3 text-center text-[14px] font-semibold text-zinc-600">{t("out_of_stock")}</p>
            )}
          </div>
        )}
      </Modal>

      {/* Basket and order */}
      <Modal
        isOpen={isCartOpen}
        onClose={() => {
          setIsCartOpen(false);
          if (orderPlaced) setOrderPlaced(false);
        }}
        title={t("cart_title")}
      >
        {orderPlaced ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle2 className="h-14 w-14 text-emerald-600" />
            <h3 className="store-heading text-xl font-bold">{t("order_success_title")}</h3>
            <p className="px-4 text-[15px] text-zinc-600">{t("order_success_body")}</p>
            <button
              type="button"
              onClick={() => {
                setOrderPlaced(false);
                setIsCartOpen(false);
              }}
              className="mt-2 rounded-xl bg-zinc-100 px-6 py-3 text-[14px] font-semibold text-zinc-900 hover:bg-zinc-200"
            >
              {t("back_to_shop")}
            </button>
          </div>
        ) : cart.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <ShoppingBag className="h-12 w-12 text-zinc-300" />
            <p className="text-zinc-500">{t("empty_cart")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <ul className="divide-y divide-zinc-200">
              {cart.map((item) => {
                const product = products.find((p) => p.product_id === item.productId);
                if (!product) return null;
                return (
                  <li key={item.productId} className="flex items-center gap-3 py-3">
                    <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                      {product.image_url && <Image src={product.image_url} alt="" fill sizes="56px" className="object-cover" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{product.name}</span>
                      <span className="block text-[13px] font-semibold text-[var(--accent-text)]">{format(product.selling_price * item.quantity)}</span>
                    </span>
                    <span className="flex shrink-0 items-center rounded-full bg-zinc-100">
                      <button type="button" aria-label={t("one_less")} onClick={() => updateQuantity(item.productId, -1)} className="rounded-full p-2 hover:bg-zinc-200">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center font-mono text-[13px] font-semibold">{item.quantity}</span>
                      <button type="button" aria-label={t("one_more")} onClick={() => updateQuantity(item.productId, 1)} className="rounded-full p-2 hover:bg-zinc-200">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </span>
                    <button type="button" aria-label={t("remove")} onClick={() => removeFromCart(item.productId)} className="shrink-0 rounded-full p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-baseline justify-between border-t border-zinc-200 pt-4">
              <span className="text-[13px] font-semibold uppercase tracking-wider text-zinc-500">{t("total")}</span>
              <span className="text-[22px] font-bold">{format(totalAmount)}</span>
            </div>

            <form onSubmit={handleCheckout} className="flex flex-col gap-3">
              <label htmlFor="customer-name" className="text-[13px] font-semibold text-zinc-700">{t("your_name")}</label>
              <input id="customer-name" required type="text" autoComplete="name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputClass} />
              <label htmlFor="customer-phone" className="text-[13px] font-semibold text-zinc-700">{t("your_phone")}</label>
              <div className="flex gap-2">
                <PhoneCountryCodeSelect value={phoneCountryCode} onChange={setPhoneCountryCode} label={t("phone_country_code")} />
                <input id="customer-phone" required type="tel" autoComplete="tel-national" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className={`${inputClass} min-w-0 flex-1`} />
              </div>
              <p className="text-[12.5px] text-zinc-500">{t("phone_country_hint")}</p>

              <p className="rounded-xl bg-[var(--accent-light)] p-3 text-[13.5px] text-zinc-800">{t("pickup_notice")}</p>

              {error && <p role="alert" className="text-center text-[14px] font-semibold text-red-600">{tFeedback(error)}</p>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-[var(--accent-bg)] py-4 text-[15px] font-bold text-white transition-colors hover:bg-[var(--accent-bg-hover)] disabled:opacity-50"
              >
                {isSubmitting ? t("submitting") : t("place_order")}
              </button>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
}
