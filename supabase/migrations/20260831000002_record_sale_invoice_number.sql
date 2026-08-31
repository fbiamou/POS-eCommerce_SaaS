-- Migration: 00005_record_sale_invoice_number.sql
-- Met à jour record_sale() pour assigner un numéro de facture séquentiel
-- lisible (ex: FAC-2026-0001) à chaque vente, au lieu de laisser
-- invoice_number vide. Le compteur est stocké et incrémenté de façon
-- atomique dans settings.next_invoice_number, verrouillé par la mise à
-- jour elle-même pour éviter toute collision entre ventes concurrentes.

CREATE OR REPLACE FUNCTION record_sale(
    _shop_id UUID,
    _client_id UUID,
    _items JSONB,
    _paid_amount INTEGER
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _invoice_id UUID;
    _invoice_number TEXT;
    _invoice_seq INTEGER;
    _total_amount INTEGER := 0;
    _item JSONB;
    _product_id UUID;
    _qty INTEGER;
    _price INTEGER;
    _item_total INTEGER;
    _current_stock INTEGER;
    _inv_status invoice_status;
BEGIN
    -- Verify user belongs to shop
    IF _shop_id != get_current_shop_id() THEN
        RAISE EXCEPTION 'Unauthorized shop access';
    END IF;

    -- Calculate total amount
    FOR _item IN SELECT * FROM jsonb_array_elements(_items)
    LOOP
        _qty := (_item->>'quantity')::INTEGER;
        _price := (_item->>'unit_price')::INTEGER;
        _total_amount := _total_amount + (_qty * _price);
    END LOOP;

    -- Determine status
    IF _paid_amount >= _total_amount THEN
        _inv_status := 'PAID';
    ELSIF _paid_amount > 0 THEN
        _inv_status := 'PARTIAL';
    ELSE
        _inv_status := 'UNPAID';
    END IF;

    -- Reserve the next sequential invoice number for this shop (row-locked
    -- by the UPDATE itself, so two concurrent sales can never get the same number)
    UPDATE settings
    SET next_invoice_number = next_invoice_number + 1
    WHERE shop_id = _shop_id
    RETURNING next_invoice_number - 1 INTO _invoice_seq;

    IF _invoice_seq IS NOT NULL THEN
        _invoice_number := 'FAC-' || to_char(now(), 'YYYY') || '-' || lpad(_invoice_seq::text, 4, '0');
    END IF;

    -- Create invoice
    INSERT INTO invoices (shop_id, client_id, invoice_number, total_amount, paid_amount, status, created_by)
    VALUES (_shop_id, _client_id, _invoice_number, _total_amount, _paid_amount, _inv_status, auth.uid())
    RETURNING id INTO _invoice_id;

    -- Process each item
    FOR _item IN SELECT * FROM jsonb_array_elements(_items)
    LOOP
        _product_id := (_item->>'product_id')::UUID;
        _qty := (_item->>'quantity')::INTEGER;
        _price := (_item->>'unit_price')::INTEGER;
        _item_total := _qty * _price;

        -- Insert invoice item
        INSERT INTO invoice_items (shop_id, invoice_id, product_id, quantity, unit_price, total_price)
        VALUES (_shop_id, _invoice_id, _product_id, _qty, _price, _item_total);

        -- Check and update stock
        SELECT quantity_in_stock INTO _current_stock
        FROM products
        WHERE id = _product_id AND shop_id = _shop_id
        FOR UPDATE; -- Lock row for concurrency

        IF _current_stock < _qty THEN
            RAISE EXCEPTION 'Not enough stock for product %', _product_id;
        END IF;

        UPDATE products
        SET quantity_in_stock = quantity_in_stock - _qty
        WHERE id = _product_id;

        -- Record stock movement
        INSERT INTO stock_movements (shop_id, product_id, type, quantity_change, reference_id, created_by)
        VALUES (_shop_id, _product_id, 'SALE', -_qty, _invoice_id, auth.uid());
    END LOOP;

    -- If paid amount > 0, record a payment
    IF _paid_amount > 0 THEN
        INSERT INTO payments (shop_id, invoice_id, amount, recorded_by)
        VALUES (_shop_id, _invoice_id, _paid_amount, auth.uid());
    END IF;

    RETURN _invoice_id;
END;
$$;
