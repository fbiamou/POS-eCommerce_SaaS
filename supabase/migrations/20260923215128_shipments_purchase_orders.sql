-- Migration: shipments_purchase_orders
-- Fournisseurs, arrivages (colis déclarés par un intermédiaire) et bons de
-- commande, validés avec le Propriétaire le 23/09/2026 :
--  - un lien de collecte par colis, fermé dès que le colis est déclaré ;
--  - le pointage d'un arrivage est la seule entrée de stock fournisseur ;
--  - un bon de commande par fournisseur, quantité proposée = remonter au
--    double du seuil de stock bas, modifiable ; le bon est seulement marqué
--    « reçu », il n'ajoute jamais de stock lui-même.
-- Toutes les écritures passent par des fonctions centralisées (AGENTS.md) ;
-- les tables sont en lecture seule pour les comptes de la boutique.


-- ============================================================
-- 1. Fournisseurs
-- ============================================================
CREATE TABLE public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL,
    name TEXT NOT NULL CHECK (btrim(name) <> ''),
    phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX suppliers_shop_id_idx ON public.suppliers (shop_id);
CREATE TRIGGER set_suppliers_updated_at BEFORE UPDATE ON public.suppliers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Suppliers readable by shop members" ON public.suppliers
    FOR SELECT USING (shop_id = get_current_shop_id());
CREATE POLICY "Suppliers created by shop members" ON public.suppliers
    FOR INSERT WITH CHECK (shop_id = get_current_shop_id());
CREATE POLICY "Suppliers updated by shop members" ON public.suppliers
    FOR UPDATE USING (shop_id = get_current_shop_id()) WITH CHECK (shop_id = get_current_shop_id());
-- Un fournisseur se désactive, il ne se supprime pas.
REVOKE ALL ON public.suppliers FROM anon;
REVOKE DELETE ON public.suppliers FROM authenticated;

-- La fiche article du brief prévoit « fournisseur » et « pays d'origine ».
-- L'ancienne colonne texte `supplier`, jamais remplie ni affichée, est
-- laissée en place et n'est plus utilisée.
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS products_supplier_id_idx ON public.products (supplier_id);


-- ============================================================
-- 2. Numérotation (ARR-2026-0001, BC-2026-0001)
-- ============================================================
ALTER TABLE public.settings
    ADD COLUMN IF NOT EXISTS next_shipment_number INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS next_purchase_order_number INTEGER NOT NULL DEFAULT 1;

CREATE TYPE public.shipment_status AS ENUM ('AWAITING_DECLARATION', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED');
CREATE TYPE public.purchase_order_status AS ENUM ('DRAFT', 'SENT', 'RECEIVED', 'CANCELLED');


-- ============================================================
-- 3. Bons de commande
-- ============================================================
CREATE TABLE public.purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL,
    reference TEXT NOT NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    status public.purchase_order_status NOT NULL DEFAULT 'DRAFT',
    created_by UUID REFERENCES public.profiles(id),
    sent_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (shop_id, reference)
);
CREATE INDEX purchase_orders_shop_id_idx ON public.purchase_orders (shop_id, created_at DESC);
CREATE TRIGGER set_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL,
    purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    stock_at_creation INTEGER NOT NULL,
    -- Une ligne retirée d'un brouillon est exclue, jamais supprimée.
    excluded BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (purchase_order_id, product_id)
);
CREATE INDEX purchase_order_items_order_idx ON public.purchase_order_items (purchase_order_id);


-- ============================================================
-- 4. Arrivages
-- ============================================================
CREATE TABLE public.shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL,
    reference TEXT NOT NULL,
    intermediary_name TEXT,
    intermediary_phone TEXT,
    purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
    status public.shipment_status NOT NULL DEFAULT 'AWAITING_DECLARATION',
    -- Jeton du lien de collecte : 256 bits aléatoires, impossible à deviner.
    -- Il n'ouvre la saisie que tant que le colis attend sa déclaration.
    intake_token TEXT NOT NULL UNIQUE
        DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    photo_path TEXT,
    declared_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    received_by UUID REFERENCES public.profiles(id),
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (shop_id, reference)
);
CREATE INDEX shipments_shop_id_idx ON public.shipments (shop_id, created_at DESC);
CREATE TRIGGER set_shipments_updated_at BEFORE UPDATE ON public.shipments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.shipment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL,
    shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (btrim(name) <> ''),
    category_name TEXT,
    product_type TEXT,
    brand TEXT,
    unit_purchase_price INTEGER NOT NULL DEFAULT 0 CHECK (unit_purchase_price >= 0),
    declared_quantity INTEGER NOT NULL CHECK (declared_quantity > 0),
    received_quantity INTEGER CHECK (received_quantity >= 0),
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX shipment_items_shipment_idx ON public.shipment_items (shipment_id);


