-- Migration: 00008_whatsapp_credentials.sql
-- Identifiants WhatsApp Cloud API par boutique (SaaS multi-tenant : chaque
-- boutique connecte son propre compte WhatsApp Business, pas une variable
-- d'environnement globale).

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_api_token TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_template_name TEXT;
