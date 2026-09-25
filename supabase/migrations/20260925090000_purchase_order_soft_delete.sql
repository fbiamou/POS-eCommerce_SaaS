-- ============================================================
-- Supprimer un bon de commande brouillon ou annulé
-- ============================================================
-- Suppression logique (AGENTS.md : jamais de DELETE sur une donnée
-- commerciale) : le bon disparaît des listes, de l'écran et de l'export, mais
-- sa ligne reste en base avec la date de suppression.
--
-- Seuls un brouillon et un bon annulé se suppriment : un bon envoyé ou reçu
-- fait partie de l'historique des achats. Un brouillon supprimé passe aussi en
-- « annulé », sinon ses articles resteraient réservés et create_purchase_orders
-- ne les proposerait plus dans un nouveau bon.

ALTER TABLE public.purchase_orders ADD COLUMN deleted_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.delete_purchase_order(_shop_id UUID, _order_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    _current public.purchase_order_status;
BEGIN
    IF _shop_id != get_current_shop_id() THEN
        RAISE EXCEPTION 'Unauthorized shop access';
    END IF;

    SELECT status INTO _current FROM purchase_orders
    WHERE id = _order_id AND shop_id = _shop_id AND deleted_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'purchase_order_not_found';
    END IF;

    IF _current NOT IN ('DRAFT', 'CANCELLED') THEN
        RAISE EXCEPTION 'purchase_order_not_deletable';
    END IF;

    UPDATE purchase_orders
    SET status = 'CANCELLED', deleted_at = NOW()
    WHERE id = _order_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_purchase_order(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_purchase_order(UUID, UUID) TO authenticated, service_role;
