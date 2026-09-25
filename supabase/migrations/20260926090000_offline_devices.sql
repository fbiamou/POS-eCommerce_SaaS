-- ============================================================
-- Mode hors ligne, étape 1
--
-- 1. Chaque téléphone (ou navigateur) qui encaisse devient une caisse
--    numérotée (1, 2, 3...) et tient sa propre série de numéros de
--    facture : FAC-2026-1-0042. Le numéro est donné sur le téléphone, avec
--    ou sans internet, et ne change jamais (décision du 25/09/2026, comme
--    Loyverse et Shopify POS).
-- 2. Une vente ou un paiement fait hors ligne arrive plus tard, au retour
--    de la connexion. Son identifiant est créé sur le téléphone : l'envoyer
--    deux fois ne l'enregistre qu'une fois.
-- 3. Une vente faite hors ligne est toujours gardée : si deux téléphones
--    ont vendu le dernier article, le stock passe sous zéro et l'article
--    apparaît « à vérifier » (décision du 25/09/2026).
-- ============================================================

CREATE TABLE public.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL,
    number INTEGER NOT NULL CHECK (number > 0),
    label TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (shop_id, number)
);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
-- Lecture seulement : une caisse se crée par register_device.
CREATE POLICY "Devices readable by shop" ON public.devices
    FOR SELECT USING (shop_id = get_current_shop_id());

ALTER TABLE public.invoices
    ADD COLUMN device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
    ADD COLUMN device_seq INTEGER CHECK (device_seq > 0),
    ADD COLUMN recorded_offline BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX invoices_device_seq_key ON public.invoices (device_id, device_seq) WHERE device_id IS NOT NULL;

ALTER TABLE public.payments
    ADD COLUMN recorded_offline BOOLEAN NOT NULL DEFAULT FALSE;

-- Une boutique supprimée par la console emporte ses caisses.
CREATE OR REPLACE FUNCTION public.delete_shop_devices_on_shop_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
    DELETE FROM devices WHERE shop_id = OLD.shop_id;
    RETURN OLD;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.delete_shop_devices_on_shop_delete() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER delete_shop_devices
    AFTER DELETE ON public.settings
    FOR EACH ROW EXECUTE FUNCTION public.delete_shop_devices_on_shop_delete();


