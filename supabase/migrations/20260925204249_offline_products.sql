-- ============================================================
-- Mode hors ligne, étape 2 : créer et modifier un article, et réceptionner
-- un bon de commande, sans internet
--
-- L'identifiant d'un article créé hors ligne vient de l'appareil ;
-- l'envoyer deux fois ne le crée qu'une fois. Une modification faite hors
-- ligne change le stock d'une différence (+3, −2) et non d'une valeur
-- fixe : les ventes faites entre-temps sur une autre caisse restent
-- comptées. Chaque changement de stock reste un mouvement enregistré
-- (AGENTS.md : une seule voie pour le stock).
-- ============================================================

-- Règles de formule : une opération faite hors ligne pendant que la
-- formule était valable reste acceptée (étape 1). Pour un article, la
-- limite d'articles de la formule s'applique toujours, même hors ligne.
CREATE OR REPLACE FUNCTION public.enforce_shop_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    _plan TEXT;
    _read_only BOOLEAN;
    _limit INTEGER;
    _offline_at TIMESTAMPTZ := nullif(current_setting('wishop.offline_at', true), '')::timestamptz;
BEGIN
    SELECT plan, read_only INTO _plan, _read_only FROM shop_plan_state(NEW.shop_id);

    IF _offline_at IS NOT NULL
       AND TG_TABLE_NAME IN ('invoices', 'invoice_items', 'payments', 'stock_movements', 'products', 'clients', 'categories',
                             'purchase_orders', 'purchase_order_items') THEN
        -- Formule expirée depuis : l'opération reste acceptée si elle a eu
        -- lieu avant la fin du délai de grâce.
        IF _read_only AND EXISTS (
            SELECT 1 FROM subscriptions s
            WHERE s.shop_id = NEW.shop_id AND s.plan <> 'STANDARD'
              AND s.paid_until IS NOT NULL AND s.paid_until + interval '3 days' > _offline_at
        ) THEN
            _read_only := FALSE;
        END IF;
        -- Le crédit et la fidélité ont été vérifiés sur l'appareil, avec la
        -- formule qu'il connaissait ; seule la limite d'articles est revue.
        IF NOT _read_only AND TG_TABLE_NAME <> 'products' THEN
            RETURN NEW;
        END IF;
    END IF;

    IF _read_only THEN
        RAISE EXCEPTION 'shop_read_only';
    END IF;

    -- Chaque table a son propre IF : une condition qui lit NEW.is_active ne
    -- doit être préparée que pour products (correctif 20260925184533).
    IF TG_TABLE_NAME = 'invoices' THEN
        IF TG_OP = 'INSERT' THEN
            IF NEW.paid_amount < NEW.total_amount AND NOT plan_allows(_plan, 'credit') THEN
                RAISE EXCEPTION 'plan_credit_locked';
            END IF;
            IF NEW.loyalty_reward_used AND NOT plan_allows(_plan, 'loyalty') THEN
                RAISE EXCEPTION 'plan_feature_locked';
            END IF;
        END IF;
    ELSIF TG_TABLE_NAME = 'purchase_orders' THEN
        IF TG_OP = 'INSERT' AND NOT plan_allows(_plan, 'purchase_orders') THEN
            RAISE EXCEPTION 'plan_feature_locked';
        END IF;
    ELSIF TG_TABLE_NAME = 'shipments' THEN
        IF TG_OP = 'INSERT' AND NOT plan_allows(_plan, 'shipments') THEN
            RAISE EXCEPTION 'plan_feature_locked';
        END IF;
    ELSIF TG_TABLE_NAME = 'online_orders' THEN
        IF TG_OP = 'INSERT' AND NOT plan_allows(_plan, 'storefront') THEN
            RAISE EXCEPTION 'plan_feature_locked';
        END IF;
    ELSIF TG_TABLE_NAME = 'reminder_logs' THEN
        IF TG_OP = 'INSERT' AND NOT plan_allows(_plan, 'reminders') THEN
            RAISE EXCEPTION 'plan_feature_locked';
        END IF;
    ELSIF TG_TABLE_NAME = 'products' THEN
        IF NEW.is_active THEN
            -- Un article déjà actif qu'on modifie ne compte pas une deuxième fois.
            IF TG_OP = 'UPDATE' THEN
                IF OLD.is_active THEN
                    RETURN NEW;
                END IF;
            END IF;
            _limit := plan_item_limit(_plan);
            IF _limit IS NOT NULL
               AND (SELECT count(*) FROM products WHERE shop_id = NEW.shop_id AND is_active) >= _limit THEN
                RAISE EXCEPTION 'plan_limit_items';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;


