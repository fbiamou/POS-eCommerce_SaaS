"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_TIME_ZONE, formatDate, formatMoney, formatNumber } from "@/lib/format";

type ShopFormatValue = {
  locale: string;
  currencySymbol: string;
  timeZone: string;
  lowStockThreshold: number;
};

const ShopFormatContext = createContext<ShopFormatValue>({
  locale: "es",
  currencySymbol: "",
  timeZone: DEFAULT_TIME_ZONE,
  lowStockThreshold: 5,
});

// Rendered once by the authenticated layout, with values read from the
// shop's settings on the server, so every client component formats amounts
// and dates the same way without prop drilling.
export function ShopFormatProvider({ value, children }: { value: ShopFormatValue; children: React.ReactNode }) {
  return <ShopFormatContext.Provider value={value}>{children}</ShopFormatContext.Provider>;
}

export function useShopFormat() {
  const value = useContext(ShopFormatContext);
  return useMemo(
    () => ({
      ...value,
      money: (amount: number) => formatMoney(amount, value.currencySymbol, value.locale),
      number: (amount: number) => formatNumber(amount, value.locale),
      date: (iso: string | Date, style?: Parameters<typeof formatDate>[3]) =>
        formatDate(iso, value.locale, value.timeZone, style),
      isLowStock: (quantity: number) => quantity <= value.lowStockThreshold,
    }),
    [value]
  );
}
