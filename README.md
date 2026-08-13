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
Konfiguration zur <id> aus certificates.ts laden
        │
        ├─ (optional) verschlüsselte Anmeldeliste laden und im Browser entschlüsseln
        │
        ▼
Dialog: Teilnehmer:in gibt Namen ein
        │
        ├─ Anmeldeliste vorhanden?  ──►  Name nicht enthalten  ──►  Fehlerdialog
        │                                Name enthalten
        ▼
Vorlage (JPG) auf 2480×3508 px Canvas zeichnen + Name als Text einsetzen
        │
        ▼
PDF (A4, jsPDF) erzeugen und lokal herunterladen
```

Die Anwendung besitzt genau eine Route mit einem Parameter (`:id`, siehe
[`src/app/app.routes.ts`](src/app/app.routes.ts)). Die `id` ist der Schlüssel in der
Zertifikatskonfiguration und dient gleichzeitig als „geheimer" Zugangslink für eine
Veranstaltung (z. B. `/certificate/e93a7f1b0c42d8e6a9f35c7d12b48f0e`).

Die PDF-Erzeugung läuft vollständig im Browser (Client-seitig). Es werden keine
Namen oder Bescheinigungen an einen Server übertragen.

---

## Konfiguration der Bescheinigungen

Jede Veranstaltung wird als Eintrag in `src/app/certificates/certificates.ts`
hinterlegt. Diese Datei ist per `.gitignore` ausgenommen und enthält die echten
(produktiven) Zugangslinks — als Vorlage dient
[`certificates.example.ts`](src/app/certificates/certificates.example.ts):

```ts
export const CERTIFICATES: Record<string, CERTMODEL> = {
  // Schlüssel = URL-Segment, idealerweise ein zufälliger, nicht erratbarer String
  e93a7f1b0c42d8e6a9f35c7d12b48f0e: {
    image: 'certificates/workshop-02.jpg', // Vorlage in public/certificates/
    outputFile: 'workshop-02.pdf',         // Dateiname des Downloads
    participants: 'participants/example.txt', // optional: verschl. Anmeldeliste
    nameMargin: '1100px',                  // vertikale Position des Namens
    dialogTitle: 'Teilnahmebescheinigung Beispielworkshop',
    dialogBody: 'Bitte geben Sie hier Ihren Namen ein …' // optional
  }
};
```

Felder des Modells `CERTMODEL`:

| Feld              | Pflicht | Bedeutung                                                                 |
|-------------------|---------|---------------------------------------------------------------------------|
| `image`           | ja      | Pfad zur Vorlage (JPG) relativ zu `public/`                               |
| `outputFile`      | ja      | Dateiname der erzeugten PDF                                               |
| `dialogTitle`     | ja      | Überschrift im Namens-Dialog                                              |
| `secondPageImage` | nein    | Optionale zweite PDF-Seite (JPG), z. B. für Rückseite / Programm          |
| `participants`    | nein    | Pfad zur verschlüsselten Anmeldeliste relativ zu `public/`               |
| `nameMargin`      | nein    | Vertikale Position des Namens auf der Vorlage (Default `-950px`)          |
| `dialogBody`      | nein    | Zusätzlicher Erläuterungstext im Dialog                                   |

Die Vorlagen (JPG) liegen in `public/certificates/`. Auch dieser Ordner ist
weitgehend `.gitignore`-t; nur `example.jpg` ist eingecheckt.

> **Positionierung des Namens:** `nameMargin` ist der y-Wert (in Pixeln), an dem der
> Name auf der 2480×3508 px großen Canvas-Fläche zentriert eingesetzt wird. Der Wert
> muss pro Vorlage einmal ausprobiert / justiert werden.

---

## Anmeldelisten & Verschlüsselung

Damit Teilnahmelisten nicht im Klartext im öffentlichen Web-Verzeichnis liegen,
werden die Namen **AES-verschlüsselt** (crypto-js) im Ordner
`public/participants/` abgelegt. Zur Laufzeit entschlüsselt CertiBot die Liste im
Browser und gleicht den eingegebenen Namen ab (siehe
[`encryption.ts`](src/app/services/encryption.ts)).

### Passwort konfigurieren

Das AES-Passwort steht in `encrypt/encrypt-config.ts` (per `.gitignore`
ausgenommen). Vorlage:
[`encrypt-config.example.ts`](encrypt/encrypt-config.example.ts).

```ts
export const encrypt = {
  password: 'DEIN-GEHEIMES-PASSWORT'
};
```

### Anmeldeliste verschlüsseln

1. Klartext-Namen (ein Name pro Zeile) unter `encrypt/participants/<datei>.txt`
   ablegen.
2. Den zu verarbeitenden Dateinamen in
   [`encrypt/encrypt-participants.ts`](encrypt/encrypt-participants.ts) eintragen
   (Variable `fileName`).
3. Skript ausführen — es schreibt die verschlüsselte Liste nach
   `public/participants/<datei>.txt`:

```bash
npx ts-node encrypt/encrypt-participants.ts
```

4. Den Pfad `participants/<datei>.txt` im passenden `CERTIFICATES`-Eintrag setzen.

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
| jsPDF            | PDF-Erzeugung     |
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
git clone https://github.com/ZfL-Koeln/CertiBot.git
cd CertiBot
npm install
```

