-- Migration: security_hardening
-- Correctifs de sécurité relevés lors de l'audit du 23/09/2026.
--
-- Cette migration ne contient que des changements applicables sans toucher
-- au code de l'application déjà en ligne : rien de ce que l'application fait
-- aujourd'hui (ventes, stock, relances, équipe, réglages, logo, photos) ne
-- cesse de fonctionner. Seuls les appels illégitimes sont désormais refusés.


-- ============================================================
-- 1. Identité de boutique : jamais NULL
-- ============================================================
-- Toutes les fonctions RPC vérifient `_shop_id != get_current_shop_id()`.
-- Pour un visiteur non connecté, get_current_shop_id() renvoyait NULL : la
-- comparaison valait NULL (pas TRUE) et la vérification LAISSAIT PASSER
-- l'appel. Comme l'identifiant d'une boutique est public (boutique en
-- ligne), n'importe qui pouvait lire les impayés d'une boutique (nom,
-- téléphone, montant), enregistrer une vente ou modifier le stock.
--
-- On renvoie désormais un identifiant nul, qui ne correspond à aucune
-- boutique : chaque vérification existante (et future) refuse l'appel, et
-- les règles RLS continuent de ne renvoyer aucune ligne. Un profil suspendu
-- (is_active = false) perd aussi l'accès aux données, en plus du
-- bannissement Supabase Auth posé par la suspension.
CREATE OR REPLACE FUNCTION public.get_current_shop_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT COALESCE(
        (SELECT shop_id FROM profiles WHERE id = auth.uid() AND is_active),
        '00000000-0000-0000-0000-000000000000'::uuid
    );
$$;

CREATE OR REPLACE FUNCTION public.is_shop_manager()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'MANAGER' AND is_active
    );
$$;


