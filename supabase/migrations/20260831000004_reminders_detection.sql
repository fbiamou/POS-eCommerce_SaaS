-- Migration: 00007_reminders_detection.sql
-- Détection des factures en retard + journalisation centralisée des relances.
-- Tant qu'aucun template WhatsApp approuvé par Meta n'est fourni, tous les
-- envois restent en mode simulation (statut 'SIMULATED', jamais 'SENT').

-- Nouveau statut pour distinguer un envoi simulé d'un envoi réel
ALTER TYPE reminder_status ADD VALUE IF NOT EXISTS 'SIMULATED';

-- Détecte les factures impayées/partiellement payées éligibles à une relance,
-- selon les délais configurés par la boutique (reminder_first_delay_days /
-- reminder_recurring_delay_days) et la dernière relance déjà journalisée.
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
        WHERE invoice_id = i.id
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

-- Enregistre une tentative de relance (simulée ou réelle) de façon
-- centralisée, pour garder un historique cohérent (cf. AGENTS.md).
CREATE OR REPLACE FUNCTION log_reminder(
    _shop_id UUID,
    _client_id UUID,
    _invoice_id UUID,
    _template_name TEXT,
    _status reminder_status
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _log_id UUID;
BEGIN
    IF _shop_id != get_current_shop_id() THEN
        RAISE EXCEPTION 'Unauthorized shop access';
    END IF;

    INSERT INTO reminder_logs (shop_id, client_id, invoice_id, template_name, status)
    VALUES (_shop_id, _client_id, _invoice_id, _template_name, _status)
    RETURNING id INTO _log_id;

    RETURN _log_id;
END;
$$;
