-- Ready for hundreds of shops (review of 26/09/2026).
--
-- 1. Every shop reads its own rows (RLS: shop_id = get_current_shop_id()),
--    but the main tables had no index on shop_id: each read went through
--    the rows of every shop. Indexes by shop, in the order the app reads
--    (the offline sync reads by updated_at, lists by created_at).
-- 2. Foreign keys without an index (Supabase performance advisor): reading
--    an invoice's lines, a client's invoices, a product's movements...
-- 3. RLS policies call get_current_shop_id() / auth.uid() once per query
--    instead of once per row: (SELECT ...) lets Postgres compute it once.

-- 1. By shop
CREATE INDEX IF NOT EXISTS categories_shop_idx ON public.categories (shop_id);
CREATE INDEX IF NOT EXISTS clients_shop_updated_idx ON public.clients (shop_id, updated_at, id);
CREATE INDEX IF NOT EXISTS invoice_items_shop_idx ON public.invoice_items (shop_id);
CREATE INDEX IF NOT EXISTS invoices_shop_updated_idx ON public.invoices (shop_id, updated_at, id);
CREATE INDEX IF NOT EXISTS invoices_shop_created_idx ON public.invoices (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS online_order_items_shop_idx ON public.online_order_items (shop_id);
CREATE INDEX IF NOT EXISTS online_orders_shop_created_idx ON public.online_orders (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_shop_idx ON public.payments (shop_id);
CREATE INDEX IF NOT EXISTS products_shop_updated_idx ON public.products (shop_id, updated_at, id);
CREATE INDEX IF NOT EXISTS profiles_shop_idx ON public.profiles (shop_id);
CREATE INDEX IF NOT EXISTS purchase_order_items_shop_idx ON public.purchase_order_items (shop_id);
CREATE INDEX IF NOT EXISTS reminder_logs_shop_idx ON public.reminder_logs (shop_id);
CREATE INDEX IF NOT EXISTS shipment_items_shop_idx ON public.shipment_items (shop_id);
CREATE INDEX IF NOT EXISTS shop_message_reads_shop_idx ON public.shop_message_reads (shop_id);
CREATE INDEX IF NOT EXISTS stock_movements_shop_created_idx ON public.stock_movements (shop_id, created_at DESC);

-- 2. Foreign keys
CREATE INDEX IF NOT EXISTS content_reports_product_idx ON public.content_reports (product_id);
CREATE INDEX IF NOT EXISTS devices_created_by_idx ON public.devices (created_by);
CREATE INDEX IF NOT EXISTS invoice_items_invoice_idx ON public.invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS invoice_items_product_idx ON public.invoice_items (product_id);
CREATE INDEX IF NOT EXISTS invoices_client_idx ON public.invoices (client_id);
CREATE INDEX IF NOT EXISTS invoices_created_by_idx ON public.invoices (created_by);
CREATE INDEX IF NOT EXISTS online_order_items_order_idx ON public.online_order_items (order_id);
CREATE INDEX IF NOT EXISTS online_order_items_product_idx ON public.online_order_items (product_id);
CREATE INDEX IF NOT EXISTS online_orders_confirmed_by_idx ON public.online_orders (confirmed_by);
CREATE INDEX IF NOT EXISTS online_orders_invoice_idx ON public.online_orders (invoice_id);
CREATE INDEX IF NOT EXISTS payments_invoice_idx ON public.payments (invoice_id);
CREATE INDEX IF NOT EXISTS payments_recorded_by_idx ON public.payments (recorded_by);
CREATE INDEX IF NOT EXISTS products_category_idx ON public.products (category_id);
CREATE INDEX IF NOT EXISTS purchase_order_items_product_idx ON public.purchase_order_items (product_id);
CREATE INDEX IF NOT EXISTS purchase_orders_created_by_idx ON public.purchase_orders (created_by);
CREATE INDEX IF NOT EXISTS purchase_orders_supplier_idx ON public.purchase_orders (supplier_id);
CREATE INDEX IF NOT EXISTS reminder_logs_client_idx ON public.reminder_logs (client_id);
CREATE INDEX IF NOT EXISTS reminder_logs_invoice_idx ON public.reminder_logs (invoice_id);
CREATE INDEX IF NOT EXISTS shipment_items_product_idx ON public.shipment_items (product_id);
CREATE INDEX IF NOT EXISTS shipments_created_by_idx ON public.shipments (created_by);
CREATE INDEX IF NOT EXISTS shipments_purchase_order_idx ON public.shipments (purchase_order_id);
CREATE INDEX IF NOT EXISTS shipments_received_by_idx ON public.shipments (received_by);
CREATE INDEX IF NOT EXISTS stock_movements_created_by_idx ON public.stock_movements (created_by);
CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON public.stock_movements (product_id);

-- 3. Policies computed once per query
ALTER POLICY "Categories isolated by shop" ON public.categories USING (shop_id = (SELECT get_current_shop_id()));
ALTER POLICY "Clients isolated by shop" ON public.clients USING (shop_id = (SELECT get_current_shop_id()));
ALTER POLICY "Devices readable by shop" ON public.devices USING (shop_id = (SELECT get_current_shop_id()));
ALTER POLICY "Invoice items isolated by shop" ON public.invoice_items USING (shop_id = (SELECT get_current_shop_id()));
ALTER POLICY "Invoices isolated by shop" ON public.invoices USING (shop_id = (SELECT get_current_shop_id()));
ALTER POLICY "Online order items isolated by shop" ON public.online_order_items USING (shop_id = (SELECT get_current_shop_id()));
ALTER POLICY "Online orders isolated by shop" ON public.online_orders USING (shop_id = (SELECT get_current_shop_id()));
ALTER POLICY "Payments isolated by shop" ON public.payments USING (shop_id = (SELECT get_current_shop_id()));
ALTER POLICY "Products isolated by shop" ON public.products USING (shop_id = (SELECT get_current_shop_id()));
ALTER POLICY "Profiles isolated by shop or self" ON public.profiles
    USING ((SELECT auth.uid()) = id OR shop_id = (SELECT get_current_shop_id()));
ALTER POLICY "Purchase order items readable by shop members" ON public.purchase_order_items USING (shop_id = (SELECT get_current_shop_id()));
ALTER POLICY "Purchase orders readable by shop members" ON public.purchase_orders USING (shop_id = (SELECT get_current_shop_id()));
ALTER POLICY "Reminder logs isolated by shop" ON public.reminder_logs USING (shop_id = (SELECT get_current_shop_id()));
ALTER POLICY "Settings readable by shop members" ON public.settings USING (shop_id = (SELECT get_current_shop_id()));
ALTER POLICY "Settings writable by shop manager" ON public.settings
    USING (shop_id = (SELECT get_current_shop_id()) AND (SELECT is_shop_manager()))
    WITH CHECK (shop_id = (SELECT get_current_shop_id()) AND (SELECT is_shop_manager()));
ALTER POLICY "Shipment items readable by shop members" ON public.shipment_items USING (shop_id = (SELECT get_current_shop_id()));
ALTER POLICY "Shipments readable by shop members" ON public.shipments USING (shop_id = (SELECT get_current_shop_id()));
ALTER POLICY "Message reads readable by their shop" ON public.shop_message_reads USING (shop_id = (SELECT get_current_shop_id()));
ALTER POLICY "Messages readable by their shop" ON public.shop_messages USING (shop_id IS NULL OR shop_id = (SELECT get_current_shop_id()));
ALTER POLICY "Stock movements isolated by shop" ON public.stock_movements USING (shop_id = (SELECT get_current_shop_id()));
ALTER POLICY "Subscription history readable by shop members" ON public.subscription_events USING (shop_id = (SELECT get_current_shop_id()));
ALTER POLICY "Subscription readable by shop members" ON public.subscriptions USING (shop_id = (SELECT get_current_shop_id()));
ALTER POLICY "Suppliers created by shop members" ON public.suppliers WITH CHECK (shop_id = (SELECT get_current_shop_id()));
ALTER POLICY "Suppliers readable by shop members" ON public.suppliers USING (shop_id = (SELECT get_current_shop_id()));
ALTER POLICY "Suppliers updated by shop members" ON public.suppliers
    USING (shop_id = (SELECT get_current_shop_id()))
    WITH CHECK (shop_id = (SELECT get_current_shop_id()));
