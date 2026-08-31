# Stack technique — V1

## Vue d'ensemble

| Couche | Choix | Pourquoi |
|---|---|---|
| Frontend | Next.js 14+ (App Router), TypeScript, Tailwind CSS | Écosystème mature, bon support PWA, s'intègre nativement avec Supabase |
| Backend / BDD | Supabase (Postgres managé + Auth + Storage + Edge Functions) | Réduit fortement le travail DevOps pour un développeur solo ; RLS natif prépare le multi-tenant futur |
| Hébergement frontend | Vercel (offre gratuite au démarrage) | Déploiement automatique depuis GitHub, gratuit à ce volume de trafic |
| Hébergement backend | Supabase Cloud (offre gratuite puis ~25$/mois) | Pas de serveur à gérer soi-même |
| Messagerie automatisée | Meta WhatsApp Cloud API (officielle) | Accès à l'API gratuit, facturation au message hors fenêtre de 24h ; seule voie conforme aux conditions WhatsApp pour les relances |
| Authentification | Supabase Auth (email + mot de passe) | Rôles gérante / vendeuse gérés via une table `profiles` liée à `auth.users` |

## Architecture des données

- Base Postgres unique, schéma prêt pour le multi-tenant (colonne `shop_id` sur toutes les tables métier) mais exploité en mono-boutique pour la V1.
- RLS (Row Level Security) activée dès la première migration : chaque requête est filtrée par `shop_id`, ce qui évite de réécrire la sécurité si une deuxième boutique est ajoutée plus tard.
- Migrations gérées via la CLI Supabase, versionnées dans `/supabase/migrations` du dépôt Git — jamais de modification manuelle du schéma en production.

## Intégration WhatsApp (relances)

- Nécessite un compte WhatsApp Business (WABA) vérifié auprès de Meta et un ou plusieurs templates de message approuvés (catégorie « utility », ex. rappel de facture) — à faire valider avant de développer cette brique ; le délai d'approbation peut prendre plusieurs jours.
- Déclenchement : une tâche planifiée (Supabase Edge Function + cron, ou pg_cron) scanne quotidiennement les factures en retard et envoie le template approprié via l'API Cloud.
- Un journal des relances envoyées (table `reminder_log`) évite les doublons et les envois trop fréquents au même client.
- Coût : gratuit pour l'accès à l'API ; quelques centimes par message envoyé (catégorie utility), variable selon le pays du destinataire — vérifier le tarif à jour dans la documentation Meta au moment de l'implémentation.

## PWA / usage mobile

- Application installable sur le téléphone de la gérante et des vendeuses (icône, plein écran) via un manifest PWA.
- Pas de mode hors-ligne complet en V1 (les écritures nécessitent une connexion à Supabase) — à évaluer pour une version ultérieure si la connectivité sur site est instable.

## Explicitement hors périmètre en V1

- Chatbot de réponse automatique générique sur WhatsApp.
- Publication automatisée sur le Statut WhatsApp ou dans des groupes (non supporté par l'API officielle, risque de bannissement).
- Vente en ligne / catalogue public / livraison.
- Interface de gestion multi-boutique (l'architecture le permet via `shop_id`, mais l'UI correspondante n'est pas construite en V1).

## Pistes pour Antigravity

- Si un serveur MCP Supabase est disponible dans Antigravity, le connecter permet à l'agent de créer/modifier les migrations directement plutôt que de générer du SQL à copier-coller.
- Utiliser le préset d'autonomie « Review-driven development » plutôt que « Agent-driven » : les changements touchant au schéma de données ou à la logique de calcul financier doivent rester supervisés.