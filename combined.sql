-- Migration: 00001_initial_schema.sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE role_type AS ENUM ('MANAGER', 'SELLER');
CREATE TYPE movement_type AS ENUM ('SALE', 'RESTOCK', 'ADJUSTMENT');
CREATE TYPE invoice_status AS ENUM ('PAID', 'PARTIAL', 'UNPAID');
CREATE TYPE reminder_status AS ENUM ('SENT', 'FAILED');

-- Profiles (linked to auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL,
    role role_type NOT NULL DEFAULT 'SELLER',
    full_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categories
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL,
    name TEXT NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    quantity_in_stock INTEGER NOT NULL DEFAULT 0,
    purchase_price INTEGER NOT NULL DEFAULT 0,
    selling_price INTEGER NOT NULL DEFAULT 0,
    supplier TEXT,
    origin_country TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stock Movements
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    type movement_type NOT NULL,
    quantity_change INTEGER NOT NULL,
    reference_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id)
);

-- Clients
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL,
    name TEXT NOT NULL,
    phone TEXT, -- format WhatsApp
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invoices
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    total_amount INTEGER NOT NULL DEFAULT 0,
    paid_amount INTEGER NOT NULL DEFAULT 0,
    status invoice_status NOT NULL DEFAULT 'UNPAID',
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invoice Items
CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    unit_price INTEGER NOT NULL,
    total_price INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recorded_by UUID REFERENCES profiles(id)
);

-- Settings
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL UNIQUE,
    reminder_first_delay_days INTEGER NOT NULL DEFAULT 7,
    reminder_recurring_delay_days INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reminder Logs
CREATE TABLE reminder_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    template_name TEXT NOT NULL,
    status reminder_status NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Migration: 00002_rls_policies.sql

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's shop_id
CREATE OR REPLACE FUNCTION get_current_shop_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT shop_id FROM profiles WHERE id = auth.uid();
$$;

-- Profiles: Users can see profiles from their own shop, or their own profile.
CREATE POLICY "Profiles isolated by shop or self" ON profiles
    FOR ALL USING (auth.uid() = id OR shop_id = get_current_shop_id());

-- Categories
CREATE POLICY "Categories isolated by shop" ON categories
    FOR ALL USING (shop_id = get_current_shop_id());

-- Products
CREATE POLICY "Products isolated by shop" ON products
    FOR ALL USING (shop_id = get_current_shop_id());

-- Stock Movements
CREATE POLICY "Stock movements isolated by shop" ON stock_movements
    FOR ALL USING (shop_id = get_current_shop_id());

-- Clients
CREATE POLICY "Clients isolated by shop" ON clients
    FOR ALL USING (shop_id = get_current_shop_id());

-- Invoices
CREATE POLICY "Invoices isolated by shop" ON invoices
    FOR ALL USING (shop_id = get_current_shop_id());

-- Invoice Items
CREATE POLICY "Invoice items isolated by shop" ON invoice_items
    FOR ALL USING (shop_id = get_current_shop_id());

-- Payments
CREATE POLICY "Payments isolated by shop" ON payments
    FOR ALL USING (shop_id = get_current_shop_id());

-- Settings
CREATE POLICY "Settings isolated by shop" ON settings
    FOR ALL USING (shop_id = get_current_shop_id());

-- Reminder logs
CREATE POLICY "Reminder logs isolated by shop" ON reminder_logs
    FOR ALL USING (shop_id = get_current_shop_id());

-- updated_at triggers
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- Migration: 00003_rpc_record_sale.sql

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

    -- Create invoice
    INSERT INTO invoices (shop_id, client_id, total_amount, paid_amount, status, created_by)
    VALUES (_shop_id, _client_id, _total_amount, _paid_amount, _inv_status, auth.uid())
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

-- Trigger to create profile and settings for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    new_shop_id UUID := uuid_generate_v4();
BEGIN
    INSERT INTO public.profiles (id, shop_id, role, full_name)
    VALUES (new.id, new_shop_id, 'MANAGER', coalesce(new.raw_user_meta_data->>'full_name', new.email));

    INSERT INTO public.settings (shop_id)
    VALUES (new_shop_id);

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
