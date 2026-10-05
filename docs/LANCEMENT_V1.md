# Lancement officiel de la V1 — compte rendu du 5 octobre 2026

## En bref

La V1 est lancée le 5 octobre 2026, avec le feu vert du fondateur :
- conditions version 2 en ligne ;
- page d'accueil ouverte à Google ;
- prix sans TVA, puisqu'un autónomo n'est pas assujetti.

Il reste à faire :
- les tests de bout en bout sur la vraie adresse (par le fondateur) ;
- l'ajout de l'activité logicielle à la licence d'autónomo.

Côté argent :
- environ **145 000 FCFA de frais par mois** ;
- une vingtaine de boutiques payantes couvrent ces frais ;
- garder **1,1 à 1,3 million de FCFA** de côté pour les premiers mois, dont 0,9 M pour le dépôt de la marque.

## 1. Documents juridiques (version 2, 5/10/2026)

Les conditions d'utilisation, la politique de confidentialité et les mentions légales existent en français et en espagnol (`public/legal/conditions.html`, `public/legal/condiciones.html`). Les nouveaux comptes enregistrent la version `2026-10-05-v2`.

**Verdict : conforme.**
- Éditeur : Williams Informatic, autónomo à Malabo, NIF AA342453FW-26/BN.
- Prix en FCFA **sans TVA** (non assujetti).
- Prix dus nets de toute retenue à la source.
- Si WISHOP devient assujetti à la TVA, le changement de prix est annoncé 30 jours à l'avance.

| Gravité | Correction |
|---|---|
| Bloquant | Mention « version provisoire » retirée ; mentions légales ajoutées : éditeur, NIF, responsable, hébergeurs, prix, et WISHOP n'est pas un établissement de paiement. |
| Bloquant | La fermeture du compte se fait sur demande (e-mail ou WhatsApp), et non plus « depuis les réglages », qui n'existe pas. |
| Bloquant | Prix « toutes taxes comprises » remplacés par « sans TVA », car un autónomo ne peut pas collecter de TVA. Corrigé aussi sur la page d'accueil, dans les 3 langues. |
| Important | Plafond de responsabilité porté à 12 mois de paiements, sans les dommages indirects, sauf faute lourde. |
| Important | Mode hors connexion et codes de caisse décrits ; pas de rétractation entre professionnels ; règles de vente à distance de la vitrine ; faille de sécurité signalée sans délai ; la version espagnole fait foi. |
| Amélioration | Lois citées sans numéro d'article non vérifié ; confidentialité complétée (codes de caisse, anti-fausses commandes, e-mails, cookies strictement nécessaires). |

## 2. Encore à faire

1. **Tests de bout en bout** sur la vraie adresse, avec un nouveau compte :
   - inscription, e-mail reçu ;
   - mot de passe oublié depuis un autre appareil ;
   - import CSV ;
   - vente au comptant et ticket ;
   - vente à crédit, puis encaissement ;
   - facture PDF ;
   - vente hors connexion, puis synchronisation sans doublon ;
   - employé avec code de caisse ;
   - formule offerte depuis la console, vitrine et commande en ligne ;
   - les 3 langues.
2. **Licence d'autónomo** : faire ajouter « servicios informáticos / venta de software en línea » à la Ventanilla Única **avant le premier paiement encaissé**. Encaisser une activité non déclarée expose à un redressement, et les factures doivent correspondre à l'activité déclarée.
3. **E-mails** : le SMTP passe par Gmail (wishop.app.contact@gmail.com). Gmail envoie environ 500 e-mails par jour, ce qui suffit au lancement. Passer au nom de domaine et à Resend quand les inscriptions dépassent environ 100 par jour, ou si les e-mails arrivent dans les indésirables.
4. **Factures d'abonnement** : la console enregistre les paiements, mais **ne produit pas encore de facture**. En attendant :
   - remettre une facture faite à la main, avec la mention « TVA non applicable — autónomo non assujetti » et le NIF ;
   - construire ensuite une facture PDF d'abonnement dans la console.
5. **Hébergeurs en formule payante** : Vercel interdit l'usage commercial en formule gratuite, et Supabase gratuit n'a pas de sauvegarde restaurable. Passer en Pro dès les premiers paiements (environ 45 $ par mois, compté dans le prévisionnel).

## 3. Décisions fiscales et juridiques

