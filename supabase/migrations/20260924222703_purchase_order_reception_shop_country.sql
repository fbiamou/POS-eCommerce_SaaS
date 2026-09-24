-- Migration: réception pointée des bons de commande, et pays de la boutique.
--
-- 1. Quand le fournisseur livre, la gérante pointe sur le bon de commande
--    les quantités réellement reçues ; seules celles-ci entrent en stock,
--    avec un mouvement RESTOCK tracé, comme pour un arrivage pointé.
--    Un bon « envoyé » ne peut plus passer à « reçu » sans ce pointage.
-- 2. Le pays de la boutique (code ISO à deux lettres) : il préremplit le
--    taux de TVA, l'indicatif et le fuseau, et nomme l'identifiant fiscal
--    (NIU, NIF) sur les tickets et factures.


-- ============================================================
-- 1. Réception pointée d'un bon de commande
-- ============================================================
ALTER TABLE public.purchase_order_items
    ADD COLUMN received_quantity INTEGER CHECK (received_quantity >= 0);

CREATE OR REPLACE FUNCTION public.receive_purchase_order(_shop_id UUID, _order_id UUID, _received JSONB)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    _order purchase_orders%ROWTYPE;
    _item purchase_order_items%ROWTYPE;
    _entry JSONB;
    _qty INTEGER;
BEGIN
    IF _shop_id != get_current_shop_id() THEN
        RAISE EXCEPTION 'Unauthorized shop access';
    END IF;

    SELECT * INTO _order FROM purchase_orders WHERE id = _order_id AND shop_id = _shop_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'purchase_order_not_found';
    END IF;
    IF _order.status <> 'SENT' THEN
        RAISE EXCEPTION 'invalid_status_change';
    END IF;

    -- Un bon suivi par un arrivage se réceptionne par cet arrivage : le
    -- pointer ici aussi compterait la marchandise deux fois.
    IF EXISTS (
        SELECT 1 FROM shipments
        WHERE purchase_order_id = _order_id AND shop_id = _shop_id AND status <> 'CANCELLED'
    ) THEN
        RAISE EXCEPTION 'purchase_order_has_shipment';
    END IF;

    FOR _item IN
        SELECT * FROM purchase_order_items
        WHERE purchase_order_id = _order_id AND shop_id = _shop_id AND NOT excluded
        ORDER BY created_at
    LOOP
        SELECT e INTO _entry FROM jsonb_array_elements(_received) e WHERE e->>'item_id' = _item.id::text LIMIT 1;
        IF _entry IS NULL THEN
            RAISE EXCEPTION 'missing_received_quantity';
        END IF;
        _qty := (_entry->>'received_quantity')::INTEGER;
        IF _qty IS NULL OR _qty < 0 THEN
            RAISE EXCEPTION 'invalid_quantity';
        END IF;

        IF _qty > 0 THEN
            UPDATE products
            SET quantity_in_stock = quantity_in_stock + _qty
            WHERE id = _item.product_id AND shop_id = _shop_id;

            INSERT INTO stock_movements (shop_id, product_id, type, quantity_change, reference_id, created_by)
            VALUES (_shop_id, _item.product_id, 'RESTOCK', _qty, _order_id, auth.uid());
        END IF;

        UPDATE purchase_order_items SET received_quantity = _qty WHERE id = _item.id;
    END LOOP;

    UPDATE purchase_orders SET status = 'RECEIVED', received_at = NOW() WHERE id = _order_id;
END;
$$;

-- « Reçu » ne s'obtient plus que par la réception pointée ci-dessus (ou par
-- l'arrivage lié) : ce changement de statut seul laissait le stock inchangé.
CREATE OR REPLACE FUNCTION public.set_purchase_order_status(_shop_id UUID, _order_id UUID, _status public.purchase_order_status)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    _current public.purchase_order_status;
BEGIN
    IF _shop_id != get_current_shop_id() THEN
        RAISE EXCEPTION 'Unauthorized shop access';
    END IF;

    SELECT status INTO _current FROM purchase_orders WHERE id = _order_id AND shop_id = _shop_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'purchase_order_not_found';
    END IF;

    -- Transitions permises : brouillon -> envoyé ; annulation tant que rien
    -- n'est reçu. La réception passe par receive_purchase_order.
    IF NOT (
        (_current = 'DRAFT' AND _status IN ('SENT', 'CANCELLED')) OR
        (_current = 'SENT' AND _status = 'CANCELLED')
    ) THEN
        RAISE EXCEPTION 'invalid_status_change';
    END IF;

    IF _status = 'SENT' AND NOT EXISTS (
        SELECT 1 FROM purchase_order_items WHERE purchase_order_id = _order_id AND NOT excluded
    ) THEN
        RAISE EXCEPTION 'empty_cart';
    END IF;

    UPDATE purchase_orders
    SET status = _status,
        sent_at = CASE WHEN _status = 'SENT' THEN NOW() ELSE sent_at END
    WHERE id = _order_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.receive_purchase_order(UUID, UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receive_purchase_order(UUID, UUID, JSONB) TO authenticated, service_role;


-- ============================================================
-- 2. Pays de la boutique
-- ============================================================
ALTER TABLE public.settings
    ADD COLUMN country_code TEXT CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$');

-- Les réglages sont lisibles colonne par colonne (migration hide_whatsapp_token).
GRANT SELECT (country_code) ON public.settings TO authenticated;
