# AGENTS.md — Règles du projet

## Contexte
Application de gestion pour une boutique de cosmétiques, perruques et prêt-à-porter féminin. Utilisatrice principale : la gérante, non technique. Voir `docs/PROMPT_CONTEXTE_V1.md` pour le brief fonctionnel complet et `docs/STACK_TECHNIQUE.md` pour l'architecture détaillée.

## Stack (résumé — détails dans docs/STACK_TECHNIQUE.md)
- Frontend : Next.js (App Router) + TypeScript + Tailwind CSS, en PWA.
- Backend / BDD : Supabase (Postgres + Auth + Storage + Edge Functions).
- Devise affichée : Franc CFA (XAF). Pas de paiement en ligne en V1.
- Langue de l'interface : français.
- Messagerie automatisée : API officielle WhatsApp Cloud (Meta) uniquement.

## Standards de code
- TypeScript en mode strict partout. Pas de `any` sans commentaire justifiant pourquoi.
- Code (variables, fonctions, tables BDD) en anglais ; tous les textes visibles par l'utilisatrice en français, centralisés dans un fichier de traduction — jamais de texte en dur dans les composants.
- Organisation par fonctionnalité (`/features/stock`, `/features/ventes`, `/features/clients`, `/features/relances`), pas par type de fichier.
- Montants monétaires toujours stockés en entier (unité XAF), jamais en float.
- UI mobile-first : la gérante et les vendeuses travaillent principalement depuis un téléphone.

## Conventions de données
- Chaque table métier (products, sales, invoices, clients, reminders...) contient une colonne `shop_id`, même si une seule boutique existe en V1. Ne jamais l'omettre : c'est ce qui permet de revendre la plateforme à d'autres boutiques sans tout réécrire.
- Suppression logique uniquement (`deleted_at` / `is_active`) sur les tables stock, ventes, clients. Jamais de `DELETE` définitif sur des données commerciales.
- Toute écriture affectant le stock ou une facture passe par une fonction/RPC centralisée (pas de mise à jour directe de quantité depuis plusieurs endroits du code), pour garder un historique cohérent.
- Row Level Security (RLS) activée sur toutes les tables dès la première migration, même en mono-boutique.

## Règles d'interdiction
- Ne jamais committer de secret (`.env`, clé `service_role` Supabase, token WhatsApp) dans le dépôt Git.
- La clé `service_role` Supabase ne doit jamais apparaître côté client — uniquement dans les Edge Functions / code serveur.
- Ne jamais modifier ou supprimer une migration déjà appliquée sans confirmation explicite de l'utilisateur.
- Ne jamais envoyer de message WhatsApp réel pendant le développement ou les tests — utiliser un numéro de test dédié ou un mode `dry-run` qui logue le message au lieu de l'envoyer.
- Ne jamais implémenter d'automatisation de Statut WhatsApp ou de publication dans des groupes : non couvert par l'API officielle, hors périmètre du projet (risque de bannissement du numéro professionnel). Si demandé plus tard, le signaler avant d'implémenter quoi que ce soit.
- Les templates de message WhatsApp utilisés dans le code doivent correspondre à des templates réellement approuvés par Meta (nom exact) — ne jamais en inventer un.

## Manière de travailler
- Prioriser le squelette fonctionnel (modèle de données, logique métier, routes) avant tout travail de design UI/UX. Les écrans peuvent rester non stylés (HTML/Tailwind minimal) tant que la mécanique n'est pas validée. Le design visuel avancé et la landing page du futur site e-commerce interviennent dans une phase séparée, une fois le squelette validé — ne pas y consacrer de temps avant ça.
- Avant d'implémenter une fonctionnalité, relire le brief correspondant dans `docs/PROMPT_CONTEXTE_V1.md`.
- Travailler en petits incréments revus (préset « Review-driven development ») plutôt qu'en autonomie totale : ce projet touche des données financières (factures, dettes), les changements de schéma et la logique de calcul doivent être validés avant merge.
- Pour toute ambiguïté fonctionnelle (ex. calcul d'une statistique, champ obligatoire), poser la question plutôt que de supposer.
- Écrire des tests pour toute logique de calcul (quantités en stock, soldes de dettes, détection de factures en retard).