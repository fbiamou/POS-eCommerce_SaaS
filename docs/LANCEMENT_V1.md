# Lancement officiel de la V1 — compte rendu du 5 octobre 2026

## En bref

L'application est prête. Il reste **4 points bloquants hors application** avant d'ouvrir la campagne : les e-mails d'inscription, le NIF dans les mentions légales, la licence d'autónomo, et la mise en ligne des conditions version 2 avec la fin du « noindex ». Ensuite, il faut faire les tests de bout en bout sur la vraie adresse.

Côté argent, avec environ **145 000 FCFA de frais par mois**, une vingtaine de boutiques payantes suffisent à couvrir les frais. Il faut garder **1,2 à 1,4 million de FCFA** de côté pour passer les premiers mois (dépôt de la marque compris).

## 1. Documents juridiques (fait le 5/10/2026)

Les conditions d'utilisation, la politique de confidentialité et les **nouvelles mentions légales** sont passées en **version 2**, en français et en espagnol (`public/legal/conditions.html`, `public/legal/condiciones.html`). Les nouveaux comptes enregistrent la version `2026-10-05-v2`.

**Verdict : conforme après corrections.** Seul le NIF reste à compléter. Les corrections faites :

| Gravité | Correction |
|---|---|
| Bloquant | Mention « version provisoire » retirée ; mentions légales ajoutées (éditeur, NIF, responsable, hébergeurs, prix, statut de non-établissement de paiement). |
| Bloquant | Le texte promettait une fermeture de compte « depuis les réglages », qui n'existe pas. Elle se fait désormais sur demande par e-mail ou WhatsApp. |
| Important | Plafond de responsabilité : 3 mois devient **12 mois** de paiements, avec exclusion des dommages indirects et réserve de la faute lourde. Un plafond trop bas risque d'être écarté par un juge. |
| Important | Mode hors connexion et codes de caisse décrits : copie des données sur l'appareil, protection de l'appareil, blocage après 5 codes faux, ventes perdues avec un appareil perdu. |
| Important | Taxes : prix TTC, TVA indiquée sur la facture quand elle s'applique. Prix nets de retenue à la source, majorés si un pays impose une retenue. |
| Important | Pas de droit de rétractation (clients professionnels) ; la formule gratuite sert d'essai. |
| Important | Vitrine : la boutique respecte les règles de vente à distance de son pays (15 jours de rétractation au Cameroun). |
| Important | Faille de sécurité : information « sans délai » de la boutique et des autorités (loi camerounaise). |
| Important | Version espagnole qui fait foi en cas de différence. |
| Amélioration | Lois citées sans numéro d'article quand le texte officiel n'a pas pu être lu. Deux lois au numéro incertain retirées. |
| Amélioration | Confidentialité : codes de caisse, téléphone des commandes de vitrine (anti-fausses commandes), e-mails envoyés par Supabase, cookies strictement nécessaires (pas de bandeau de consentement à afficher), autorité camerounaise. |

## 2. Bloquant avant le lancement

