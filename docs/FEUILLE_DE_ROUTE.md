# Feuille de route WISHOP (cahier des charges des versions)

Document vivant : ce qui est décidé pour les prochaines versions, pour le garder en tête à mesure qu'on avance. Mis à jour le 25/09/2026.

## Aujourd'hui (V1, pilote)

- Caisse, stock, factures, crédits clients, relances WhatsApp manuelles, vitrine en ligne, bons de commande, arrivages par lien, carte de fidélité, export complet des données.
- Formules appliquées : Standard (gratuit), Essentiel, Pro, Pro Plus, avec cadenas, lecture seule après échéance et comptes en pause (voir `src/features/billing/plans.ts`).
- Paiement des formules à la main (Muni Dinero, virement, espèces) ; activation depuis la console d'administration WISHOP.
- Les vitrines des formules Standard, Essentiel et Pro portent la mention WISHOP et un bouton vers la page d'accueil (« Découvrir WISHOP ») : chaque vitrine fait connaître la plateforme. Seul Pro Plus retire cette mention.

## V2

- Suivi des dépenses et bénéfice net (Essentiel, Pro, Pro Plus).
- Paiement Mobile Money à la caisse (Pro, Pro Plus).
- Console d'administration : messages aux boutiques, alertes à l'administrateur (voir la question de l'e-mail d'envoi).

## V3

- Mode hors ligne, dans toutes les formules, gratuite comprise (coupures de courant et d'internet).
- Plusieurs boutiques par compte (Pro, Pro Plus).
- Rapports par intelligence artificielle (Pro Plus).

## V4

### Paiement en ligne des formules (agrégateur)

- Dès qu'une société WISHOP est enregistrée et qu'un agrégateur est choisi (en Guinée équatoriale : accord direct à prévoir avec Muni Dinero ; au Cameroun, agrégateurs panafricains).
- Fonctionnement : WISHOP crée la demande de paiement (boutique, formule, nombre de mois) ; à la confirmation, l'agrégateur prévient WISHOP (webhook signé), qui prolonge la formule avec la même règle que la console et l'inscrit dans l'historique. Un même paiement n'est jamais compté deux fois. La console reste pour les cas manuels.

### Place de marché WISHOP (« la boutique des boutiques »)

Idée du 25/09/2026, à construire avec le paiement en ligne.

- Sur la page d'accueil de WISHOP, en plus de la présentation du logiciel, un espace « marché » où les visiteurs découvrent les boutiques de la plateforme qui ont une vitrine.
- Boutiques regroupées par catégorie (prêt-à-porter, cosmétiques, perruques, bijoux…), avec un petit aperçu de chaque boutique, et filtrées par pays (plusieurs pays de la zone CEMAC).
- Option payante à part, hors abonnement : une boutique paie un forfait pour apparaître dans cet espace ; selon le montant payé, elle reste en tête de liste pendant une durée donnée (mise en avant).
- Réservée aux boutiques qui ont une vitrine. Selon la grille actuelle, la vitrine commence en Pro ; l'idée d'origine citait aussi Essentiel : à trancher avant de construire.
- À prévoir : règles de classement (payé d'abord, puis par date ou activité), durée des mises en avant, référencement par pays et par catégorie, modération (les signalements existent déjà).
