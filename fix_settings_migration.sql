-- ============================================================
-- Migration: Enrichissement de la table settings
-- Profil boutique + Personnalisation UI + Storage bucket
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- 1. Ajouter les colonnes au profil boutique
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS shop_name TEXT,
  ADD COLUMN IF NOT EXISTS shop_phone TEXT,
  ADD COLUMN IF NOT EXISTS shop_address TEXT,
  ADD COLUMN IF NOT EXISTS shop_email TEXT,
  ADD COLUMN IF NOT EXISTS shop_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'XAF',
  ADD COLUMN IF NOT EXISTS currency_symbol TEXT NOT NULL DEFAULT 'FCFA';

-- 2. Ajouter les colonnes de personnalisation de l'interface
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS theme_accent_color TEXT NOT NULL DEFAULT '#7c3aed',
  ADD COLUMN IF NOT EXISTS theme_font TEXT NOT NULL DEFAULT 'Geist';

-- 3. Créer le bucket de stockage pour les logos/assets de boutique
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-assets', 'shop-assets', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Politique RLS pour le bucket storage
-- Lecture publique (pour afficher les logos sur les factures)
CREATE POLICY "Public read shop-assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'shop-assets');

-- Écriture/suppression uniquement par les membres de la boutique connectés
CREATE POLICY "Shop members can upload assets" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'shop-assets'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Shop members can update assets" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'shop-assets'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Shop members can delete assets" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'shop-assets'
    AND auth.role() = 'authenticated'
  );

-- 5. Mettre à jour le trigger pour initialiser les nouvelles colonnes lors de l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    new_shop_id UUID;
    user_name TEXT;
BEGIN
    new_shop_id := gen_random_uuid();

    IF new.raw_user_meta_data IS NOT NULL AND new.raw_user_meta_data ? 'full_name' THEN
        user_name := new.raw_user_meta_data->>'full_name';
    ELSE
        user_name := new.email;
    END IF;

    INSERT INTO public.profiles (id, shop_id, role, full_name)
    VALUES (new.id, new_shop_id, 'MANAGER', user_name);

    INSERT INTO public.settings (
      id, shop_id,
      shop_name,
      currency_code, currency_symbol,
      theme_accent_color, theme_font
    )
    VALUES (
      gen_random_uuid(), new_shop_id,
      'Ma Boutique',
      'XAF', 'FCFA',
      '#7c3aed', 'Geist'
    );

    RETURN new;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