1. **E-mails d'inscription.** Le service gratuit de Supabase est limité à environ 2 e-mails par heure, et seulement vers l'équipe. Vérifier Supabase › Authentication › Emails › SMTP Settings. S'il n'y a pas de SMTP personnalisé : nom de domaine + Resend (gratuit jusqu'à 3 000 e-mails par mois).
2. **NIF** de Williams Informatic à me donner. Je le place dans les mentions légales fr/es.
3. **Licence d'autónomo** : vérifier à la Ventanilla Única qu'elle couvre « servicios informáticos / venta de software en línea ». Sinon, ajouter l'activité.
4. **Mise en ligne** à ton feu vert : conditions version 2 et fin du « noindex » de la page d'accueil (`public/landing/index.html` et `next.config.ts`).
5. **Tests de bout en bout** sur la vraie adresse, avec un nouveau compte :
   - inscription, puis e-mail reçu ;
   - mot de passe oublié depuis un autre appareil ;
   - import CSV ;
   - vente au comptant et ticket ;
   - vente à crédit, puis encaissement ;
   - facture PDF ;
   - vente hors connexion, puis synchronisation sans doublon ;
   - employé avec code de caisse ;
   - formule offerte depuis la console, puis vitrine et commande en ligne ;
   - les 3 langues.

## 3. Décisions fiscales et juridiques

- **Boutiques du Cameroun.** Un abonnement payant vendu depuis la Guinée équatoriale à une boutique camerounaise oblige en principe à s'immatriculer à la TVA camerounaise (19,25 %). Un transfert de données hors du Cameroun demande aussi une autorisation de l'autorité de protection des données (APDP). **Recommandation :** à l'ouverture, formules payantes pour la Guinée équatoriale seulement ; les boutiques camerounaises restent en Standard gratuit jusqu'à la SARLU camerounaise prévue par la feuille de route.
- **TVA en Guinée équatoriale (15 %)** : on ne sait pas encore si l'autónomo y est assujetti, ni à partir de quel seuil. Le prévisionnel la compte par prudence. Si elle ne s'applique pas, la marge est meilleure d'environ 15 %.
- **Encaissements** : chaque paiement de formule doit avoir sa facture (déjà dans la console) et une preuve (reçu Muni Dinero, virement). Exporter chaque mois l'historique des paiements de la console : c'est le livre de recettes.
- **Marque WISHOP** : faire la recherche d'antériorité OAPI, à cause de la proximité avec « Wish », avant le dépôt. Compter environ 900 000 FCFA avec mandataire, ce qui est prévu dans le prévisionnel. À faire avant de dépenser fort en publicité.
- **Données personnelles en Guinée équatoriale** : déclarer les fichiers au registre de la loi 1/2016 si l'organe de contrôle fonctionne (à vérifier).

## 4. Engagements des conditions à construire (pas bloquants le jour 1)

| Engagement | État | Échéance réelle |
|---|---|---|
| Archivage du compte 30 jours après un impayé | À faire à la main (pause depuis la console) | Dès le premier impayé |
| Suppression 180 jours après un impayé | Impossible aujourd'hui pour une boutique qui a payé | À construire avant avril 2027 |
| Suppression d'un compte gratuit inactif depuis 12 mois, avec préavis | À construire | Avant octobre 2027 |
| Journaux techniques gardés 90 jours au plus | Réglages des hébergeurs à vérifier | Avant le lancement si possible |

## 5. Prévisionnel (3 ans)

Fichier : `docs/finance/WISHOP_previsionnel_2026-10.xlsx` (scénario central, formules modifiables). Les hypothèses sont dans `docs/finance/hypotheses_previsionnel.json`. Chiffres recalculés par Excel le 5/10/2026.

**Hypothèses que j'ai posées (à remplacer par tes vrais chiffres)** :
- boutiques payantes gagnées et croissance par mois ;
- part des boutiques qui quittent chaque mois ;
- mélange des formules : 60 % Essentiel, 30 % Pro, 10 % Pro Plus ;
- frais par mois :
  - hébergement Pro : 30 000 FCFA ;
  - publicité : 60 000 FCFA, plus 5 000 FCFA par boutique gagnée ;
  - outils : 30 000 FCFA ;
  - divers : 25 000 FCFA ;
- apport : 1 000 000 FCFA ;
- TVA de 15 % comprise dans les prix ;
- prix de lancement, avec une hausse moyenne de 20 % par an quand le prix normal remplace le prix de lancement ;
- aucun salaire la première année.

| | Prudent | Central | Ambitieux |
|---|---|---|---|
| Nouvelles boutiques payantes / mois au départ | 3 | 5 | 8 |
| Croissance mensuelle des nouvelles boutiques | 3 % | 5 % | 7 % |
| Boutiques perdues / mois | 7 % | 5 % | 4 % |
| Boutiques payantes fin an 1 / an 2 / an 3 | 30 / 56 / 85 | 63 / 147 / 282 | 119 / 342 / 814 |
| CA hors taxes an 1 / an 2 / an 3 (FCFA) | 1,7 M / 5,1 M / 9,9 M | 3,2 M / 12,2 M / 29,7 M | 5,8 M / 26,3 M / 78,8 M |
| Résultat net an 1 / an 2 / an 3 (FCFA) | −0,44 M / 1,1 M / 3,3 M | 0,68 M / 5,9 M / 17,2 M | 2,3 M / 15,5 M / 51,6 M |
| Premier mois rentable | mois 8 | mois 5 | mois 3 |
| Point le plus bas de la trésorerie (apport de 1 M compris) | −0,39 M (mois 7) | −0,17 M (mois 4) | −0,06 M (mois 2) |
| Somme à prévoir au départ | ≈ 1,4 M FCFA | ≈ 1,2 M FCFA | ≈ 1,1 M FCFA |

À retenir :
- environ 20 boutiques payantes couvrent les frais fixes ;
- sans le dépôt de marque (900 000 FCFA), le besoin de départ tombe sous 0,5 M FCFA ;
- le marché équato-guinéen est petit, donc le scénario ambitieux suppose de vendre aussi hors du pays, ce qui ramène à la question camerounaise.
