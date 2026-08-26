# CertiBot

> Automatisierte Erstellung von Teilnahmebescheinigungen für das Zentrum für LehrerInnenbildung (ZfL) der Universität zu Köln

CertiBot ist eine Angular-Webanwendung, mit der Teilnehmende von Workshops und
Fortbildungen ihre **Teilnahmebescheinigung selbst als PDF erzeugen** können.
Jeder Veranstaltung ist ein eigener, nicht erratbarer Link zugeordnet. Beim Aufruf
gibt die Person ihren Namen ein; CertiBot schreibt den Namen an die passende Stelle
in eine vorbereitete Zertifikatsvorlage und erzeugt daraus im Browser eine
druckfertige PDF-Datei im A4-Format.

Optional lässt sich der eingegebene Name gegen eine **verschlüsselte Anmeldeliste**
prüfen, sodass nur tatsächlich registrierte Personen eine Bescheinigung erhalten.

---

## Funktionsweise

```
Aufruf von  /certificate/<id>
        │
        ▼
Konfiguration config/<id>.json per HTTP laden (zur Laufzeit, kein Rebuild nötig)
        │
        ├─ (optional) verschlüsselte Anmeldeliste laden und im Browser entschlüsseln
        │
        ▼
Dialog: Teilnehmer:in gibt Namen ein
        │
        ├─ Anmeldeliste vorhanden?  ──►  Name nicht enthalten  ──►  Fehlerdialog
        │                                Name enthalten
        ▼
PDF-Vorlage laden, Name mit pdf-lib an der konfigurierten Position einsetzen
        │
        ▼
PDF lokal herunterladen
```

Die Anwendung besitzt genau eine Route mit einem Parameter (`:id`, siehe
[`src/app/app.routes.ts`](src/app/app.routes.ts)). Die `id` ist der Schlüssel in der
Zertifikatskonfiguration und dient gleichzeitig als „geheimer" Zugangslink für eine
Veranstaltung (z. B. `/certificate/e93a7f1b0c42d8e6a9f35c7d12b48f0e`).

Die PDF-Erzeugung läuft vollständig im Browser (Client-seitig). Es werden keine
Namen oder Bescheinigungen an einen Server übertragen.

---

## Konfiguration der Bescheinigungen