Vor dem ersten Start die beiden Konfigurationsdateien aus ihren Vorlagen anlegen:

```bash
cp encrypt/encrypt-config.example.ts encrypt/encrypt-config.ts
cp src/app/certificates/certificates.example.ts src/app/certificates/certificates.ts
```

Anschließend Passwort und Bescheinigungen wie oben beschrieben eintragen.

## Entwicklungsserver

```bash
ng serve
```

Danach [http://localhost:4200/certificate/RANDOM_STRING](http://localhost:4200/certificate/RANDOM_STRING)
aufrufen (der Beispiel-Schlüssel `RANDOM_STRING` stammt aus der Beispielkonfiguration).
Die Anwendung lädt bei Änderungen an den Quelldateien automatisch neu.

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

1. Produktions-Build erstellen: `ng build`
2. Inhalt von `dist/CertiBot/browser/` in das Zielverzeichnis des Webservers kopieren
   (entsprechend dem `baseHref` `/certificate/`).
3. Die Datei [`htaccess`](htaccess) als `.htaccess` in dasselbe Verzeichnis
   kopieren — sie leitet alle Anfragen auf `index.html` um, damit das clientseitige
   Routing (`/certificate/<id>`) funktioniert.
4. Sicherstellen, dass die produktiven Vorlagen (`public/certificates/`) und
   verschlüsselten Anmeldelisten (`public/participants/`) mit ausgeliefert werden.

---

## Projektstruktur

```
CertiBot/
├── src/
│   └── app/
│       ├── app.routes.ts              # Route /:id → Certificate-Komponente
│       ├── certificates/
│       │   ├── certificates.ts        # Produktive Konfiguration (gitignored)
│       │   └── certificates.example.ts# Vorlage der Konfiguration
│       ├── components/
│       │   ├── certificate/           # Kernkomponente: Vorlage laden, Name setzen, PDF bauen
│       │   ├── dialog/                # Namens-Eingabedialog
│       │   └── error-dialog/          # Fehlerdialog (Name nicht in Liste)
│       └── services/
│           └── encryption.ts          # AES-Entschlüsselung der Anmeldeliste
├── public/
│   ├── certificates/                  # Vorlagen (JPG) – gitignored außer example.jpg
│   └── participants/                  # Verschlüsselte Anmeldelisten – gitignored außer example.txt
├── encrypt/
│   ├── encrypt-config.ts              # AES-Passwort (gitignored)
│   ├── encrypt-config.example.ts      # Vorlage des Passworts
│   └── encrypt-participants.ts        # Skript: Namen verschlüsseln
├── angular.json                       # Angular-CLI-Konfiguration (baseHref /certificate/)
├── htaccess                           # Apache-Konfiguration (→ als .htaccess umbenennen)
└── package.json                       # Abhängigkeiten und npm-Skripte
```
