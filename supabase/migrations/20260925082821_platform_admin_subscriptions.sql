-- ============================================================
-- Formules, abonnements et administration de la plateforme WISHOP
-- ============================================================
-- Décisions du 25/09/2026 :
-- - une console réservée aux administrateurs de la plateforme (le fondateur),
--   distincte des rôles d'une boutique (Propriétaire, Caissier) ;
-- - chaque boutique démarre en Standard (gratuit) ; les mois payants sont
--   offerts ou encaissés à la main (Muni Dinero, virement, espèces) en
--   attendant un agrégateur de paiement ;
-- - chaque mois offert, chaque paiement, chaque suspension est historisé.
--
-- Le premier administrateur est ajouté à la main (INSERT dans
-- platform_admins), pas dans cette migration : aucune adresse e-mail ni
-- identifiant dans le dépôt.

-- 1. Administrateurs de la plateforme -----------------------------------
CREATE TABLE public.platform_admins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_admins FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
    SELECT EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid());
$$;

-- 2. Formule de chaque boutique -------------------------------------------
-- Une boutique sans ligne ici est en Standard. paid_until : fin de la
-- période payée ou offerte (NULL en Standard). Passé cette date, la boutique
-- repasse en Standard (règle appliquée par l'application).
CREATE TABLE public.subscriptions (
    shop_id UUID PRIMARY KEY,
    plan TEXT NOT NULL DEFAULT 'STANDARD' CHECK (plan IN ('STANDARD', 'ESSENTIEL', 'PRO', 'PRO_PLUS')),
    paid_until TIMESTAMPTZ,
    suspended_at TIMESTAMPTZ,
    suspension_reason TEXT CHECK (length(suspension_reason) <= 500),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscriptions FROM anon, authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;
CREATE POLICY "Subscription readable by shop members" ON public.subscriptions
    FOR SELECT TO authenticated USING (shop_id = get_current_shop_id());

INSERT INTO public.subscriptions (shop_id)
SELECT DISTINCT shop_id FROM public.settings
ON CONFLICT (shop_id) DO NOTHING;

-- 3. Historique -------------------------------------------------------------
CREATE TABLE public.subscription_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('GRANT', 'PAYMENT', 'STANDARD', 'SUSPEND', 'RESUME')),
    plan TEXT CHECK (plan IN ('STANDARD', 'ESSENTIEL', 'PRO', 'PRO_PLUS')),
    months INTEGER CHECK (months BETWEEN 1 AND 36),
    amount INTEGER CHECK (amount >= 0),
    method TEXT CHECK (method IN ('MUNI_DINERO', 'BANK_TRANSFER', 'CASH', 'OTHER')),
    paid_until TIMESTAMPTZ,
    note TEXT CHECK (length(note) <= 500),
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX subscription_events_shop_idx ON public.subscription_events (shop_id, created_at DESC);
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscription_events FROM anon, authenticated;
GRANT SELECT ON public.subscription_events TO authenticated;
CREATE POLICY "Subscription history readable by shop members" ON public.subscription_events
    FOR SELECT TO authenticated USING (shop_id = get_current_shop_id());

-- 4. Actions de l'administrateur ---------------------------------------------
-- Offrir des mois (_amount NULL) ou enregistrer un paiement reçu. Même
-- formule encore en cours : les mois s'ajoutent à la suite de la date de fin.
-- Autre formule, ou période terminée : la nouvelle période part d'aujourd'hui.
CREATE OR REPLACE FUNCTION public.admin_extend_plan(
    _shop_id UUID,
    _plan TEXT,
    _months INTEGER,
    _amount INTEGER DEFAULT NULL,
    _method TEXT DEFAULT NULL,
    _note TEXT DEFAULT NULL
) RETURNS TIMESTAMPTZ
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    _current_plan TEXT;
    _current_until TIMESTAMPTZ;
    _start TIMESTAMPTZ;
    _until TIMESTAMPTZ;
BEGIN
    IF NOT is_platform_admin() THEN
        RAISE EXCEPTION 'access_denied';
    END IF;
    IF _plan IS NULL OR _plan NOT IN ('ESSENTIEL', 'PRO', 'PRO_PLUS') THEN
        RAISE EXCEPTION 'admin_invalid';
    END IF;
    IF _months IS NULL OR _months < 1 OR _months > 36 THEN
        RAISE EXCEPTION 'admin_invalid';
    END IF;
    IF _amount IS NOT NULL AND (_amount < 0 OR _method IS NULL OR _method NOT IN ('MUNI_DINERO', 'BANK_TRANSFER', 'CASH', 'OTHER')) THEN
        RAISE EXCEPTION 'admin_invalid';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM settings WHERE shop_id = _shop_id) THEN
        RAISE EXCEPTION 'shop_not_found';
    END IF;

    INSERT INTO subscriptions (shop_id) VALUES (_shop_id) ON CONFLICT (shop_id) DO NOTHING;
    SELECT plan, paid_until INTO _current_plan, _current_until
    FROM subscriptions WHERE shop_id = _shop_id FOR UPDATE;

    IF _current_plan = _plan AND _current_until > now() THEN
        _start := _current_until;
    ELSE
        _start := now();
    END IF;
    _until := _start + make_interval(months => _months);

    UPDATE subscriptions SET plan = _plan, paid_until = _until, updated_at = now()
    WHERE shop_id = _shop_id;

    INSERT INTO subscription_events (shop_id, kind, plan, months, amount, method, paid_until, note, created_by)
    VALUES (_shop_id, CASE WHEN _amount IS NULL THEN 'GRANT' ELSE 'PAYMENT' END, _plan, _months,
            _amount, CASE WHEN _amount IS NULL THEN NULL ELSE _method END, _until,
            nullif(btrim(coalesce(_note, '')), ''), auth.uid());

    RETURN _until;
