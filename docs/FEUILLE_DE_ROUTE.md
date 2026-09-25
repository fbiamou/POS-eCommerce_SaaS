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
- E-mails automatiques : avertissements et messages aux boutiques par e-mail (en plus des messages dans l'application, déjà en place), alertes à l'administrateur (nouvelle inscription, signalement, erreur de la plateforme). Il faut un nom de domaine à WISHOP (on ne peut pas envoyer d'e-mails au nom de vercel.app) et un service d'envoi (par exemple Resend, gratuit jusqu'à 3 000 e-mails par mois). Le même domaine servirait d'adresse définitive au site et à une adresse de contact professionnelle.
- Coût indicatif d'un nom de domaine (par an, à vérifier au moment de l'achat) : un .com autour de 10 à 15 dollars (6 000 à 9 000 FCFA) ; un .app autour de 15 à 20 dollars ; les .shop et .store sont souvent très bon marché la première année puis nettement plus chers au renouvellement. Choix du fondateur (25/09/2026) : un domaine en .app, à acheter dès que les moyens le permettent.

- Validation manuelle des vitrines avant leur mise en ligne (décision du 25/09/2026) : en cas d'abus, ou par simple contrôle, une vitrine nouvellement ouverte attend l'accord de l'administrateur dans la console avant d'être visible du public.

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
