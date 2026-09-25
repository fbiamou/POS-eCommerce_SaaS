# WISHOP · Dossier de design de la page d'accueil

Version 5 · 24 septembre 2026 (vos retours sur la première version construite : ticket de caisse, relance automatique mise en avant, deux voies de réapprovisionnement, indication sur le mini-essai, Boss MaMa B, espagnol au tutoiement, FAQ honnête sur la prise en main) · Direction choisie : **A, Indigo royal** · Palier 1

Ce dossier est l'entrée unique de la construction. Chaque texte destiné aux visiteurs est livré **mot pour mot** : la construction le câble, elle ne le reformule jamais. Seule exception mécanique : la passe typographique (espaces fines insécables en français, séparateurs de milliers propres à chaque langue), décrite en section 10.

---

## 1. La prémisse

**Le fil.** Dans un tissu indigo teint à la réserve, une seule ligne blanche tient tout le motif. WISHOP est ce fil pour une boutique : chaque vente, chaque crédit, chaque article du stock et chaque relance, reliés et suivis sans jamais le perdre.

Le mot tient dans les trois langues, avec la même image : *ne plus perdre le fil*, *never lose the thread*, *no perder el hilo*. Il porte les deux sentiments demandés : la **fierté** (l'indigo, étoffe des cérémonies) et la **maîtrise** (tenir le fil).

Toute la page enseigne cette seule idée. Le héros montre ce que le fil relie : les produits de toutes les boutiques (mode, beauté, perruques, bijoux, décoration) descendent au rythme du défilement et trouvent leur place, sans rien perdre. La ligne du fil se dessine ensuite sous le titre et court de section en section jusqu'au dernier bouton.

**La cible** : toutes les boutiques de détail, pas seulement la beauté. Prêt-à-porter, cosmétiques, perruques, bijoux, objets de décoration. Les visuels montrent cette variété.

---

## 2. Les couleurs

Direction fixée par le monde du héros (studio indigo profond, produits aux couleurs chaudes, reflets safran). Les valeurs du héros sombre seront affinées sur la vidéo approuvée ; les valeurs claires sont celles de l'application.

```css
:root{
  /* Coton : le fond de la page sous le héros, légèrement bleuté, jamais blanc pur */
  --canvas:#F2F3F8;
  --panel:#FBFBFE;          /* cartes et surfaces levées */
  --text-primary:#141C45;   /* Indigo nuit */
  --text-secondary:#4F5780;
  --brand:#2B44A0;          /* Indigo de cuve : liens, fil, éléments de marque */
  --night:#141C45;          /* sections sombres, dans la continuité du héros */
  --mist:#D7DBEA;           /* Brume : lignes décoratives, surfaces douces */
  --line-strong:#6D77A6;    /* bordures interactives (3,9:1 sur Coton) */
  --accent:#F4B63F;         /* Safran : le bouton d'action et le losange du fil, rien d'autre */
  --accent-hover:#E9A623;
  --accent-muted:rgba(244,182,63,.22);
  --on-accent:#141C45;      /* texte sur Safran (9:1) */
  --ok:#1E7F4F;             /* payé : état seulement, jamais couleur de marque */
  --late:#C2412D;           /* en retard : état seulement */
}
```

Règles :
- Le Safran n'apparaît qu'aux endroits suivants : le bouton « Créer ma boutique », le losange qui se pose en dernier sur le fil, et l'anneau de focus clavier.
- Contrastes vérifiés : Indigo nuit sur Coton 14,7:1 ; Indigo de cuve et texte blanc 8,6:1 ; texte secondaire sur Coton 6,2:1.
- La page n'a qu'un seul environnement de fond (section 7) : le héros sombre, puis le Coton, reliés par la couture du fil.

---

## 3. Les polices

| Rôle | Police | Graisses utilisées |
|---|---|---|
| Titres | **Bricolage Grotesque** (axe de taille optique automatique) | 800, et 600 pour les petits titres |
| Texte | **Figtree** | 400, 600 |
| Chiffres, étiquettes, montants | **Spline Sans Mono** | 500 |

Couverture vérifiée pour le français, l'anglais et l'espagnol (é, è, ç, ñ, ¿, ¡). Chargement Google Fonts avec `preconnect`, uniquement ces graisses.

---

## 4. La carte des bandes du héros

Le plan (6 secondes, Kling 3.0 Pro, sans son) : dans un studio indigo profond, de vrais produits haut de gamme, sans marque (une robe longue en satin champagne, une perruque longue lisse et brillante, une manchette et un collier en or, un parfum en cristal, un rouge à lèvres en étui doré, un sac en cuir noir, un vase sculptural sable), descendent lentement, ensemble, comme en apesanteur. Le satin ondule, les cheveux se balancent, l'or accroche la lumière. Ils ralentissent et finissent par flotter, immobiles et ordonnés, au centre droit, sans toucher le sol : tout est à sa place. Image de départ : `review/start-frame-v5-luxe.png` (le sac noir rappelle la silhouette d'un modèle de grande maison : gardé tel quel à votre demande). L'action vit au centre droit ; les textes vivent à gauche.

