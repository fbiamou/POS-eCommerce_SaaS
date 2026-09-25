-- ============================================================
-- Les formules appliquées (décisions du 25/09/2026)
-- ============================================================
-- Grille publique : Standard (1 compte, 100 articles, caisse au comptant) ;
-- Essentiel (+ crédit, factures PDF, relances manuelles ; 2 comptes, 500
-- articles) ; Pro (+ vitrine, commandes en ligne, bons de commande, fidélité,
-- accès page par page, relances automatiques ; 5 comptes, 2 000 articles) ;
-- Pro Plus (+ arrivages par lien, vitrine sans mention WISHOP ; illimité).
--
-- Échéance non payée : 3 jours de grâce, puis LECTURE SEULE (conditions
-- d'utilisation, art. 8) — tout reste visible et exportable, plus aucune
-- écriture — jusqu'au paiement ou au retour volontaire au Standard.
--
-- Même règle côté application : src/features/billing/plans.ts.

-- 1. État de la formule d'une boutique -----------------------------------------
CREATE OR REPLACE FUNCTION public.shop_plan_state(_shop_id UUID)
RETURNS TABLE (plan TEXT, read_only BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
    SELECT COALESCE(s.plan, 'STANDARD'),
           COALESCE(s.plan <> 'STANDARD' AND (s.paid_until IS NULL OR s.paid_until + interval '3 days' <= now()), FALSE)
    FROM (SELECT 1) AS one
    LEFT JOIN subscriptions s ON s.shop_id = _shop_id;
$$;

CREATE OR REPLACE FUNCTION public.plan_rank(_plan TEXT)
RETURNS INTEGER
LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$
    SELECT CASE _plan WHEN 'ESSENTIEL' THEN 1 WHEN 'PRO' THEN 2 WHEN 'PRO_PLUS' THEN 3 ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION public.plan_allows(_plan TEXT, _feature TEXT)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$
    SELECT plan_rank(_plan) >= CASE _feature
        WHEN 'credit' THEN 1
        WHEN 'invoice_pdf' THEN 1
        WHEN 'reminders' THEN 1
        WHEN 'storefront' THEN 2
        WHEN 'purchase_orders' THEN 2
        WHEN 'loyalty' THEN 2
        WHEN 'page_access' THEN 2
        WHEN 'auto_reminders' THEN 2
        WHEN 'shipments' THEN 3
        WHEN 'no_branding' THEN 3
        ELSE 99
    END;
$$;

-- NULL : illimité.
CREATE OR REPLACE FUNCTION public.plan_item_limit(_plan TEXT)
RETURNS INTEGER
LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$
    SELECT CASE _plan WHEN 'ESSENTIEL' THEN 500 WHEN 'PRO' THEN 2000 WHEN 'PRO_PLUS' THEN NULL ELSE 100 END;
$$;

CREATE OR REPLACE FUNCTION public.plan_account_limit(_plan TEXT)
RETURNS INTEGER
LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$
    SELECT CASE _plan WHEN 'ESSENTIEL' THEN 2 WHEN 'PRO' THEN 5 WHEN 'PRO_PLUS' THEN NULL ELSE 1 END;
$$;

-- 2. Garde-fou sur toutes les écritures commerciales --------------------------
-- Déclencheur commun : lecture seule, fonctions de la formule, plafond
-- d'articles. Il s'applique aussi aux fonctions RPC (qui écrivent dans ces
-- tables), donc à toutes les portes d'entrée.
CREATE OR REPLACE FUNCTION public.enforce_shop_plan()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    _plan TEXT;
    _read_only BOOLEAN;
    _limit INTEGER;
BEGIN
    SELECT plan, read_only INTO _plan, _read_only FROM shop_plan_state(NEW.shop_id);

    IF _read_only THEN
        RAISE EXCEPTION 'shop_read_only';
    END IF;

    IF TG_TABLE_NAME = 'invoices' AND TG_OP = 'INSERT' THEN
        IF NEW.paid_amount < NEW.total_amount AND NOT plan_allows(_plan, 'credit') THEN
            RAISE EXCEPTION 'plan_credit_locked';
        END IF;
        IF NEW.loyalty_reward_used AND NOT plan_allows(_plan, 'loyalty') THEN
            RAISE EXCEPTION 'plan_feature_locked';
        END IF;
    ELSIF TG_TABLE_NAME = 'purchase_orders' AND TG_OP = 'INSERT' AND NOT plan_allows(_plan, 'purchase_orders') THEN
        RAISE EXCEPTION 'plan_feature_locked';
    ELSIF TG_TABLE_NAME = 'shipments' AND TG_OP = 'INSERT' AND NOT plan_allows(_plan, 'shipments') THEN
        RAISE EXCEPTION 'plan_feature_locked';
    ELSIF TG_TABLE_NAME = 'online_orders' AND TG_OP = 'INSERT' AND NOT plan_allows(_plan, 'storefront') THEN
        RAISE EXCEPTION 'plan_feature_locked';
    ELSIF TG_TABLE_NAME = 'reminder_logs' AND TG_OP = 'INSERT' AND NOT plan_allows(_plan, 'reminders') THEN
        RAISE EXCEPTION 'plan_feature_locked';
    ELSIF TG_TABLE_NAME = 'products' AND NEW.is_active THEN
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

    RETURN NEW;
END;
$$;

DO $$
DECLARE
    _table TEXT;
BEGIN
    FOREACH _table IN ARRAY ARRAY[
        'products', 'categories', 'clients', 'suppliers', 'invoices', 'invoice_items', 'payments',
        'stock_movements', 'purchase_orders', 'purchase_order_items', 'shipments', 'shipment_items',
        'online_orders', 'online_order_items', 'reminder_logs'
    ] LOOP
        EXECUTE format(
            'CREATE TRIGGER enforce_shop_plan BEFORE INSERT OR UPDATE ON public.%I '
            'FOR EACH ROW EXECUTE FUNCTION public.enforce_shop_plan()',
            _table
        );
    END LOOP;
END;
$$;

-- 3. Comptes en trop : mis en pause automatiquement ----------------------------
-- La Propriétaire (le premier profil MANAGER créé) n'est jamais en pause. Les
-- autres comptes actifs, du plus ancien au plus récent, gardent l'accès dans
-- la limite de la formule ; les suivants sont en pause, et retrouvent l'accès
-- d'eux-mêmes dès que la formule le permet. Lu par le proxy à chaque page.
CREATE OR REPLACE FUNCTION public.current_member_paused()
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    _shop UUID;
    _owner UUID;
    _limit INTEGER;
    _rank BIGINT;
BEGIN
    SELECT shop_id INTO _shop FROM profiles WHERE id = auth.uid() AND is_active;
    IF _shop IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT id INTO _owner FROM profiles
    WHERE shop_id = _shop AND role = 'MANAGER'
    ORDER BY created_at, id
    LIMIT 1;
    IF _owner = auth.uid() THEN
        RETURN FALSE;
    END IF;

    SELECT plan_account_limit(plan) INTO _limit FROM shop_plan_state(_shop);
    IF _limit IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT ranked.rank INTO _rank FROM (
        SELECT id, row_number() OVER (ORDER BY created_at, id) AS rank
        FROM profiles
        WHERE shop_id = _shop AND is_active AND id IS DISTINCT FROM _owner
    ) AS ranked
    WHERE ranked.id = auth.uid();

    RETURN COALESCE(_rank > _limit - 1, FALSE);
END;
$$;

-- 4. Retour volontaire au Standard (Propriétaire, formule échue) --------------
CREATE OR REPLACE FUNCTION public.choose_standard_plan()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    _shop UUID := get_current_shop_id();
BEGIN
    IF NOT is_shop_manager() THEN
        RAISE EXCEPTION 'access_denied';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM subscriptions
        WHERE shop_id = _shop AND plan <> 'STANDARD' AND paid_until IS NOT NULL AND paid_until <= now()
    ) THEN
        RAISE EXCEPTION 'invalid_status_change';
    END IF;

    UPDATE subscriptions SET plan = 'STANDARD', paid_until = NULL, updated_at = now()
    WHERE shop_id = _shop;
    INSERT INTO subscription_events (shop_id, kind, plan, note, created_by)
    VALUES (_shop, 'STANDARD', 'STANDARD', 'Choisi par la Propriétaire', auth.uid());
END;
$$;

-- 5. Vitrine : réservée à Pro et Pro Plus, fermée en lecture seule ------------
-- Le profil public dit aussi si la mention « Propulsé par WISHOP » s'affiche
-- (retirée en Pro Plus) : le type de retour change, d'où DROP puis CREATE.
DROP FUNCTION IF EXISTS public.get_public_shop_profile(TEXT);
CREATE FUNCTION public.get_public_shop_profile(_shop_slug TEXT)
RETURNS TABLE (
    shop_id UUID,
    shop_name TEXT,
    shop_logo_url TEXT,
    shop_address TEXT,
    shop_phone TEXT,
    currency_symbol TEXT,
    theme_accent_color TEXT,
    theme_font TEXT,
    default_phone_country_code TEXT,
    show_wishop_badge BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
    SELECT s.shop_id, s.shop_name, s.shop_logo_url, s.shop_address, s.shop_phone,
           s.currency_symbol, s.theme_accent_color, s.theme_font, s.default_phone_country_code,
           NOT plan_allows(st.plan, 'no_branding')
    FROM settings s
    CROSS JOIN LATERAL shop_plan_state(s.shop_id) st
    WHERE s.shop_slug = _shop_slug
      AND plan_allows(st.plan, 'storefront')
      AND NOT st.read_only
      AND NOT EXISTS (
          SELECT 1 FROM subscriptions sub
          WHERE sub.shop_id = s.shop_id AND sub.suspended_at IS NOT NULL
      );
$$;

CREATE OR REPLACE FUNCTION public.get_public_shop_catalog(_shop_slug TEXT)
RETURNS TABLE (
    product_id UUID,
    name TEXT,
    description TEXT,
    image_url TEXT,
    category_name TEXT,
    selling_price INTEGER,
    in_stock BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
    SELECT p.id, p.name, p.description, p.image_url, c.name, p.selling_price,
           (p.quantity_in_stock > 0)
    FROM products p
    JOIN settings s ON s.shop_id = p.shop_id
    CROSS JOIN LATERAL shop_plan_state(s.shop_id) st
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE s.shop_slug = _shop_slug
      AND p.is_published_online = TRUE
      AND p.is_active = TRUE
      AND plan_allows(st.plan, 'storefront')
      AND NOT st.read_only
      AND NOT EXISTS (
          SELECT 1 FROM subscriptions sub
          WHERE sub.shop_id = s.shop_id AND sub.suspended_at IS NOT NULL
      )
    ORDER BY p.name ASC;
$$;

-- 6. Droits -------------------------------------------------------------------------
-- shop_plan_state ne sert qu'aux fonctions ci-dessus (SECURITY DEFINER) : un
-- compte connecté lit sa propre formule dans subscriptions, pas celle des autres.
REVOKE EXECUTE ON FUNCTION public.shop_plan_state(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_shop_plan() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_member_paused() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.choose_standard_plan() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_plan_state(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.current_member_paused() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.choose_standard_plan() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_shop_profile(TEXT) TO anon, authenticated, service_role;
