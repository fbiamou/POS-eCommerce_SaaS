-- Migration: 00015_employee_page_access.sql
-- Permet au gérant de restreindre les pages accessibles à un employé
-- (ex. un(e) caissier(e) qui ne doit voir que Ventes/Factures/Commandes).
--
-- Un tableau vide signifie "non restreint" (accès à tout, comme avant cette
-- migration) — c'est le défaut, pour ne jamais bloquer silencieusement un
-- compte existant. La restriction ne s'applique que si le gérant configure
-- explicitement un ensemble de pages pour un employé donné. Les MANAGER
-- gardent toujours un accès complet, quel que soit ce champ.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS allowed_pages TEXT[] NOT NULL DEFAULT '{}';
