-- Migration: stabilization_data
-- Corrections fonctionnelles relevées lors de l'audit du 23/09/2026.
-- Les nouveaux messages d'erreur sont des codes (ex. 'insufficient_stock')
-- que l'application traduit ; ils ne sont jamais affichés tels quels.


-- ============================================================
-- 1. Réglages : seuil de stock bas et fuseau horaire de la boutique
-- ============================================================
-- Un seul seuil, réglable par boutique (5 par défaut), pour le tableau de
-- bord, la liste du stock et les bons de commande. Le fuseau horaire sert à
-- délimiter « aujourd'hui » : le serveur tourne en UTC, soit une heure de
-- décalage avec l'Afrique centrale.
ALTER TABLE public.settings
    ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 5
        CHECK (low_stock_threshold >= 0),
    ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Africa/Douala';

-- Indique si un jeton WhatsApp est enregistré, sans exposer le jeton : une
-- migration suivante retire la lecture du jeton aux comptes de la boutique
-- (seul le code serveur en a besoin pour envoyer un message).
ALTER TABLE public.settings
    ADD COLUMN IF NOT EXISTS whatsapp_token_set BOOLEAN
        GENERATED ALWAYS AS (COALESCE(whatsapp_api_token, '') <> '') STORED;


-- ============================================================
-- 2. Produits : marque et type deviennent de vrais champs
-- ============================================================
-- Jusqu'ici ils étaient collés au nom (« Nom - type - marque »), ce qui
-- rendait les filtres de la caisse inutilisables. Champs facultatifs :
-- une boutique ne connaît pas toujours la marque d'un article.
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS brand TEXT,
    ADD COLUMN IF NOT EXISTS product_type TEXT;


