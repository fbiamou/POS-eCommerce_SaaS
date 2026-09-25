-- ============================================================
-- Moyens de paiement des formules (décision du 25/09/2026)
-- ============================================================
-- En plus de Muni Dinero, du virement bancaire et des espèces : BGFI Mobile,
-- Orange Money et Ecobank Mobile Money. Paiements encaissés à la main par
-- WISHOP et enregistrés dans la console.

ALTER TABLE public.subscription_events DROP CONSTRAINT IF EXISTS subscription_events_method_check;
ALTER TABLE public.subscription_events ADD CONSTRAINT subscription_events_method_check
    CHECK (method IN ('MUNI_DINERO', 'BGFI_MOBILE', 'ORANGE_MONEY', 'ECOBANK_MOBILE', 'BANK_TRANSFER', 'CASH', 'OTHER'));

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
    IF _amount IS NOT NULL AND (_amount < 0 OR _method IS NULL OR _method NOT IN
        ('MUNI_DINERO', 'BGFI_MOBILE', 'ORANGE_MONEY', 'ECOBANK_MOBILE', 'BANK_TRANSFER', 'CASH', 'OTHER')) THEN
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
