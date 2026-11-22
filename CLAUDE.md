@AGENTS.md

# SimuFlow

Application mobile de simulation de workflows, projet personnel de Loïck. Interface et documentation en français ; le README principal est en anglais.

## Se repérer

Lire d'abord [docs/carte.md](docs/carte.md) : où est quoi, les règles et les pièges, en une page. Ne lire `docs/technique.md` que pour le détail d'une partie. Garder les commandes peu bavardes (`| tail`, `grep`) plutôt que d'afficher des fichiers ou des journaux entiers.

## Documentation à tenir à jour

Toute modification du code (`src/`, `app.json`, `package.json`, `modules/`) met à jour, dans le même commit ou la même pull request :

- `README.md` (anglais) et `README.fr.md` (français) : mêmes sections, même contenu, chacun dans sa langue.
- `docs/technique.md` : état actuel, structure, commandes, architecture. Décrire le code tel qu'il est, pas tel qu'on l'espère.
- `docs/site/manuel/index.html` : le manuel d'utilisation, publié sur https://mloick.github.io/SIMUFLOW/manuel/. C'est la seule description des fonctionnalités pour l'utilisateur non technique : des guides « Je veux… » courts, en « vous », avec l'écran de l'app. Une fonctionnalité nouvelle ou changée y ajoute ou corrige son guide (tableau `G` du script), et le lexique ou la FAQ si besoin.
- `docs/site/en/manual/index.html` : la traduction anglaise du manuel, publiée sur https://mloick.github.io/SIMUFLOW/en/manual/. Même structure et mêmes identifiants de guides que le manuel français ; ses images viennent de `docs/site/manuel/img/`. Tout guide ajouté ou corrigé en français l'est aussi en anglais, dans la même pull request, avec les libellés anglais de l'app (`src/i18n/messages/en*.ts`).
- `docs/fonctionnalites.md` : une page courte qui renvoie vers le manuel et donne l'état de chaque fonctionnalité en une ligne. Passer une fonctionnalité de « Prévue » à « Disponible » quand elle fonctionne. Ne pas y redécrire les écrans.

Si une modification ne change rien pour un document, ne pas le toucher.

Chaque étape qui change un écran ajoute ses captures dans `docs/captures/` (nommées `etape-<numéro>-<sujet>.png`, compressées), dans la même pull request, et les affiche dans `docs/technique.md` à l'endroit qui décrit l'écran. Si l'écran apparaît dans le manuel, sa capture y est aussi remplacée : un seul écran par image, en WebP de 600 px de large, dans `docs/site/manuel/img/`.

## Présentation du projet

Dans tous les textes publics (README, docs, site, description du dépôt) :

- SimuFlow est le projet personnel de Loïck. Ne pas le présenter comme un projet d'école, de cours ou de Master (ni « pour le cours », « pour l'oral », « étudiant »).
- Le public est tout chef de projet et son équipe, quel que soit le secteur (informatique, logistique, RH, achats, finance…), pour modéliser, simuler et faire valider des process. Un workflow informatique ou ITSM n'est qu'un exemple parmi d'autres, jamais le public visé.
- Mettre en avant le travail en équipe : projets qui regroupent plusieurs process, validation de chaque partie par son acteur.

## Confidentialité

Uniquement des exemples fictifs : aucun nom d'entreprise, de client, de service ou de process réel, dans le code comme dans la documentation.