-- ============================================================
-- 3. Vente : contrôles manquants
-- ============================================================
-- Corrige trois défauts de la version précédente :
--  - un article d'une autre boutique n'était pas refusé, et la mise à jour
--    du stock ne filtrait pas sur la boutique : un compte connecté pouvait
--    décrémenter le stock d'une autre boutique ;
--  - une quantité négative ou nulle était acceptée (elle augmentait le stock
--    et produisait une facture négative) ;
--  - un montant remis supérieur au total (monnaie rendue) était enregistré
--    tel quel comme payé. Seul le total compte désormais comme payé.
CREATE OR REPLACE FUNCTION public.record_sale(_shop_id uuid, _client_id uuid, _items jsonb, _paid_amount integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    _invoice_id UUID;
    _invoice_number TEXT;
    _invoice_seq INTEGER;
    _total_amount INTEGER := 0;
    _paid INTEGER;
    _item JSONB;
    _product_id UUID;
    _qty INTEGER;
    _price INTEGER;
    _current_stock INTEGER;
    _inv_status invoice_status;
BEGIN
    IF _shop_id != get_current_shop_id() THEN
        RAISE EXCEPTION 'Unauthorized shop access';
    END IF;

    IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
        RAISE EXCEPTION 'empty_cart';
    END IF;

    IF _paid_amount IS NULL OR _paid_amount < 0 THEN
        RAISE EXCEPTION 'invalid_amount';
    END IF;

    IF _client_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM clients WHERE id = _client_id AND shop_id = _shop_id) THEN
        RAISE EXCEPTION 'client_not_found';
    END IF;

    FOR _item IN SELECT * FROM jsonb_array_elements(_items)
    LOOP
        _qty := (_item->>'quantity')::INTEGER;
        _price := (_item->>'unit_price')::INTEGER;
        IF _qty IS NULL OR _qty <= 0 THEN
            RAISE EXCEPTION 'invalid_quantity';
        END IF;
        IF _price IS NULL OR _price < 0 THEN
            RAISE EXCEPTION 'invalid_price';
        END IF;
        _total_amount := _total_amount + (_qty * _price);
    END LOOP;

    _paid := LEAST(_paid_amount, _total_amount);

    IF _paid >= _total_amount THEN
        _inv_status := 'PAID';
    ELSIF _paid > 0 THEN
        _inv_status := 'PARTIAL';
    ELSE
        _inv_status := 'UNPAID';
    END IF;

    -- Numéro de facture séquentiel par boutique (la ligne est verrouillée par
    -- l'UPDATE : deux ventes simultanées n'obtiennent jamais le même numéro).
    UPDATE settings
    SET next_invoice_number = next_invoice_number + 1
    WHERE shop_id = _shop_id
    RETURNING next_invoice_number - 1 INTO _invoice_seq;

    IF _invoice_seq IS NOT NULL THEN
        _invoice_number := 'FAC-' || to_char(now(), 'YYYY') || '-' || lpad(_invoice_seq::text, 4, '0');
    END IF;

    INSERT INTO invoices (shop_id, client_id, invoice_number, total_amount, paid_amount, status, created_by)
    VALUES (_shop_id, _client_id, _invoice_number, _total_amount, _paid, _inv_status, auth.uid())
    RETURNING id INTO _invoice_id;

    FOR _item IN SELECT * FROM jsonb_array_elements(_items)
    LOOP
        _product_id := (_item->>'product_id')::UUID;
        _qty := (_item->>'quantity')::INTEGER;
        _price := (_item->>'unit_price')::INTEGER;

        SELECT quantity_in_stock INTO _current_stock
        FROM products
        WHERE id = _product_id AND shop_id = _shop_id AND is_active
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'product_not_found';
        END IF;
        IF _current_stock < _qty THEN
            RAISE EXCEPTION 'insufficient_stock';
        END IF;

        INSERT INTO invoice_items (shop_id, invoice_id, product_id, quantity, unit_price, total_price)
        VALUES (_shop_id, _invoice_id, _product_id, _qty, _price, _qty * _price);

        UPDATE products
        SET quantity_in_stock = quantity_in_stock - _qty
        WHERE id = _product_id AND shop_id = _shop_id;

        INSERT INTO stock_movements (shop_id, product_id, type, quantity_change, reference_id, created_by)
        VALUES (_shop_id, _product_id, 'SALE', -_qty, _invoice_id, auth.uid());
    END LOOP;

    IF _paid > 0 THEN
        INSERT INTO payments (shop_id, invoice_id, amount, recorded_by)
        VALUES (_shop_id, _invoice_id, _paid, auth.uid());
    END IF;

    RETURN _invoice_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_sale(uuid, uuid, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_sale(uuid, uuid, jsonb, integer) TO authenticated, service_role;


-- ============================================================
-- 4. Encaisser un paiement sur une facture existante
-- ============================================================
-- Il n'existait aucun moyen d'enregistrer le règlement d'une dette après la
-- vente : un impayé ne pouvait jamais être soldé, et les relances auraient
-- continué indéfiniment. Chaque paiement est journalisé dans `payments`, et
-- la facture est mise à jour dans la même transaction.
CREATE OR REPLACE FUNCTION public.record_payment(_shop_id uuid, _invoice_id uuid, _amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    _total INTEGER;
    _paid INTEGER;
    _new_paid INTEGER;
BEGIN
    IF _shop_id != get_current_shop_id() THEN
        RAISE EXCEPTION 'Unauthorized shop access';
    END IF;

    IF _amount IS NULL OR _amount <= 0 THEN
        RAISE EXCEPTION 'invalid_amount';
    END IF;

    SELECT total_amount, paid_amount INTO _total, _paid
    FROM invoices
    WHERE id = _invoice_id AND shop_id = _shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'invoice_not_found';
    END IF;
    IF _paid >= _total THEN
        RAISE EXCEPTION 'invoice_already_paid';
    END IF;
    IF _amount > _total - _paid THEN
        RAISE EXCEPTION 'payment_exceeds_balance';
    END IF;

    _new_paid := _paid + _amount;

    INSERT INTO payments (shop_id, invoice_id, amount, recorded_by)
    VALUES (_shop_id, _invoice_id, _amount, auth.uid());

    UPDATE invoices
    SET paid_amount = _new_paid,
        status = (CASE WHEN _new_paid >= _total THEN 'PAID' ELSE 'PARTIAL' END)::invoice_status
    WHERE id = _invoice_id;

    RETURN _total - _new_paid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_payment(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_payment(uuid, uuid, integer) TO authenticated, service_role;


-- ============================================================
-- 5. Création d'un employé : plus de boutique fantôme
-- ============================================================
-- Créer un employé déclenchait l'inscription d'un nouveau compte, donc la
-- création d'une boutique vide (« Ma Boutique ») que le code déplaçait
-- ensuite vers la boutique du Propriétaire en laissant la coquille vide.
-- L'application passe désormais la boutique d'accueil dans app_metadata,
-- que seule la clé serveur peut écrire (un utilisateur qui s'inscrit ne
-- peut pas s'y inviter lui-même, contrairement à user_metadata).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    new_shop_id UUID;
    user_name TEXT;
    invited_shop_id UUID;
    invited_role role_type;
BEGIN
    user_name := COALESCE(NULLIF(new.raw_user_meta_data->>'full_name', ''), new.email);

    invited_shop_id := NULLIF(new.raw_app_meta_data->>'invited_shop_id', '')::UUID;
    IF invited_shop_id IS NOT NULL THEN
        invited_role := COALESCE(NULLIF(new.raw_app_meta_data->>'invited_role', ''), 'SELLER')::role_type;
        INSERT INTO public.profiles (id, shop_id, role, full_name)
        VALUES (new.id, invited_shop_id, invited_role, user_name);
        RETURN new;
    END IF;

    new_shop_id := gen_random_uuid();

    INSERT INTO public.profiles (id, shop_id, role, full_name)
    VALUES (new.id, new_shop_id, 'MANAGER', user_name);

    INSERT INTO public.settings (
      id, shop_id,
      shop_name,
      currency_code, currency_symbol,
      theme_accent_color, theme_font
    )
    VALUES (
      gen_random_uuid(), new_shop_id,
      'Ma Boutique',
      'XAF', 'FCFA',
      '#7c3aed', 'Geist'
    );

    RETURN new;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
        RAISE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
