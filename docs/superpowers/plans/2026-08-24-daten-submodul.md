# Daten-Submodul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die produktiven Zertifikatsdaten von CertiBot in ein privates Git-Repository auslagern und über ein Submodul unter `data/` einbinden.

**Architecture:** Ein privates Daten-Repo (`Teilnahmebescheinigungen-Aktiv`) hält flach strukturiert die echten Vorlagen (`certificates/`), Anmeldelisten (`participants/`) und die Konfiguration (`certificates.ts`). CertiBot bindet es als Submodul unter `data/` ein. Angular-Assets werden per Glob aus `data/` zusätzlich zu `public/` gemergt; die Konfiguration wird über den TypeScript-Pfad-Alias `@data/*` importiert. Die `*.example.*`-Vorlagen bleiben im öffentlichen Hauptrepo als Fallback.

**Tech Stack:** Git Submodules, Angular 22 (`@angular/build`), TypeScript path aliases.

## Global Constraints

- Daten-Repo Remote: `https://github.com/ZfL-Koeln/Teilnahmebescheinigungen-Aktiv.git` (privat, HTTPS-URL).
- Lokale Arbeitskopie des Daten-Repos: `/Users/sportello/Develop/Teilnahmebescheinigungen-Aktiv`.
- CertiBot-Repo: `/Users/sportello/Develop/CertiBot`, Arbeit auf Branch `feature/daten-submodul`.
- Submodul-Mount-Punkt: `data/` (CertiBot-Repo-Root).
- Nur echte Produktivdaten wandern ins Submodul. `example.jpg`, `example.txt`, `certificates.example.ts` und `favicon.ico` bleiben im Hauptrepo.
- Laufzeit-Asset-Pfade in der Konfiguration bleiben unverändert: `certificates/<datei>.jpg`, `participants/<datei>.txt`.
- Der Typ `CERTMODEL` bleibt zusammen mit den Daten in `certificates.ts`.

---

### Task 1: Daten-Repo flach umstrukturieren und initial committen

Baut die lokale Arbeitskopie des Daten-Repos auf die flache Zielstruktur um und erzeugt den ersten Commit. Die echten Daten stammen aus den aktuellen (gitignorierten) CertiBot-Arbeitsdateien als Quelle der Wahrheit.

**Files:**
- Data-Repo (`/Users/sportello/Develop/Teilnahmebescheinigungen-Aktiv`):
  - Create: `certificates/2026-09-10_forum-praxisphasen.jpg`
  - Create: `participants/2026-09-10_forum-praxisphasen.txt`
  - Create: `certificates.ts`
  - Create/Modify: `.gitignore` (ignoriert nur `.idea/`)
  - Create: `README.md`
  - Remove: bisherige gespiegelte Struktur (`public/`, `src/`) und `public/favicon.ico`

**Interfaces:**
- Produces: Ein Daten-Repo mit genau diesen Top-Level-Einträgen: `certificates/`, `participants/`, `certificates.ts`, `.gitignore`, `README.md`. `certificates.ts` exportiert `CERTIFICATES` (Record) und den Typ `CERTMODEL`.

- [ ] **Step 1: Bestehende Staging-Area und gespiegelte Struktur im Daten-Repo verwerfen**

Der Remote ist leer, es gibt noch keinen Commit — daher kann alles neu aufgebaut werden.

```bash
cd /Users/sportello/Develop/Teilnahmebescheinigungen-Aktiv
git rm -r --cached . 2>/dev/null; true
rm -rf public src
```

- [ ] **Step 2: Flache Verzeichnisse anlegen und echte Daten aus CertiBot kopieren**

```bash
cd /Users/sportello/Develop/Teilnahmebescheinigungen-Aktiv
mkdir -p certificates participants
cp /Users/sportello/Develop/CertiBot/public/certificates/2026-09-10_forum-praxisphasen.jpg certificates/
cp /Users/sportello/Develop/CertiBot/public/participants/2026-09-10_forum-praxisphasen.txt participants/
cp /Users/sportello/Develop/CertiBot/src/app/certificates/certificates.ts certificates.ts
```

- [ ] **Step 3: `.gitignore` und `README.md` schreiben**

`.gitignore`:

```
.idea/
.DS_Store
```

`README.md`:

```markdown
# Teilnahmebescheinigungen-Aktiv

Private Produktivdaten für [CertiBot](https://github.com/ZfL-Koeln/CertiBot).

Dieses Repository wird in CertiBot als Git-Submodul unter `data/` eingebunden.

## Struktur

- `certificates/` — Zertifikatsvorlagen (JPG), Laufzeit-Assets
- `participants/` — AES-verschlüsselte Anmeldelisten (TXT)
- `certificates.ts` — produktive Konfiguration (`CERTIFICATES` + Typ `CERTMODEL`)

## Verwendung

In CertiBot:

    git submodule update --remote data

Details siehe README von CertiBot.
```

- [ ] **Step 4: Struktur verifizieren**

Run:
```bash
cd /Users/sportello/Develop/Teilnahmebescheinigungen-Aktiv
find . -not -path './.git/*' -not -path './.idea/*' | sort
```
Expected (genau diese Einträge, keine `public/`- oder `src/`-Pfade):
```
.
./.gitignore
./README.md
./certificates
./certificates/2026-09-10_forum-praxisphasen.jpg
./certificates.ts
./participants
./participants/2026-09-10_forum-praxisphasen.txt
```

- [ ] **Step 5: Initial commit im Daten-Repo**

```bash
cd /Users/sportello/Develop/Teilnahmebescheinigungen-Aktiv
git add .
git commit -m "Initiale Struktur: certificates, participants, certificates.ts"
```

Expected: Commit wird erstellt (`git log --oneline` zeigt genau einen Commit).

---

### Task 2: Daten-Repo zu GitHub pushen (Checkpoint — erfordert GitHub-Zugang des Nutzers)

`git submodule add` klont den Remote — dafür muss das private Repo mindestens einen gepushten Commit haben. Dieser Push ist eine nach außen gerichtete Aktion und erfordert die GitHub-Credentials des Nutzers.

**Files:** keine (Remote-Operation).

**Interfaces:**
- Produces: Der Remote `https://github.com/ZfL-Koeln/Teilnahmebescheinigungen-Aktiv.git` enthält den Branch `main` mit dem Commit aus Task 1.

- [ ] **Step 1: Remote prüfen/setzen**

Run:
```bash
cd /Users/sportello/Develop/Teilnahmebescheinigungen-Aktiv
git remote -v
```
Falls kein `origin` gesetzt ist:
```bash
git remote add origin https://github.com/ZfL-Koeln/Teilnahmebescheinigungen-Aktiv.git
```

- [ ] **Step 2: Branch benennen und pushen (Nutzer-Aktion)**

```bash
cd /Users/sportello/Develop/Teilnahmebescheinigungen-Aktiv
git branch -M main
git push -u origin main
```

Hinweis: Bei HTTPS fragt GitHub nach Login/Token. Dieser Schritt wird vom Nutzer ausgeführt bzw. bestätigt.

- [ ] **Step 3: Push verifizieren**

Run:
```bash
git ls-remote https://github.com/ZfL-Koeln/Teilnahmebescheinigungen-Aktiv.git
```
Expected: Ausgabe enthält eine Zeile mit `refs/heads/main` und dem Commit-SHA.

---

### Task 3: Submodul in CertiBot einbinden

Fügt das private Repo als Submodul unter `data/` hinzu und committet die Referenz auf dem Feature-Branch.

**Files:**
- CertiBot:
  - Create: `.gitmodules`
  - Create: `data/` (Submodul-Gitlink)

**Interfaces:**
- Consumes: Gepushter Remote aus Task 2.
- Produces: `data/certificates.ts`, `data/certificates/…`, `data/participants/…` sind im CertiBot-Arbeitsbaum verfügbar. `.gitmodules` definiert das Submodul `data`.

- [ ] **Step 1: Sicherstellen, auf dem Feature-Branch zu sein**

Run:
```bash
cd /Users/sportello/Develop/CertiBot
git branch --show-current
```
Expected: `feature/daten-submodul`

- [ ] **Step 2: Submodul hinzufügen**

```bash
cd /Users/sportello/Develop/CertiBot
git submodule add https://github.com/ZfL-Koeln/Teilnahmebescheinigungen-Aktiv.git data
```

Expected: `data/` wird geklont; `.gitmodules` wird erstellt.

- [ ] **Step 3: Submodul-Inhalt verifizieren**

