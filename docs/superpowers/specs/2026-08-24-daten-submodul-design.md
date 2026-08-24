# Design: Produktivdaten als Git-Submodul einbinden

**Datum:** 2026-08-24
**Status:** Genehmigt (Design-Phase)

## Ziel

Die produktiven Zertifikatsdaten von CertiBot sollen in ein eigenes, privates
Repository ausgelagert und in die Angular-Anwendung über ein **Git-Submodul**
eingebunden und synchronisiert werden.

Betroffene Daten (heute im Hauptrepo, `.gitignore`-t):

- `public/certificates/*.jpg` — Zertifikatsvorlagen (Laufzeit-Assets)
- `public/participants/*.txt` — verschlüsselte Anmeldelisten (Laufzeit-Assets)
- `src/app/certificates/certificates.ts` — produktive Konfiguration (Build-Zeit-Import)

## Grundprinzip

**Trennung „öffentliches App-Gerüst" vs. „private Produktivdaten".**
Das Submodul enthält **ausschließlich echte Produktivdaten**. Die `*.example.*`-Vorlagen
und das Favicon bleiben im Hauptrepo, damit CertiBot ein eigenständiges, öffentlich
klonbares Repo bleibt und das im README beschriebene Setup ohne Zugriff auf das private
Datenrepo weiter funktioniert.

## Ziel-Repository

- **Remote:** `https://github.com/ZfL-Koeln/Teilnahmebescheinigungen-Aktiv.git`
- Lokale Arbeitskopie liegt aktuell unter `/Users/sportello/Develop/Teilnahmebescheinigungen-Aktiv`
  (noch nichts committed/gepusht). Die bestehende gespiegelte Ordnerstruktur
  (`public/…`, `src/app/…`) und das versehentlich kopierte `public/favicon.ico`
  werden verworfen und durch die flache Zielstruktur ersetzt.

## Struktur des Daten-Repos (flach)

```
Teilnahmebescheinigungen-Aktiv/
├── certificates/
│   └── 2026-09-10_forum-praxisphasen.jpg
├── participants/
│   └── 2026-09-10_forum-praxisphasen.txt
├── certificates.ts          # produktive Konfiguration: CERTIFICATES + Typ CERTMODEL
├── .gitignore               # ignoriert nur .idea/
└── README.md                # kurze Erklärung, wie das Repo als Submodul dient
```

Der Typ `CERTMODEL` bleibt zusammen mit den Daten in `certificates.ts` (keine
Auftrennung des Typ-Contracts). `certificates.example.ts` wandert **nicht** hierher,
sondern bleibt im Hauptrepo.

## Einbindung im Hauptrepo (CertiBot)

### Submodul-Mount

- Mount-Punkt: **`data/`** (Repo-Root von CertiBot)
- `.gitmodules`:
  ```
  [submodule "data"]
      path = data
      url = https://github.com/ZfL-Koeln/Teilnahmebescheinigungen-Aktiv.git
  ```

### Assets (`angular.json`)

`assets` beider Targets (`build` und `test`) wird erweitert. Die Ordner
`certificates/` und `participants/` aus dem Submodul werden an denselben
Laufzeit-Ausgabepfad gemergt, an dem heute die `public/`-Assets landen:

```json
"assets": [
  { "glob": "**/*", "input": "public" },
  { "glob": "certificates/**", "input": "data" },
  { "glob": "participants/**", "input": "data" }
]
```

Ergebnis: `data/certificates/x.jpg` → `certificates/x.jpg` und
`public/certificates/example.jpg` → `certificates/example.jpg` liegen gemeinsam
im Asset-Root. Die Laufzeit-Pfade in `certificates.ts` (`certificates/…`,
`participants/…`) bleiben damit unverändert gültig.

### Config-Import (`tsconfig.json`)

Pfad-Alias, damit die Konfiguration aus `data/` sauber importiert werden kann
(statt relativer `../../../data`-Pfade):

```json
"compilerOptions": {
  "baseUrl": ".",
  "paths": { "@data/*": ["data/*"] }
}
```

In `src/app/components/certificate/certificate.ts` ändert sich der Import:

```ts
// vorher: import {CERTIFICATES, CERTMODEL} from '../../certificates/certificates';
import {CERTIFICATES, CERTMODEL} from '@data/certificates';
```

Die Datei `data/certificates.ts` wird automatisch ins TS-Programm gezogen, da sie
importiert wird (kein Eintrag in `include` von `tsconfig.app.json` nötig).