-- ------------------------------------------------------------
-- Enregistrer une caisse, ou retrouver celle du téléphone
-- ------------------------------------------------------------
-- Le téléphone garde l'identifiant de sa caisse. À chaque connexion il le
-- renvoie : la fonction répond avec son numéro et le dernier numéro de
-- facture enregistré, pour que la série reprenne au bon endroit. Un
-- identifiant inconnu (téléphone effacé, autre boutique) donne une
-- nouvelle caisse, donc une nouvelle série : jamais deux fois le même numéro.
CREATE OR REPLACE FUNCTION public.register_device(_device_id UUID DEFAULT NULL, _label TEXT DEFAULT NULL)
RETURNS TABLE(device_id UUID, device_number INTEGER, last_seq INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    _shop UUID := get_current_shop_id();
    _id UUID;
    _number INTEGER;
BEGIN
    IF _shop IS NULL THEN
        RAISE EXCEPTION 'shop_not_found';
    END IF;

    IF _device_id IS NOT NULL THEN
        UPDATE devices d SET last_seen_at = now()
        WHERE d.id = _device_id AND d.shop_id = _shop
        RETURNING d.id, d.number INTO _id, _number;
    END IF;

    IF _id IS NULL THEN
        -- Deux téléphones qui s'enregistrent en même temps n'obtiennent
        -- jamais le même numéro : la ligne de la boutique est verrouillée.
        PERFORM 1 FROM settings WHERE shop_id = _shop FOR UPDATE;
        SELECT COALESCE(max(d.number), 0) + 1 INTO _number FROM devices d WHERE d.shop_id = _shop;
        INSERT INTO devices (shop_id, number, label, created_by)
        VALUES (_shop, _number, nullif(left(btrim(COALESCE(_label, '')), 80), ''), auth.uid())
        RETURNING id INTO _id;
    END IF;

    RETURN QUERY
    SELECT _id, _number, COALESCE((SELECT max(i.device_seq) FROM invoices i WHERE i.device_id = _id), 0);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.register_device(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_device(UUID, TEXT) TO authenticated, service_role;


-- ------------------------------------------------------------
-- Heure d'une opération faite hors ligne
-- ------------------------------------------------------------
-- L'heure vient du téléphone : elle est ramenée entre « il y a 30 jours »
-- et « maintenant », pour qu'une horloge fausse ne place pas une vente
-- dans le futur ou des années en arrière.
CREATE OR REPLACE FUNCTION public.offline_time(_at TIMESTAMPTZ)
RETURNS TIMESTAMPTZ
LANGUAGE sql STABLE SET search_path TO 'public'
AS $$
    SELECT CASE WHEN _at IS NULL THEN NULL
                ELSE LEAST(now(), GREATEST(_at, now() - interval '30 days')) END;
$$;


-- ------------------------------------------------------------
-- Règles de formule pour une opération faite hors ligne
-- ------------------------------------------------------------
-- Une vente faite hors ligne pendant que la formule était valable reste
-- acceptée, même si la formule a expiré avant le retour de la connexion :
-- la vente a eu lieu. Le téléphone a déjà appliqué les règles de la
-- formule qu'il connaissait (crédit, fidélité). record_sale et
-- record_payment signalent l'heure de l'opération hors ligne dans
-- wishop.offline_at, le temps de leurs écritures.
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

    IF _offline_at IS NOT NULL AND TG_TABLE_NAME IN ('invoices', 'invoice_items', 'payments', 'stock_movements', 'products', 'clients') THEN
        IF NOT _read_only THEN
            RETURN NEW;
        END IF;
        -- Formule expirée depuis : la vente reste acceptée si elle a eu
        -- lieu avant la fin du délai de grâce.
        IF EXISTS (
            SELECT 1 FROM subscriptions s
            WHERE s.shop_id = NEW.shop_id AND s.plan <> 'STANDARD'
              AND s.paid_until IS NOT NULL AND s.paid_until + interval '3 days' > _offline_at
        ) THEN
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


-- ------------------------------------------------------------
-- record_sale : caisse, numéro par téléphone, vente hors ligne
-- ------------------------------------------------------------
-- Nouveaux paramètres, tous facultatifs (confirm_online_order continue
-- d'appeler la fonction avec quatre arguments) :
--   _invoice_id  identifiant créé sur le téléphone ; une vente déjà reçue
--                n'est pas enregistrée une deuxième fois ;
--   _device_id, _device_seq  la caisse et son numéro dans la série ;
--   _sold_at     heure de la vente, donnée seulement pour une vente faite
--                hors ligne.
-- Sans caisse (commande de la vitrine confirmée), le numéro reste celui de
-- la boutique : FAC-2026-0042.
DROP FUNCTION public.record_sale(uuid, uuid, jsonb, integer, boolean);

CREATE FUNCTION public.record_sale(
    _shop_id uuid,
    _client_id uuid,
    _items jsonb,
    _paid_amount integer,
    _use_loyalty_reward boolean DEFAULT FALSE,
    _invoice_id uuid DEFAULT NULL,
    _device_id uuid DEFAULT NULL,
    _device_seq integer DEFAULT NULL,
    _sold_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    _new_id UUID;
    _existing_shop UUID;
    _invoice_number TEXT;
    _invoice_seq INTEGER;
    _device_number INTEGER;
    _offline BOOLEAN := _sold_at IS NOT NULL;
    _sale_time TIMESTAMPTZ := COALESCE(offline_time(_sold_at), now());
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

    -- Déjà reçue (renvoi après une coupure) : on rend la même facture.
    IF _invoice_id IS NOT NULL THEN
        SELECT shop_id INTO _existing_shop FROM invoices WHERE id = _invoice_id;
        IF FOUND THEN
            IF _existing_shop <> _shop_id THEN
                RAISE EXCEPTION 'Unauthorized shop access';
            END IF;
            RETURN _invoice_id;
        END IF;
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

    IF _device_id IS NOT NULL THEN
        SELECT number INTO _device_number FROM devices WHERE id = _device_id AND shop_id = _shop_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'device_not_found';
        END IF;
        IF _device_seq IS NULL OR _device_seq <= 0 THEN
            RAISE EXCEPTION 'device_sequence_missing';
        END IF;
        IF EXISTS (SELECT 1 FROM invoices WHERE device_id = _device_id AND device_seq = _device_seq) THEN
            RAISE EXCEPTION 'device_sequence_conflict';
        END IF;
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

    IF _device_id IS NOT NULL THEN
        _invoice_number := 'FAC-' || to_char(_sale_time, 'YYYY') || '-' || _device_number || '-' || lpad(_device_seq::text, 4, '0');
    ELSE
        -- Numéro séquentiel de la boutique (la ligne est verrouillée par
        -- l'UPDATE : deux ventes simultanées n'obtiennent jamais le même).
        UPDATE settings
        SET next_invoice_number = next_invoice_number + 1
        WHERE shop_id = _shop_id
        RETURNING next_invoice_number - 1 INTO _invoice_seq;

        IF _invoice_seq IS NOT NULL THEN
            _invoice_number := 'FAC-' || to_char(_sale_time, 'YYYY') || '-' || lpad(_invoice_seq::text, 4, '0');
        END IF;
    END IF;

    IF _offline THEN
        PERFORM set_config('wishop.offline_at', _sale_time::text, true);
    END IF;

    INSERT INTO invoices (id, shop_id, client_id, invoice_number, total_amount, paid_amount, status, created_by,
                          discount_amount, loyalty_reward_used, device_id, device_seq, recorded_offline, created_at)
    VALUES (COALESCE(_invoice_id, gen_random_uuid()), _shop_id, _client_id, _invoice_number, _total_amount, _paid,
            _inv_status, auth.uid(), _discount, COALESCE(_use_loyalty_reward, FALSE), _device_id, _device_seq,
            _offline, _sale_time)
    RETURNING id INTO _new_id;

    FOR _item IN SELECT * FROM jsonb_array_elements(_items)
    LOOP
        _product_id := (_item->>'product_id')::UUID;
        _qty := (_item->>'quantity')::INTEGER;
        _price := (_item->>'unit_price')::INTEGER;

        -- Hors ligne, l'article a pu être retiré entre-temps sur un autre
        -- téléphone : la vente a eu lieu, elle est gardée.
        SELECT quantity_in_stock INTO _current_stock
        FROM products
        WHERE id = _product_id AND shop_id = _shop_id AND (is_active OR _offline)
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'product_not_found';
        END IF;
        -- En ligne, on ne vend pas plus que le stock. Hors ligne, la vente
        -- est gardée et le stock peut passer sous zéro (« à vérifier »).
        IF _current_stock < _qty AND NOT _offline THEN
            RAISE EXCEPTION 'insufficient_stock';
        END IF;

        INSERT INTO invoice_items (shop_id, invoice_id, product_id, quantity, unit_price, total_price, created_at)
        VALUES (_shop_id, _new_id, _product_id, _qty, _price, _qty * _price, _sale_time);

        UPDATE products
        SET quantity_in_stock = quantity_in_stock - _qty
        WHERE id = _product_id AND shop_id = _shop_id;

        INSERT INTO stock_movements (shop_id, product_id, type, quantity_change, reference_id, created_by, created_at)
        VALUES (_shop_id, _product_id, 'SALE', -_qty, _new_id, auth.uid(), _sale_time);
    END LOOP;

    IF _paid > 0 THEN
        INSERT INTO payments (shop_id, invoice_id, amount, recorded_by, payment_date, recorded_offline)
        VALUES (_shop_id, _new_id, _paid, auth.uid(), _sale_time, _offline);
    END IF;

    IF _offline THEN
        PERFORM set_config('wishop.offline_at', '', true);
    END IF;

    RETURN _new_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.record_sale(uuid, uuid, jsonb, integer, boolean, uuid, uuid, integer, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_sale(uuid, uuid, jsonb, integer, boolean, uuid, uuid, integer, timestamptz) TO authenticated, service_role;


-- ------------------------------------------------------------
-- record_payment : paiement d'une dette, en ligne ou hors ligne
-- ------------------------------------------------------------
--   _payment_id  identifiant créé sur le téléphone ; un paiement déjà reçu
--                n'est pas enregistré une deuxième fois ;
--   _paid_at     heure du paiement, donnée seulement hors ligne.
-- Un paiement plus grand que ce qui reste dû est refusé, même hors ligne :
-- le téléphone le garde « à vérifier » pour que la propriétaire décide
-- (ce peut être le même paiement saisi sur deux téléphones).
DROP FUNCTION public.record_payment(uuid, uuid, integer);

CREATE FUNCTION public.record_payment(
    _shop_id uuid,
    _invoice_id uuid,
    _amount integer,
    _payment_id uuid DEFAULT NULL,
    _paid_at timestamptz DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    _total INTEGER;
    _paid INTEGER;
    _new_paid INTEGER;
    _existing_shop UUID;
    _offline BOOLEAN := _paid_at IS NOT NULL;
    _pay_time TIMESTAMPTZ := COALESCE(offline_time(_paid_at), now());
BEGIN
    IF _shop_id != get_current_shop_id() THEN
        RAISE EXCEPTION 'Unauthorized shop access';
    END IF;

    IF _payment_id IS NOT NULL THEN
        SELECT shop_id INTO _existing_shop FROM payments WHERE id = _payment_id;
        IF FOUND THEN
            IF _existing_shop <> _shop_id THEN
                RAISE EXCEPTION 'Unauthorized shop access';
            END IF;
            SELECT total_amount - paid_amount INTO _total FROM invoices WHERE id = _invoice_id AND shop_id = _shop_id;
            RETURN COALESCE(_total, 0);
        END IF;
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

    IF _offline THEN
        PERFORM set_config('wishop.offline_at', _pay_time::text, true);
    END IF;

    INSERT INTO payments (id, shop_id, invoice_id, amount, recorded_by, payment_date, recorded_offline)
    VALUES (COALESCE(_payment_id, gen_random_uuid()), _shop_id, _invoice_id, _amount, auth.uid(), _pay_time, _offline);

    UPDATE invoices
    SET paid_amount = _new_paid,
        status = (CASE WHEN _new_paid >= _total THEN 'PAID' ELSE 'PARTIAL' END)::invoice_status
    WHERE id = _invoice_id;

    IF _offline THEN
        PERFORM set_config('wishop.offline_at', '', true);
    END IF;

    RETURN _total - _new_paid;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.record_payment(uuid, uuid, integer, uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_payment(uuid, uuid, integer, uuid, timestamptz) TO authenticated, service_role;


-- ------------------------------------------------------------
-- record_client : cliente créée à la caisse, en ligne ou hors ligne
-- ------------------------------------------------------------
-- L'identifiant vient du téléphone, pour qu'une vente hors ligne puisse
-- déjà la nommer ; la renvoyer ne crée pas de doublon. _created_at n'est
-- donné que hors ligne.
CREATE OR REPLACE FUNCTION public.record_client(
    _client_id uuid,
    _name text,
    _phone text DEFAULT NULL,
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
BEGIN
    IF _shop IS NULL THEN
        RAISE EXCEPTION 'shop_not_found';
    END IF;
    IF _client_id IS NULL OR nullif(btrim(COALESCE(_name, '')), '') IS NULL THEN
        RAISE EXCEPTION 'required_fields_missing';
    END IF;

    SELECT shop_id INTO _existing_shop FROM clients WHERE id = _client_id;
    IF FOUND THEN
        IF _existing_shop <> _shop THEN
            RAISE EXCEPTION 'Unauthorized shop access';
        END IF;
        RETURN _client_id;
    END IF;

    IF _created_at IS NOT NULL THEN
        PERFORM set_config('wishop.offline_at', _time::text, true);
    END IF;

    INSERT INTO clients (id, shop_id, name, phone, created_at)
    VALUES (_client_id, _shop, btrim(_name), nullif(btrim(COALESCE(_phone, '')), ''), _time);

    IF _created_at IS NOT NULL THEN
        PERFORM set_config('wishop.offline_at', '', true);
    END IF;

    RETURN _client_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.record_client(uuid, text, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_client(uuid, text, text, timestamptz) TO authenticated, service_role;