-- ============================================================
-- 5. Sécurité des nouvelles tables : lecture pour l'équipe, écriture par RPC
-- ============================================================
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Purchase orders readable by shop members" ON public.purchase_orders
    FOR SELECT USING (shop_id = get_current_shop_id());
CREATE POLICY "Purchase order items readable by shop members" ON public.purchase_order_items
    FOR SELECT USING (shop_id = get_current_shop_id());
CREATE POLICY "Shipments readable by shop members" ON public.shipments
    FOR SELECT USING (shop_id = get_current_shop_id());
CREATE POLICY "Shipment items readable by shop members" ON public.shipment_items
    FOR SELECT USING (shop_id = get_current_shop_id());

REVOKE ALL ON public.purchase_orders, public.purchase_order_items, public.shipments, public.shipment_items FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.purchase_orders, public.purchase_order_items, public.shipments, public.shipment_items FROM authenticated;


-- ============================================================
-- 6. Arrivages : fonctions
-- ============================================================

-- Crée un colis attendu et son lien de collecte.
CREATE OR REPLACE FUNCTION public.create_shipment_link(
    _shop_id UUID,
    _intermediary_name TEXT,
    _intermediary_phone TEXT,
    _purchase_order_id UUID DEFAULT NULL
)
RETURNS TABLE (shipment_id UUID, intake_token TEXT, reference TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    _seq INTEGER;
    _reference TEXT;
BEGIN
    IF _shop_id != get_current_shop_id() THEN
        RAISE EXCEPTION 'Unauthorized shop access';
    END IF;

    IF _purchase_order_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM purchase_orders po
        WHERE po.id = _purchase_order_id AND po.shop_id = _shop_id AND po.status IN ('DRAFT', 'SENT')
    ) THEN
        RAISE EXCEPTION 'purchase_order_not_found';
    END IF;

    UPDATE settings SET next_shipment_number = next_shipment_number + 1
    WHERE settings.shop_id = _shop_id
    RETURNING next_shipment_number - 1 INTO _seq;
    _reference := 'ARR-' || to_char(now(), 'YYYY') || '-' || lpad(COALESCE(_seq, 1)::text, 4, '0');

    RETURN QUERY
    INSERT INTO shipments (shop_id, reference, intermediary_name, intermediary_phone, purchase_order_id, created_by)
    VALUES (_shop_id, _reference, NULLIF(btrim(_intermediary_name), ''), NULLIF(btrim(_intermediary_phone), ''),
            _purchase_order_id, auth.uid())
    RETURNING shipments.id, shipments.intake_token, shipments.reference;
END;
$$;

-- Vrai si le jeton ouvre encore une saisie (sert à la règle de dépôt photo).
CREATE OR REPLACE FUNCTION public.is_open_intake_token(_token TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM shipments WHERE intake_token = _token AND status = 'AWAITING_DECLARATION'
    );
$$;

