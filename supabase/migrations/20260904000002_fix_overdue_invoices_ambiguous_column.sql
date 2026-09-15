-- Migration: 00014_fix_overdue_invoices_ambiguous_column.sql
-- Bug critique : dans get_overdue_invoices_for_reminders, la sous-requête
-- LATERAL référence "invoice_id" sans le qualifier, ce qui est ambigu entre
-- la colonne reminder_logs.invoice_id et le paramètre de sortie "invoice_id"
-- déclaré dans RETURNS TABLE. Résultat : la fonction levait TOUJOURS une
-- erreur 42702, silencieusement avalée côté application, qui affichait donc
-- "aucune facture en retard" quel que soit l'état réel des factures.

CREATE OR REPLACE FUNCTION get_overdue_invoices_for_reminders(_shop_id UUID)
RETURNS TABLE (
    invoice_id UUID,
    invoice_number TEXT,
    client_id UUID,
    client_name TEXT,
    client_phone TEXT,
    total_amount INTEGER,
    paid_amount INTEGER,
    created_at TIMESTAMPTZ,
    days_overdue INTEGER,
    last_reminder_at TIMESTAMPTZ,
    reminder_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _first_delay INTEGER;
    _recurring_delay INTEGER;
BEGIN
    IF _shop_id != get_current_shop_id() THEN
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
