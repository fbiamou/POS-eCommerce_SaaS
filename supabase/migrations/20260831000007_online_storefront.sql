-- Migration: 00010_online_storefront.sql
-- Boutique en ligne : catalogue public par boutique + commandes en attente
-- (pas de paiement en ligne pour l'instant — retrait/paiement en boutique).

-- 1. Curation des articles publiés en ligne
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS is_published_online BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Identifiant public de la boutique (utilisé dans l'URL /boutique/{slug})
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS shop_slug TEXT UNIQUE;

-- 3. Bucket de stockage pour les photos d'articles
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read product-images" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "Shop members can upload product images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Shop members can update product images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Shop members can delete product images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
  );

-- 4. Commandes en ligne (en attente de confirmation en boutique)
CREATE TYPE online_order_status AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

CREATE TABLE IF NOT EXISTS online_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    status online_order_status NOT NULL DEFAULT 'PENDING',
    total_amount INTEGER NOT NULL DEFAULT 0,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    confirmed_by UUID REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS online_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL,
    order_id UUID NOT NULL REFERENCES online_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    unit_price INTEGER NOT NULL,
    total_price INTEGER NOT NULL
);

ALTER TABLE online_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE online_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Online orders isolated by shop" ON online_orders
    FOR ALL USING (shop_id = get_current_shop_id());

CREATE POLICY "Online order items isolated by shop" ON online_order_items
    FOR ALL USING (shop_id = get_current_shop_id());

