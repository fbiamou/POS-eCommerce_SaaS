-- ============================================================
-- Supprimer définitivement une boutique de test (console WISHOP)
-- ============================================================
-- Décision du 25/09/2026 : exception assumée à la suppression logique
-- (AGENTS.md), réservée aux boutiques qui n'ont JAMAIS payé — boutiques de
-- test ou fictives créées par des testeurs. Une boutique qui a payé au moins
-- une fois garde son historique (obligations légales) : on la suspend.
--
-- Cette fonction efface toutes les données de la boutique, dans l'ordre des
-- clés étrangères, puis ses profils. Elle renvoie ce que le serveur doit
-- encore effacer avec la clé service_role : les comptes de connexion (Auth)
-- et les photos d'arrivage (rangées sous le jeton du lien, pas sous shop_id).

CREATE OR REPLACE FUNCTION public.admin_delete_shop(_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    _members UUID[];
    _photos TEXT[];
BEGIN
    IF NOT is_platform_admin() THEN
        RAISE EXCEPTION 'access_denied';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM settings WHERE shop_id = _shop_id) THEN
        RAISE EXCEPTION 'shop_not_found';
    END IF;
    IF EXISTS (SELECT 1 FROM subscription_events WHERE shop_id = _shop_id AND kind = 'PAYMENT') THEN
        RAISE EXCEPTION 'shop_has_payments';
    END IF;
    IF EXISTS (
        SELECT 1 FROM profiles p JOIN platform_admins a ON a.user_id = p.id WHERE p.shop_id = _shop_id
    ) THEN
        RAISE EXCEPTION 'shop_has_admin';
    END IF;

    SELECT COALESCE(array_agg(id), '{}') INTO _members FROM profiles WHERE shop_id = _shop_id;
    SELECT COALESCE(array_agg(photo_path), '{}') INTO _photos
    FROM shipments WHERE shop_id = _shop_id AND photo_path IS NOT NULL;

    DELETE FROM content_reports WHERE shop_id = _shop_id;
    DELETE FROM reminder_logs WHERE shop_id = _shop_id;
    DELETE FROM online_order_items WHERE shop_id = _shop_id;
    DELETE FROM online_orders WHERE shop_id = _shop_id;
    DELETE FROM payments WHERE shop_id = _shop_id;
    DELETE FROM invoice_items WHERE shop_id = _shop_id;
    DELETE FROM invoices WHERE shop_id = _shop_id;
    DELETE FROM stock_movements WHERE shop_id = _shop_id;
    DELETE FROM shipment_items WHERE shop_id = _shop_id;
    DELETE FROM shipments WHERE shop_id = _shop_id;
    DELETE FROM purchase_order_items WHERE shop_id = _shop_id;
    DELETE FROM purchase_orders WHERE shop_id = _shop_id;
    DELETE FROM products WHERE shop_id = _shop_id;
    DELETE FROM categories WHERE shop_id = _shop_id;
    DELETE FROM clients WHERE shop_id = _shop_id;
    DELETE FROM suppliers WHERE shop_id = _shop_id;
    DELETE FROM subscription_events WHERE shop_id = _shop_id;
    DELETE FROM subscriptions WHERE shop_id = _shop_id;
    DELETE FROM profiles WHERE shop_id = _shop_id;
    DELETE FROM settings WHERE shop_id = _shop_id;

    RETURN jsonb_build_object('members', to_jsonb(_members), 'shipment_photos', to_jsonb(_photos));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_shop(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_shop(UUID) TO authenticated, service_role;
