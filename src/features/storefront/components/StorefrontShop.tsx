"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Plus, Minus, Trash2, ShoppingBag, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { createClient } from "@/utils/supabase/client";
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
  const cartKey = `storefront-cart-${shop.shop_id}`;

  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderPlaced, setOrderPlaced] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(cartKey);
      if (raw) setCart(JSON.parse(raw));
    } catch {
      // ignore malformed/unavailable storage
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(cartKey, JSON.stringify(cart));
    } catch {
      // ignore unavailable storage
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

  const format = (n: number) => `${n.toLocaleString("fr-FR")} ${shop.currency_symbol}`;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const items = cart.map((item) => ({ product_id: item.productId, quantity: item.quantity }));

      const { error: rpcError } = await supabase.rpc("place_online_order", {
        _shop_id: shop.shop_id,
        _customer_name: customerName,
        _customer_phone: customerPhone,
        _items: items,
      });

      if (rpcError) throw new Error(rpcError.message);

      setCart([]);
      setOrderPlaced(true);
    } catch (err: any) {
      setError(err.message ?? t("order_error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b bg-white dark:bg-zinc-900 px-4 py-4 sm:py-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            {shop.shop_logo_url ? (
              <Image src={shop.shop_logo_url} alt={shop.shop_name || ""} width={56} height={56} className="h-14 w-14 shrink-0 rounded-xl object-cover" />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-xl font-bold text-white">
                {(shop.shop_name || "B")[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold">{shop.shop_name || t("default_shop_name")}</h1>
              {shop.shop_address && <p className="truncate text-sm text-zinc-500">{shop.shop_address}</p>}
            </div>
          </div>
          <div className="shrink-0 self-start sm:self-auto">
            <LocaleSwitcher variant="pills" />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 p-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold">{t("catalog_title")}</h2>
          {products.length === 0 ? (
            <p className="rounded-lg border bg-white dark:bg-zinc-900 p-8 text-center text-sm text-zinc-500">
              {t("no_products")}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {products.map((product) => (
                <div key={product.product_id} className="flex flex-col rounded-lg border bg-white dark:bg-zinc-900 p-3 shadow-sm">
                  <div className="mb-2 flex h-28 items-center justify-center overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">
                    {product.image_url ? (
                      <Image src={product.image_url} alt={product.name} width={160} height={112} className="h-full w-full object-cover" />
                    ) : (
                      <ShoppingBag className="h-8 w-8 text-zinc-300" />
                    )}
                  </div>
                  <span className="line-clamp-2 text-sm font-medium">{product.name}</span>
                  {product.category_name && <span className="text-xs text-zinc-400">{product.category_name}</span>}
                  <span className="mt-1 font-bold">{format(product.selling_price)}</span>
                  {!product.in_stock ? (
                    <span className="mt-2 text-xs font-medium text-red-500">{t("out_of_stock")}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addToCart(product.product_id)}
                      className="mt-2 rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-black/90 dark:bg-white dark:text-black"
                    >
                      {t("add_to_cart")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-white dark:bg-zinc-900 p-4 shadow-sm h-fit">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <ShoppingBag className="h-5 w-5" /> {t("cart_title")}
          </h2>

          {orderPlaced ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <p className="font-medium">{t("order_success_title")}</p>
              <p className="text-sm text-zinc-500">{t("order_success_body")}</p>
              <button
                type="button"
                onClick={() => setOrderPlaced(false)}
                className="mt-2 text-sm text-violet-600 hover:underline"
              >
                {t("back_to_shop")}
              </button>
            </div>
          ) : cart.length === 0 ? (
            <p className="text-sm text-zinc-500">{t("empty_cart")}</p>
          ) : (
            <form onSubmit={handleCheckout} className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 max-h-72 overflow-y-auto pr-1">
                {cart.map((item) => {
                  const product = products.find((p) => p.product_id === item.productId);
                  if (!product) return null;
                  return (
                    <div key={item.productId} className="flex items-center justify-between gap-2 border-b pb-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{product.name}</p>
                        <p className="text-xs text-zinc-500">{format(product.selling_price * item.quantity)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button type="button" onClick={() => updateQuantity(item.productId, -1)} className="rounded-full bg-zinc-200 p-1 dark:bg-zinc-700">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-4 text-center text-sm">{item.quantity}</span>
                        <button type="button" onClick={() => updateQuantity(item.productId, 1)} className="rounded-full bg-zinc-200 p-1 dark:bg-zinc-700">
                          <Plus className="h-3 w-3" />
                        </button>
                        <button type="button" onClick={() => removeFromCart(item.productId)} className="ml-1 text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between border-t pt-2 text-base font-bold">
                <span>{t("total")}</span>
                <span>{format(totalAmount)}</span>
              </div>

              <div className="flex flex-col gap-2">
                <input
                  required
                  type="text"
                  placeholder={t("your_name")}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
                <input
                  required
                  type="text"
                  placeholder={t("your_phone")}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>

              <p className="text-xs text-zinc-500">{t("pickup_notice")}</p>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-black py-2.5 text-sm font-bold text-white hover:bg-black/90 disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {isSubmitting ? t("submitting") : t("place_order")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