END;
$$;

-- Remettre une boutique en Standard (erreur de saisie, fin d'un accord).
CREATE OR REPLACE FUNCTION public.admin_set_standard(_shop_id UUID, _note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
    IF NOT is_platform_admin() THEN
        RAISE EXCEPTION 'access_denied';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM settings WHERE shop_id = _shop_id) THEN
        RAISE EXCEPTION 'shop_not_found';
    END IF;

    INSERT INTO subscriptions (shop_id) VALUES (_shop_id) ON CONFLICT (shop_id) DO NOTHING;
    UPDATE subscriptions SET plan = 'STANDARD', paid_until = NULL, updated_at = now()
    WHERE shop_id = _shop_id;

    INSERT INTO subscription_events (shop_id, kind, plan, note, created_by)
    VALUES (_shop_id, 'STANDARD', 'STANDARD', nullif(btrim(coalesce(_note, '')), ''), auth.uid());
END;
$$;

-- Suspendre (contenu illicite, fraude...) ou réactiver une boutique.
CREATE OR REPLACE FUNCTION public.admin_set_suspended(_shop_id UUID, _suspended BOOLEAN, _reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
    IF NOT is_platform_admin() THEN
        RAISE EXCEPTION 'access_denied';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM settings WHERE shop_id = _shop_id) THEN
        RAISE EXCEPTION 'shop_not_found';
    END IF;
    IF length(_reason) > 500 THEN
        RAISE EXCEPTION 'admin_invalid';
    END IF;

    INSERT INTO subscriptions (shop_id) VALUES (_shop_id) ON CONFLICT (shop_id) DO NOTHING;
    UPDATE subscriptions
    SET suspended_at = CASE WHEN _suspended THEN now() ELSE NULL END,
        suspension_reason = CASE WHEN _suspended THEN nullif(btrim(coalesce(_reason, '')), '') ELSE NULL END,
        updated_at = now()
    WHERE shop_id = _shop_id;

    INSERT INTO subscription_events (shop_id, kind, note, created_by)
    VALUES (_shop_id, CASE WHEN _suspended THEN 'SUSPEND' ELSE 'RESUME' END,
            nullif(btrim(coalesce(_reason, '')), ''), auth.uid());
END;
$$;

-- Suite donnée à un signalement de la vitrine.
CREATE OR REPLACE FUNCTION public.admin_set_report_status(_report_id UUID, _status TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
    IF NOT is_platform_admin() THEN
        RAISE EXCEPTION 'access_denied';
    END IF;
    IF _status IS NULL OR _status NOT IN ('NEW', 'REVIEWED', 'REMOVED', 'DISMISSED') THEN
        RAISE EXCEPTION 'admin_invalid';
    END IF;
    UPDATE content_reports
    SET status = _status, handled_at = CASE WHEN _status = 'NEW' THEN NULL ELSE now() END
    WHERE id = _report_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'admin_invalid';
    END IF;
END;
$$;

-- 5. Lectures de la console ----------------------------------------------------
-- Fonctions SQL filtrées par is_platform_admin() : vides pour tout autre compte.
CREATE OR REPLACE FUNCTION public.admin_list_shops()
RETURNS TABLE (
    shop_id UUID,
    shop_name TEXT,
    shop_slug TEXT,
    country_code TEXT,
    owner_name TEXT,
    owner_email TEXT,
    signed_up_at TIMESTAMPTZ,
    member_count BIGINT,
    product_count BIGINT,
    invoice_count BIGINT,
    last_sale_at TIMESTAMPTZ,
    plan TEXT,
    paid_until TIMESTAMPTZ,
    suspended_at TIMESTAMPTZ,
    suspension_reason TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
    SELECT s.shop_id, s.shop_name, s.shop_slug, s.country_code,
           owner.full_name, owner.email::text, owner.created_at,
           (SELECT count(*) FROM profiles p WHERE p.shop_id = s.shop_id),
           (SELECT count(*) FROM products p WHERE p.shop_id = s.shop_id AND p.is_active),
           (SELECT count(*) FROM invoices i WHERE i.shop_id = s.shop_id),
           (SELECT max(i.created_at) FROM invoices i WHERE i.shop_id = s.shop_id),
           COALESCE(sub.plan, 'STANDARD'), sub.paid_until, sub.suspended_at, sub.suspension_reason
    FROM settings s
    LEFT JOIN subscriptions sub ON sub.shop_id = s.shop_id
    LEFT JOIN LATERAL (
        SELECT p.full_name, u.email, u.created_at
        FROM profiles p JOIN auth.users u ON u.id = p.id
        WHERE p.shop_id = s.shop_id AND p.role = 'MANAGER'
        ORDER BY u.created_at
        LIMIT 1
    ) owner ON TRUE
    WHERE is_platform_admin()
    ORDER BY owner.created_at DESC NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.admin_shop_events(_shop_id UUID)
RETURNS TABLE (
    id UUID,
    kind TEXT,
    plan TEXT,
    months INTEGER,
    amount INTEGER,
    method TEXT,
    paid_until TIMESTAMPTZ,
    note TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
    SELECT e.id, e.kind, e.plan, e.months, e.amount, e.method, e.paid_until, e.note, e.created_at
    FROM subscription_events e
    WHERE e.shop_id = _shop_id AND is_platform_admin()
    ORDER BY e.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_reports()
RETURNS TABLE (
    id UUID,
    shop_id UUID,
    shop_name TEXT,
    shop_slug TEXT,
    product_name TEXT,
    reason TEXT,
    details TEXT,
    reporter_contact TEXT,
    status TEXT,
    created_at TIMESTAMPTZ,
    handled_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
    SELECT r.id, r.shop_id, s.shop_name, s.shop_slug, p.name, r.reason, r.details,
           r.reporter_contact, r.status, r.created_at, r.handled_at
    FROM content_reports r
    LEFT JOIN settings s ON s.shop_id = r.shop_id
    LEFT JOIN products p ON p.id = r.product_id
    WHERE is_platform_admin()
    ORDER BY (r.status = 'NEW') DESC, r.created_at DESC;
$$;

-- 6. Une boutique suspendue n'a plus de vitrine ---------------------------------
CREATE OR REPLACE FUNCTION public.get_public_shop_profile(_shop_slug TEXT)
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
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
    SELECT s.shop_id, s.shop_name, s.shop_logo_url, s.shop_address, s.shop_phone,
           s.currency_symbol, s.theme_accent_color, s.theme_font, s.default_phone_country_code
    FROM settings s
    WHERE s.shop_slug = _shop_slug
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
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE s.shop_slug = _shop_slug
      AND p.is_published_online = TRUE
      AND p.is_active = TRUE
      AND NOT EXISTS (
          SELECT 1 FROM subscriptions sub
          WHERE sub.shop_id = s.shop_id AND sub.suspended_at IS NOT NULL
      )
    ORDER BY p.name ASC;
$$;

-- 7. Droits ------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_extend_plan(UUID, TEXT, INTEGER, INTEGER, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_standard(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_suspended(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_report_status(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_shops() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_shop_events(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_reports() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_extend_plan(UUID, TEXT, INTEGER, INTEGER, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_standard(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_suspended(UUID, BOOLEAN, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_report_status(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_shops() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_shop_events(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_reports() TO authenticated, service_role;
