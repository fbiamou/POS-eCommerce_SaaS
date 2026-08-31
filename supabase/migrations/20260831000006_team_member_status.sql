-- Migration: 00009_team_member_status.sql
-- Statut actif/suspendu affiché pour chaque membre de l'équipe. La donnée
-- d'application faisant réellement autorité pour bloquer la connexion est
-- le bannissement Supabase Auth (ban_duration) posé par les actions
-- suspend/reactivate ; cette colonne n'est qu'un miroir pour l'affichage
-- dans la liste, afin d'éviter un appel à l'API admin à chaque chargement
-- de la page Équipe.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
