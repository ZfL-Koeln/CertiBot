# Vereinfachte Pflege von Bescheinigungen — Design

**Datum:** 2026-08-25
**Status:** Entwurf (freigegeben zur Umsetzungsplanung)

## Problem

Eine neue Bescheinigung in CertiBot einzupflegen ist heute mehrstufig und fehleranfällig:

1. Vorlage in Word (.docx) gestalten
2. Externes Tool [Tangent](https://github.com/janwieners/Tangent) nutzt, um docx → jpg zu wandeln
3. jpg von Hand nach `data/certificates/` kopieren
4. `data/certificates.ts` von Hand editieren (zufällige ID vergeben, `nameMargin` durch Ausprobieren justieren, Titel/Texte)
5. optional: Anmeldeliste verschlüsseln — Klartext ablegen, `fileName` in `encrypt/encrypt-participants.ts` ändern, Skript laufen lassen, verschlüsselte Datei nach `data/participants/` kopieren
6. `ng build`
7. Deploy per scp

Schmerzpunkte: externer docx→jpg-Umweg, händisches TS-Editieren, `nameMargin`-Raten, und ein **kompletter Rebuild + Redeploy der ganzen App bei jeder neuen Bescheinigung**.

## Ziel

Die gesamte Kette auf **ein lokales Werkzeug** reduzieren, mit dem eine Bescheinigung in einem Rutsch angelegt wird — ohne externes Tangent, ohne händisches Editieren von Code, **ohne Rebuild der App**.

## Lösungsüberblick

Das Vorhaben besteht aus zwei Teilen:

1. **Einmaliger Umbau der App** — Konfiguration wird zur Laufzeit geladen (statt einkompiliert), und der Name wird direkt in eine PDF-Vorlage gestempelt (statt auf ein JPG gezeichnet).
2. **Neues lokales Werkzeug `certadmin`** — eine kleine Weboberfläche auf dem Rechner, die PDF-Vorlage + Angaben entgegennimmt, Config schreibt, Anmeldelisten verschlüsselt und alles im `data/`-Submodul ablegt.

Der Server-Upload sowie das Committen/Pushen des Submoduls bleiben **außerhalb** des Werkzeugs (macht der Nutzer mit seinem bestehenden Prozess). Der Server ist ein klassischer PHP/Apache2-Stack; `config/`, `templates/` und `participants/` werden dort als **statische Dateien** ausgeliefert — kein serverseitiger Code nötig.

---

## Teil 1 — Umbau der App

### 1a. Laufzeit-Konfiguration, eine Datei pro Veranstaltung

Statt einer einkompilierten `data/certificates.ts` liegt pro Veranstaltung **genau eine JSON-Datei** neben den Assets:

```
/certificate/                 (Server-Zielverzeichnis, baseHref /certificate/)
├── index.html, *.js, ...      (gebaute App — ändert sich nur noch bei echten App-Updates)
├── config/<id>.json           (Konfiguration EINER Veranstaltung)
├── templates/<id>.pdf         (PDF-Vorlage, aus Word exportiert)
└── participants/<id>.txt       (optional, AES-verschlüsselte Anmeldeliste)
```

Beim Aufruf von `/certificate/<id>` holt die App per `HttpClient` **nur** `config/<id>.json`.
Bei HTTP 404 (Datei nicht vorhanden) → Fehlerdialog „unbekannter Link".

**Warum eine Datei pro ID statt einer gemeinsamen `manifest.json`:**
Eine Datei, die alle IDs auflistet, würde sämtliche geheimen Veranstaltungslinks an einem Ort offenlegen — schlechter als heute. Mit einer Datei pro ID ist jede Veranstaltung nur erreichbar, wenn man ihre ID kennt (gleiches Geheimhaltungsmodell wie der Zugangslink). Zusätzlich fasst das Werkzeug beim Anlegen nie eine geteilte Datei an und kann daher keinen bestehenden Eintrag versehentlich überschreiben. Das ist sicherer und robuster als der Ist-Zustand (heute stecken alle IDs im JS-Bundle).

**`.htaccess`:** Die vorhandene Regel liefert existierende Dateien direkt aus (`RewriteCond %{DOCUMENT_ROOT}%{REQUEST_URI} -f`), bevor auf `index.html` umgeleitet wird. `config/*.json` und `templates/*.pdf` werden also korrekt ausgeliefert und nicht auf die App umgeschrieben. **Keine Änderung nötig.**

### 1b. Datenformat `config/<id>.json`

```json
{
  "template": "templates/2026-09-10_forum-praxisphasen.pdf",
  "outputFile": "2026-09-10_forum-praxisphasen.pdf",
  "participants": "participants/2026-09-10_forum-praxisphasen.txt",
  "name": { "x": 297, "y": 250, "size": 15, "color": "#005179" },
  "secondPage": "templates/....pdf",
  "dialogTitle": "Teilnahmebescheinigung Forum Praxisphasen",
  "dialogBody": "Bitte geben Sie hier Ihren Namen ein …"
}
```

| Feld | Pflicht | Bedeutung |
|------|---------|-----------|
| `template` | ja | Pfad zur PDF-Vorlage (relativ zum Ausgabeverzeichnis) |
| `outputFile` | ja | Dateiname der erzeugten PDF beim Download |
| `name.x`, `name.y` | ja | Position des Namens in **PDF-Punkten** (Ursprung unten-links, A4 = 595×842 pt) |
| `name.size` | ja | Schriftgröße in pt |
| `name.color` | nein | Hex-Farbe, Default `#005179` |
| `dialogTitle` | ja | Überschrift im Namensdialog |
| `dialogBody` | nein | Zusatztext im Dialog |
| `participants` | nein | Pfad zur verschlüsselten Anmeldeliste |
| `secondPage` | nein | Optionale zweite PDF-Seite (angehängt) |

Ein TypeScript-Interface (`CERTCONFIG`) beschreibt dieses Format weiterhin für Typsicherheit in der App; die Werte kommen aber zur Laufzeit aus dem Fetch, nicht aus dem Import.

### 1c. PDF-Stempeln statt Canvas/JPG

Die Kernkomponente (`src/app/components/certificate/certificate.ts`) wird umgebaut:

- Abhängigkeiten: `jspdf`, `html2canvas` (falls nur hier genutzt) und die Canvas-Zeichenlogik entfallen. Neu: **`pdf-lib`** + **`@pdf-lib/fontkit`**.
- Ablauf beim Erzeugen:
  1. `config/<id>.json` ist bereits geladen.
  2. PDF-Vorlage als `ArrayBuffer` fetchen (`template`).
  3. Mit `pdf-lib` laden, Albert-Sans-TTF einbetten (fontkit).
  4. Namen auf Seite 1 an `name.x`/`name.y` (zentriert) in `name.size`/`name.color` stempeln.
  5. Falls `secondPage`: deren Seite(n) anhängen.
  6. `PDFDocument.save()` → Blob → Download unter `outputFile`.
- Der bestehende Ablauf davor (Route `:id` → Config → optional Anmeldeliste entschlüsseln und abgleichen → Namensdialog) bleibt inhaltlich gleich; nur die Config-Quelle (Fetch statt Import) und der Erzeugungsschritt (pdf-lib statt Canvas+jsPDF) ändern sich.

**Vorteil:** Ausgabe ist vektor-/text-scharf statt JPG-komprimiert (heute `JPG_QUALITY = 0.5`).

**Positionierung — Koordinaten:** Die Live-Vorschau des Werkzeugs (pdf.js) rendert mit Ursprung **oben-links**; `pdf-lib` stempelt mit Ursprung **unten-links**. Das Werkzeug rechnet vor dem Speichern in die pdf-lib-Konvention um, sodass in `config/<id>.json` bereits pdf-lib-Koordinaten stehen und die App nichts umrechnen muss.

### 1d. `angular.json`

Die Asset-Globs für `certificates/**` und `participants/**` aus `data/` werden ersetzt durch die neue Struktur, damit ein normaler `ng build` weiterhin lokal lauffähige Beispieldaten (aus `public/`) mitnimmt. Produktiv liegen `config/`, `templates/`, `participants/` ohnehin nur auf dem Server. Konkrete Globs werden im Umsetzungsplan festgelegt.

---

## Teil 2 — Werkzeug `certadmin`

### 2a. Form & Technik

- Ort: `tools/certadmin/` im Hauptrepo.
- Start: `npm run certadmin` → Node-Backend startet und öffnet `http://localhost:4300`.
- Backend: schlank (Node + Express oder Node-`http`), nur lokal erreichbar.
- Frontend: eine statische HTML/JS-Seite; **pdf.js** rendert die Vorschau der PDF-Vorlage.

### 2b. Ablauf in der Oberfläche

1. **PDF ziehen** (aus Word exportierte Vorlage) → erste Seite wird per pdf.js gerendert.
2. **Name positionieren:** in die Vorschau klicken/ziehen; ein Beispielname wird live an der Stelle eingeblendet; Schriftgröße per Schieberegler. → liefert `x/y/size`.
3. **Felder:** Dialog-Titel, optionaler Dialog-Text, Ausgabedateiname (Vorbelegung aus PDF-Dateiname).
4. **Anmeldeliste (optional):** Klartext-Namen (ein Name pro Zeile) in ein Textfeld. Das Werkzeug verschlüsselt sie mit dem AES-Passwort aus `encrypt/encrypt-config.ts` (gleiche Logik wie `encrypt/encrypt-participants.ts`, aber ohne manuelles `fileName`-Editieren/Skriptlauf).
5. **Button „Anlegen".**

### 2c. Was das Backend beim Anlegen tut

- **Zufällige ID** erzeugen (32 hex, wie heute).
- Dateien **nur in das `data/`-Submodul** schreiben:
  - `data/templates/<id>.pdf` (Kopie der hochgeladenen Vorlage)
  - `data/config/<id>.json`
  - falls Liste: `data/participants/<id>.txt` (verschlüsselt)
- **Kein** scp/Upload, **kein** `git commit`/`push` — das macht der Nutzer selbst.
- Rückgabe an die Oberfläche: der fertige Link `…/certificate/<id>` zum Kopieren.

> Das `data/`-Submodul bleibt die versionierte Quelle/Backup. Der bisherige Ordner `data/certificates/` (JPG) wird durch `data/templates/` (PDF) und `data/config/` abgelöst.

### 2d. Migration der bestehenden Bescheinigung

Die eine vorhandene Bescheinigung (`a93a7f1b…`, „Forum Praxisphasen") wird **einmalig** über das neue Werkzeug neu eingestellt: Word-Dokument als PDF exportieren, durchs Werkzeug schicken. Damit ist die neue Kette zugleich real getestet. Anschließend werden `data/certificates.ts`, `data/certificates/` (JPG) und die alte Canvas/JPG-Logik entfernt — es gibt nur noch **einen** Weg.

Falls das Original-Word-Dokument nicht vorliegt, kann als Fallback die bestehende JPG einmalig in eine PDF verpackt und als Vorlage genutzt werden (Qualität dann wie bisher).

---

## Umsetzungsreihenfolge

1. App-Umbau: Laufzeit-Config (`config/<id>.json`-Fetch) + pdf-lib-Stempeln; `CERTCONFIG`-Interface; `angular.json`-Anpassung; Tests aktualisieren.
2. Werkzeug `certadmin` bauen (Backend + Vorschau-Frontend + Verschlüsselung).
3. Bestehende Bescheinigung migrieren; alten Code/Assets entfernen; README aktualisieren.

## Bewusst nicht enthalten (YAGNI)

- **Keine** Online-Admin-Seite auf dem Server (Sicherheit/Aufwand) — das Werkzeug bleibt lokal.
- **Kein** automatisches docx→PDF im Werkzeug — der Nutzer exportiert den einen PDF-Klick in Word selbst (spart LibreOffice-Abhängigkeit und Layout-Risiken).
- **Kein** Server-Upload und **kein** Git-Commit/Push durch das Werkzeug — bleibt beim bestehenden Prozess des Nutzers.
- **Keine** Bearbeiten/Löschen-Funktion im Werkzeug vorerst — Korrekturen über erneutes Anlegen bzw. direkt in `data/`.

## Offene Risiken / im Umsetzungsplan zu klären

- **Font-Einbettung:** Albert Sans liegt als *variable* TTF (`@fontsource-variable/albert-sans`) vor. `pdf-lib`/fontkit bettet daraus eine statische Instanz ein — im Plan verifizieren; falls Probleme, statisches `@fontsource/albert-sans` ergänzen.
- **Bundle-Größe/Abhängigkeiten:** `pdf-lib` ersetzt `jspdf`/`html2canvas` in der App; `pdf.js` kommt nur im lokalen Werkzeug hinzu, nicht im App-Bundle.
- **Zweite Seite:** Sicherstellen, dass angehängte `secondPage`-PDFs mit korrekter A4-Größe übernommen werden.
