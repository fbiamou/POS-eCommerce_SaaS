import { createClient } from "@/utils/supabase/server";

export type PublicShopProfile = {
  shop_id: string;
  shop_name: string | null;
  shop_logo_url: string | null;
  shop_address: string | null;
  shop_phone: string | null;
  currency_symbol: string;
  theme_accent_color: string;
  theme_font: string;
  default_phone_country_code: string;
  /** False on Pro Plus: the storefront carries no WISHOP mention. */
  show_wishop_badge: boolean;
};

export type PublicProduct = {
  product_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  category_name: string | null;
  selling_price: number;
  in_stock: boolean;
};

export async function getPublicShopProfile(slug: string): Promise<PublicShopProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_shop_profile", { _shop_slug: slug });
  if (error || !data || data.length === 0) return null;
  return data[0];
}

export async function getPublicShopCatalog(slug: string): Promise<PublicProduct[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_shop_catalog", { _shop_slug: slug });
  if (error) {
    console.error("Error fetching public catalog:", error);
    return [];
  }
  return data ?? [];
}
