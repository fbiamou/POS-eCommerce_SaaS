"use client";

import { createContext, useContext, useState } from "react";
import { useTranslations } from "next-intl";
import { Select } from "@/components/ui/Select";
import { SHOP_COUNTRIES, findShopCountry } from "@/lib/countries";
import { PHONE_COUNTRY_CODES } from "@/lib/phoneCountryCodes";
import { SHOP_TIME_ZONES } from "@/lib/timeZones";

// The shop's country and the settings it pre-fills (dialling code, time zone,
// VAT rate). The fields sit in different parts of the settings form, so they
// share their values through this context instead of one big component.
type Region = {
  country: string;
  phone: string;
  timeZone: string;
  vatRate: string;
  setCountry: (code: string) => void;
  setPhone: (code: string) => void;
  setTimeZone: (zone: string) => void;
  setVatRate: (rate: string) => void;
};

const RegionContext = createContext<Region | null>(null);

function useRegion() {
  const region = useContext(RegionContext);
  if (!region) throw new Error("ShopRegion fields must be inside <ShopRegionProvider>");
  return region;
}

export function ShopRegionProvider({
  initialCountry,
  initialPhone,
  initialTimeZone,
  initialVatRate,
  children,
}: {
  initialCountry: string | null;
  initialPhone: string;
  initialTimeZone: string;
  initialVatRate: string;
  children: React.ReactNode;
}) {
  const [country, setCountryState] = useState(initialCountry ?? "");
  const [phone, setPhone] = useState(initialPhone);
  const [timeZone, setTimeZone] = useState(initialTimeZone);
  const [vatRate, setVatRate] = useState(initialVatRate);

  const setCountry = (code: string) => {
    setCountryState(code);
    const preset = findShopCountry(code);
    if (!preset) return;
    setPhone(preset.phone);
    setTimeZone(preset.timeZone);
    setVatRate((preset.vatBps / 100).toFixed(2));
  };

  return (
    <RegionContext.Provider value={{ country, phone, timeZone, vatRate, setCountry, setPhone, setTimeZone, setVatRate }}>
      {children}
    </RegionContext.Provider>
  );
}

export function ShopCountryField({ id }: { id: string }) {
  const t = useTranslations("Settings");
  const { country, setCountry } = useRegion();
  return (
    <Select
      id={id}
      name="country_code"
      value={country}
      onChange={setCountry}
      options={[
        ...SHOP_COUNTRIES.map((c) => ({ value: c.code, label: t(`country_${c.code}`) })),
        { value: "", label: t("country_other") },
      ]}
    />
  );
}

export function ShopPhoneCodeField({ id }: { id: string }) {
  const { phone, setPhone } = useRegion();
  return (
    <Select
      id={id}
      name="default_phone_country_code"
      value={phone}
      onChange={setPhone}
      options={PHONE_COUNTRY_CODES.map((c) => ({ value: c.code, label: c.label, hint: c.code }))}
    />
  );
}

export function ShopTimeZoneField({ id }: { id: string }) {
  const { timeZone, setTimeZone } = useRegion();
  return (
    <Select
      id={id}
      name="timezone"
      value={timeZone}
      onChange={setTimeZone}
      options={SHOP_TIME_ZONES.map((z) => ({ value: z.value, label: z.label }))}
    />
  );
}

export function ShopVatRateField({ id, className }: { id: string; className?: string }) {
  const { vatRate, setVatRate } = useRegion();
  return (
    <input
      id={id}
      name="vat_rate"
      type="number"
      step="0.01"
      min="0"
      max="100"
      value={vatRate}
      onChange={(e) => setVatRate(e.target.value)}
      className={className}
    />
  );
}

// "NIU" or "NIF" in the tax section follows the chosen country.
export function ShopTaxIdLabel({ htmlFor, className }: { htmlFor: string; className?: string }) {
  const t = useTranslations("Settings");
  const { country } = useRegion();
  const preset = findShopCountry(country);
  return (
    <label htmlFor={htmlFor} className={className}>
      {preset ? t(`tax_id_${preset.taxIdLabel}`) : t("tax_id_generic")}
    </label>
  );
}
