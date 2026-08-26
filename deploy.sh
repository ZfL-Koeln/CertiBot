#!/usr/bin/env bash
#
# Deployt CertiBot auf den Produktionsserver (Apache, apps.zflkoeln.de).
#
# Nutzung:
#   ./deploy.sh          App + .htaccess + alle Bescheinigungsdateien (Standard)
#   ./deploy.sh app      nur App (ng build) + .htaccess
#   ./deploy.sh certs    nur Bescheinigungsdateien (config/, templates/, participants/) — KEIN Rebuild
#
# Hintergrund: Die App wird als statischer Build ausgeliefert; die produktiven
# Bescheinigungen liegen im data/-Submodul und werden zur Laufzeit vom Server
# geladen. Für neue/geänderte Bescheinigungen genügt daher "./deploy.sh certs"
# (kein App-Rebuild nötig).
#
# Server-Zugang (REMOTE/TARGET) steht in deploy-config.sh (per .gitignore
# ausgenommen). Vorlage: deploy-config.example.sh.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/deploy-config.sh"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Konfigurationsdatei fehlt: $CONFIG_FILE" >&2
  echo "Anlegen mit:  cp deploy-config.example.sh deploy-config.sh" >&2
  echo "und darin REMOTE/TARGET eintragen." >&2
  exit 1
fi

# shellcheck source=deploy-config.example.sh
source "$CONFIG_FILE"

: "${REMOTE:?REMOTE ist nicht gesetzt (siehe deploy-config.sh)}"
: "${TARGET:?TARGET ist nicht gesetzt (siehe deploy-config.sh)}"

MODE="${1:-all}"

deploy_app() {
  echo "==> App bauen (ng build)"
  npx ng build

  echo "==> App hochladen -> $TARGET"
  scp -r dist/CertiBot/browser/* "$REMOTE:$TARGET/"

  echo "==> .htaccess hochladen (clientseitiges Routing)"
  scp htaccess "$REMOTE:$TARGET/.htaccess"
}

deploy_certs() {
  echo "==> Zielverzeichnisse sicherstellen"
  ssh "$REMOTE" "mkdir -p '$TARGET/config' '$TARGET/templates' '$TARGET/participants'"

  echo "==> Bescheinigungsdateien hochladen (config/, templates/, participants/)"
  shopt -s nullglob
  local cfg=(data/config/*.json)
  local tpl=(data/templates/*.pdf)
  local par=(data/participants/*.txt)
  shopt -u nullglob

  if [ ${#cfg[@]} -gt 0 ]; then
    scp "${cfg[@]}" "$REMOTE:$TARGET/config/"
  else
    echo "   (keine config-Dateien in data/config/)"
  fi

  if [ ${#tpl[@]} -gt 0 ]; then
    scp "${tpl[@]}" "$REMOTE:$TARGET/templates/"
  else
    echo "   (keine Vorlagen in data/templates/)"
  fi

  if [ ${#par[@]} -gt 0 ]; then
    scp "${par[@]}" "$REMOTE:$TARGET/participants/"
  else
    echo "   (keine Anmeldelisten in data/participants/)"
  fi
}

case "$MODE" in
  all)   deploy_app; deploy_certs ;;
  app)   deploy_app ;;
  certs) deploy_certs ;;
  *)
    echo "Unbekannter Modus: $MODE" >&2
    echo "Nutzung: ./deploy.sh [all|app|certs]" >&2
    exit 2
    ;;
esac

echo "==> Fertig ($MODE)."
