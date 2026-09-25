-- ============================================================
-- Console : la langue de chaque boutique
-- ============================================================
-- Décision du 25/09/2026 : pour écrire à une boutique dans sa langue, la
-- console affiche la langue de l'interface choisie à l'inscription (données
-- de l'utilisatrice : locale). Les boutiques inscrites avant ce réglage n'en
-- ont pas : l'application la déduit alors du pays.
-- Le type de retour change, d'où DROP puis CREATE (lecture seule, aucune
-- donnée modifiée).

DROP FUNCTION IF EXISTS public.admin_list_shops();
CREATE FUNCTION public.admin_list_shops()
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
    suspension_reason TEXT,
    owner_locale TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
    SELECT s.shop_id, s.shop_name, s.shop_slug, s.country_code,
           owner.full_name, owner.email::text, owner.created_at,
           (SELECT count(*) FROM profiles p WHERE p.shop_id = s.shop_id),
           (SELECT count(*) FROM products p WHERE p.shop_id = s.shop_id AND p.is_active),
           (SELECT count(*) FROM invoices i WHERE i.shop_id = s.shop_id),
           (SELECT max(i.created_at) FROM invoices i WHERE i.shop_id = s.shop_id),
           COALESCE(sub.plan, 'STANDARD'), sub.paid_until, sub.suspended_at, sub.suspension_reason,
           owner.locale
    FROM settings s
    LEFT JOIN subscriptions sub ON sub.shop_id = s.shop_id
    LEFT JOIN LATERAL (
        SELECT p.full_name, u.email, u.created_at, u.raw_user_meta_data ->> 'locale' AS locale
        FROM profiles p JOIN auth.users u ON u.id = p.id
        WHERE p.shop_id = s.shop_id AND p.role = 'MANAGER'
        ORDER BY u.created_at
        LIMIT 1
    ) owner ON TRUE
    WHERE is_platform_admin()
    ORDER BY owner.created_at DESC NULLS LAST;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_shops() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_shops() TO authenticated, service_role;
