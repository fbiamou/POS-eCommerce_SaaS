-- Migration: 00006_restock_product_rpc.sql
-- Fonction centralisée pour tout réapprovisionnement de stock (import CSV,
-- futur écran de réception d'arrivage...), afin qu'aucune mise à jour de
-- quantity_in_stock ne se fasse en dehors d'une fonction traçant un
-- mouvement de stock (cf. AGENTS.md).

CREATE OR REPLACE FUNCTION restock_product(
    _shop_id UUID,
    _product_id UUID,
    _quantity INTEGER,
    _new_purchase_price INTEGER DEFAULT NULL,
    _new_selling_price INTEGER DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF _shop_id != get_current_shop_id() THEN
        RAISE EXCEPTION 'Unauthorized shop access';
    END IF;

    IF _quantity <= 0 THEN
        RAISE EXCEPTION 'Restock quantity must be positive';
    END IF;

    UPDATE products
    SET quantity_in_stock = quantity_in_stock + _quantity,
        purchase_price = COALESCE(_new_purchase_price, purchase_price),
        selling_price = COALESCE(_new_selling_price, selling_price)
    WHERE id = _product_id AND shop_id = _shop_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product % not found for shop %', _product_id, _shop_id;
    END IF;

    INSERT INTO stock_movements (shop_id, product_id, type, quantity_change, created_by)
    VALUES (_shop_id, _product_id, 'RESTOCK', _quantity, auth.uid());
END;
$$;
