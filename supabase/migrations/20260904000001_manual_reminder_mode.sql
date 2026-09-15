-- Migration: 00013_manual_reminder_mode.sql
-- Mode de relance "manuel" en attendant que les identifiants WhatsApp Cloud
-- API réels soient configurés pour une boutique : au lieu d'un envoi
-- automatique via l'API Meta, on ouvre un lien wa.me pré-rempli que la
-- gérante ou une vendeuse envoie elle-même depuis son propre WhatsApp.
-- Distinct de 'SIMULATED' (rien n'est produit) : ici un message réel est
-- prêt à être envoyé par une personne.

ALTER TYPE reminder_status ADD VALUE IF NOT EXISTS 'MANUAL';