Run:
```bash
cat /Users/sportello/Develop/CertiBot/.gitmodules
ls /Users/sportello/Develop/CertiBot/data
```
Expected: `.gitmodules` enthält `path = data` und die HTTPS-URL. `ls` zeigt `certificates`, `participants`, `certificates.ts`, `README.md`.

- [ ] **Step 4: Submodul-Referenz committen**

```bash
cd /Users/sportello/Develop/CertiBot
git add .gitmodules data
git commit -m "Daten-Submodul unter data/ einbinden

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Angular-Assets um das Submodul erweitern

Erweitert die `assets`-Konfiguration beider Targets (`build`, `test`), sodass die Vorlagen und Anmeldelisten aus dem Submodul an denselben Laufzeit-Ausgabepfad wie die `public/`-Assets gemergt werden.

**Files:**
- Modify: `angular.json` (assets in `architect.build.options` und `architect.test.options`)

**Interfaces:**
- Consumes: Submodul unter `data/` aus Task 3.
- Produces: `ng build` kopiert `data/certificates/**` → `certificates/**` und `data/participants/**` → `participants/**` in den Output.

- [ ] **Step 1: `assets` im `build`-Target ändern**

In `angular.json`, `projects.CertiBot.architect.build.options.assets`, den bisherigen Block

```json
"assets": [
  {
    "glob": "**/*",
    "input": "public"
  }
],
```

ersetzen durch:

```json
"assets": [
  {
    "glob": "**/*",
    "input": "public"
  },
  {
    "glob": "certificates/**",
    "input": "data"
  },
  {
    "glob": "participants/**",
    "input": "data"
  }
],
```

- [ ] **Step 2: `assets` im `test`-Target identisch ändern**

In `angular.json`, `projects.CertiBot.architect.test.options.assets`, denselben Block wie in Step 1 einsetzen (aktuell nur `{ "glob": "**/*", "input": "public" }`).

- [ ] **Step 3: JSON-Gültigkeit und Build-Kopie verifizieren**

Run:
```bash
cd /Users/sportello/Develop/CertiBot
node -e "JSON.parse(require('fs').readFileSync('angular.json','utf8')); console.log('angular.json OK')"
npx ng build
```
Expected: `angular.json OK`, Build erfolgreich. Danach:
```bash
ls dist/CertiBot/browser/certificates dist/CertiBot/browser/participants
```
Expected: `certificates/` enthält `example.jpg` **und** `2026-09-10_forum-praxisphasen.jpg`; `participants/` enthält `example.txt` **und** `2026-09-10_forum-praxisphasen.txt`.

- [ ] **Step 4: Commit**

```bash
cd /Users/sportello/Develop/CertiBot
git add angular.json
git commit -m "Assets: certificates/ und participants/ aus Submodul mergen

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: TypeScript-Pfad-Alias einrichten und Config-Import umstellen

Führt den Alias `@data/*` ein und stellt den Import in `certificate.ts` auf die Konfiguration aus dem Submodul um.

**Files:**
- Modify: `tsconfig.json` (`compilerOptions`)
- Modify: `src/app/components/certificate/certificate.ts:16`

**Interfaces:**
- Consumes: `data/certificates.ts` (exportiert `CERTIFICATES` und Typ `CERTMODEL`) aus Task 3.
- Produces: Die App bezieht `CERTIFICATES` und `CERTMODEL` über `@data/certificates`.

- [ ] **Step 1: Alias in `tsconfig.json` ergänzen**

In `tsconfig.json`, im `compilerOptions`-Objekt, folgende zwei Einträge ergänzen (nach `"module": "preserve"`):

```json
"baseUrl": ".",
"paths": {
  "@data/*": ["data/*"]
}
```

- [ ] **Step 2: Import in `certificate.ts` umstellen**

In `src/app/components/certificate/certificate.ts` Zeile 16 ersetzen:

von
```ts
import {CERTIFICATES, CERTMODEL} from '../../certificates/certificates';
```
zu
```ts
import {CERTIFICATES, CERTMODEL} from '@data/certificates';
```

- [ ] **Step 3: Build gegen den neuen Import verifizieren**