Plages de défilement : **points de départ**, validés ensuite par le test des coups de molette.

| Bande | Plage | Moment du film | Texte (FR, mot pour mot) | Entrée |
|---|---|---|---|---|
| 1 | 0,00 à 0,20 | Les produits entrent par le haut du cadre | « Un cahier de crédits. » / « Un téléphone qui chauffe. » / « Une caisse qui ne tombe pas juste. » | Les trois lignes descendent l'une après l'autre de quelques pixels, au rythme des produits qui entrent |
| 2 | 0,26 à 0,46 | La descente : le satin ondule, les cheveux se balancent, l'or accroche la lumière | « Toute votre boutique tient à un fil. » | Le titre passe du flou au net en descendant légèrement, au rythme de la descente |
| 3 | 0,52 à 0,72 | Les produits ralentissent et trouvent leur place | « WISHOP le tient pour vous. » puis, plus petit : « Ventes, stock, crédits et relances WhatsApp, reliés dans une seule app. » | Révélation ligne à ligne de gauche à droite, comme un trait qu'on trace |
| Repos | 0,80 à 1,00 | Image finale : les produits flottent, immobiles et ordonnés, au centre droit du studio indigo | Voir section 5 (même texte que le héros fixe) | Le fil se dessine sous le titre de gauche à droite, le losange Safran se pose en dernier |

Les trois phrases de la bande 1 sont un **procédé voulu** (triade), pas une dérive.

---

## 5. Le héros fixe (téléphones, mouvement réduit) et le repos

Posé sur l'image finale, sans parcours derrière :

- **Titre (H1)** : « Ne perdez plus le fil de votre boutique. »
- **Sous-titre** : « Encaissez, suivez chaque crédit jusqu'au dernier franc, surveillez le stock et relancez vos clients sur WhatsApp. Tout depuis votre téléphone. »
- **Bouton** : « Créer ma boutique »
- **Sous le bouton** : « Gratuit pour commencer. »
- **Lien secondaire** : « Voir comment ça marche » (vers la section 1)

---

## 6. Sous le héros