-- ============================================================
-- 2. Relances automatiques : le serveur reste autorisé
-- ============================================================
-- La tâche planifiée (/api/cron/reminders) appelle ces deux fonctions avec
-- la clé service_role, donc sans utilisateur connecté. Elle ne fonctionnait
-- que grâce au défaut corrigé au point 1 : on l'autorise explicitement.
-- Corps identiques à la version en production, seule la vérification change.
CREATE OR REPLACE FUNCTION public.get_overdue_invoices_for_reminders(_shop_id uuid)
RETURNS TABLE(invoice_id uuid, invoice_number text, client_id uuid, client_name text, client_phone text, total_amount integer, paid_amount integer, created_at timestamp with time zone, days_overdue integer, last_reminder_at timestamp with time zone, reminder_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    _first_delay INTEGER;
    _recurring_delay INTEGER;
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' AND _shop_id != get_current_shop_id() THEN
        RAISE EXCEPTION 'Unauthorized shop access';
    END IF;

    SELECT reminder_first_delay_days, reminder_recurring_delay_days
    INTO _first_delay, _recurring_delay
    FROM settings
    WHERE shop_id = _shop_id;

    RETURN QUERY
    SELECT
        i.id,
        i.invoice_number,
        c.id,
        c.name,
        c.phone,
        i.total_amount,
        i.paid_amount,
        i.created_at,
        (NOW()::date - i.created_at::date)::INTEGER,
        rl.last_sent_at,
        COALESCE(rl.reminder_count, 0)::INTEGER
    FROM invoices i
    JOIN clients c ON c.id = i.client_id
    LEFT JOIN LATERAL (
        SELECT MAX(sent_at) AS last_sent_at, COUNT(*) AS reminder_count
        FROM reminder_logs
        WHERE reminder_logs.invoice_id = i.id
    ) rl ON TRUE
    WHERE i.shop_id = _shop_id
      AND i.status IN ('UNPAID', 'PARTIAL')
      AND c.phone IS NOT NULL
      AND (
        (rl.last_sent_at IS NULL AND i.created_at <= NOW() - (_first_delay || ' days')::INTERVAL)
        OR
        (rl.last_sent_at IS NOT NULL AND rl.last_sent_at <= NOW() - (_recurring_delay || ' days')::INTERVAL)
      )
    ORDER BY i.created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_reminder(_shop_id uuid, _client_id uuid, _invoice_id uuid, _template_name text, _status reminder_status)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    _log_id UUID;
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' AND _shop_id != get_current_shop_id() THEN
        RAISE EXCEPTION 'Unauthorized shop access';
    END IF;

    INSERT INTO reminder_logs (shop_id, client_id, invoice_id, template_name, status)
    VALUES (_shop_id, _client_id, _invoice_id, _template_name, _status)
    RETURNING id INTO _log_id;

    RETURN _log_id;
END;
$$;


-- ============================================================
-- 3. Qui peut appeler quelle fonction
-- ============================================================
-- Seules les trois fonctions de la boutique en ligne restent ouvertes aux
-- visiteurs : get_public_shop_profile, get_public_shop_catalog et
-- place_online_order. Les autres exigent une session (ou la clé serveur).
REVOKE EXECUTE ON FUNCTION public.record_sale(uuid, uuid, jsonb, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.adjust_product_stock(uuid, uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.restock_product(uuid, uuid, integer, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_overdue_invoices_for_reminders(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_reminder(uuid, uuid, uuid, text, reminder_status) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.confirm_online_order(uuid, uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_online_order(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_shop_manager() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.record_sale(uuid, uuid, jsonb, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.adjust_product_stock(uuid, uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restock_product(uuid, uuid, integer, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_overdue_invoices_for_reminders(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_reminder(uuid, uuid, uuid, text, reminder_status) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_online_order(uuid, uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_online_order(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_shop_manager() TO authenticated, service_role;

-- Fonction de déclencheur : jamais appelable directement par l'API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Chemin de recherche figé (avertissement de sécurité Supabase).
ALTER FUNCTION public.handle_new_user() SET search_path TO 'public';
ALTER FUNCTION public.set_updated_at() SET search_path TO 'public';


-- ============================================================
-- 4. Pas de suppression définitive depuis l'API (AGENTS.md)
-- ============================================================
-- Les données commerciales se désactivent (is_active), elles ne se
-- suppriment jamais. L'application n'utilise aucun DELETE : on le retire.
REVOKE DELETE ON
    public.profiles, public.categories, public.products, public.stock_movements,
    public.clients, public.invoices, public.invoice_items, public.payments,
    public.settings, public.reminder_logs, public.online_orders, public.online_order_items
FROM anon, authenticated;


-- ============================================================
-- 5. Factures, paiements, mouvements : écriture uniquement via les RPC
-- ============================================================
-- AGENTS.md : toute écriture touchant une facture ou le stock passe par une
-- fonction centralisée. Les RPC (SECURITY DEFINER) continuent d'écrire ; un
-- appel direct à l'API ne peut plus modifier un montant payé, un statut de
-- facture ou l'historique des mouvements. L'application n'écrit jamais
-- directement dans ces tables.
REVOKE INSERT, UPDATE ON
    public.invoices, public.invoice_items, public.payments, public.stock_movements,
    public.reminder_logs, public.online_orders, public.online_order_items
FROM anon, authenticated;


-- ============================================================
-- 6. Rôles et accès : seul un Propriétaire les modifie
-- ============================================================
-- La règle RLS des profils autorise chacun à modifier sa propre ligne : une
-- vendeuse pouvait donc se donner elle-même le rôle MANAGER. Ce déclencheur
-- réserve les champs sensibles au Propriétaire de la même boutique. Le code
-- serveur (clé service_role) et le déclencheur d'inscription n'ont pas
-- d'utilisateur connecté et restent autorisés.
CREATE OR REPLACE FUNCTION public.guard_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.shop_id IS DISTINCT FROM OLD.shop_id THEN
        RAISE EXCEPTION 'A profile cannot change shop' USING ERRCODE = '42501';
    END IF;

    IF (NEW.role IS DISTINCT FROM OLD.role
        OR NEW.allowed_pages IS DISTINCT FROM OLD.allowed_pages
        OR NEW.is_active IS DISTINCT FROM OLD.is_active)
       AND NOT (is_shop_manager() AND OLD.shop_id = get_current_shop_id()) THEN
        RAISE EXCEPTION 'Only a shop manager can change roles and access' USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_profile_privileges() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_profile_privileges ON public.profiles;
CREATE TRIGGER guard_profile_privileges
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileges();


-- ============================================================
-- 7. Réglages de la boutique : lecture pour l'équipe, écriture Propriétaire
-- ============================================================
DROP POLICY IF EXISTS "Settings isolated by shop" ON public.settings;

CREATE POLICY "Settings readable by shop members" ON public.settings
    FOR SELECT USING (shop_id = get_current_shop_id());

CREATE POLICY "Settings writable by shop manager" ON public.settings
    FOR UPDATE USING (shop_id = get_current_shop_id() AND is_shop_manager())
    WITH CHECK (shop_id = get_current_shop_id() AND is_shop_manager());


-- ============================================================
-- 8. Photos et logos : chaque boutique n'écrit que dans son dossier
-- ============================================================
-- Avant : tout compte connecté (l'inscription est libre) pouvait remplacer
-- ou supprimer les images de n'importe quelle boutique. L'application range
-- déjà chaque fichier sous "<shop_id>/...", on l'exige désormais.
DROP POLICY IF EXISTS "Shop members can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Shop members can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Shop members can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Shop members can upload assets" ON storage.objects;
DROP POLICY IF EXISTS "Shop members can update assets" ON storage.objects;
DROP POLICY IF EXISTS "Shop members can delete assets" ON storage.objects;

CREATE POLICY "Shop members write own product images" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'product-images'
                AND (storage.foldername(name))[1] = public.get_current_shop_id()::text);

CREATE POLICY "Shop members update own product images" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'product-images'
           AND (storage.foldername(name))[1] = public.get_current_shop_id()::text)
    WITH CHECK (bucket_id = 'product-images'
                AND (storage.foldername(name))[1] = public.get_current_shop_id()::text);

CREATE POLICY "Shop members delete own product images" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'product-images'
           AND (storage.foldername(name))[1] = public.get_current_shop_id()::text);

CREATE POLICY "Shop manager writes own assets" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'shop-assets'
                AND (storage.foldername(name))[1] = public.get_current_shop_id()::text
                AND public.is_shop_manager());

CREATE POLICY "Shop manager updates own assets" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'shop-assets'
           AND (storage.foldername(name))[1] = public.get_current_shop_id()::text
           AND public.is_shop_manager())
    WITH CHECK (bucket_id = 'shop-assets'
                AND (storage.foldername(name))[1] = public.get_current_shop_id()::text
                AND public.is_shop_manager());

CREATE POLICY "Shop manager deletes own assets" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'shop-assets'
           AND (storage.foldername(name))[1] = public.get_current_shop_id()::text
           AND public.is_shop_manager());
