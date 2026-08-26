# Vorlage für deploy-config.sh — von deploy.sh eingelesen (source).
#
# Einrichten:
#   cp deploy-config.example.sh deploy-config.sh
# und darin REMOTE/TARGET auf den echten Server anpassen.
#
# deploy-config.sh ist per .gitignore ausgenommen (enthält Servername/Pfad)
# und wird NICHT eingecheckt.

# SSH-Ziel (Benutzer@Host), so wie es scp/ssh erwartet.
REMOTE="ssh-BENUTZER@HOST.example.com"

# Absoluter Pfad zum Zielverzeichnis auf dem Server (Auslieferungsordner der App,
# entsprechend dem baseHref /certificate/).
TARGET="/pfad/zum/webroot/certificate"
