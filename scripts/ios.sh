#!/usr/bin/env bash
# Compile et lance l'app iOS (Simulateur, ou iPhone avec --device), puis efface
# les fichiers temporaires de compilation quand on arrête le serveur (Ctrl+C).
set -u
cd "$(dirname "$0")/.."

trap 'exit 130' INT
trap 'echo; bash scripts/nettoyer-ios.sh' EXIT

npx expo run:ios "$@"
