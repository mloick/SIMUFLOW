#!/usr/bin/env bash
# Compile et lance l'app iOS (Simulateur, ou iPhone avec --device). Les fichiers
# de compilation sont gardés : la compilation suivante ne refait que ce qui a
# changé. Pour libérer de la place : npm run nettoyer.
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

# Rappel quand le disque se remplit (moins de 10 Go libres).
if [ "$(uname)" = "Darwin" ]; then
  libre=$(( $(df -k / | awk 'NR==2 {print $4}') / 1024 / 1024 ))
  if [ "$libre" -lt 10 ]; then
    echo "Attention : ${libre} Go libres. Pour libérer les fichiers de compilation : npm run nettoyer"
  fi
fi

npx expo run:ios "$@"