## Was aus dem Hauptrepo entfernt wird

- `src/app/certificates/certificates.ts` → ins Submodul verschoben.
  `src/app/certificates/certificates.example.ts` **bleibt** (Vorlage).
- Echte Daten `public/certificates/2026-09-10_forum-praxisphasen.jpg` und
  `public/participants/2026-09-10_forum-praxisphasen.txt` → ins Submodul.
  `public/certificates/example.jpg` und `public/participants/example.txt`
  **bleiben** im Hauptrepo.
- `.gitignore` wird bereinigt: die Ignore-Regeln für die nun ausgelagerten
  Produktivdaten unter `public/certificates/*`, `public/participants/*` und
  `src/app/certificates/certificates.ts` werden entfernt. Die Regeln rund um
  `encrypt/` und das root-`participants/`-Verzeichnis bleiben unangetastet.

## Öffentliches Haupt-Repo, privates Daten-Repo

CertiBot bleibt ein **öffentliches** Repo; das Daten-Repo ist **privat**. Ein
öffentliches Repo darf ein privates als Submodul referenzieren.

- Das öffentliche Repo speichert vom Submodul nur `.gitmodules` (mit der URL des
  privaten Repos) und einen Commit-Zeiger (SHA). **Kein Inhalt** des privaten Repos
  (Vorlagen, Anmeldelisten, `certificates.ts`) landet im öffentlichen Repo.
- Das ist sicherer als der Ist-Zustand, in dem die Produktivdaten nur
  `.gitignore`-geschützt im öffentlichen Repo liegen und versehentlich mitcommittet
  werden könnten.
- Öffentlich sichtbar wird lediglich die URL/der Name `Teilnahmebescheinigungen-Aktiv`
  in `.gitmodules`; der Zugriff auf die Inhalte bleibt durch GitHub geschützt
  (404 / Auth erforderlich).
- Personen ohne Zugang können das Submodul nicht initialisieren → sie nutzen den
  Fallback (siehe unten). Der Produktions-Build erfordert Build-Zeit-Zugriff auf das
  private Repo, da die Daten in `dist/` mit ausgeliefert werden.
- Submodul-URL: **HTTPS** (`https://github.com/…`) — bequem für interaktive Clones
  mit GitHub-Login/Token. (SSH wäre für CI eine Alternative, ist hier aber nicht im
  Scope.)

## Developer-Experience / Fallback

Contributor **mit** Zugang zum privaten Datenrepo:

```bash
git clone --recurse-submodules https://github.com/ZfL-Koeln/CertiBot.git
# oder nach einem normalen clone:
git submodule update --init data
```

Contributor **ohne** Zugang: statt der Submodul-Initialisierung wird `data/`
manuell aus den Beispielen befüllt (analog zum heutigen `cp`-Setup):

```bash
mkdir -p data/certificates data/participants
cp src/app/certificates/certificates.example.ts data/certificates.ts
# example-Assets liegen bereits in public/certificates + public/participants
```

Der Build benötigt zwingend eine Datei `data/certificates.ts` — entweder aus dem
Submodul oder aus der Beispielvorlage.

## Synchronisieren

Standard-Submodul-Workflow:

```bash
# Neuesten Stand der Daten holen und im Hauptrepo referenzieren:
git submodule update --remote data
git add data && git commit -m "Daten-Submodul aktualisiert"
```

## Dokumentation

Das README (Abschnitte „Konfiguration", „Anmeldelisten", „Installation",
„Projektstruktur", „Deployment") wird an das Submodul-Modell angepasst:
Klon mit `--recurse-submodules`, `data/`-Struktur, neuer Import-/Asset-Pfad,
Sync-Befehl, Fallback ohne Submodul-Zugang.

## Verifikation

- `npm ci` und `ng build` laufen mit initialisiertem Submodul fehlerfrei durch.
- Erzeugtes `dist/CertiBot/browser/certificates/…` und `…/participants/…`
  enthalten sowohl example- als auch produktive Dateien.
- `ng build` ohne Submodul, aber mit aus der Vorlage erstelltem `data/certificates.ts`,
  läuft ebenfalls durch (Fallback-Pfad).
- Der bestehende Unit-Test (`app.spec.ts`) bleibt grün.

## Nicht im Scope

- Verschlüsselungs-Skripte unter `encrypt/` und deren Config bleiben unverändert.
- Kein CI/CD-Umbau, kein automatisches Submodul-Update im Deployment.
- Keine Auftrennung des Typ-Contracts `CERTMODEL` aus den Daten.
