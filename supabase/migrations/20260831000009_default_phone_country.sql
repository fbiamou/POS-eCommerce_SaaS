-- Migration: 00012_default_phone_country.sql
-- Indicatif téléphonique par défaut de la boutique (pays de résidence),
-- utilisé pour pré-remplir le sélecteur d'indicatif sur le formulaire de
-- commande de la boutique en ligne — une cliente peut avoir un numéro
-- WhatsApp d'un autre pays et doit pouvoir le corriger.

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS default_phone_country_code TEXT NOT NULL DEFAULT '+237';

-- Expose it on the public storefront profile function (safe to share
-- publicly — it's just a dial-code hint, not sensitive). The return
-- row type is changing (new column), so Postgres won't allow a plain
-- CREATE OR REPLACE — the old function must be dropped first.
DROP FUNCTION IF EXISTS get_public_shop_profile(TEXT);

CREATE FUNCTION get_public_shop_profile(_shop_slug TEXT)
RETURNS TABLE (
    shop_id UUID,
    shop_name TEXT,
    shop_logo_url TEXT,
    shop_address TEXT,
    shop_phone TEXT,
    currency_symbol TEXT,
    theme_accent_color TEXT,
    theme_font TEXT,
    default_phone_country_code TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT shop_id, shop_name, shop_logo_url, shop_address, shop_phone,
           currency_symbol, theme_accent_color, theme_font, default_phone_country_code
    FROM settings
    WHERE shop_slug = _shop_slug;
$$;
