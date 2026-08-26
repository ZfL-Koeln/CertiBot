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

# SSH-Verbindungsmultiplexing: Alle scp/ssh-Aufrufe teilen sich eine
# Master-Verbindung, sodass die Passphrase des Keys nur EINMAL abgefragt wird
# (beim ersten Verbindungsaufbau). Die Verbindung wird am Ende wieder geschlossen.
# Kurzer Socket-Pfad in /tmp (nicht $TMPDIR), damit das Socket-Pfadlimit
# (~104 Zeichen) nicht überschritten wird.
SSH_CONTROL="$(mktemp -u /tmp/certibot-deploy-XXXXXX)"
SSH_OPTS=(-o "ControlMaster=auto" -o "ControlPath=$SSH_CONTROL" -o "ControlPersist=120")

close_master() {
  ssh -O exit -o "ControlPath=$SSH_CONTROL" "$REMOTE" >/dev/null 2>&1 || true
}
trap close_master EXIT

deploy_app() {
  echo "==> App bauen (ng build)"
  npx ng build

  echo "==> App hochladen -> $TARGET"
  scp "${SSH_OPTS[@]}" -r dist/CertiBot/browser/* "$REMOTE:$TARGET/"

  echo "==> .htaccess hochladen (clientseitiges Routing)"
  scp "${SSH_OPTS[@]}" htaccess "$REMOTE:$TARGET/.htaccess"
}

deploy_certs() {
  echo "==> Zielverzeichnisse sicherstellen"
  ssh "${SSH_OPTS[@]}" "$REMOTE" "mkdir -p '$TARGET/config' '$TARGET/templates' '$TARGET/participants'"

  echo "==> Bescheinigungsdateien hochladen (config/, templates/, participants/)"
  shopt -s nullglob
  local cfg=(data/config/*.json)
  local tpl=(data/templates/*.pdf)
  local par=(data/participants/*.txt)
  shopt -u nullglob

  if [ ${#cfg[@]} -gt 0 ]; then
    scp "${SSH_OPTS[@]}" "${cfg[@]}" "$REMOTE:$TARGET/config/"
  else
    echo "   (keine config-Dateien in data/config/)"
  fi

  if [ ${#tpl[@]} -gt 0 ]; then
    scp "${SSH_OPTS[@]}" "${tpl[@]}" "$REMOTE:$TARGET/templates/"
  else
    echo "   (keine Vorlagen in data/templates/)"
  fi

  if [ ${#par[@]} -gt 0 ]; then
    scp "${SSH_OPTS[@]}" "${par[@]}" "$REMOTE:$TARGET/participants/"
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
