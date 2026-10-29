#!/usr/bin/env bash
# Efface les fichiers temporaires de compilation iOS de SimuFlow pour libérer
# de l'espace disque. Tout ce qui est supprimé ici se recrée à la compilation
# suivante. Le dossier ios/ est gardé : il contient la signature (équipe Apple).
set -u
cd "$(dirname "$0")/.."

if [ "$(uname)" != "Darwin" ]; then
  echo "Nettoyage iOS ignoré : il ne concerne que macOS."
  exit 0
fi

libre_avant=$(df -k / | awk 'NR==2 {print $4}')

# Fichiers compilés par Xcode pour ce projet (plusieurs Go).
rm -rf "$HOME"/Library/Developer/Xcode/DerivedData/SimuFlow-*
rm -rf ios/build
# Caches du serveur Metro.
rm -rf "${TMPDIR:-/tmp}"/metro-* "${TMPDIR:-/tmp}"/haste-map-*
# Simulateurs iOS qui ne correspondent plus à aucune version installée.
xcrun simctl delete unavailable 2>/dev/null

libre_apres=$(df -k / | awk 'NR==2 {print $4}')
libere=$(( (libre_apres - libre_avant) / 1024 ))
[ "$libere" -lt 0 ] && libere=0
echo "Nettoyage terminé : ${libere} Mo libérés, $(( libre_apres / 1024 / 1024 )) Go libres."
