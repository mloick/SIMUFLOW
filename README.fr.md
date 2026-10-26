# SimuFlow

Français · [English](README.md)

SimuFlow est une application mobile qui transforme un workflow métier en un parcours interactif et vérifié. On importe un schéma draw.io ou on photographie un tableau de process, on voit les anomalies, puis on rejoue le process pas à pas en choisissant chaque branche.

> État : début du projet. Le dépôt contient pour l'instant l'application de départ d'Expo et la maquette des écrans. Les fonctionnalités du simulateur sont construites étape par étape.

## Pour qui

Les chefs de projet et analystes qui conçoivent des workflows de gestion des services informatiques (ITSM) avec les métiers. Un schéma statique se valide mal : impasses, décisions à une seule sortie et délais incohérents sont découverts trop tard. SimuFlow les rend visibles en moins d'une minute.

## Écrans clés

- **Process** : la liste des process importés, avec leur état de diagnostic.
- **Simulation** : le schéma s'allume au fil du parcours ; chaque décision demande quelle branche suivre.
- **Scanner** : on photographie un tableau (étape, acteur, délai) et il devient un workflow.

La maquette complète est dans [`docs/maquette/`](docs/maquette/).

## Fonctionnalités du téléphone

- Caméra avec lecture de texte sur le téléphone (module natif en Kotlin et en Swift).
- Notifications quand un process partagé est validé ou commenté.

## Démarrer

Prérequis : Node.js 22.13 ou plus récent, et l'application Expo Go sur le téléphone.

```bash
npm install
npx expo start
```

Scannez le QR code avec l'appareil photo du téléphone pour ouvrir l'app dans Expo Go. Sur un Mac avec Xcode, appuyez sur `i` pour ouvrir le Simulateur iOS.

## Documentation

- [Documentation technique](docs/technique.md) : architecture, structure, commandes.
- [Guide des fonctionnalités](docs/fonctionnalites.md) : ce que fait l'application, en termes simples.

## Technologies

Expo SDK 58, React Native 0.88, Expo Router, TypeScript (strict).

## Licence

Voir [LICENSE](LICENSE).
