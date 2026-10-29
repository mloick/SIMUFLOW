#!/usr/bin/env bash
# Compile et lance l'app iOS (Simulateur, ou iPhone avec --device), puis efface
# les fichiers temporaires de compilation quand on arrête le serveur (Ctrl+C).
set -u
cd "$(dirname "$0")/.."

# Des paquets Expo de versions décalées compilent sans erreur, mais l'app
# plante au lancement (« Symbol not found » entre modules précompilés).
# On s'arrête avant de compiler. Sans réseau, la vérification est sautée.
verif=$(npx expo install --check 2>&1)
if echo "$verif" | grep -q "should be updated"; then
  echo "$verif"
  echo
  echo "Versions de paquets incompatibles avec le SDK Expo."
  echo "Corriger avec : npx expo install --fix && (cd ios && pod install)"
  exit 1
fi

trap 'exit 130' INT
trap 'echo; bash scripts/nettoyer-ios.sh' EXIT

npx expo run:ios "$@"