Jede Veranstaltung wird zur Laufzeit über eine eigene Datei `config/<id>.json`
konfiguriert. Diese Dateien liegen **nicht** im App-Build, sondern werden
produktiv separat auf dem Server im Verzeichnis `config/` neben `index.html`
abgelegt (siehe [Deployment](#deployment-apache)) — ein neuer Eintrag oder
eine Änderung erfordert also **keinen Rebuild** der Anwendung. CertiBot lädt
die passende Datei beim Aufruf von `/certificate/<id>` per HTTP (siehe
[`cert-config-loader.ts`](src/app/services/cert-config-loader.ts)).

Für die lokale Entwicklung liegt unter
[`public/config/RANDOM_STRING.json`](public/config/RANDOM_STRING.json) ein
Beispiel:

```json
{
  "template": "templates/example.pdf",
  "outputFile": "beispiel-bescheinigung.pdf",
  "name": { "x": 297, "y": 560, "size": 15, "color": "#005179" },
  "dialogTitle": "Bitte geben Sie Ihren Namen ein:",
  "dialogBody": "Beispielkonfiguration für die lokale Entwicklung."
}
```

Felder des Konfigurationsformats (`CERTCONFIG`, siehe
[`cert-config.ts`](src/app/certificates/cert-config.ts)):

| Feld                | Pflicht | Bedeutung                                                                 |
|---------------------|---------|----------------------------------------------------------------------------|
| `template`          | ja      | Pfad zur PDF-Vorlage, relativ zum Ausgabeverzeichnis (`templates/…`)      |
| `outputFile`        | ja      | Dateiname der erzeugten PDF                                               |
| `name`              | ja      | Position/Größe/Farbe des eingesetzten Namens, siehe unten                 |
| `name.x`            | ja      | Horizontaler Mittelpunkt, um den der Name zentriert wird, in PDF-Punkten (Ursprung unten-links) |
| `name.y`            | ja      | Position der Namens-Basislinie in PDF-Punkten (Ursprung unten-links)      |
| `name.size`         | ja      | Schriftgröße in pt                                                        |
| `name.color`        | nein    | Hex-Farbe des Namens, z. B. `#005179` (Default `#005179`)                 |
| `dialogTitle`       | ja      | Überschrift im Namens-Dialog                                              |
| `secondPage`        | nein    | Optionale zweite PDF-Seite (Pfad zu einer weiteren PDF), wird angehängt   |
| `participants`      | nein    | Pfad zur verschlüsselten Anmeldeliste, relativ zum Ausgabeverzeichnis (im lokalen Beispiel oben weggelassen) |
| `dialogBody`        | nein    | Zusätzlicher Erläuterungstext im Dialog                                   |

Die PDF-Vorlagen selbst liegen unter `templates/` (produktiv auf dem Server,
lokal als Beispiel unter [`public/templates/example.pdf`](public/templates/example.pdf)),
der für die Namens-Einblendung verwendete Font unter
[`public/fonts/albert-sans.ttf`](public/fonts/albert-sans.ttf). Der Name wird
mit [pdf-lib](https://pdf-lib.js.org/) direkt in die PDF-Vorlage eingebettet
(siehe [`pdf-generator.ts`](src/app/services/pdf-generator.ts)) — es gibt
keine Zwischenstufe über Canvas/JPG mehr.

Neue Bescheinigungen (Vorlage hochladen, `config/<id>.json` anlegen,
optional Anmeldeliste verschlüsseln) werden mit dem separaten, lokal
laufenden Werkzeug **`certadmin`** (Phase B dieses Projekts) erstellt. Das
Werkzeug schreibt die Dateien lokal in das private Daten-Submodul `data/`
(`data/config/`, `data/templates/`, `data/participants/`); von dort werden
sie separat auf den Server hochgeladen (siehe [Deployment](#deployment-apache))
— ein Rebuild oder Redeploy der CertiBot-Anwendung ist dafür nicht nötig.

---

## Anmeldelisten & Verschlüsselung

Damit Teilnahmelisten nicht im Klartext im öffentlichen Web-Verzeichnis liegen,
werden die Namen **AES-verschlüsselt** (crypto-js) abgelegt. Zur Laufzeit lädt
CertiBot die in `participants` referenzierte Liste, entschlüsselt sie im
Browser und gleicht den eingegebenen Namen ab (siehe
[`encryption.ts`](src/app/services/encryption.ts)). Das lokale Beispiel dazu
liegt unter [`public/participants/example.txt`](public/participants/example.txt).

Das Anlegen und Verschlüsseln neuer Anmeldelisten (Klartext-Namen eintragen,
verschlüsselte Datei nach `data/participants/` schreiben, Referenz in der
zugehörigen `data/config/<id>.json` setzen) übernimmt künftig ebenfalls das
Werkzeug **`certadmin`** (Phase B) — ein manuelles Ausführen einzelner
Verschlüsselungs-Skripte ist dafür nicht mehr nötig.

Personen, deren Name nicht in der Liste steht, erhalten den Fehlerdialog
„Ihr Name befindet sich nicht in der Anmeldeliste." und keine PDF.

> **Sicherheitshinweis:** Da die Anwendung rein Client-seitig läuft, gelangen sowohl
> das AES-Passwort als auch die verschlüsselte Liste in den Browser der Nutzenden.
> Die Verschlüsselung schützt die Klarnamen davor, offen im Verzeichnis zu liegen und
> indexiert zu werden; sie ist kein Schutz gegen technisch versierte Nutzende. Der
> eigentliche Zugangsschutz liegt im nicht erratbaren `:id`-Link.

---

## Technologie-Stack

| Technologie      | Version           |
|------------------|-------------------|
| Angular          | 22.x (Standalone Components) |
| Angular Material | 22.x              |
| TypeScript       | ~6.0              |
| pdf-lib          | PDF-Erzeugung (Name in Vorlage einbetten) |
| crypto-js        | AES-Verschlüsselung |
| Node.js          | ≥ 20 empfohlen    |
| Paketmanager     | npm               |

---

## Voraussetzungen

- [Node.js](https://nodejs.org/) ≥ 20
- [Angular CLI](https://angular.dev/tools/cli) ≥ 22

```bash
npm install -g @angular/cli
```

## Installation

```bash
git clone --recurse-submodules https://github.com/ZfL-Koeln/CertiBot.git
cd CertiBot
npm install
```

Nach einem normalen Klon (ohne `--recurse-submodules`) lässt sich das private
Daten-Submodul `data/` nachträglich laden:

```bash
git submodule update --init data
```

Ohne Zugang zum privaten Datenrepo (`Teilnahmebescheinigungen-Aktiv`) ist
kein Einrichten von `data/` nötig: Für die lokale Entwicklung genügen die
Beispieldateien unter `public/` (siehe [Konfiguration](#konfiguration-der-bescheinigungen)).

Vor dem ersten Start zusätzlich die Verschlüsselungs-Konfiguration aus ihrer
Vorlage anlegen:

```bash
cp encrypt/encrypt-config.example.ts encrypt/encrypt-config.ts
```

Anschließend das AES-Passwort in `encrypt-config.ts` eintragen.

## Entwicklungsserver

```bash
ng serve
```

Danach [http://localhost:4200/certificate/RANDOM_STRING](http://localhost:4200/certificate/RANDOM_STRING)
aufrufen (der Beispiel-Schlüssel `RANDOM_STRING` stammt aus der Beispielkonfiguration).
Die Anwendung lädt bei Änderungen an den Quelldateien automatisch neu.

> **Lokales Testen erzeugter Bescheinigungen:** Der Entwicklungsserver
> (`ng serve`, Konfiguration `development`) liefert zusätzlich zu `public/`
> auch das `data/`-Submodul (`config/`, `templates/`, `participants/`) aus.
> Eine mit `certadmin` erzeugte Bescheinigung ist damit sofort unter
> `http://localhost:4200/certificate/<id>` aufrufbar — ohne sie nach `public/`
> zu kopieren. Nach dem Anlegen den Dev-Server einmal neu starten, damit die
> neuen Dateien eingelesen werden. Der **Produktions-Build** (`ng build`)
> bündelt weiterhin ausschließlich `public/`; produktive Daten werden separat
> auf den Server hochgeladen.

## Build

```bash
ng build
```

Die Build-Artefakte liegen anschließend unter `dist/CertiBot/browser/`. Der
Produktions-Build ist auf Performance und Ladezeit optimiert.

> Die Anwendung wird unter dem Basispfad `/certificate/` ausgeliefert
> (`baseHref` in [`angular.json`](angular.json)). Beim Deployment in ein anderes
> Verzeichnis muss dieser Wert angepasst werden.

## Tests

```bash
ng test        # Unit-Tests (Karma + Jasmine)
```

---

## Deployment (Apache)

Es gibt **zwei getrennte Deployments**: die **App** (nur bei Code-Änderungen)
und die **Bescheinigungen** (bei jeder neuen/geänderten — ohne Rebuild). Beides
übernimmt das Skript [`deploy.sh`](deploy.sh).

### Einmalige Einrichtung

Der Server-Zugang steht in `deploy-config.sh` (per `.gitignore` ausgenommen,
enthält Servername/Pfad). Vor dem ersten Deploy aus der Vorlage anlegen und
`REMOTE`/`TARGET` eintragen:

```bash
cp deploy-config.example.sh deploy-config.sh
```

### Deployen

```bash
./deploy.sh          # App (ng build) + .htaccess + alle Bescheinigungsdateien
./deploy.sh app      # nur App (ng build) + .htaccess
./deploy.sh certs    # nur Bescheinigungen (config/, templates/, participants/) — KEIN Rebuild
```

Was dabei passiert:

1. **App:** `ng build` erzeugt den Produktions-Build unter
   `dist/CertiBot/browser/` (`baseHref` `/certificate/`). Der Build bündelt
   **nur** `public/` (Beispieldaten, siehe [`angular.json`](angular.json)) —
   produktive `config/`-, `templates/`- und `participants/`-Dateien sind
   **nicht** Teil des Builds. Der Build wird ins Zielverzeichnis kopiert,
   zusammen mit [`htaccess`](htaccess) als `.htaccess` (leitet Anfragen auf
   `index.html` um, damit das clientseitige Routing `/certificate/<id>`
   funktioniert).
2. **Bescheinigungen:** Die produktiven Dateien liegen im privaten
   Daten-Submodul `data/` (dort vom Werkzeug **`certadmin`** abgelegt) und
   werden nach `config/`, `templates/` bzw. `participants/` neben `index.html`
   hochgeladen. Sie werden zur Laufzeit vom Server geladen — ein neuer Eintrag
   benötigt daher **weder einen neuen `ng build` noch ein erneutes Deployment
   der App** (`./deploy.sh certs` genügt).

Ein App-Deploy überschreibt `index.html`, JS und CSS, **löscht aber keine**
bereits hochgeladenen Bescheinigungen auf dem Server.

---

## Projektstruktur

```
CertiBot/
├── src/
│   └── app/
│       ├── app.routes.ts              # Route /:id → Certificate-Komponente
│       ├── certificates/
│       │   ├── cert-config.ts         # CERTCONFIG-Modell (Format von config/<id>.json)
│       │   └── certificates.example.ts# Beispiel einer CERTCONFIG (Dokumentationszweck)
│       ├── components/
│       │   ├── certificate/           # Kernkomponente: Config laden, Name abfragen, PDF bauen
│       │   ├── dialog/                # Namens-Eingabedialog
│       │   └── error-dialog/          # Fehlerdialog (Name nicht in Liste)
│       └── services/
│           ├── cert-config-loader.ts  # lädt config/<id>.json zur Laufzeit per HTTP
│           ├── pdf-generator.ts       # setzt den Namen per pdf-lib in die PDF-Vorlage ein
│           └── encryption.ts          # AES-Entschlüsselung der Anmeldeliste
├── public/                            # lokale Beispieldaten, werden 1:1 mitgebaut
│   ├── config/RANDOM_STRING.json      # Beispiel-Konfiguration
│   ├── templates/example.pdf          # Beispiel-PDF-Vorlage
│   ├── fonts/albert-sans.ttf          # Font für die Namens-Einblendung
│   └── participants/example.txt       # Beispiel-Anmeldeliste (verschlüsselt)
├── data/                              # privates Git-Submodul (Teilnahmebescheinigungen-Aktiv)
│   ├── config/                        # echte config/<id>.json-Dateien
│   ├── templates/                     # echte PDF-Vorlagen
│   └── participants/                  # echte (verschlüsselte) Anmeldelisten
├── encrypt/
│   ├── encrypt-config.ts              # AES-Passwort (gitignored), zur Laufzeit im Browser genutzt
│   └── encrypt-config.example.ts      # Vorlage des Passworts
├── .gitmodules                        # verweist auf das private Submodul data/
├── angular.json                       # Angular-CLI-Konfiguration (baseHref /certificate/, Assets nur aus public/)
├── htaccess                           # Apache-Konfiguration (→ als .htaccess umbenennen)
├── deploy.sh                          # Deploy-Skript (Modi: all/app/certs)
├── deploy-config.example.sh           # Vorlage für den Server-Zugang
├── deploy-config.sh                   # echte REMOTE/TARGET-Werte (gitignored)
└── package.json                       # Abhängigkeiten und npm-Skripte
```

`data/` wird lokal vom Werkzeug **`certadmin`** (Phase B) befüllt und dient
als Ablage, bevor die Dateien produktiv auf den Server hochgeladen werden;
es ist nicht Teil des App-Builds (siehe [Konfiguration](#konfiguration-der-bescheinigungen)
und [Deployment](#deployment-apache)).