-- 5. Lecture publique du profil boutique (uniquement les champs sûrs —
-- jamais les identifiants WhatsApp, infos fiscales, etc.)
CREATE OR REPLACE FUNCTION get_public_shop_profile(_shop_slug TEXT)
RETURNS TABLE (
    shop_id UUID,
    shop_name TEXT,
    shop_logo_url TEXT,
    shop_address TEXT,
    shop_phone TEXT,
    currency_symbol TEXT,
    theme_accent_color TEXT,
    theme_font TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT shop_id, shop_name, shop_logo_url, shop_address, shop_phone,
           currency_symbol, theme_accent_color, theme_font
    FROM settings
    WHERE shop_slug = _shop_slug;
$$;

-- 6. Lecture publique du catalogue (uniquement les articles publiés,
-- jamais le prix d'achat, le fournisseur, ou la quantité exacte en stock)
CREATE OR REPLACE FUNCTION get_public_shop_catalog(_shop_slug TEXT)
RETURNS TABLE (
    product_id UUID,
    name TEXT,
    description TEXT,
    image_url TEXT,
    category_name TEXT,
    selling_price INTEGER,
    in_stock BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT p.id, p.name, p.description, p.image_url, c.name, p.selling_price,
           (p.quantity_in_stock > 0)
    FROM products p
    JOIN settings s ON s.shop_id = p.shop_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE s.shop_slug = _shop_slug
      AND p.is_published_online = TRUE
      AND p.is_active = TRUE
    ORDER BY p.name ASC;
$$;

-- 7. Passer une commande en ligne (appelable anonymement — aucune session
-- requise, c'est une visiteuse du site public). Les prix sont toujours
-- recalculés côté serveur à partir du catalogue réel, jamais depuis ce que
-- le client envoie.
CREATE OR REPLACE FUNCTION place_online_order(
    _shop_id UUID,
    _customer_name TEXT,
    _customer_phone TEXT,
    _items JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _order_id UUID;
    _total_amount INTEGER := 0;
    _item JSONB;
    _product_id UUID;
    _qty INTEGER;
    _price INTEGER;
    _stock INTEGER;
    _is_published BOOLEAN;
BEGIN
    IF _customer_name IS NULL OR trim(_customer_name) = '' THEN
        RAISE EXCEPTION 'Customer name is required';
    END IF;
    IF _customer_phone IS NULL OR trim(_customer_phone) = '' THEN
        RAISE EXCEPTION 'Customer phone is required';
    END IF;
    IF jsonb_array_length(_items) = 0 THEN
        RAISE EXCEPTION 'Cart is empty';
    END IF;

    FOR _item IN SELECT * FROM jsonb_array_elements(_items)
    LOOP
        _product_id := (_item->>'product_id')::UUID;
        _qty := (_item->>'quantity')::INTEGER;

        SELECT selling_price, quantity_in_stock, is_published_online
        INTO _price, _stock, _is_published
        FROM products
        WHERE id = _product_id AND shop_id = _shop_id AND is_active = TRUE;

        IF NOT FOUND OR NOT _is_published THEN
            RAISE EXCEPTION 'Product % is not available', _product_id;
        END IF;
        IF _qty <= 0 OR _qty > _stock THEN
            RAISE EXCEPTION 'Invalid quantity for product %', _product_id;
        END IF;

        _total_amount := _total_amount + (_price * _qty);
    END LOOP;

    INSERT INTO online_orders (shop_id, customer_name, customer_phone, total_amount)
    VALUES (_shop_id, trim(_customer_name), trim(_customer_phone), _total_amount)
    RETURNING id INTO _order_id;

    FOR _item IN SELECT * FROM jsonb_array_elements(_items)
    LOOP
        _product_id := (_item->>'product_id')::UUID;
        _qty := (_item->>'quantity')::INTEGER;
        SELECT selling_price INTO _price FROM products WHERE id = _product_id;

        INSERT INTO online_order_items (shop_id, order_id, product_id, quantity, unit_price, total_price)
        VALUES (_shop_id, _order_id, _product_id, _qty, _price, _price * _qty);
    END LOOP;

    RETURN _order_id;
END;
$$;

-- 8. Confirmer une commande en ligne (staff authentifié) — transforme la
-- commande en attente en vraie vente en réutilisant record_sale() tel quel
-- (numéro de facture, décrément de stock, mouvements de stock, tout est
-- déjà géré là-bas).
CREATE OR REPLACE FUNCTION confirm_online_order(
    _shop_id UUID,
    _order_id UUID,
    _paid_amount INTEGER DEFAULT 0
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _client_id UUID;
    _customer_name TEXT;
    _customer_phone TEXT;
    _order_status online_order_status;
    _items JSONB;
    _invoice_id UUID;
BEGIN
    IF _shop_id != get_current_shop_id() THEN
        RAISE EXCEPTION 'Unauthorized shop access';
    END IF;

    SELECT customer_name, customer_phone, status
    INTO _customer_name, _customer_phone, _order_status
    FROM online_orders
    WHERE id = _order_id AND shop_id = _shop_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;
    IF _order_status != 'PENDING' THEN
        RAISE EXCEPTION 'Order is not pending';
    END IF;

    SELECT id INTO _client_id FROM clients WHERE shop_id = _shop_id AND phone = _customer_phone LIMIT 1;
    IF _client_id IS NULL THEN
        INSERT INTO clients (shop_id, name, phone)
        VALUES (_shop_id, _customer_name, _customer_phone)
        RETURNING id INTO _client_id;
    END IF;

    SELECT jsonb_agg(jsonb_build_object(
        'product_id', product_id,
        'quantity', quantity,
        'unit_price', unit_price
    ))
    INTO _items
    FROM online_order_items
    WHERE order_id = _order_id;

    _invoice_id := record_sale(_shop_id, _client_id, _items, _paid_amount);

    UPDATE online_orders
    SET status = 'CONFIRMED', invoice_id = _invoice_id, confirmed_at = NOW(), confirmed_by = auth.uid()
    WHERE id = _order_id;

    RETURN _invoice_id;
END;
$$;

-- 9. Annuler une commande en ligne (ex: cliente jamais venue)
CREATE OR REPLACE FUNCTION cancel_online_order(_shop_id UUID, _order_id UUID) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF _shop_id != get_current_shop_id() THEN
        RAISE EXCEPTION 'Unauthorized shop access';
    END IF;

    UPDATE online_orders
    SET status = 'CANCELLED'
    WHERE id = _order_id AND shop_id = _shop_id AND status = 'PENDING';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found or not pending';
    END IF;
END;
$$;
