# certadmin – Bescheinigungsverwaltung

Lokales Werkzeug zum Erstellen und Verwalten von Teilnahmebescheinigungen mit verschlüsselten Teilnehmerlisten.

## Voraussetzungen

Das Werkzeug erfordert, dass die Datei `encrypt/encrypt-config.ts` im Wurzelverzeichnis des Repositories existiert und das AES-Passwort enthält. Ohne diese Datei kann das Werkzeug nicht starten.

## Start

```bash
npm run certadmin
```

Das Werkzeug startet einen lokalen HTTP-Server auf `http://localhost:4300` und öffnet die Seite automatisch im Browser.

## Ablauf

1. **PDF-Vorlage exportieren**: Exportiere die Bescheinigungsvorlage als PDF aus Word.
2. **PDF laden**: Wähle die exportierte PDF-Datei über die Dateiverwaltung im Werkzeug aus.
3. **Position klicken**: Klicke in der Vorschau auf die Stelle, wo der Teilnehmername positioniert werden soll (Mittelpunkt der Basislinie).
4. **Felder ausfüllen**:
   - **Dialog-Titel**: Der Titel der Bescheinigung (z.B. „Teilnahmebescheinigung")
   - **Dialog-Text** (optional): Zusätzlicher Bescheinigungstext
   - **Dateiname**: Der Name der erzeugten PDF-Datei (z.B. „bescheinigung.pdf")
   - **Anmeldeliste** (optional): Teilnehmernamen, ein Name pro Zeile
5. **Anlegen**: Klicke auf „Anlegen", um die Bescheinigung zu erstellen.

Das Werkzeug zeigt nach dem Erstellen einen Link zur Bescheinigung an (z.B. `/certificate/<id>`).

## Datei-Ausgabe

Das Werkzeug schreibt die folgenden Dateien in das lokale `data/`-Verzeichnis (ein Git-Submodul):

- `data/config/<id>.json` – Konfiguration der Bescheinigung
- `data/templates/<id>.pdf` – Die PDF-Vorlage
- `data/participants/<id>.txt` – Verschlüsselte Teilnehmerliste (nur falls angegeben)

## Upload und Git-Commit

**Wichtig:** Das Werkzeug lädt die erstellten Dateien **NICHT** auf den Server hoch und erstellt **NICHT** automatisch Git-Commits. Dies muss der Benutzer **manuell** durchführen:

1. Überprüfe, dass die neuen Dateien korrekt in `data/config/`, `data/templates/` und ggf. `data/participants/` geschrieben wurden.
2. Führe in das `data/`-Submodul ein `git commit` durch und pushe die Änderungen auf das Remote-Repository.
3. Kommitiere auch die Aktualisierung des Submoduls im Hauptrepository und pushe diese.
4. Übertrage die Dateien manuell auf den Produktionsserver.

Nach dem manuellen Upload zum Server ist **kein Rebuild der Anwendung erforderlich** – die neuen Dateien sind sofort verfügbar.
