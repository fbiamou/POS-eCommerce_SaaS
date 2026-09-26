-- Storefront orders (place_online_order) can be placed without an account,
-- so anyone could send thousands of fake orders to a shop (review of
-- 26/09/2026). Limits, like the storefront reports already have:
--   - at most 3 orders per phone number and shop in 15 minutes;
--   - at most 30 orders per shop in 10 minutes;
--   - at most 50 lines per order, a name of 100 characters, a phone of 30.
-- A real customer never reaches them; the error codes are shown to the
-- visitor in her language (lib/feedback.ts). A captcha comes on top later.

CREATE OR REPLACE FUNCTION public.place_online_order(_shop_id uuid, _customer_name text, _customer_phone text, _items jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _order_id UUID;
    _total_amount INTEGER := 0;
    _item JSONB;
    _product_id UUID;
    _qty INTEGER;
    _price INTEGER;
    _stock INTEGER;
    _is_published BOOLEAN;
BEGIN
    IF _customer_name IS NULL OR trim(_customer_name) = '' THEN
        RAISE EXCEPTION 'Customer name is required';
    END IF;
    IF _customer_phone IS NULL OR trim(_customer_phone) = '' THEN
        RAISE EXCEPTION 'Customer phone is required';
    END IF;
    IF length(trim(_customer_name)) > 100 OR length(trim(_customer_phone)) > 30 THEN
        RAISE EXCEPTION 'order_contact_too_long';
    END IF;
    IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
        RAISE EXCEPTION 'Cart is empty';
    END IF;
    IF jsonb_array_length(_items) > 50 THEN
        RAISE EXCEPTION 'order_too_large';
    END IF;

    IF (SELECT count(*) FROM online_orders
        WHERE shop_id = _shop_id AND customer_phone = trim(_customer_phone)
          AND created_at > now() - interval '15 minutes') >= 3
       OR (SELECT count(*) FROM online_orders
        WHERE shop_id = _shop_id AND created_at > now() - interval '10 minutes') >= 30 THEN
        RAISE EXCEPTION 'order_rate_limited';
    END IF;

    FOR _item IN SELECT * FROM jsonb_array_elements(_items)
    LOOP
        _product_id := (_item->>'product_id')::UUID;
        _qty := (_item->>'quantity')::INTEGER;

        SELECT selling_price, quantity_in_stock, is_published_online
        INTO _price, _stock, _is_published
        FROM products
        WHERE id = _product_id AND shop_id = _shop_id AND is_active = TRUE;

        IF NOT FOUND OR NOT _is_published THEN
            RAISE EXCEPTION 'Product % is not available', _product_id;
        END IF;
        IF _qty <= 0 OR _qty > _stock THEN
            RAISE EXCEPTION 'Invalid quantity for product %', _product_id;
        END IF;

        _total_amount := _total_amount + (_price * _qty);
    END LOOP;

    INSERT INTO online_orders (shop_id, customer_name, customer_phone, total_amount)
    VALUES (_shop_id, trim(_customer_name), trim(_customer_phone), _total_amount)
    RETURNING id INTO _order_id;

    FOR _item IN SELECT * FROM jsonb_array_elements(_items)
    LOOP
        _product_id := (_item->>'product_id')::UUID;
        _qty := (_item->>'quantity')::INTEGER;
        SELECT selling_price INTO _price FROM products WHERE id = _product_id;

        INSERT INTO online_order_items (shop_id, order_id, product_id, quantity, unit_price, total_price)
        VALUES (_shop_id, _order_id, _product_id, _qty, _price, _price * _qty);
    END LOOP;

    RETURN _order_id;
END;
$$;
