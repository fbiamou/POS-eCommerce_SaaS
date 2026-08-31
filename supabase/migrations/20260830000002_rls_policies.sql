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