Run:
```bash
cd /Users/sportello/Develop/CertiBot
npx ng build
```
Expected: Build erfolgreich (der Alias `@data/certificates` wird aufgelöst, keine „Cannot find module"-Fehler).

- [ ] **Step 4: Commit**

```bash
cd /Users/sportello/Develop/CertiBot
git add tsconfig.json src/app/components/certificate/certificate.ts
git commit -m "Config-Import auf @data-Alias (Submodul) umstellen

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Ausgelagerte Produktivdaten aus dem Hauptrepo entfernen und `.gitignore` bereinigen

Entfernt die nun im Submodul liegenden echten Daten aus dem CertiBot-Arbeitsbaum und bereinigt die veralteten `.gitignore`-Regeln. Die Beispieldateien bleiben.

**Files:**
- Remove (Arbeitsbaum, gitignoriert — kein `git rm` nötig):
  - `public/certificates/2026-09-10_forum-praxisphasen.jpg`
  - `public/participants/2026-09-10_forum-praxisphasen.txt`
  - `src/app/certificates/certificates.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: Umgestellter Import aus Task 5 (nichts referenziert mehr `src/app/certificates/certificates.ts`).
- Produces: Sauberer Arbeitsbaum; echte Daten existieren nur noch unter `data/`.

- [ ] **Step 1: Ausgelagerte Dateien aus dem Arbeitsbaum löschen**

```bash
cd /Users/sportello/Develop/CertiBot
rm -f public/certificates/2026-09-10_forum-praxisphasen.jpg
rm -f public/participants/2026-09-10_forum-praxisphasen.txt
rm -f src/app/certificates/certificates.ts
```

- [ ] **Step 2: `.gitignore` bereinigen**

In `.gitignore` die folgenden drei Blöcke **entfernen** (sie betreffen nun ausgelagerte Daten):

```
/public/participants/*
!/public/participants/example.txt

/public/certificates/*
!/public/certificates/example.jpg
```
und
```
/src/app/certificates/certificates.ts
```

Die Regeln zu `/encrypt/…` und `/participants/*` (Root-Verzeichnis) **bleiben unverändert**.

- [ ] **Step 3: Beispieldateien-Verbleib und Build verifizieren**

Run:
```bash
cd /Users/sportello/Develop/CertiBot
ls public/certificates public/participants src/app/certificates
```
Expected: `public/certificates/example.jpg`, `public/participants/example.txt`, `src/app/certificates/certificates.example.ts` sind vorhanden; die produktiven Dateien fehlen.

```bash
npx ng build
ls dist/CertiBot/browser/certificates dist/CertiBot/browser/participants
```
Expected: Build erfolgreich; Output enthält weiterhin example- **und** produktive Dateien (letztere aus dem Submodul).

- [ ] **Step 4: Commit**

```bash
cd /Users/sportello/Develop/CertiBot
git add .gitignore
git commit -m "Ausgelagerte Produktivdaten entfernen, .gitignore bereinigen

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Fallback ohne Submodul-Zugang verifizieren

Stellt sicher, dass Contributor ohne Zugang zum privaten Repo bauen können, indem `data/certificates.ts` aus der Beispielvorlage erstellt wird. Dieser Task verifiziert nur den Fallback-Pfad und stellt den Submodul-Zustand danach wieder her.

**Files:** keine dauerhaften Änderungen.

**Interfaces:**
- Consumes: `src/app/certificates/certificates.example.ts`, Alias `@data/*` aus Task 5.

- [ ] **Step 1: Submodul temporär leeren (simuliert fehlenden Zugang)**

```bash
cd /Users/sportello/Develop/CertiBot
git submodule deinit -f data
```
Expected: `data/` ist nun leer.

- [ ] **Step 2: `data/` aus Beispielen befüllen**

```bash
cd /Users/sportello/Develop/CertiBot
mkdir -p data/certificates data/participants
cp src/app/certificates/certificates.example.ts data/certificates.ts
```

- [ ] **Step 3: Build im Fallback-Modus verifizieren**

Run:
```bash
cd /Users/sportello/Develop/CertiBot
npx ng build
```
Expected: Build erfolgreich (App nutzt die Beispiel-Konfiguration über `@data/certificates`).

- [ ] **Step 4: Submodul-Zustand wiederherstellen**

```bash
cd /Users/sportello/Develop/CertiBot
rm -rf data
git submodule update --init data
```
Expected: `ls data` zeigt wieder `certificates`, `participants`, `certificates.ts`, `README.md` aus dem Remote.

---

### Task 8: README aktualisieren

Passt die betroffenen README-Abschnitte an das Submodul-Modell an.

**Files:**
- Modify: `README.md` (Abschnitte „Konfiguration der Bescheinigungen", „Anmeldelisten & Verschlüsselung", „Installation", „Projektstruktur", „Deployment")

**Interfaces:**
- Consumes: fertige Submodul-Einbindung aus Tasks 3–6.

- [ ] **Step 1: Klon-Anweisung in „Installation" ergänzen**

In `README.md`, Abschnitt „Installation", den Klon-Block ersetzen durch:

```bash
git clone --recurse-submodules https://github.com/ZfL-Koeln/CertiBot.git
cd CertiBot
npm install
```

Und einen Hinweis ergänzen: Nach einem normalen Klon lässt sich das Submodul mit `git submodule update --init data` nachladen. Ohne Zugang zum privaten Datenrepo stattdessen den Fallback nutzen:

```bash
mkdir -p data/certificates data/participants
cp src/app/certificates/certificates.example.ts data/certificates.ts
```

- [ ] **Step 2: Pfadangaben in „Konfiguration der Bescheinigungen" anpassen**

Die Formulierung „Jede Veranstaltung wird als Eintrag in `src/app/certificates/certificates.ts` hinterlegt … per `.gitignore` ausgenommen" ersetzen durch den Verweis, dass die produktive Konfiguration jetzt in `data/certificates.ts` (privates Submodul) liegt, und `certificates.example.ts` weiterhin als Vorlage im Hauptrepo dient. Den Hinweis „Auch dieser Ordner ist weitgehend `.gitignore`-t; nur `example.jpg` ist eingecheckt" für `public/certificates/` ersetzen durch: Vorlagen liegen produktiv unter `data/certificates/`; im Hauptrepo bleibt nur `example.jpg`.

- [ ] **Step 3: „Anmeldelisten & Verschlüsselung" anpassen**

Ergänzen, dass die verschlüsselten Listen produktiv unter `data/participants/` (Submodul) liegen; das Verschlüsselungsskript unter `encrypt/` bleibt unverändert und schreibt weiterhin nach `public/participants/` — der erzeugte Output wird anschließend ins Submodul (`data/participants/`) übernommen. (Skript-Zielpfad wird in diesem Plan nicht geändert; nur der Ablauf dokumentiert.)

- [ ] **Step 4: „Projektstruktur" aktualisieren**

Den Struktur-Baum um das Submodul ergänzen:

```
CertiBot/
├── data/                              # privates Submodul (Produktivdaten)
│   ├── certificates/                  # Vorlagen (JPG)
│   ├── participants/                  # verschlüsselte Anmeldelisten
│   └── certificates.ts                # produktive Konfiguration
├── src/app/certificates/
│   └── certificates.example.ts        # Vorlage der Konfiguration
├── public/
│   ├── certificates/example.jpg       # Beispielvorlage
│   └── participants/example.txt       # Beispiel-Anmeldeliste
…
```

- [ ] **Step 5: „Deployment" ergänzen**

In „Deployment (Apache)" ergänzen: Vor dem Build sicherstellen, dass das Submodul initialisiert ist (`git submodule update --init data`), damit die produktiven Vorlagen und Listen mit in `dist/` gebaut werden. Den Sync-Befehl für Aktualisierungen dokumentieren:

```bash
git submodule update --remote data
git add data && git commit -m "Daten-Submodul aktualisiert"
```

- [ ] **Step 6: Commit**

```bash
cd /Users/sportello/Develop/CertiBot
git add README.md
git commit -m "README: Daten-Submodul-Workflow dokumentieren

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Verifikation (Gesamt)

- [ ] `ng build` läuft mit initialisiertem Submodul fehlerfrei; `dist/CertiBot/browser/certificates` und `…/participants` enthalten example- und produktive Dateien.
- [ ] `ng build` läuft auch im Fallback (data/ aus Beispiel) fehlerfrei (Task 7).
- [ ] `.gitmodules` referenziert die private HTTPS-URL; `git submodule status` zeigt `data` sauber.
- [ ] Keine echten Produktivdaten mehr im Hauptrepo-Arbeitsbaum außerhalb von `data/`.
- [ ] Bestehender Unit-Test bleibt grün: `npx ng test --watch=false --browsers=ChromeHeadless` (sofern lokal ausführbar).