-- Catégorie par son nom (trouvée sans tenir compte des majuscules, créée
-- à la première utilisation) et fournisseur de la boutique seulement :
-- mêmes règles que le formulaire en ligne (features/stock/actions.ts).
CREATE OR REPLACE FUNCTION public.shop_category_id(_shop_id uuid, _name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    _clean TEXT := nullif(btrim(COALESCE(_name, '')), '');
    _id UUID;
BEGIN
    IF _clean IS NULL THEN
        RETURN NULL;
    END IF;
    SELECT id INTO _id FROM categories WHERE shop_id = _shop_id AND name ILIKE _clean LIMIT 1;
    IF _id IS NULL THEN
        INSERT INTO categories (shop_id, name) VALUES (_shop_id, _clean) RETURNING id INTO _id;
    END IF;
    RETURN _id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.shop_category_id(uuid, text) FROM PUBLIC, anon, authenticated;


-- ------------------------------------------------------------
-- record_product : article créé en ligne ou hors ligne
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_product(
    _product_id uuid,
    _name text,
    _category text DEFAULT NULL,
    _brand text DEFAULT NULL,
    _product_type text DEFAULT NULL,
    _supplier_id uuid DEFAULT NULL,
    _origin_country text DEFAULT NULL,
    _purchase_price integer DEFAULT 0,
    _selling_price integer DEFAULT 0,
    _description text DEFAULT NULL,
    _is_published_online boolean DEFAULT FALSE,
    _opening_stock integer DEFAULT 0,
    _created_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    _shop UUID := get_current_shop_id();
    _existing_shop UUID;
    _time TIMESTAMPTZ := COALESCE(offline_time(_created_at), now());
    _opening INTEGER := GREATEST(0, COALESCE(_opening_stock, 0));
BEGIN
    IF _shop IS NULL THEN
        RAISE EXCEPTION 'shop_not_found';
    END IF;
    IF _product_id IS NULL OR nullif(btrim(COALESCE(_name, '')), '') IS NULL THEN
        RAISE EXCEPTION 'required_fields_missing';
    END IF;

    -- Déjà reçu (renvoi après une coupure).
    SELECT shop_id INTO _existing_shop FROM products WHERE id = _product_id;
    IF FOUND THEN
        IF _existing_shop <> _shop THEN
            RAISE EXCEPTION 'Unauthorized shop access';
        END IF;
        RETURN _product_id;
    END IF;

    IF _created_at IS NOT NULL THEN
        PERFORM set_config('wishop.offline_at', _time::text, true);
    END IF;

    INSERT INTO products (id, shop_id, name, category_id, brand, product_type, supplier_id, origin_country,
                          purchase_price, selling_price, quantity_in_stock, description, is_published_online, created_at)
    VALUES (
        _product_id, _shop, btrim(_name), shop_category_id(_shop, _category),
        nullif(btrim(COALESCE(_brand, '')), ''), nullif(btrim(COALESCE(_product_type, '')), ''),
        (SELECT id FROM suppliers WHERE id = _supplier_id AND shop_id = _shop),
        nullif(btrim(COALESCE(_origin_country, '')), ''),
        GREATEST(0, COALESCE(_purchase_price, 0)), GREATEST(0, COALESCE(_selling_price, 0)), 0,
        nullif(btrim(COALESCE(_description, '')), ''), COALESCE(_is_published_online, FALSE), _time
    );

    -- Le stock de départ passe par un mouvement, comme toute entrée de stock.
    IF _opening > 0 THEN
        UPDATE products SET quantity_in_stock = _opening WHERE id = _product_id;
        INSERT INTO stock_movements (shop_id, product_id, type, quantity_change, created_by, created_at)
        VALUES (_shop, _product_id, 'ADJUSTMENT', _opening, auth.uid(), _time);
    END IF;

    IF _created_at IS NOT NULL THEN
        PERFORM set_config('wishop.offline_at', '', true);
    END IF;

    RETURN _product_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.record_product(uuid, text, text, text, text, uuid, text, integer, integer, text, boolean, integer, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_product(uuid, text, text, text, text, uuid, text, integer, integer, text, boolean, integer, timestamptz) TO authenticated, service_role;


-- ------------------------------------------------------------
-- update_product_offline : article modifié hors ligne
-- ------------------------------------------------------------
-- _change_id vient de l'appareil et devient l'identifiant du mouvement de
-- stock : une modification renvoyée n'est appliquée qu'une fois.
CREATE OR REPLACE FUNCTION public.update_product_offline(
    _product_id uuid,
    _change_id uuid,
    _name text,
    _category text,
    _brand text,
    _product_type text,
    _supplier_id uuid,
    _origin_country text,
    _purchase_price integer,
    _selling_price integer,
    _description text,
    _is_published_online boolean,
    _stock_delta integer,
    _changed_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    _shop UUID := get_current_shop_id();
    _time TIMESTAMPTZ := COALESCE(offline_time(_changed_at), now());
BEGIN
    IF _shop IS NULL THEN
        RAISE EXCEPTION 'shop_not_found';
    END IF;
    IF _change_id IS NULL OR nullif(btrim(COALESCE(_name, '')), '') IS NULL THEN
        RAISE EXCEPTION 'required_fields_missing';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM products WHERE id = _product_id AND shop_id = _shop) THEN
        RAISE EXCEPTION 'product_not_found';
    END IF;
    -- Déjà reçue (renvoi après une coupure).
    IF EXISTS (SELECT 1 FROM stock_movements WHERE id = _change_id) THEN
        RETURN;
    END IF;

    PERFORM set_config('wishop.offline_at', _time::text, true);

    UPDATE products
    SET name = btrim(_name),
        category_id = shop_category_id(_shop, _category),
        brand = nullif(btrim(COALESCE(_brand, '')), ''),
        product_type = nullif(btrim(COALESCE(_product_type, '')), ''),
        supplier_id = (SELECT id FROM suppliers WHERE id = _supplier_id AND shop_id = _shop),
        origin_country = nullif(btrim(COALESCE(_origin_country, '')), ''),
        purchase_price = GREATEST(0, COALESCE(_purchase_price, 0)),
        selling_price = GREATEST(0, COALESCE(_selling_price, 0)),
        description = nullif(btrim(COALESCE(_description, '')), ''),
        is_published_online = COALESCE(_is_published_online, FALSE),
        quantity_in_stock = quantity_in_stock + COALESCE(_stock_delta, 0)
    WHERE id = _product_id AND shop_id = _shop;

    -- Le mouvement de stock sert aussi de reçu : renvoyée, la différence
    -- n'est pas ajoutée deux fois. Sans différence, renvoyer les mêmes
    -- valeurs ne change rien.
    IF COALESCE(_stock_delta, 0) <> 0 THEN
        INSERT INTO stock_movements (id, shop_id, product_id, type, quantity_change, created_by, created_at)
        VALUES (_change_id, _shop, _product_id, 'ADJUSTMENT', _stock_delta, auth.uid(), _time);
    END IF;

    PERFORM set_config('wishop.offline_at', '', true);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.update_product_offline(uuid, uuid, text, text, text, text, uuid, text, integer, integer, text, boolean, integer, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_product_offline(uuid, uuid, text, text, text, text, uuid, text, integer, integer, text, boolean, integer, timestamptz) TO authenticated, service_role;


-- ------------------------------------------------------------
-- receive_purchase_order_offline : livraison pointée hors ligne
-- ------------------------------------------------------------
-- La livraison arrive pendant une coupure : les quantités pointées sur
-- l'appareil entrent dans le stock au retour de la connexion, par
-- receive_purchase_order (mêmes règles qu'en ligne), à l'heure réelle du
-- pointage. Un bon déjà réceptionné ne l'est pas une deuxième fois.
CREATE OR REPLACE FUNCTION public.receive_purchase_order_offline(
    _shop_id uuid,
    _order_id uuid,
    _received jsonb,
    _received_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    _status purchase_order_status;
    _time TIMESTAMPTZ := COALESCE(offline_time(_received_at), now());
BEGIN
    IF _shop_id != get_current_shop_id() THEN
        RAISE EXCEPTION 'Unauthorized shop access';
    END IF;
    SELECT status INTO _status FROM purchase_orders WHERE id = _order_id AND shop_id = _shop_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'purchase_order_not_found';
    END IF;
    IF _status = 'RECEIVED' THEN
        RETURN;
    END IF;

    PERFORM set_config('wishop.offline_at', _time::text, true);
    PERFORM receive_purchase_order(_shop_id, _order_id, _received);
    UPDATE purchase_orders SET received_at = _time WHERE id = _order_id;
    UPDATE stock_movements SET created_at = _time
    WHERE reference_id = _order_id AND shop_id = _shop_id AND type = 'RESTOCK' AND created_at = now();
    PERFORM set_config('wishop.offline_at', '', true);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.receive_purchase_order_offline(uuid, uuid, jsonb, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receive_purchase_order_offline(uuid, uuid, jsonb, timestamptz) TO authenticated, service_role;
