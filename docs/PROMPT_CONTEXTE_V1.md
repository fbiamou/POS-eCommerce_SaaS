## Contexte métier

Je développe la V1 d'une application de gestion pour une boutique de cosmétiques, perruques et prêt-à-porter féminin. La gérante travaille aujourd'hui sur papier/carnet et n'a aucune visibilité fiable sur son stock, ses ventes ou les impayés de ses clientes.

## Objectif de la V1

Construire une application web (PWA, mobile-first, en français, montants en Franc CFA / XAF) couvrant trois blocs fonctionnels, dans cet ordre de priorité.

### 1. Stock, ventes et facturation
- Fiche article : nom, catégorie, quantité en stock, prix d'achat, prix de vente, fournisseur, pays d'origine.
- Enregistrement d'une vente : sélection d'article(s), quantité, prix de vente appliqué, client (optionnel), génération d'une facture simple.
- Mise à jour automatique du stock à chaque vente (jamais de modification manuelle du stock en parallèle d'une vente).
- Tableau de bord : chiffre d'affaires du jour, articles les plus vendus (période paramétrable : jour / semaine / mois).

### 2. Clients et gestion des dettes
- Fiche client : nom, téléphone (format WhatsApp), historique d'achats.
- Détection des clientes récurrentes (ex. plus de N achats sur une période) et de leurs articles préférés, déduite de l'historique des ventes — pas de saisie manuelle de « préférence ».
- Suivi des factures partiellement ou totalement impayées, avec solde dû par client.
- Vue globale des impayés, triable par ancienneté ou par montant.

### 3. Relances automatiques par WhatsApp
- Détection quotidienne des factures impayées dépassant un délai configurable (ex. 7 jours).
- Envoi d'un message de relance via l'API officielle WhatsApp Cloud, avec un template pré-approuvé (le nom exact du template sera fourni séparément une fois validé par Meta — ne pas en inventer un en attendant).
- Un même client ne doit pas recevoir plusieurs relances pour la même facture dans un intervalle rapproché (journaliser les envois).

## Hors périmètre pour cette V1 (ne pas implémenter)
- Chatbot de réponse automatique WhatsApp généraliste.
- Publication automatique sur le Statut WhatsApp ou dans des groupes.
- Vente en ligne, catalogue public, livraison.
- Interface de gestion multi-boutique opérationnelle (le schéma de données doit néanmoins prévoir une colonne `shop_id` sur toutes les tables métier, conformément à `AGENTS.md`).

## Rôles utilisateurs
- **Gérante** : accès complet (stock, ventes, clients, factures, statistiques, relances).
- **Vendeuse** : peut enregistrer une vente et consulter le stock ; pas d'accès aux statistiques financières ni aux réglages.

## Ce que j'attends de toi pour démarrer
1. Propose un schéma de base de données (tables, colonnes, relations) respectant les conventions de `AGENTS.md`, et présente-le avant de générer les migrations.
2. Découpe le travail en tâches courtes et vérifiables (une table métier à la fois, puis un écran à la fois) — pas un gros commit monolithique.
3. Pose-moi des questions dès qu'une règle métier n'est pas claire (ex. seuil exact de « client récurrent », délai avant relance) plutôt que de choisir arbitrairement.
4. Construis d'abord le squelette fonctionnel (données + logique + écrans minimalistes, sans habillage visuel) ; le design UI/UX avancé et la landing page du futur site e-commerce viendront dans une étape séparée, une fois cette base validée — ne pas les traiter maintenant.