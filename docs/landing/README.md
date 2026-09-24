# Page d'accueil WISHOP (`public/landing`)

Site statique servi par l'application à l'adresse `/landing` : `public/landing/index.html` et `public/landing/assets/`. Aucune compilation propre, pas de dépendance au code Next.js. `next.config.ts` fait pointer `/landing` vers `index.html` et ajoute l'en-tête `X-Robots-Tag: noindex` pendant la phase d'aperçu.

Le dossier de design (textes, choix, registre d'honnêteté) est `docs/landing/design-package.md`. Les brouillons, vidéos brutes et images de travail restent hors du dépôt, dans le dossier de travail `WISHOP/review` à côté du projet.

## Ce qu'il ne faut pas casser

- **Aperçu non indexé.** L'en-tête `X-Robots-Tag` de `next.config.ts` et la balise `robots` en tête de `index.html` empêchent l'indexation. Les retirer tous les deux au lancement public, en même temps que le remplissage de `og:image` et `og:url` (commentaire `DEPLOY STEP`), et le basculement de l'accueil `/` vers cette page.
- **Chemins absolus.** Les images et la vidéo sont appelées en `/landing/assets/...`, pour fonctionner que l'adresse se termine ou non par une barre oblique. Les boutons « Créer ma boutique » et « Se connecter » pointent vers `/{langue}/login` du même domaine.
- **Le middleware (`src/proxy.ts`) ne touche pas `/landing`** : son `matcher` ne couvre que `/` et `/(es|fr|en)/...`. Ne pas l'élargir sans exclure `/landing`.
- **Les cinq conditions du héros fixe existent deux fois**, dans les media queries CSS et dans le tableau `GATES` du script. Les chaînes doivent rester identiques caractère pour caractère. Sur ces cinq cas (téléphones, tablettes en portrait, écran tactile en portrait, téléphone couché, mouvement réduit), la vidéo n'est jamais téléchargée : le héros montre `hero-ending.jpg` et la section fait un seul écran.
- **La vidéo est chargée entière en Blob** (`fetch` puis `URL.createObjectURL`), parce que certains hébergeurs ne gèrent pas le téléchargement partiel. Ne pas la remplacer par un simple `src`.
- **Encodage de la vidéo** : une image clé toutes les 8 (`-g 8 -keyint_min 8`), sinon le défilement saccade. Recette : `10k-websites/references/ffmpeg-recipes.md`.
- **Espaces insécables** : en français, espace fine insécable (`&#8239;`) avant `: ; ! ?`, dans les milliers et dans les guillemets ; espace insécable (`&nbsp;`) entre un nombre et son unité (`50&nbsp;ml`, `22&nbsp;pouces`). Toujours en entités ou en échappements (` `, ` `), jamais le caractère brut. Éditer ce fichier avec un outil qui respecte l'UTF-8, jamais avec `sed` sous Windows.
- **Montants** formatés par le script selon la langue (`6 000`, `6,000`, `6.000`) à partir des attributs `data-amount`.
- **Langues** : le français est écrit dans le HTML ; l'anglais et l'espagnol sont dans `DICT.en` et `DICT.es`, indexés sur les attributs `data-i18n`. L'espagnol est au tutoiement.
- **Lisibilité mesurée** : pire pixel sous chaque légende du héros au-dessus de 16:1 (outil `10k-websites/tools/legibility.mjs`). Toute retouche des voiles ou de la vidéo doit être remesurée.
- **Les écrans montrés sont ceux de l'app refondue.** La page ne remplace l'accueil `/` qu'une fois la refonte livrée.