-- Ce que voit l'intermédiaire en ouvrant le lien : le strict nécessaire.
CREATE OR REPLACE FUNCTION public.get_shipment_intake(_token TEXT)
RETURNS TABLE (reference TEXT, status public.shipment_status, shop_name TEXT, shop_logo_url TEXT, currency_symbol TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
    SELECT s.reference, s.status, st.shop_name, st.shop_logo_url, st.currency_symbol
    FROM shipments s
    JOIN settings st ON st.shop_id = s.shop_id
    WHERE s.intake_token = _token;
$$;

-- L'intermédiaire déclare le contenu du colis. Le lien se ferme ensuite.
CREATE OR REPLACE FUNCTION public.submit_shipment_declaration(_token TEXT, _items JSONB, _photo_path TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    _shipment shipments%ROWTYPE;
    _item JSONB;
    _name TEXT;
    _qty INTEGER;
    _price INTEGER;
BEGIN
    SELECT * INTO _shipment FROM shipments WHERE intake_token = _token FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'shipment_not_found';
    END IF;
    IF _shipment.status <> 'AWAITING_DECLARATION' THEN
        RAISE EXCEPTION 'shipment_already_submitted';
    END IF;

    IF _photo_path IS NULL OR _photo_path NOT LIKE _token || '/%' THEN
        RAISE EXCEPTION 'photo_required';
    END IF;

    IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
        RAISE EXCEPTION 'empty_cart';
    END IF;
    IF jsonb_array_length(_items) > 500 THEN
        RAISE EXCEPTION 'too_many_items';
    END IF;

    FOR _item IN SELECT * FROM jsonb_array_elements(_items)
    LOOP
        _name := btrim(COALESCE(_item->>'name', ''));
        _qty := (_item->>'quantity')::INTEGER;
        _price := COALESCE((_item->>'unit_price')::INTEGER, 0);
        IF _name = '' THEN
            RAISE EXCEPTION 'required_fields_missing';
        END IF;
        IF _qty IS NULL OR _qty <= 0 THEN
            RAISE EXCEPTION 'invalid_quantity';
        END IF;
        IF _price < 0 THEN
            RAISE EXCEPTION 'invalid_price';
        END IF;

        INSERT INTO shipment_items (shop_id, shipment_id, name, category_name, product_type, brand,
                                    unit_purchase_price, declared_quantity)
        VALUES (_shipment.shop_id, _shipment.id, _name,
                NULLIF(btrim(_item->>'category'), ''), NULLIF(btrim(_item->>'type'), ''),
                NULLIF(btrim(_item->>'brand'), ''), _price, _qty);
    END LOOP;

    UPDATE shipments
    SET status = 'IN_TRANSIT', declared_at = NOW(), photo_path = _photo_path
    WHERE id = _shipment.id;

    RETURN _shipment.reference;
END;
$$;

-- Pointage à l'arrivée : seule entrée de stock depuis un fournisseur.
-- _received : [{ "item_id": ..., "received_quantity": n, "selling_price": n (facultatif, article nouveau) }]
CREATE OR REPLACE FUNCTION public.receive_shipment(_shop_id UUID, _shipment_id UUID, _received JSONB)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    _shipment shipments%ROWTYPE;
    _item shipment_items%ROWTYPE;
    _entry JSONB;
    _qty INTEGER;
    _selling_price INTEGER;
    _product_id UUID;
    _category_id UUID;
BEGIN
    IF _shop_id != get_current_shop_id() THEN
        RAISE EXCEPTION 'Unauthorized shop access';
    END IF;

    SELECT * INTO _shipment FROM shipments WHERE id = _shipment_id AND shop_id = _shop_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'shipment_not_found';
    END IF;
    IF _shipment.status <> 'IN_TRANSIT' THEN
        RAISE EXCEPTION 'shipment_not_in_transit';
    END IF;

    FOR _item IN SELECT * FROM shipment_items WHERE shipment_id = _shipment_id ORDER BY created_at
    LOOP
        SELECT e INTO _entry FROM jsonb_array_elements(_received) e WHERE e->>'item_id' = _item.id::text LIMIT 1;
        IF _entry IS NULL THEN
            RAISE EXCEPTION 'missing_received_quantity';
        END IF;
        _qty := (_entry->>'received_quantity')::INTEGER;
        IF _qty IS NULL OR _qty < 0 THEN
            RAISE EXCEPTION 'invalid_quantity';
        END IF;
        _selling_price := NULLIF(_entry->>'selling_price', '')::INTEGER;
        IF _selling_price IS NOT NULL AND _selling_price < 0 THEN
            RAISE EXCEPTION 'invalid_price';
        END IF;

        _product_id := NULL;
        IF _qty > 0 THEN
            -- Même article = même nom, même marque, même type (sans tenir compte de la casse).
            SELECT p.id INTO _product_id
            FROM products p
            WHERE p.shop_id = _shop_id AND p.is_active
              AND lower(p.name) = lower(_item.name)
              AND lower(COALESCE(p.brand, '')) = lower(COALESCE(_item.brand, ''))
              AND lower(COALESCE(p.product_type, '')) = lower(COALESCE(_item.product_type, ''))
            ORDER BY p.created_at
            LIMIT 1
            FOR UPDATE;

            IF _product_id IS NULL THEN
                _category_id := NULL;
                IF _item.category_name IS NOT NULL THEN
                    SELECT c.id INTO _category_id FROM categories c
                    WHERE c.shop_id = _shop_id AND lower(c.name) = lower(_item.category_name) LIMIT 1;
                    IF _category_id IS NULL THEN
                        INSERT INTO categories (shop_id, name) VALUES (_shop_id, _item.category_name)
                        RETURNING id INTO _category_id;
                    END IF;
                END IF;

                INSERT INTO products (shop_id, name, brand, product_type, category_id, supplier_id,
                                      purchase_price, selling_price, quantity_in_stock)
                VALUES (_shop_id, _item.name, _item.brand, _item.product_type, _category_id,
                        (SELECT po.supplier_id FROM purchase_orders po WHERE po.id = _shipment.purchase_order_id),
                        _item.unit_purchase_price, COALESCE(_selling_price, 0), 0)
                RETURNING id INTO _product_id;
            END IF;

            UPDATE products
            SET quantity_in_stock = quantity_in_stock + _qty,
                purchase_price = CASE WHEN _item.unit_purchase_price > 0 THEN _item.unit_purchase_price ELSE purchase_price END,
                selling_price = COALESCE(_selling_price, selling_price)
            WHERE id = _product_id AND shop_id = _shop_id;

            INSERT INTO stock_movements (shop_id, product_id, type, quantity_change, reference_id, created_by)
            VALUES (_shop_id, _product_id, 'RESTOCK', _qty, _shipment_id, auth.uid());
        END IF;

        UPDATE shipment_items SET received_quantity = _qty, product_id = _product_id WHERE id = _item.id;
    END LOOP;

    UPDATE shipments SET status = 'RECEIVED', received_at = NOW(), received_by = auth.uid()
    WHERE id = _shipment_id;

    IF _shipment.purchase_order_id IS NOT NULL THEN
        UPDATE purchase_orders SET status = 'RECEIVED', received_at = NOW()
        WHERE id = _shipment.purchase_order_id AND status IN ('DRAFT', 'SENT');
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_shipment(_shop_id UUID, _shipment_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
    IF _shop_id != get_current_shop_id() THEN
        RAISE EXCEPTION 'Unauthorized shop access';
    END IF;
    UPDATE shipments SET status = 'CANCELLED'
    WHERE id = _shipment_id AND shop_id = _shop_id AND status IN ('AWAITING_DECLARATION', 'IN_TRANSIT');
    IF NOT FOUND THEN
        RAISE EXCEPTION 'shipment_not_found';
    END IF;
END;
$$;


-- ============================================================
-- 7. Bons de commande : fonctions
-- ============================================================

-- Un brouillon par fournisseur pour les articles sous le seuil qui ne sont
-- pas déjà dans un bon ouvert. Quantité proposée : remonter au double du
-- seuil (seuil 5, stock 2 : 8), modifiable avant envoi.
CREATE OR REPLACE FUNCTION public.create_purchase_orders(_shop_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    _threshold INTEGER;
    _group RECORD;
    _seq INTEGER;
    _order_id UUID;
    _created INTEGER := 0;
BEGIN
    IF _shop_id != get_current_shop_id() THEN
        RAISE EXCEPTION 'Unauthorized shop access';
    END IF;

    SELECT low_stock_threshold INTO _threshold FROM settings WHERE shop_id = _shop_id;
    _threshold := COALESCE(_threshold, 5);

    FOR _group IN
        SELECT p.supplier_id
        FROM products p
        WHERE p.shop_id = _shop_id AND p.is_active AND p.quantity_in_stock <= _threshold
          AND NOT EXISTS (
              SELECT 1 FROM purchase_order_items poi
              JOIN purchase_orders po ON po.id = poi.purchase_order_id
              WHERE poi.product_id = p.id AND NOT poi.excluded AND po.status IN ('DRAFT', 'SENT')
          )
        GROUP BY p.supplier_id
    LOOP
        UPDATE settings SET next_purchase_order_number = next_purchase_order_number + 1
        WHERE shop_id = _shop_id
        RETURNING next_purchase_order_number - 1 INTO _seq;

        INSERT INTO purchase_orders (shop_id, reference, supplier_id, created_by)
        VALUES (_shop_id, 'BC-' || to_char(now(), 'YYYY') || '-' || lpad(COALESCE(_seq, 1)::text, 4, '0'),
                _group.supplier_id, auth.uid())
        RETURNING id INTO _order_id;

        INSERT INTO purchase_order_items (shop_id, purchase_order_id, product_id, quantity, stock_at_creation)
        SELECT _shop_id, _order_id, p.id, GREATEST(2 * _threshold - p.quantity_in_stock, 1), p.quantity_in_stock
        FROM products p
        WHERE p.shop_id = _shop_id AND p.is_active AND p.quantity_in_stock <= _threshold
          AND p.supplier_id IS NOT DISTINCT FROM _group.supplier_id
          AND NOT EXISTS (
              SELECT 1 FROM purchase_order_items poi
              JOIN purchase_orders po ON po.id = poi.purchase_order_id
              WHERE poi.product_id = p.id AND NOT poi.excluded AND po.status IN ('DRAFT', 'SENT')
                AND po.id <> _order_id
          );

        _created := _created + 1;
    END LOOP;

    RETURN _created;
END;
$$;

-- Modifier une ligne d'un brouillon (quantité, ou l'exclure du bon).
CREATE OR REPLACE FUNCTION public.update_purchase_order_item(_shop_id UUID, _item_id UUID, _quantity INTEGER, _excluded BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
    IF _shop_id != get_current_shop_id() THEN
        RAISE EXCEPTION 'Unauthorized shop access';
    END IF;
    IF _quantity IS NULL OR _quantity <= 0 THEN
        RAISE EXCEPTION 'invalid_quantity';
    END IF;
    UPDATE purchase_order_items poi
    SET quantity = _quantity, excluded = COALESCE(_excluded, FALSE)
    FROM purchase_orders po
    WHERE poi.id = _item_id AND poi.shop_id = _shop_id
      AND po.id = poi.purchase_order_id AND po.status = 'DRAFT';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'purchase_order_not_editable';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_purchase_order_status(_shop_id UUID, _order_id UUID, _status public.purchase_order_status)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    _current public.purchase_order_status;
BEGIN
    IF _shop_id != get_current_shop_id() THEN
        RAISE EXCEPTION 'Unauthorized shop access';
    END IF;

    SELECT status INTO _current FROM purchase_orders WHERE id = _order_id AND shop_id = _shop_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'purchase_order_not_found';
    END IF;

    -- Transitions permises : brouillon -> envoyé -> reçu ; annulation tant
    -- que rien n'est reçu. Aucune ne touche au stock.
    IF NOT (
        (_current = 'DRAFT' AND _status IN ('SENT', 'CANCELLED')) OR
        (_current = 'SENT' AND _status IN ('RECEIVED', 'CANCELLED'))
    ) THEN
        RAISE EXCEPTION 'invalid_status_change';
    END IF;

    IF _status = 'SENT' AND NOT EXISTS (
        SELECT 1 FROM purchase_order_items WHERE purchase_order_id = _order_id AND NOT excluded
    ) THEN
        RAISE EXCEPTION 'empty_cart';
    END IF;

    UPDATE purchase_orders
    SET status = _status,
        sent_at = CASE WHEN _status = 'SENT' THEN NOW() ELSE sent_at END,
        received_at = CASE WHEN _status = 'RECEIVED' THEN NOW() ELSE received_at END
    WHERE id = _order_id;
END;
$$;


-- ============================================================
-- 8. Droits d'exécution
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.create_shipment_link(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.receive_shipment(UUID, UUID, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_shipment(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_purchase_orders(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_purchase_order_item(UUID, UUID, INTEGER, BOOLEAN) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_purchase_order_status(UUID, UUID, public.purchase_order_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_shipment_link(UUID, TEXT, TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.receive_shipment(UUID, UUID, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_shipment(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_purchase_orders(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_purchase_order_item(UUID, UUID, INTEGER, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_purchase_order_status(UUID, UUID, public.purchase_order_status) TO authenticated, service_role;

-- Ouvertes à l'intermédiaire, sans compte : protégées par le jeton du lien.
GRANT EXECUTE ON FUNCTION public.get_shipment_intake(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_shipment_declaration(TEXT, JSONB, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_open_intake_token(TEXT) TO anon, authenticated;


-- ============================================================
-- 9. Photos des colis : espace privé
-- ============================================================
-- L'intermédiaire dépose la photo dans le dossier "<jeton>/", uniquement
-- tant que le colis attend sa déclaration. Seule l'équipe de la boutique
-- peut ensuite la voir (lien signé, jamais public).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('shipment-photos', 'shipment-photos', FALSE, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Intermediary uploads parcel photo" ON storage.objects
    FOR INSERT TO anon, authenticated
    WITH CHECK (bucket_id = 'shipment-photos'
                AND public.is_open_intake_token((storage.foldername(name))[1]));

CREATE POLICY "Shop members view parcel photos" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'shipment-photos'
           AND EXISTS (
               SELECT 1 FROM public.shipments s
               WHERE s.intake_token = (storage.foldername(name))[1]
                 AND s.shop_id = public.get_current_shop_id()
           ));
