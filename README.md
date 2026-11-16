# Points Liés

Trois jeux de réflexion à jouer seul, où l'on relie des points. Quinze niveaux par jeu, du plus simple au plus retors. Un niveau s'ouvre quand le précédent est réussi.

Chaque niveau garde ses records : le meilleur temps (le chrono part au premier coup et s'arrête quand l'onglet est caché) et le moins de coups (annuler compte pour un coup, recommencer remet tout à zéro). La liste des niveaux et l'accueil affichent le temps cumulé. Tout reste dans le navigateur de l'appareil.

- **Les Carrés** : chaque trait coûte une énergie, sauf s'il ferme une case. Il faut repérer les couloirs, où un seul trait payé en ferme plusieurs.
- **Triangles** : relier des points sans croiser de trait ni traverser de mur, et former le nombre de triangles demandé avec un nombre de traits limité.
- **Les Ponts** : chaque île dit combien de ponts en partent ; tout relier en un seul réseau, sans croisement, deux ponts au plus par paire.

Aucune dépendance : ouvrir `index.html` suffit (ou n'importe quel hébergement statique, GitHub Pages compris).

## Fichiers

- `index.html`, `style.css` : la page et son style.
- `js/commun.js` : navigation, progression, scores, écran de victoire.
- `js/regles-*.js` : les règles de chaque jeu, partagées par le navigateur et le générateur.
- `js/jeu-*.js` : le plateau et les gestes de chaque jeu.
- `js/niveaux-*.js` : les niveaux, produits par le générateur.

## Outils

- `node outils/generer.cjs [carres|triangles|ponts]` refait les niveaux. Ils sont tirés d'une graine fixe et vérifiés : optimum exact pour les Carrés, meilleure solution trouvée par recherche pour Triangles, solution unique pour les Ponts.
- `node outils/tester.cjs` joue les 45 niveaux dans Chromium (Playwright), au pointeur simulé, avec les solutions du générateur, vérifie que chaque victoire s'affiche et que son score est gardé, qu'une deuxième partie se compare au record, et qu'une progression de la première version est reprise.
- `node outils/artefact.cjs sortie.html` rassemble tout en une seule page autonome.