Une seule action pour toute la page : **« Créer ma boutique »**, qui mène à l'inscription de l'application (`/fr/login`, `/en/login`, `/es/login` selon la langue affichée ; l'inscription se fait sur cette page avec une adresse e-mail). Pas de formulaire sur le site : l'action renvoie vers l'application.

**Modèle freemium** : la page dit clairement que WISHOP est gratuit pour commencer et que des formules payantes viendront plus tard. Aucun prix n'est affiché, parce que les formules et le paiement de l'abonnement ne sont pas encore en place. La mention « Gratuit pour commencer » accompagne chaque bouton « Créer ma boutique », sauf dans l'appel final, dont le texte le dit déjà.

La mise en ligne attend la **refonte de l'application**, pour que chaque écran montré existe vraiment (section 11).

### Navigation
Logo WISHOP · « Comment ça marche » · « Vitrine » · « Questions » · « Se connecter » · bouton « Créer ma boutique » · sélecteur « FR · EN · ES »

### La couture (transition héros vers Coton)
Le fil court sur toute la largeur à la jonction entre l'indigo du héros et le Coton : le fil dessiné prend le relais du héros. Pas de texte.

### Section 1 · Comment ça marche (`#comment`)
Structure : une colonne de quatre étapes reliées par un fil vertical qui se dessine au défilement ; un losange s'allume à chaque étape. Chaque étape a sa capture d'écran de l'application refondue, dans un cadre de téléphone. La numérotation est justifiée : c'est le vrai cycle d'une vente.

- Surtitre : « Comment ça marche »
- Titre : « Un seul fil, de la vente à la relance. »
- **Vendez** : « Encaissez en quelques touches, comptant ou à crédit. Le ticket de caisse s'imprime aussitôt, et la facture existe aussi en PDF pour la partager avec votre client. » Maquette : le ticket de caisse de Boss MaMa B, avec « Imprimer le ticket » et « Télécharger le PDF ».
- **Suivez** : « Chaque crédit a sa barre de remboursement : ce qui est payé, ce qui reste, et depuis quand. »
- **Relancez** : « Un client vous doit de l'argent ? WISHOP le relance tout seul sur WhatsApp, au rythme que vous choisissez, jusqu'à ce que sa dette soit soldée. Le message est déjà écrit, avec son nom et le montant. » Sous le texte, un renvoi visible vers la question des relances : « En attente du feu vert de Meta dans notre région. Voir pourquoi ». Maquette : relances automatiques (rappels envoyés, prochain rappel, arrêt dès que la dette est soldée).
- **Réapprovisionnez** (bon de commande, fournisseur connu) : « Le stock bas saute aux yeux. Quand vous savez ce qu'il manque, WISHOP prépare un bon de commande par fournisseur, à envoyer par WhatsApp ou en PDF. À la livraison, vous validez la réception et le stock se met à jour. »
- **Achetez à distance** (lien envoyé à un intermédiaire, achats selon la tendance) : « Pour un nouvel arrivage ou des achats selon la tendance, envoyez un lien à la personne qui achète pour vous sur place. Elle note chaque article au fil de ses achats et joint la photo du colis. À l'arrivée, vous cochez ce que vous recevez, et le stock se met à jour tout seul. »

### Section 2 · Le moment interactif (`#credit`)
Structure : un seul grand panneau centré, sur fond Indigo nuit (le seul retour au sombre sous le héros). Le visiteur encaisse lui-même le dernier paiement d'un crédit et regarde le fil se compléter.

- Étiquette : « Exemple »
- Surtitre : « Essayez »
- Titre : « Regardez un crédit se refermer. »
- Texte : « Mireille doit encore 6 000 FCFA sur ses achats. Encaissez son dernier paiement. »
- État de départ : total 18 000 FCFA, deux losanges posés (deux paiements de 6 000 FCFA), fil rempli aux deux tiers, « Reste 6 000 FCFA ».
- Indication au-dessus du bouton (avec une flèche qui bouge doucement, et un halo sur le bouton jusqu'au premier clic) : « À vous : appuyez sur le bouton pour encaisser. »
- Bouton : « Encaisser 6 000 FCFA »
- État final : le fil se complète, le troisième losange se pose, la ligne affiche « Soldé. Le fil est complet. »
- Lien : « Recommencer »

### Section 3 · La vitrine (`#vitrine`)
Structure : deux colonnes, texte à gauche, capture de la vitrine publique d'une boutique d'exemple (à sa propre couleur) à droite, dans un téléphone.

- Surtitre : « Votre vitrine »
- Titre : « Une boutique en ligne à votre nom. »
- Texte : « Chaque boutique WISHOP a sa page publique, à ses couleurs. Vos clients parcourent vos articles et passent commande ; ils paient et récupèrent en boutique. »

### Section 4 · L'équipe (`#equipe`)
Structure : bande horizontale à deux blocs côte à côte, sans capture, avec deux petits schémas de rôles dessinés au fil.

- Titre : « Chacun sa place dans la boutique. »
- Bloc 1 : « Vous voyez tout. Vos employés n'accèdent qu'aux pages que vous leur ouvrez, la caisse par exemple. »
- Bloc 2 : « Sur le téléphone que vous avez déjà : WISHOP s'ouvre dans le navigateur, rien à installer. »

### Section 5 · Questions (`#questions`)
Structure : accordéon, une question ouverte à la fois. Réponses tirées des vraies objections trouvées en recherche et des vraies limites du produit.

- Titre : « Vos questions. »
1. « Combien ça coûte ? » · « WISHOP est gratuit pour commencer. Des formules payantes arriveront plus tard, et nous vous préviendrons avant tout changement. »
2. « Est-ce compliqué à prendre en main ? » · « Au quotidien, non : vendre, suivre un crédit ou relancer se fait en quelques touches. Le vrai travail est au départ : enregistrer votre stock. Vous pouvez ajouter vos articles un par un depuis l'application, ce qui prend du temps, ou importer d'un coup votre stock existant depuis un fichier Excel (au format CSV), ce qui demande d'être à l'aise avec un tableur. Selon les cas, des vidéos d'explication ou une aide au démarrage peuvent vous être proposées. »
3. « Faut-il une connexion internet ? » · « Oui, WISHOP fonctionne en ligne. Une connexion mobile ordinaire suffit. »
4. « Les relances partent-elles toutes seules ? » · « C'est tout l'intérêt : WISHOP relance automatiquement sur WhatsApp chaque client qui vous doit de l'argent, au rythme que vous choisissez, jusqu'à ce que sa dette soit soldée. La fonction est prête dans l'application, mais elle attend le feu vert de Meta, la société derrière WhatsApp, dont l'accès est encore restreint dans notre région. En attendant, WISHOP prépare le message et vous n'avez plus qu'à l'envoyer. Dès que Meta lèvera cette restriction, les relances automatiques seront activées. »
5. « Mes employés peuvent-ils l'utiliser ? » · « Oui. Vous créez leur accès et vous choisissez les pages qu'ils voient. »
6. « Mes chiffres sont-ils à l'abri ? » · « Chaque boutique ne voit que ses propres données. Les ventes, factures et paiements ne peuvent pas être effacés depuis l'app : votre historique reste juste. »
7. « Et si je ne vends pas en FCFA ? » · « Le FCFA est proposé par défaut. Vous pouvez choisir une autre devise dans les réglages de la boutique. »

### Section 6 · L'appel final
Structure : pleine largeur sur l'image finale du héros réutilisée, texte centré, le fil complet sous le titre.

- Titre : « Votre boutique mérite mieux qu'un cahier. »
- Texte : « Créez-la en ligne, gratuitement pour commencer. Il suffit d'une adresse e-mail. »
- Bouton : « Créer ma boutique »

### Pied de page
Logo WISHOP · « Le fil de votre boutique. » · liens « Comment ça marche », « Vitrine », « Questions », « Se connecter » · sélecteur de langue · « © 2026 WISHOP »

Pas de témoignages : aucun n'existe encore, et la règle est de ne jamais en inventer. La section s'ajoutera quand les premières boutiques témoigneront.

---

## 7. Le calque vectoriel

Tout est dessiné à la main en SVG, rien n'est généré :

- **Le fil** : polyligne en zigzag, trait blanc (sur sombre) ou Indigo de cuve (sur Coton), losanges tous les quatre sommets, le dernier en Safran. Il apparaît : sous le titre du repos (se dessine au repos), à la couture héros vers Coton, en colonne vertébrale verticale de la section 1 (se dessine au défilement, un losange par étape), dans le moment interactif (barre de remboursement), sous le titre de l'appel final, et en filet du pied de page.
- **Le logo** : le W en zigzag continu, losange Safran au sommet. Favicon SVG en ligne.
- **Particules** : quelques grains de poussière dorée très discrets qui dérivent lentement dans le héros (canvas), comme ceux du film, uniquement pendant le héros.
- **Environnement de fond** : une trame de coton très légère sur le Coton, qui dérive sur un cycle de 90 secondes.
- **Mouvement réduit** : tous les fils sont affichés entiers, la dérive et les particules s'arrêtent, les changements de préférence en cours de visite sont suivis.

---

## 8. Le standard technique

Tout le standard de `references/scrub-pipeline.md`, sans exception : chargement de la vidéo en Blob avec anneau de progression, interpolation normalisée par le temps, recherches d'image regroupées, écritures DOM seulement quand la valeur change, rythme des bandes validé par le test des coups de molette, système de lisibilité à quatre couches (voile local, ombre, zone calme, audit du pire pixel), les cinq conditions du héros fixe suivies en direct, page complète sans vidéo, et le plancher qualité (polices limitées, repères sémantiques, lien d'évitement, focus visible en Safran, cibles tactiles de 44 px). Plus la règle du site animé de bout en bout de la phase 8 de la méthode.

---

## 9. Les images d'appui

- **Aucune image générée sous le héros.** Les visuels des sections sont de vraies captures de l'application refondue (quatre étapes, la vitrine), montrées telles quelles dans des cadres de téléphone : ce sont le vrai visage du produit.
- Les quatre étapes reçoivent chacune leur capture (traitement égal des éléments parallèles).
- Pas de personne à l'image : pas de protagoniste, pas de référence de visage à gérer.
- L'image finale du héros est réutilisée comme fond de l'appel final.

Coût de génération : les essais d'image de départ, la retouche du fond en indigo, puis la vidéo (Kling 3.0 Pro, 10,5 crédits par essai). Rien d'autre sous le héros.

---

## 10. Les langues

- **Source** : le français, écrit dans le HTML. L'anglais et l'espagnol sont portés par un dictionnaire indexé sur le balisage (clés `data-i18n`), l'état français est relevé depuis le DOM au chargement pour que les versions ne puissent pas diverger.
- **Choix de la langue** : sélecteur « FR · EN · ES », mémorisé dans le navigateur ; première visite selon la langue du navigateur, français par défaut. Le bouton d'action suit la langue (`/fr/login`, `/en/login`, `/es/login`).
- **Registre** : « vous » en français ; « usted » en espagnol, comme l'application.
- **Typographie par langue** :
  - Français : espace fine insécable avant : ; ! ? et à l'intérieur de « », séparateur de milliers espace fine insécable (6 000), espace insécable entre le montant et FCFA.
  - Anglais : aucune espace avant la ponctuation, milliers avec virgule (6,000 FCFA).
  - Espagnol : ¿…? et ¡…!, milliers avec point (6.000 FCFA), comme l'application.
- **Limite honnête** : le sélecteur sert les visiteurs, pas les moteurs de recherche. Seul le français, présent dans le HTML, est indexé. Indexer l'anglais et l'espagnol demandera des adresses séparées avec balises hreflang : un ajout, pas une reconstruction.

### Textes anglais et espagnols

Depuis la version 5, les textes anglais et espagnols font foi dans le dictionnaire de la page (`site/index.html`, objets `DICT.en` et `DICT.es`), pour éviter deux copies qui divergent pendant les relectures. L'espagnol passe au tutoiement (« Cobra, sigue… », titres « Venta », « Sigue », « Recuerda », « Reaprovisiona », « Compra a distancia »), à votre demande. Le message de relance affiché dans la maquette garde le vouvoiement, parce que c'est le vrai texte envoyé par l'application aux clients.

Les textes anglais et espagnols sont à faire relire par une personne de langue maternelle avant la mise en ligne.

---

## 11. Le registre d'honnêteté

| Ligne | Statut | Qui confirme |
|---|---|---|
| Vente comptant ou à crédit, ticket de caisse imprimable, facture en PDF | Vérifié dans le code (page ticket 80 mm avec impression, route PDF des factures) | Fait |
| Barre de remboursement par crédit | **Promesse de la refonte** : n'existe pas encore sous cette forme dans l'app | La page part en ligne après la refonte |
| Message WhatsApp déjà écrit avec nom et montant | Vérifié (lien WhatsApp pré-rempli, ou envoi par le compte Business connecté) | Fait |
| Relances automatiques jusqu'au solde de la dette | **Mise en avant à votre demande.** Le code existe (tâche quotidienne, délais réglables, arrêt au paiement) mais l'accès à l'API WhatsApp de Meta est restreint dans votre région. La page le dit dans la FAQ, avec un renvoi visible depuis l'étape « Relancez » | Vous : l'explication « restriction de Meta dans notre région » |
| « À la livraison, vous validez la réception et le stock se met à jour » (bon de commande) | **À confirmer** : aujourd'hui, marquer un bon de commande « reçu » n'ajoute pas de stock ; seul un arrivage pointé le fait | Vous : choisir si la réception d'un bon de commande doit alimenter le stock |
| Stock bas signalé, bons de commande par fournisseur, arrivages pointés | Vérifié (seuil réglable, bons de commande, arrivages) | Fait |
| Vitrine publique aux couleurs de la boutique, commande en ligne, paiement et retrait en boutique | Vérifié | Fait |
| Accès des employés limités aux pages choisies | Vérifié | Fait |
| Ventes, factures, paiements non effaçables depuis l'app | Vérifié (suppression retirée au niveau de la base) | Fait |
| Autre devise possible dans les réglages | Vérifié | Fait |
| Inscription avec une adresse e-mail | Vérifié (inscription sur la page de connexion, confirmation par e-mail) | Fait |
| « Rien à installer, s'ouvre dans le navigateur » | Vérifié (application web, pas d'installation requise) | Fait |
| Prise en main : saisie du stock à la main ou import d'un fichier Excel (CSV), aide possible selon les cas | Vérifié (formulaire produit, import CSV) ; « aide possible » formulé au conditionnel | Vous |
| Boutique d'exemple « Boss MaMa B » | Nom de votre première cliente, utilisé à votre demande | Vous : son accord pour apparaître sur la page |
| « Une connexion mobile ordinaire suffit » | **Promesse en votre nom** (dépend des performances après refonte) | Vous, après mesure sur un vrai téléphone en données mobiles |
| « Avec de gros boutons » | **Promesse de la refonte** | La page part en ligne après la refonte |
| « Gratuit pour commencer », formules payantes plus tard | **Votre décision** (modèle freemium). Aucun prix affiché : formules et paiement de l'abonnement pas encore en place | Vous. À compléter quand les formules seront fixées |
| « Nous vous préviendrons avant tout changement » | **Promesse en votre nom** | Vous, avant la mise en ligne |
| Témoignages, nombre de boutiques, chiffres d'usage | **Volontairement absents** : aucun n'existe | À ajouter quand ils existeront |
| Nom WISHOP | À vérifier : déjà utilisé hors d'Afrique centrale | Recherche d'antériorité OAPI avant la mise en ligne publique |
| Adresse de l'application derrière « Créer ma boutique » | Actuelle : wishop-saa-s.vercel.app (depuis le 25/09/2026, l'ancienne pos-e-commerce-saa-s.vercel.app redirige) | À changer si l'app passe sur un domaine WISHOP |
| Données de la démo (Mireille, montants) | Exemple, affiché comme tel | Fait |
| Produits montrés dans le héros | Images générées, génériques, sans marque ni logo (vérifié au zoom) | Fait |

---

## 12. La porte des textes

Chaque texte ci-dessus part mot pour mot. Avant que quiconque voie la page construite, elle passe la porte de la phase 9 dans les trois langues : zéro tiret cadratin, zéro mot creux (leverage, seamless, empower, unlock, robust, actionable, data-driven, solutions, et leurs équivalents), puis la relecture des tics d'écriture automatique dans les paragraphes. La triade de la bande 1 et le jeu sur « le fil » sont des procédés voulus de ce dossier : ils restent.