- **Boutiques du Cameroun.** Vendre un abonnement payant depuis la Guinée équatoriale à une boutique camerounaise oblige en principe à s'immatriculer à la TVA camerounaise (19,25 %). Le transfert de leurs données hors du Cameroun demande aussi une autorisation de l'APDP. **Recommandation :** formules payantes en Guinée équatoriale seulement ; boutiques camerounaises en Standard gratuit jusqu'à la SARLU camerounaise.
- **Livre de recettes** : chaque paiement a sa facture et sa preuve (reçu Muni Dinero, virement). Exporter chaque mois l'historique des paiements de la console.
- **Seuil du régime simplifié (REAM, environ 30 M FCFA de recettes par an)** : le scénario central le dépasse en année 3. C'est le moment prévu pour la société (feuille de route du 5/10/2026).
- **Marque WISHOP** : faire la recherche d'antériorité OAPI (proximité avec « Wish »), puis le dépôt. Environ 900 000 FCFA avec mandataire. À faire avant de forcer sur la publicité.
- **Données personnelles en Guinée équatoriale** : déclarer les fichiers au registre de la loi 1/2016 si l'organe de contrôle fonctionne (à vérifier).

## 4. Engagements des conditions à construire

| Engagement | État | Échéance réelle |
|---|---|---|
| Facture pour chaque paiement d'abonnement | À la main pour l'instant | Dès le premier paiement |
| Archivage du compte 30 jours après un impayé | À la main (pause depuis la console) | Dès le premier impayé |
| Suppression 180 jours après un impayé | Impossible aujourd'hui pour une boutique qui a payé | À construire avant avril 2027 |
| Suppression d'un compte gratuit inactif depuis 12 mois, avec préavis | À construire | Avant octobre 2027 |

## 5. Prévisionnel sur 3 ans (sans TVA)

Fichier : `docs/finance/WISHOP_previsionnel_2026-10.xlsx` (scénario central, formules modifiables). Les hypothèses sont dans `docs/finance/hypotheses_previsionnel.json`. Chiffres recalculés par Excel le 5/10/2026.

**Hypothèses posées par l'agent, à remplacer par les vrais chiffres** :
- rythme de nouvelles boutiques payantes et part des boutiques qui partent ;
- mélange des formules : 60 % Essentiel, 30 % Pro, 10 % Pro Plus ;
- frais mensuels :
  - hébergement Pro : 30 000 FCFA ;
  - publicité : 60 000 FCFA, plus 5 000 FCFA par boutique gagnée ;
  - outils : 30 000 FCFA ;
  - divers : 25 000 FCFA ;
- apport : 1 000 000 FCFA ;
- prix de lancement, avec une hausse moyenne de 20 % par an quand le prix normal remplace le prix de lancement ;
- aucun salaire la première année ;
- impôt sur le bénéfice à 25 %, avec un minimum de 1,5 % du chiffre d'affaires (règle des sociétés, prise par prudence).

| | Prudent | Central | Ambitieux |
|---|---|---|---|
| Nouvelles boutiques payantes / mois au départ | 3 | 5 | 8 |
| Croissance mensuelle des nouvelles boutiques | 3 % | 5 % | 7 % |
| Boutiques perdues / mois | 7 % | 5 % | 4 % |
| Boutiques payantes fin an 1 / an 2 / an 3 | 30 / 56 / 85 | 63 / 147 / 282 | 119 / 342 / 814 |
| Chiffre d'affaires an 1 / an 2 / an 3 (FCFA) | 1,9 M / 5,9 M / 11,3 M | 3,7 M / 14,0 M / 34,2 M | 6,6 M / 30,2 M / 90,7 M |
| Résultat net an 1 / an 2 / an 3 (FCFA) | −0,20 M / 1,6 M / 4,4 M | 1,0 M / 7,3 M / 20,6 M | 3,0 M / 18,5 M / 60,4 M |
| Premier mois rentable | mois 7 | mois 4 | mois 3 |
| Point le plus bas de la trésorerie (apport de 1 M compris) | −0,33 M (mois 6) | −0,14 M (mois 3) | −0,05 M (mois 2) |
| Somme à prévoir au départ | ≈ 1,3 M FCFA | ≈ 1,15 M FCFA | ≈ 1,05 M FCFA |

À retenir :
- une vingtaine de boutiques payantes couvrent les frais fixes ;
- sans le dépôt de marque, le besoin de départ tombe sous 0,45 M FCFA ;
- le marché équato-guinéen est petit, donc le scénario ambitieux suppose de vendre hors du pays, ce qui ramène à la question camerounaise.
