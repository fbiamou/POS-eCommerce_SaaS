-- Migration: carte de fidélité à tampons, et boutique créée avec son nom
-- et son pays dès l'inscription.
--
-- 1. Carte à tampons (choix du propriétaire, septembre 2026) : chaque vente
--    payée en entier à un client lui donne un tampon (une vente à crédit
--    compte une fois soldée). Quand la carte est pleine (10 tampons par
--    défaut, réglable), l'achat suivant a une remise (10 % par défaut,
--    réglable), appliquée par record_sale après vérification côté serveur.
--    L'achat qui utilise la récompense ne donne pas de tampon.
-- 2. L'inscription transmet le nom et le pays de la boutique : le pays
--    préremplit l'indicatif, le fuseau et la TVA, comme dans les réglages.
--    Une nouvelle boutique prend l'indigo WISHOP au lieu du violet.


-- ============================================================
-- 1. Carte de fidélité à tampons
-- ============================================================
ALTER TABLE public.settings
    ADD COLUMN loyalty_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN loyalty_stamps_required INTEGER NOT NULL DEFAULT 10
        CHECK (loyalty_stamps_required BETWEEN 2 AND 50),
    ADD COLUMN loyalty_reward_percent INTEGER NOT NULL DEFAULT 10
        CHECK (loyalty_reward_percent BETWEEN 1 AND 100);

GRANT SELECT (loyalty_enabled, loyalty_stamps_required, loyalty_reward_percent) ON public.settings TO authenticated;

-- La remise est enregistrée à part : les lignes gardent leur prix, et
-- total_amount = somme des lignes - discount_amount.
ALTER TABLE public.invoices
    ADD COLUMN discount_amount INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    ADD COLUMN loyalty_reward_used BOOLEAN NOT NULL DEFAULT FALSE;

-- Une récompense est disponible quand le client a rempli plus de cartes
-- qu'il n'a utilisé de récompenses. Même calcul que loyaltyCard()
-- (src/features/clients/loyalty.ts), testé.
CREATE OR REPLACE FUNCTION public.loyalty_reward_available(_shop_id UUID, _client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
    SELECT COALESCE((
        SELECT s.loyalty_enabled
           AND (
               SELECT count(*) FROM invoices i
               WHERE i.shop_id = _shop_id AND i.client_id = _client_id
                 AND i.status = 'PAID' AND NOT i.loyalty_reward_used
           ) / s.loyalty_stamps_required
           > (
               SELECT count(*) FROM invoices i
               WHERE i.shop_id = _shop_id AND i.client_id = _client_id AND i.loyalty_reward_used
           )
        FROM settings s WHERE s.shop_id = _shop_id
    ), FALSE);
$$;

-- Seule record_sale s'en sert : aucun compte ne l'appelle directement.
REVOKE EXECUTE ON FUNCTION public.loyalty_reward_available(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- record_sale gagne un paramètre facultatif. L'ancienne signature est
-- remplacée (et non doublée) : confirm_online_order l'appelle avec quatre
-- arguments, qui prennent la valeur par défaut du cinquième.
DROP FUNCTION public.record_sale(uuid, uuid, jsonb, integer);

CREATE FUNCTION public.record_sale(
    _shop_id uuid,
    _client_id uuid,
    _items jsonb,
    _paid_amount integer,
    _use_loyalty_reward boolean DEFAULT FALSE
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    _invoice_id UUID;
    _invoice_number TEXT;
    _invoice_seq INTEGER;
    _subtotal INTEGER := 0;
    _discount INTEGER := 0;
    _reward_percent INTEGER;
    _total_amount INTEGER;
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
        _subtotal := _subtotal + (_qty * _price);
    END LOOP;

    -- Récompense de fidélité : vérifiée ici, jamais crue sur parole.
    IF COALESCE(_use_loyalty_reward, FALSE) THEN
        IF _client_id IS NULL OR NOT loyalty_reward_available(_shop_id, _client_id) THEN
            RAISE EXCEPTION 'loyalty_reward_unavailable';
        END IF;
        SELECT loyalty_reward_percent INTO _reward_percent FROM settings WHERE shop_id = _shop_id;
        _discount := round(_subtotal * _reward_percent / 100.0)::INTEGER;
    END IF;

    _total_amount := _subtotal - _discount;
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

    INSERT INTO invoices (shop_id, client_id, invoice_number, total_amount, paid_amount, status, created_by,
                          discount_amount, loyalty_reward_used)
    VALUES (_shop_id, _client_id, _invoice_number, _total_amount, _paid, _inv_status, auth.uid(),
            _discount, COALESCE(_use_loyalty_reward, FALSE))
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
$function$;

REVOKE EXECUTE ON FUNCTION public.record_sale(uuid, uuid, jsonb, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_sale(uuid, uuid, jsonb, integer, boolean) TO authenticated, service_role;


-- ============================================================
-- 2. Nom et pays de la boutique dès l'inscription
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    new_shop_id UUID;
    user_name TEXT;
    invited_shop_id UUID;
    invited_role role_type;
    _shop_name TEXT;
    _country TEXT;
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
    _shop_name := COALESCE(NULLIF(btrim(new.raw_user_meta_data->>'shop_name'), ''), 'Ma Boutique');
    _country := NULLIF(new.raw_user_meta_data->>'country_code', '');
    -- Pays de la zone CEMAC seulement (src/lib/countries.ts) ; sinon aucun.
    IF _country NOT IN ('GQ', 'CM', 'GA', 'CG', 'TD', 'CF') THEN
        _country := NULL;
    END IF;

    INSERT INTO public.profiles (id, shop_id, role, full_name)
    VALUES (new.id, new_shop_id, 'MANAGER', user_name);

    INSERT INTO public.settings (
      id, shop_id,
      shop_name, country_code,
      currency_code, currency_symbol,
      default_phone_country_code, timezone, vat_rate_bps,
      theme_accent_color, theme_font
    )
    VALUES (
      gen_random_uuid(), new_shop_id,
      _shop_name, _country,
      'XAF', 'FCFA',
      CASE _country WHEN 'GQ' THEN '+240' WHEN 'GA' THEN '+241' WHEN 'CG' THEN '+242'
                    WHEN 'TD' THEN '+235' WHEN 'CF' THEN '+236' ELSE '+237' END,
      CASE _country WHEN 'GQ' THEN 'Africa/Malabo' WHEN 'GA' THEN 'Africa/Libreville' WHEN 'CG' THEN 'Africa/Brazzaville'
                    WHEN 'TD' THEN 'Africa/Ndjamena' WHEN 'CF' THEN 'Africa/Bangui' ELSE 'Africa/Douala' END,
      CASE _country WHEN 'GQ' THEN 1500 WHEN 'GA' THEN 1800 WHEN 'CG' THEN 1890
                    WHEN 'TD' THEN 1800 WHEN 'CF' THEN 1900 ELSE 1925 END,
      '#2B44A0', 'Geist'
    );

    RETURN new;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
        RAISE;
END;
$function$;
