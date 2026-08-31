-- Migration: 00004_invoice_numbering_and_tax_fields.sql
-- Ajoute la numérotation séquentielle des factures et les mentions légales
-- fiscales optionnelles (NIU, RCCM, TVA) reprises depuis le profil boutique.

-- 1. Mentions légales et compteur de facturation sur le profil boutique
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS tax_id TEXT,
  ADD COLUMN IF NOT EXISTS trade_register TEXT,
  ADD COLUMN IF NOT EXISTS vat_registered BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS vat_rate_bps INTEGER NOT NULL DEFAULT 1925,
  ADD COLUMN IF NOT EXISTS next_invoice_number INTEGER NOT NULL DEFAULT 1;

-- 2. Numéro de facture lisible, assigné une seule fois par record_sale
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_number TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_shop_invoice_number_key
  ON public.invoices (shop_id, invoice_number);
