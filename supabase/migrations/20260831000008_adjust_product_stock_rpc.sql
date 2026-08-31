-- Migration: 00011_adjust_product_stock_rpc.sql
-- La fiche produit (modale d'édition du Stock) permet de corriger
-- directement la quantité en stock. Pour respecter la règle du projet
-- (jamais de mise à jour de quantity_in_stock en dehors d'une fonction
-- centralisée), on passe désormais par cette fonction, qui journalise
-- l'écart comme un mouvement de stock de type ADJUSTMENT.

CREATE OR REPLACE FUNCTION adjust_product_stock(
    _shop_id UUID,
    _product_id UUID,
    _new_quantity INTEGER
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _current_quantity INTEGER;
    _delta INTEGER;
BEGIN
    IF _shop_id != get_current_shop_id() THEN
        RAISE EXCEPTION 'Unauthorized shop access';
    END IF;
    IF _new_quantity < 0 THEN
        RAISE EXCEPTION 'Quantity cannot be negative';
    END IF;

    SELECT quantity_in_stock INTO _current_quantity
    FROM products
    WHERE id = _product_id AND shop_id = _shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found';
    END IF;

    _delta := _new_quantity - _current_quantity;

    UPDATE products SET quantity_in_stock = _new_quantity WHERE id = _product_id;

    IF _delta != 0 THEN
        INSERT INTO stock_movements (shop_id, product_id, type, quantity_change, created_by)
        VALUES (_shop_id, _product_id, 'ADJUSTMENT', _delta, auth.uid());
    END IF;
END;
$$;
