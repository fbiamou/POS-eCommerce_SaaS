-- Migration: hide_whatsapp_token
-- À appliquer APRÈS la mise en ligne du code qui lit les réglages colonne par
-- colonne (features/settings/queries.ts) : l'ancien code faisait
-- `select('*')` sur `settings` et échouerait sans la colonne du jeton.
--
-- Le jeton d'accès WhatsApp Business permet d'envoyer des messages au nom de
-- la boutique. Aucun compte de la boutique n'a besoin de le lire : le
-- Propriétaire peut le remplacer (écriture), et seul le code serveur l'utilise
-- pour envoyer une relance, avec la clé service_role
-- (features/reminders/credentials.ts, api/cron/reminders).
-- `whatsapp_token_set` indique s'il est configuré sans l'exposer.

REVOKE SELECT ON public.settings FROM anon, authenticated;

GRANT SELECT (
    id, shop_id, reminder_first_delay_days, reminder_recurring_delay_days,
    created_at, updated_at, shop_name, shop_phone, shop_address, shop_email,
    shop_logo_url, currency_code, currency_symbol, theme_accent_color, theme_font,
    tax_id, trade_register, vat_registered, vat_rate_bps, next_invoice_number,
    whatsapp_phone_number_id, whatsapp_template_name, whatsapp_token_set,
    shop_slug, default_phone_country_code, low_stock_threshold, timezone
) ON public.settings TO authenticated;
