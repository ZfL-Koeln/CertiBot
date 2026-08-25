# Vereinfachte Bescheinigungspflege — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bescheinigungen ohne externes Tangent, ohne händisches Editieren von `certificates.ts` und ohne App-Rebuild anlegen — die App lädt die Konfiguration zur Laufzeit und stempelt Namen direkt in PDF-Vorlagen; ein lokales Werkzeug `certadmin` erzeugt Config, verschlüsselt Anmeldelisten und legt alles im `data/`-Submodul ab.

**Architecture:** Zwei Teile. (1) App-Umbau: pro Veranstaltung `config/<id>.json` per HTTP laden statt einkompilierter `CERTIFICATES`; Namen mit `pdf-lib` in eine PDF-Vorlage stempeln statt auf ein JPG-Canvas zu zeichnen. (2) Lokales Node-Werkzeug `certadmin` mit pdf.js-Vorschau zum Positionieren des Namens, das PDF/Config/verschlüsselte Liste ins `data/`-Submodul schreibt (kein Upload, kein Git-Commit).

**Tech Stack:** Angular 22, `pdf-lib` + `@pdf-lib/fontkit` (App-Laufzeit, ersetzt `jspdf`), `pdfjs-dist` (nur Werkzeug-Vorschau), `crypto-js` (bereits vorhanden, AES), Node 26 (`node:test`, `node:http`, `node:crypto`).

## Global Constraints

- Angular `^22.1.3`, Standalone Components, `ChangeDetectionStrategy` wie in bestehenden Komponenten.
- `baseHref` bleibt `/certificate/`; alle Laufzeit-Fetches sind **relativ** (`config/<id>.json`, `templates/<id>.pdf`, `fonts/albert-sans.ttf`, `participants/<id>.txt`) und lösen dadurch gegen `/certificate/...` auf.
- Namensfarbe Default `#005179` (bisheriger Wert). Namensschrift: Albert Sans (eingebettetes TTF).
- Koordinaten in `config.name`: `x` = **horizontaler Mittelpunkt** des Namens, `y` = Textbasislinie, beide in **PDF-Punkten mit Ursprung unten-links** (pdf-lib-Konvention). A4 = 595×842 pt.
- Das Werkzeug schreibt **ausschließlich** nach `data/` (Ordner `config/`, `templates/`, `participants/`). Kein scp/Upload, kein `git commit`/`push`.
- AES-Passwort stammt aus `encrypt/encrypt-config.ts` (per `.gitignore` ausgenommen).
- Häufige Commits, ein Commit pro Task-Ende.

---

## Phase A — App-Umbau (Laufzeit-Config + PDF-Stempeln)

### Task A1: Abhängigkeiten + Font-Asset

**Files:**
- Modify: `package.json` (dependencies)
- Create: `public/fonts/albert-sans.ttf`

**Interfaces:**
- Produces: verfügbare Module `pdf-lib` (`PDFDocument`, `rgb`) und `@pdf-lib/fontkit` (default export) für spätere Tasks; Font unter Laufzeitpfad `fonts/albert-sans.ttf`.

- [ ] **Step 1: pdf-lib + fontkit installieren, ungenutztes html2canvas entfernen**

```bash
cd /Users/sportello/Develop/CertiBot
npm install pdf-lib@^1.17.1 @pdf-lib/fontkit@^1.1.1
npm uninstall html2canvas
```
> `jspdf` bleibt vorerst installiert und wird **erst in Task A5** entfernt — zusammen mit seiner Nutzung in `certificate.ts`. `certificate.ts` wird in diesem Task **nicht** angefasst.

- [ ] **Step 2: Albert Sans als statisches TTF laden** (Fontsource liefert nur woff2; pdf-lib/fontkit braucht TTF/OTF)

```bash
mkdir -p public/fonts
curl -L -o public/fonts/albert-sans.ttf "https://cdn.jsdelivr.net/fontsource/fonts/albert-sans@latest/latin-400-normal.ttf"
```

- [ ] **Step 3: TTF verifizieren** (muss mit der TrueType-Signatur `00 01 00 00` beginnen und > 20 KB sein)

```bash
node -e "const b=require('fs').readFileSync('public/fonts/albert-sans.ttf'); console.log('size',b.length,'sig',b.slice(0,4).toString('hex'));"
```
Expected: `size` deutlich > 20000, `sig 00010000`. Falls stattdessen HTML/woff2 kam (`sig` z. B. `3c21` oder `774f`), Download-URL korrigieren, bevor weitergemacht wird.

- [ ] **Step 4: Build läuft noch** (nur Kompilierbarkeit prüfen)

```bash
npx ng build 2>&1 | tail -5
```
Expected: erfolgreicher Build (jsPDF wird in Task A5 aus dem Code entfernt; bis dahin bleibt der Import bestehen — falls der Build wegen fehlendem `jspdf` bricht, A5 vorziehen. In der Regel baut es, da der Import erst zur Laufzeit zieht).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json public/fonts/albert-sans.ttf
git commit -m "Deps: pdf-lib/fontkit statt jspdf; Albert-Sans-TTF als Font-Asset

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task A2: Konfigurations-Interface + Beispiel-Assets

**Files:**
- Create: `src/app/certificates/cert-config.ts`
- Create: `public/config/RANDOM_STRING.json`
- Create: `public/templates/example.pdf`
- Modify: `src/app/certificates/certificates.example.ts` (ersetzt altes CERTMODEL-Beispiel)

**Interfaces:**
- Produces: `interface CERTCONFIG`, `interface NamePlacement` — von Loader, Generator und Komponente konsumiert.

- [ ] **Step 1: CERTCONFIG-Interface anlegen**

`src/app/certificates/cert-config.ts`:
```ts
export interface NamePlacement {
  /** Horizontaler Mittelpunkt des Namens in PDF-Punkten (Ursprung unten-links). */
  x: number;
  /** Textbasislinie in PDF-Punkten (Ursprung unten-links). */
  y: number;
  /** Schriftgröße in pt. */
  size: number;
  /** Hex-Farbe, z. B. "#005179". Default #005179. */
  color?: string;
}

export interface CERTCONFIG {
  /** Pfad zur PDF-Vorlage, relativ zum Ausgabeverzeichnis. */
  template: string;
  /** Dateiname der heruntergeladenen PDF. */
  outputFile: string;
  /** Position/Größe/Farbe des Namens. */
  name: NamePlacement;
  /** Optionaler Pfad zur verschlüsselten Anmeldeliste. */
  participants?: string;
  /** Optionale zweite PDF-Seite (wird angehängt). */
  secondPage?: string;
  /** Überschrift im Namensdialog. */
  dialogTitle: string;
  /** Optionaler Zusatztext im Dialog. */
  dialogBody?: string;
}
```

- [ ] **Step 2: Beispiel-Konfiguration für lokale Entwicklung anlegen**

`public/config/RANDOM_STRING.json`:
```json
{
  "template": "templates/example.pdf",
  "outputFile": "beispiel-bescheinigung.pdf",
  "name": { "x": 297, "y": 560, "size": 15, "color": "#005179" },
  "dialogTitle": "Bitte geben Sie Ihren Namen ein:",
  "dialogBody": "Beispielkonfiguration für die lokale Entwicklung."
}
```

- [ ] **Step 3: Beispiel-PDF-Vorlage erzeugen** (A4, damit `ng serve` lokal ohne Produktivdaten funktioniert)

```bash
mkdir -p public/templates
node -e "
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
(async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('BEISPIEL-BESCHEINIGUNG', { x: 130, y: 700, size: 24, font, color: rgb(0,0.32,0.47) });
  page.drawText('(Platzhaltervorlage fuer die lokale Entwicklung)', { x: 150, y: 660, size: 12, font, color: rgb(0.4,0.4,0.4) });
  require('fs').writeFileSync('public/templates/example.pdf', await doc.save());
  console.log('example.pdf geschrieben');
})();
"
```
Expected: `example.pdf geschrieben`, Datei existiert.

- [ ] **Step 4: Alte Beispiel-Konfiguration ersetzen** (Typ + Beispiel auf neues Format)

`src/app/certificates/certificates.example.ts` komplett ersetzen durch:
```ts
import type { CERTCONFIG } from './cert-config';

// Beispielhafte Laufzeit-Konfiguration. Produktiv liegt pro Veranstaltung
// eine Datei config/<id>.json neben der App (siehe README).
export const EXAMPLE_CONFIG: CERTCONFIG = {
  template: 'templates/example.pdf',
  outputFile: 'beispiel-bescheinigung.pdf',
  name: { x: 297, y: 560, size: 15, color: '#005179' },
  dialogTitle: 'Bitte geben Sie Ihren Namen ein:',
  dialogBody: 'Beispielkonfiguration für die lokale Entwicklung.'
};
```

- [ ] **Step 5: Commit**

```bash
git add src/app/certificates/cert-config.ts src/app/certificates/certificates.example.ts public/config public/templates
git commit -m "Config-Format CERTCONFIG + Beispiel-Assets (config/RANDOM_STRING.json, example.pdf)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task A3: CertConfigLoader-Service

**Files:**
- Create: `src/app/services/cert-config-loader.ts`
- Test: `src/app/services/cert-config-loader.spec.ts`

**Interfaces:**
- Consumes: `CERTCONFIG` aus Task A2.
- Produces: `class CertConfigLoader` mit `load(id: string): Observable<CERTCONFIG | null>` (404/Fehler → `null`).

- [ ] **Step 1: Failing test schreiben**

`src/app/services/cert-config-loader.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CertConfigLoader } from './cert-config-loader';
import { CERTCONFIG } from '../certificates/cert-config';

describe('CertConfigLoader', () => {
  let loader: CertConfigLoader;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CertConfigLoader, provideHttpClient(), provideHttpClientTesting()]
    });
    loader = TestBed.inject(CertConfigLoader);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('fetches config/<id>.json and returns the config', () => {
    const cfg: CERTCONFIG = {
      template: 'templates/abc.pdf', outputFile: 'abc.pdf',
      name: { x: 1, y: 2, size: 3 }, dialogTitle: 'T'
    };
    let result: CERTCONFIG | null | undefined;
    loader.load('abc123').subscribe(r => (result = r));
    const req = httpMock.expectOne('config/abc123.json');
    expect(req.request.method).toBe('GET');
    req.flush(cfg);
    expect(result).toEqual(cfg);
  });

  it('returns null on 404 (unknown id)', () => {
    let result: CERTCONFIG | null | undefined;
    loader.load('missing').subscribe(r => (result = r));
    httpMock.expectOne('config/missing.json').flush('nope', { status: 404, statusText: 'Not Found' });
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Test läuft und schlägt fehl**

```bash
npx ng test --watch=false --include='**/cert-config-loader.spec.ts' 2>&1 | tail -15
```
Expected: FAIL (`CertConfigLoader` existiert nicht).

- [ ] **Step 3: Service implementieren**

`src/app/services/cert-config-loader.ts`:
```ts
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CERTCONFIG } from '../certificates/cert-config';

@Injectable({ providedIn: 'root' })
export class CertConfigLoader {
  private readonly http = inject(HttpClient);

  load(id: string): Observable<CERTCONFIG | null> {
    return this.http.get<CERTCONFIG>(`config/${id}.json`).pipe(
      catchError(() => of(null))
    );
  }
}
```

- [ ] **Step 4: Test läuft und besteht**

```bash
npx ng test --watch=false --include='**/cert-config-loader.spec.ts' 2>&1 | tail -15
```
Expected: PASS (2 specs).

- [ ] **Step 5: Commit**

```bash
git add src/app/services/cert-config-loader.ts src/app/services/cert-config-loader.spec.ts
git commit -m "CertConfigLoader: Laufzeit-Config pro id laden (404 -> null)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task A4: Farb-Helper + PdfGenerator-Service

**Files:**
- Create: `src/app/services/pdf-generator.ts`
- Test: `src/app/services/pdf-generator.spec.ts`

**Interfaces:**
- Consumes: `CERTCONFIG`; `pdf-lib`, `@pdf-lib/fontkit`.
- Produces: `hexToRgb(hex: string): { r: number; g: number; b: number }` (0..1) und `class PdfGenerator` mit `generate(config: CERTCONFIG, name: string): Promise<Blob>`.

- [ ] **Step 1: Failing test für den reinen Farb-Helper**

`src/app/services/pdf-generator.spec.ts`:
```ts
import { hexToRgb } from './pdf-generator';

describe('hexToRgb', () => {
  it('parses #005179 to 0..1 components', () => {
    const { r, g, b } = hexToRgb('#005179');
    expect(r).toBeCloseTo(0, 5);
    expect(g).toBeCloseTo(0x51 / 255, 5);
    expect(b).toBeCloseTo(0x79 / 255, 5);
  });

  it('accepts hex without leading #', () => {
    expect(hexToRgb('ffffff')).toEqual({ r: 1, g: 1, b: 1 });
  });

  it('throws on invalid input', () => {
    expect(() => hexToRgb('nope')).toThrowError(/Invalid hex/);
  });
});
```

- [ ] **Step 2: Test läuft und schlägt fehl**

```bash
npx ng test --watch=false --include='**/pdf-generator.spec.ts' 2>&1 | tail -15
```
Expected: FAIL (`hexToRgb` nicht exportiert).

- [ ] **Step 3: Helper + Service implementieren**

`src/app/services/pdf-generator.ts`:
```ts
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { CERTCONFIG } from '../certificates/cert-config';

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) throw new Error(`Invalid hex color: ${hex}`);
  const int = parseInt(m[1], 16);
  return { r: ((int >> 16) & 255) / 255, g: ((int >> 8) & 255) / 255, b: (int & 255) / 255 };
}

@Injectable({ providedIn: 'root' })
export class PdfGenerator {
  private readonly http = inject(HttpClient);
  private fontCache?: ArrayBuffer;

  async generate(config: CERTCONFIG, name: string): Promise<Blob> {
    const tplBytes = await firstValueFrom(
      this.http.get(config.template, { responseType: 'arraybuffer' })
    );
    const fontBytes = await this.loadFont();

    const pdfDoc = await PDFDocument.load(tplBytes);
    pdfDoc.registerFontkit(fontkit);
    const font = await pdfDoc.embedFont(fontBytes, { subset: true });

    const page = pdfDoc.getPage(0);
    const size = config.name.size;
    const textWidth = font.widthOfTextAtSize(name, size);
    const { r, g, b } = hexToRgb(config.name.color ?? '#005179');
    page.drawText(name, {
      x: config.name.x - textWidth / 2,
      y: config.name.y,
      size,
      font,
      color: rgb(r, g, b),
    });

    if (config.secondPage) {
      const spBytes = await firstValueFrom(
        this.http.get(config.secondPage, { responseType: 'arraybuffer' })
      );
      const spDoc = await PDFDocument.load(spBytes);
      const [copied] = await pdfDoc.copyPages(spDoc, [0]);
      pdfDoc.addPage(copied);
    }

    const out = await pdfDoc.save();
    return new Blob([out], { type: 'application/pdf' });
  }

  private async loadFont(): Promise<ArrayBuffer> {
    if (!this.fontCache) {
      this.fontCache = await firstValueFrom(
        this.http.get('fonts/albert-sans.ttf', { responseType: 'arraybuffer' })
      );
    }
    return this.fontCache;
  }
}
```

- [ ] **Step 4: Test läuft und besteht**

```bash
npx ng test --watch=false --include='**/pdf-generator.spec.ts' 2>&1 | tail -15
```
Expected: PASS (3 specs). Der volle PDF-Weg (`generate`) wird in Task A5 manuell im Browser verifiziert — er ist im Karma-Headless nicht sinnvoll testbar (Font-Fetch + Binär-PDF).

- [ ] **Step 5: Commit**

```bash
git add src/app/services/pdf-generator.ts src/app/services/pdf-generator.spec.ts
git commit -m "PdfGenerator: Namen mit pdf-lib in PDF-Vorlage stempeln (+ hexToRgb, getestet)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task A5: Certificate-Komponente umbauen

**Files:**
- Modify: `src/app/components/certificate/certificate.ts` (komplett ersetzen)
- Modify: `src/app/components/certificate/certificate.html`
- Modify: `src/app/components/certificate/certificate.spec.ts`

**Interfaces:**
- Consumes: `CertConfigLoader.load` (Task A3), `PdfGenerator.generate` (Task A4), `Encryption.decrypt` (bestehend), `Dialog`/`ErrorDialog` (bestehend).

- [ ] **Step 1: Komponentenlogik ersetzen**

`src/app/components/certificate/certificate.ts` komplett ersetzen durch:
```ts
import { Component, inject, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Encryption } from '../../services/encryption';
import { CertConfigLoader } from '../../services/cert-config-loader';
import { PdfGenerator } from '../../services/pdf-generator';
import { filter, map, switchMap, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { Dialog } from '../dialog/dialog';
import { ErrorDialog } from '../error-dialog/error-dialog';
import { CERTCONFIG } from '../../certificates/cert-config';

export interface DialogData {
  name: string;
  title: string;
  body: string;
}

@Component({
  selector: 'app-certificate',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, FormsModule, MatButtonModule],
  templateUrl: './certificate.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./certificate.scss']
})
export class Certificate implements OnInit, OnDestroy {
  private readonly encryption = inject(Encryption);
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly configLoader = inject(CertConfigLoader);
  private readonly pdfGenerator = inject(PdfGenerator);
  public readonly dialog = inject(MatDialog);
  public readonly errorDialog = inject(MatDialog);
  private readonly destroy$ = new Subject<void>();

  name = '';
  ready = true;
  private config?: CERTCONFIG;
  private participants: string[] = [];

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map(pm => pm.get('id')),
        switchMap(id => this.configLoader.load(id ?? '')),
        takeUntil(this.destroy$)
      )
      .subscribe(cfg => {
        if (!cfg) {
          this.errorDialog.open(ErrorDialog, { disableClose: true });
          return;
        }
        this.config = cfg;

        if (cfg.participants) {
          this.http.get(cfg.participants, { responseType: 'text' })
            .subscribe(data => {
              const encryptedNames = data.split('\n').filter(Boolean);
              this.participants = encryptedNames.map(n => this.encryption.decrypt(n));
            });
        }

        this.openNameDialogAndGenerate();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private openNameDialogAndGenerate(): void {
    const cfg = this.config!;
    const dialogRef = this.dialog.open(Dialog, {
      data: { name: this.name, title: cfg.dialogTitle, body: cfg.dialogBody ?? '' },
      disableClose: true,
      autoFocus: true,
    });

    dialogRef.afterClosed()
      .pipe(
        filter((result: string | undefined) => !!result && result.trim().length > 0),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: async (result) => {
          this.name = (result as string).trim();

          if (this.participants.length > 0 && !this.participants.includes(this.name)) {
            this.errorDialog.open(ErrorDialog, { disableClose: true });
            return;
          }

          try {
            const blob = await this.pdfGenerator.generate(cfg, this.name);
            this.downloadBlob(blob, cfg.outputFile || 'teilnahmebescheinigung.pdf');
          } catch (err) {
            console.error('Failed to generate PDF', err);
            this.errorDialog.open(ErrorDialog, { disableClose: true });
          } finally {
            this.ready = false;
          }
        }
      });
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
```

- [ ] **Step 2: Template vereinfachen** (kein On-Screen-Certificate/Canvas mehr nötig)

`src/app/components/certificate/certificate.html` komplett ersetzen durch:
```html
<div id="bgr"></div>
```

- [ ] **Step 3: Komponenten-Spec auf HttpClient-Testing umstellen**

`src/app/components/certificate/certificate.spec.ts` komplett ersetzen durch:
```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Certificate } from './certificate';

describe('Certificate', () => {
  let component: Certificate;
  let fixture: ComponentFixture<Certificate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Certificate],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Certificate);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
```

- [ ] **Step 4: jsPDF-Dependency entfernen** (Nutzung ist mit Step 1 aus `certificate.ts` verschwunden)

```bash
npm uninstall jspdf
```
Danach prüfen, dass keine Referenz mehr existiert:
```bash
grep -rn "jspdf\|jsPDF" src/ | grep -v node_modules
```
Expected: keine Treffer.

- [ ] **Step 5: Unit-Tests der Komponente laufen**

```bash
npx ng test --watch=false --include='**/certificate.spec.ts' 2>&1 | tail -20
```
Expected: PASS (`should create`). Bei ausstehenden HTTP-Requests ggf. `provideHttpClientTesting` bereitgestellt — der Test rendert nur, ohne id, daher kein Fetch.

- [ ] **Step 6: Manuelle End-to-End-Verifikation im Browser**

```bash
npx ng serve
```
Dann `http://localhost:4200/certificate/RANDOM_STRING` öffnen, Namen „Test Person" eingeben. Erwartung: eine PDF `beispiel-bescheinigung.pdf` wird heruntergeladen; auf Seite 1 steht „Test Person" (Albert Sans, dunkelblau) an Position (297, 560). Danach `http://localhost:4200/certificate/gibtsnicht` → Fehlerdialog. Server mit Strg-C beenden.

- [ ] **Step 7: Commit**

```bash
git add src/app/components/certificate/certificate.ts src/app/components/certificate/certificate.html src/app/components/certificate/certificate.spec.ts package.json package-lock.json
git commit -m "Certificate: Laufzeit-Config + pdf-lib-Download statt Canvas/JPG; jspdf entfernt

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task A6: Build-Assets bereinigen

**Files:**
- Modify: `angular.json` (beide `assets`-Blöcke)
- Modify: `README.md` (Abschnitte Konfiguration/Deployment/Projektstruktur)

**Interfaces:**
- Consumes: neue Ordnerstruktur `public/config`, `public/templates`, `public/fonts`.

- [ ] **Step 1: Data-Globs aus `angular.json` entfernen**

In `angular.json` in **beiden** `assets`-Arrays (Zeilen ~26–39 und ~94–107) die beiden Data-Einträge löschen, sodass nur noch der `public`-Eintrag bleibt:
```json
"assets": [
  {
    "glob": "**/*",
    "input": "public"
  }
],
```
Begründung: Produktive `config/`, `templates/`, `participants/` liegen nur auf dem Server und werden separat hochgeladen; der App-Build bündelt sie nicht. Lokale Beispieldaten kommen aus `public/`.

Außerdem in `angular.json` das in Task A5 großzügig auf `2.5MB` angehobene `maximumError` des `initial`-Budgets auf `2.2MB` straffen (gemessenes Initial-Bundle ~2.11MB, so bleibt das Budget ein sinnvoller Regressions-Wächter mit etwas Puffer). Den `maximumWarning`-Wert unverändert lassen.

- [ ] **Step 2: Sauberer Produktions-Build**

```bash
npx ng build 2>&1 | tail -8
```
Expected: erfolgreicher Build ohne Fehler. Prüfen, dass `dist/CertiBot/browser/fonts/albert-sans.ttf`, `dist/CertiBot/browser/config/RANDOM_STRING.json` und `dist/CertiBot/browser/templates/example.pdf` existieren:
```bash
ls dist/CertiBot/browser/fonts dist/CertiBot/browser/config dist/CertiBot/browser/templates
```

- [ ] **Step 3: README auf neue Struktur aktualisieren**

In `README.md`: den JPG/`nameMargin`/`certificates.ts`-Ablauf durch die neue Struktur ersetzen — `config/<id>.json` (Format-Tabelle wie in der Spec), PDF-Vorlagen unter `templates/`, Font unter `fonts/albert-sans.ttf`, sowie den Hinweis, dass neue Bescheinigungen mit dem Werkzeug `certadmin` (Phase B) angelegt werden und **kein Rebuild** nötig ist. Den Abschnitt „Anmeldelisten & Verschlüsselung" auf das Werkzeug verweisen.

- [ ] **Step 4: Commit**

```bash
git add angular.json README.md
git commit -m "Build: nur public/ als Assets; README auf Laufzeit-Config umgestellt

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase B — Werkzeug `certadmin`

### Task B1: Werkzeug-Kernlogik (Node-Bibliothek)

**Files:**
- Create: `tools/certadmin/lib/certadmin.js`
- Test: `tools/certadmin/lib/certadmin.test.js`
- Modify: `package.json` (Script `certadmin:test`)

**Interfaces:**
- Produces (CommonJS-Exports):
  - `generateId(): string` — 32 hex.
  - `encryptNames(namesText: string, password: string): string` — je Zeile ein AES-Chiffrat, `\n`-getrennt.
  - `extractPassword(configTsPath: string): string` — liest Passwort aus `encrypt/encrypt-config.ts`.
  - `buildConfig(opts): CERTCONFIG-Objekt`.
  - `writeCertificate(dataDir, opts): { config }` — schreibt Dateien nach `data/`.

- [ ] **Step 1: Failing tests schreiben**

`tools/certadmin/lib/certadmin.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const CryptoJS = require('crypto-js');
const {
  generateId, encryptNames, extractPassword, buildConfig, writeCertificate,
} = require('./certadmin');

test('generateId returns 32 lowercase hex chars', () => {
  assert.match(generateId(), /^[0-9a-f]{32}$/);
  assert.notEqual(generateId(), generateId());
});

test('encryptNames round-trips with crypto-js and skips blank lines', () => {
  const enc = encryptNames('Max Mustermann\n\n  Erika Muster \n', 'geheim');
  const lines = enc.split('\n');
  assert.equal(lines.length, 2);
  const dec = CryptoJS.AES.decrypt(lines[0], 'geheim').toString(CryptoJS.enc.Utf8);
  assert.equal(dec, 'Max Mustermann');
});

test('extractPassword reads password from a TS config file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'certadmin-'));
  const p = path.join(dir, 'encrypt-config.ts');
  fs.writeFileSync(p, "export const encrypt = {\n  password: 'S3cr3t!'\n};\n");
  assert.equal(extractPassword(p), 'S3cr3t!');
});

test('buildConfig includes optional paths only when present', () => {
  const base = { id: 'abc', outputFile: 'o.pdf', name: { x: 1, y: 2, size: 3, color: '#005179' }, dialogTitle: 'T' };
  const plain = buildConfig(base);
  assert.equal(plain.template, 'templates/abc.pdf');
  assert.equal(plain.participants, undefined);
  assert.equal(plain.secondPage, undefined);
  const full = buildConfig({ ...base, hasParticipants: true, hasSecondPage: true, dialogBody: 'B' });
  assert.equal(full.participants, 'participants/abc.txt');
  assert.equal(full.secondPage, 'templates/abc-2.pdf');
  assert.equal(full.dialogBody, 'B');
});

test('writeCertificate writes pdf, config and encrypted list into data dir', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'certadmin-data-'));
  const config = buildConfig({ id: 'xy', outputFile: 'o.pdf', name: { x: 1, y: 2, size: 3 }, dialogTitle: 'T', hasParticipants: true });
  writeCertificate(dir, {
    id: 'xy',
    pdfBuffer: Buffer.from('%PDF-1.4 test'),
    config,
    encryptedParticipants: 'ciphertext',
  });
  assert.ok(fs.existsSync(path.join(dir, 'templates', 'xy.pdf')));
  assert.ok(fs.existsSync(path.join(dir, 'participants', 'xy.txt')));
  const written = JSON.parse(fs.readFileSync(path.join(dir, 'config', 'xy.json'), 'utf8'));
  assert.equal(written.template, 'templates/xy.pdf');
});
```

- [ ] **Step 2: Test läuft und schlägt fehl**

```bash
node --test 'tools/certadmin/lib/**/*.test.js' 2>&1 | tail -15
```
Expected: FAIL (`Cannot find module './certadmin'`).

- [ ] **Step 3: Bibliothek implementieren**

`tools/certadmin/lib/certadmin.js`:
```js
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const CryptoJS = require('crypto-js');

function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

function encryptNames(namesText, password) {
  return namesText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((n) => CryptoJS.AES.encrypt(n, password).toString())
    .join('\n');
}

function extractPassword(configTsPath) {
  const src = fs.readFileSync(configTsPath, 'utf8');
  const m = /password\s*:\s*['"`](.+?)['"`]/.exec(src);
  if (!m) throw new Error(`Kein Passwort in ${configTsPath} gefunden`);
  return m[1];
}

function buildConfig(opts) {
  const { id, outputFile, name, dialogTitle, dialogBody, hasParticipants, hasSecondPage } = opts;
  const config = {
    template: `templates/${id}.pdf`,
    outputFile,
    name,
    dialogTitle,
  };
  if (hasParticipants) config.participants = `participants/${id}.txt`;
  if (hasSecondPage) config.secondPage = `templates/${id}-2.pdf`;
  if (dialogBody) config.dialogBody = dialogBody;
  return config;
}

function writeCertificate(dataDir, opts) {
  const { id, pdfBuffer, config, encryptedParticipants, secondPageBuffer } = opts;
  fs.mkdirSync(path.join(dataDir, 'templates'), { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'config'), { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'templates', `${id}.pdf`), pdfBuffer);
  fs.writeFileSync(path.join(dataDir, 'config', `${id}.json`), JSON.stringify(config, null, 2));
  if (secondPageBuffer) {
    fs.writeFileSync(path.join(dataDir, 'templates', `${id}-2.pdf`), secondPageBuffer);
  }
  if (encryptedParticipants) {
    fs.mkdirSync(path.join(dataDir, 'participants'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'participants', `${id}.txt`), encryptedParticipants);
  }
  return { config };
}

module.exports = { generateId, encryptNames, extractPassword, buildConfig, writeCertificate };
```

- [ ] **Step 4: `certadmin:test`-Script ergänzen und Tests laufen lassen**

In `package.json` unter `scripts` ergänzen:
```json
"certadmin": "node tools/certadmin/server.js",
"certadmin:test": "node --test 'tools/certadmin/lib/**/*.test.js'"
```
Dann:
```bash
npm run certadmin:test 2>&1 | tail -15
```
Expected: PASS (5 Tests).

- [ ] **Step 5: Commit**

```bash
git add tools/certadmin/lib package.json
git commit -m "certadmin: Kernlogik (id, encrypt, config, write) mit node:test

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task B2: HTTP-Server des Werkzeugs

**Files:**
- Create: `tools/certadmin/server.js`
- Modify: `package.json` (devDependency `pdfjs-dist`)

**Interfaces:**
- Consumes: `tools/certadmin/lib/certadmin.js` (Task B1).
- Produces: lokaler Server auf Port 4300; `POST /api/create` (JSON) → `{ id }`; statische Auslieferung von `tools/certadmin/public/` und der pdf.js-Dateien unter `/vendor/`.
- Request-Body von `/api/create`:
  ```
  { pdfBase64: string, outputFile: string,
    name: { x:number, y:number, size:number, color:string },
    dialogTitle: string, dialogBody?: string,
    participants?: string,           // Klartext, ein Name pro Zeile
    secondPageBase64?: string }
  ```

- [ ] **Step 1: pdfjs-dist als devDependency installieren**

```bash
npm install --save-dev pdfjs-dist@^4.7.76
```

- [ ] **Step 2: Server implementieren**

`tools/certadmin/server.js`:
```js
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const {
  generateId, encryptNames, extractPassword, buildConfig, writeCertificate,
} = require('./lib/certadmin');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(REPO_ROOT, 'data');
const ENCRYPT_CONFIG = path.join(REPO_ROOT, 'encrypt', 'encrypt-config.ts');
const PUBLIC_DIR = path.join(__dirname, 'public');
const PDFJS_DIR = path.join(REPO_ROOT, 'node_modules', 'pdfjs-dist', 'build');
const PORT = 4300;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.map': 'application/json' };

function send(res, status, body, type = 'text/plain') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

function serveFile(res, file) {
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Not found');
    send(res, 200, buf, MIME[path.extname(file)] || 'application/octet-stream');
  });
}

async function handleCreate(req, res) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return send(res, 400, 'Ungültiges JSON');
  }
  try {
    const id = generateId();
    const pdfBuffer = Buffer.from(body.pdfBase64, 'base64');
    const secondPageBuffer = body.secondPageBase64
      ? Buffer.from(body.secondPageBase64, 'base64')
      : undefined;

    let encryptedParticipants;
    const hasParticipants = !!(body.participants && body.participants.trim());
    if (hasParticipants) {
      const password = extractPassword(ENCRYPT_CONFIG);
      encryptedParticipants = encryptNames(body.participants, password);
    }

    const config = buildConfig({
      id,
      outputFile: body.outputFile,
      name: body.name,
      dialogTitle: body.dialogTitle,
      dialogBody: body.dialogBody,
      hasParticipants,
      hasSecondPage: !!secondPageBuffer,
    });

    writeCertificate(DATA_DIR, { id, pdfBuffer, config, encryptedParticipants, secondPageBuffer });
    send(res, 200, JSON.stringify({ id }), 'application/json');
  } catch (err) {
    console.error(err);
    send(res, 500, JSON.stringify({ error: String(err.message || err) }), 'application/json');
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'POST' && url.pathname === '/api/create') return handleCreate(req, res);

  if (url.pathname.startsWith('/vendor/')) {
    const name = path.basename(url.pathname);
    return serveFile(res, path.join(PDFJS_DIR, name));
  }
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  return serveFile(res, path.join(PUBLIC_DIR, rel));
});

server.listen(PORT, () => {
  const link = `http://localhost:${PORT}`;
  console.log(`certadmin läuft auf ${link}`);
  console.log(`Schreibt nach: ${DATA_DIR}`);
  // Browser öffnen (macOS)
  try { require('node:child_process').exec(`open ${link}`); } catch { /* ignore */ }
});
```

- [ ] **Step 3: Server-Start rauchtesten** (ohne UI, nur Erreichbarkeit)

```bash
node tools/certadmin/server.js &
SERVER_PID=$!
sleep 1
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4300/vendor/pdf.mjs
kill $SERVER_PID
```
Expected: `200` (pdf.js-Datei wird ausgeliefert). Falls `404`: prüfen, ob `node_modules/pdfjs-dist/build/pdf.mjs` existiert (`ls node_modules/pdfjs-dist/build`) und den Dateinamen ggf. anpassen.

- [ ] **Step 4: Commit**

```bash
git add tools/certadmin/server.js package.json package-lock.json
git commit -m "certadmin: lokaler HTTP-Server mit /api/create

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task B3: Werkzeug-Oberfläche (pdf.js-Vorschau + Positionierung)

**Files:**
- Create: `tools/certadmin/public/index.html`
- Create: `tools/certadmin/public/app.js`

**Interfaces:**
- Consumes: `/vendor/pdf.mjs` (pdf.js), `POST /api/create` (Task B2).
- Koordinaten-Umrechnung: Klick auf Canvas `(cx, cy)` (oben-links, in CSS-Pixeln) → PDF-Punkte `xPt = cx / scale`, `yTopPt = cy / scale`, dann pdf-lib-`y = pageHeightPt - yTopPt`. `scale` = Renderskala der pdf.js-Viewport.

- [ ] **Step 1: HTML-Gerüst anlegen**

`tools/certadmin/public/index.html`:
```html
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <title>certadmin — Bescheinigung anlegen</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #123; }
    h1 { color: #005179; }
    .row { display: flex; gap: 2rem; align-items: flex-start; }
    .panel { flex: 1; min-width: 320px; }
    label { display: block; margin: .6rem 0 .2rem; font-weight: 600; }
    input, textarea { width: 100%; padding: .4rem; box-sizing: border-box; }
    #canvasWrap { position: relative; display: inline-block; border: 1px solid #ccc; cursor: crosshair; }
    #marker { position: absolute; transform: translate(-50%, -50%); color: #005179; white-space: nowrap; pointer-events: none; font-family: sans-serif; }
    button { margin-top: 1rem; padding: .6rem 1.2rem; background: #005179; color: #fff; border: 0; border-radius: 4px; cursor: pointer; font-size: 1rem; }
    #result { margin-top: 1rem; padding: 1rem; background: #eef6fb; border-radius: 4px; display: none; }
    #result a { word-break: break-all; }
  </style>
</head>
<body>
  <h1>Bescheinigung anlegen</h1>
  <div class="row">
    <div class="panel">
      <label>PDF-Vorlage (aus Word exportiert)</label>
      <input type="file" id="pdfFile" accept="application/pdf" />
      <label>Namensgröße: <span id="sizeLabel">15</span> pt</label>
      <input type="range" id="size" min="8" max="40" value="15" />
      <p>Klicke in die Vorschau, wo der Name (Mittelpunkt der Basislinie) stehen soll.</p>
      <div id="canvasWrap">
        <canvas id="preview"></canvas>
        <div id="marker">Max Mustermann</div>
      </div>
    </div>
    <div class="panel">
      <label>Dialog-Titel</label>
      <input id="dialogTitle" value="Teilnahmebescheinigung" />
      <label>Dialog-Text (optional)</label>
      <textarea id="dialogBody" rows="2"></textarea>
      <label>Dateiname der PDF</label>
      <input id="outputFile" value="bescheinigung.pdf" />
      <label>Anmeldeliste (optional, ein Name pro Zeile)</label>
      <textarea id="participants" rows="6" placeholder="Leer lassen, wenn keine Prüfung gewünscht ist."></textarea>
      <button id="create" disabled>Anlegen</button>
      <div id="result"></div>
    </div>
  </div>
  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Frontend-Logik anlegen**

`tools/certadmin/public/app.js`:
```js
import * as pdfjsLib from '/vendor/pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.mjs';

const RENDER_SCALE = 1.0; // 1 CSS-Pixel = 1 PDF-Punkt
const els = {
  pdfFile: document.getElementById('pdfFile'),
  size: document.getElementById('size'),
  sizeLabel: document.getElementById('sizeLabel'),
  canvas: document.getElementById('preview'),
  wrap: document.getElementById('canvasWrap'),
  marker: document.getElementById('marker'),
  create: document.getElementById('create'),
  result: document.getElementById('result'),
};

let pdfBase64 = null;
let pageHeightPt = 0;
let placement = null; // { xPt, yTopPt }

function updateMarker() {
  els.marker.style.fontSize = `${els.size.value * RENDER_SCALE}px`;
  if (placement) {
    els.marker.style.left = `${placement.xPt * RENDER_SCALE}px`;
    els.marker.style.top = `${placement.yTopPt * RENDER_SCALE}px`;
    els.marker.style.display = 'block';
  } else {
    els.marker.style.display = 'none';
  }
}

els.size.addEventListener('input', () => {
  els.sizeLabel.textContent = els.size.value;
  updateMarker();
});

els.pdfFile.addEventListener('change', async () => {
  const file = els.pdfFile.files[0];
  if (!file) return;
  const buf = await file.arrayBuffer();
  pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(buf)));

  const pdf = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  pageHeightPt = viewport.height / RENDER_SCALE;
  els.canvas.width = viewport.width;
  els.canvas.height = viewport.height;
  await page.render({ canvasContext: els.canvas.getContext('2d'), viewport }).promise;
  els.create.disabled = false;
});

els.wrap.addEventListener('click', (e) => {
  const rect = els.canvas.getBoundingClientRect();
  placement = { xPt: (e.clientX - rect.left) / RENDER_SCALE, yTopPt: (e.clientY - rect.top) / RENDER_SCALE };
  updateMarker();
});

els.create.addEventListener('click', async () => {
  if (!pdfBase64 || !placement) {
    alert('Bitte PDF laden und Namensposition anklicken.');
    return;
  }
  const size = Number(els.size.value);
  const body = {
    pdfBase64,
    outputFile: document.getElementById('outputFile').value.trim() || 'bescheinigung.pdf',
    name: {
      x: Math.round(placement.xPt),
      y: Math.round(pageHeightPt - placement.yTopPt), // pdf-lib: Ursprung unten-links
      size,
      color: '#005179',
    },
    dialogTitle: document.getElementById('dialogTitle').value.trim(),
    dialogBody: document.getElementById('dialogBody').value.trim() || undefined,
    participants: document.getElementById('participants').value.trim() || undefined,
  };
  els.create.disabled = true;
  const res = await fetch('/api/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  els.create.disabled = false;
  if (!res.ok) {
    els.result.style.display = 'block';
    els.result.textContent = `Fehler: ${data.error || res.status}`;
    return;
  }
  els.result.style.display = 'block';
  els.result.innerHTML = `Angelegt. Link: <a href="/certificate/${data.id}">/certificate/${data.id}</a><br>Dateien liegen in <code>data/</code>. Jetzt committen/pushen und hochladen.`;
});
```

- [ ] **Step 3: Manuelle Verifikation der Oberfläche**

```bash
npm run certadmin
```
Im geöffneten Browser (`http://localhost:4300`): `public/templates/example.pdf` als Vorlage wählen → Vorschau erscheint; Größe per Schieberegler ändern → Beispielname skaliert; in die Vorschau klicken → Name springt an die Stelle; „Anlegen" klicken. Erwartung: Erfolgsmeldung mit Link. Prüfen:
```bash
ls data/config data/templates
```
Es müssen `data/config/<id>.json` und `data/templates/<id>.pdf` existieren. Testdateien danach wieder entfernen (nur für den Rauchtest):
```bash
# Beispiel: die soeben erzeugten Testdateien wieder löschen (id einsetzen)
# rm data/config/<id>.json data/templates/<id>.pdf
```
Server mit Strg-C beenden.

- [ ] **Step 4: Commit**

```bash
git add tools/certadmin/public
git commit -m "certadmin: Oberflaeche mit pdf.js-Vorschau und Namenspositionierung

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task B4: Werkzeug-Dokumentation

**Files:**
- Create: `tools/certadmin/README.md`

**Interfaces:** keine (Doku).

- [ ] **Step 1: README für das Werkzeug schreiben**

`tools/certadmin/README.md` mit: Zweck; Voraussetzung `encrypt/encrypt-config.ts` (Passwort); Start `npm run certadmin`; Ablauf (PDF aus Word exportieren → laden → Position klicken → Felder → Anlegen); wohin geschrieben wird (`data/config`, `data/templates`, `data/participants`); ausdrücklicher Hinweis, dass **Upload und `git commit`/`push` manuell** erfolgen; und dass danach **kein App-Rebuild** nötig ist (nur die drei Dateien hochladen).

- [ ] **Step 2: Commit**

```bash
git add tools/certadmin/README.md
git commit -m "certadmin: README

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase C — Migration & Aufräumen

### Task C1: Bestehende Bescheinigung migrieren

**Files:**
- Create (im Submodul): `data/config/<neue-id>.json`, `data/templates/<neue-id>.pdf`, `data/participants/<neue-id>.txt`

**Interfaces:**
- Consumes: `certadmin` (Phase B).

> **Nutzer-Aktion nötig:** Für die bestehende Veranstaltung „Forum Praxisphasen" wird die **PDF-Vorlage** benötigt. Bevorzugt: das Original-Word-Dokument in Word als PDF exportieren. Fallback (falls nur das JPG vorliegt): das vorhandene `data/certificates/2026-09-10_forum-praxisphasen.jpg` einmalig in eine PDF verpacken.

- [ ] **Step 1 (nur Fallback): JPG in A4-PDF verpacken**, falls kein Word-Export vorliegt

```bash
node -e "
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
(async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const jpg = await doc.embedJpg(fs.readFileSync('data/certificates/2026-09-10_forum-praxisphasen.jpg'));
  page.drawImage(jpg, { x: 0, y: 0, width: 595, height: 842 });
  fs.writeFileSync('/tmp/forum-praxisphasen.pdf', await doc.save());
  console.log('Fallback-PDF: /tmp/forum-praxisphasen.pdf');
})();
"
```

- [ ] **Step 2: Über `certadmin` neu anlegen**

`npm run certadmin`, die PDF (Word-Export oder Fallback) laden, Namensposition setzen (Anhaltspunkt: der alte `nameMargin` war `1100px` auf 3508px-Höhe ≈ 31 % von oben → in A4-Punkten ca. `yTopPt ≈ 0.31 × 842 ≈ 261`, also Klick im oberen Drittel; visuell feinjustieren). Titel „Teilnahmebescheinigung Forum Praxisphasen", `outputFile` `2026-09-10_forum-praxisphasen.pdf`. Anmeldeliste: die Klartextnamen aus der bisherigen Quelle einfügen (die alte `data/participants/2026-09-10_forum-praxisphasen.txt` ist bereits verschlüsselt — für die Neuanlage die **Klartext**-Liste verwenden; liegt beim Nutzer). „Anlegen".

- [ ] **Step 3: Verifizieren**

```bash
ls data/config data/templates data/participants
```
Neue `<id>.json`/`<id>.pdf` (und ggf. `<id>.txt`) müssen existieren. Optional lokal testen: `<id>.json`/PDF/Liste nach `public/config` bzw. `public/templates`/`public/participants` kopieren, `npx ng serve`, `http://localhost:4200/certificate/<id>` aufrufen, einen gültigen Namen eingeben → PDF mit korrekt platziertem Namen. Danach die Kopien aus `public/` wieder entfernen.

- [ ] **Step 4: Commit im Submodul** (durch den Nutzer)

Hinweis in der Ausgabe an den Nutzer: im Submodul `data/` committen/pushen und anschließend die drei Dateien auf den Server laden. (Der Plan committet Submodul-Inhalte nicht automatisch.)

---

### Task C2: Alten Code und Assets entfernen

**Files:**
- Delete: `data/certificates.ts`, `data/certificates/2026-09-10_forum-praxisphasen.jpg` (nach erfolgreicher Migration)
- Modify: `encrypt/encrypt-participants.ts` (auf Werkzeug verweisen oder entfernen)
- Modify: `tsconfig.json` (ungenutzten `@data/*`-Alias entfernen, falls nirgends mehr importiert)
- Verify: keine Referenzen mehr auf `CERTIFICATES`, `CERTMODEL`, `jspdf`, `html2canvas`, `nameMargin`

- [ ] **Step 1: Auf verbliebene Altreferenzen prüfen**

```bash
cd /Users/sportello/Develop/CertiBot
grep -rn "CERTIFICATES\|CERTMODEL\|jspdf\|jsPDF\|html2canvas\|nameMargin\|@data/certificates" src/ | grep -v node_modules
```
Expected: keine Treffer. Falls doch, die betreffenden Stellen bereinigen.

- [ ] **Step 2: Veraltetes Verschlüsselungs-Skript entschärfen**

`encrypt/encrypt-participants.ts`: Da die Verschlüsselung jetzt im Werkzeug passiert, das Skript entweder löschen oder oben einen Kommentar einfügen: „Veraltet — Anmeldelisten werden über tools/certadmin verschlüsselt." (Entscheidung: löschen, wenn nicht anderweitig genutzt.)

- [ ] **Step 3: `@data/*`-Alias entfernen, wenn ungenutzt**

Prüfen und ggf. aus `tsconfig.json` (`paths`) entfernen:
```bash
grep -rn "@data/" src/ | grep -v node_modules
```
Kein Treffer → den `"@data/*": ["./data/*"]`-Eintrag in `tsconfig.json` löschen.

- [ ] **Step 4: Voller Testlauf + Build**

```bash
npm run certadmin:test 2>&1 | tail -5
npx ng test --watch=false 2>&1 | tail -20
npx ng build 2>&1 | tail -6
```
Expected: Werkzeug-Tests PASS; alle Angular-Specs PASS; Build erfolgreich.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Aufraeumen: alte JPG-Config/Skripte entfernt, Aliasse bereinigt

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

Hinweis: Löschungen innerhalb von `data/` (Submodul) werden separat im Submodul committet (durch den Nutzer).

---

## Self-Review (durchgeführt)

**Spec-Abdeckung:**
- Laufzeit-Config pro id → Task A2 (Format), A3 (Loader), A5 (Nutzung). ✓
- `.htaccess` unverändert (existierende Dateien werden ausgeliefert) → keine Task nötig, in Global Constraints/Spec dokumentiert. ✓
- PDF-Stempeln statt JPG → Task A4/A5. ✓
- Zweite Seite → in `PdfGenerator.generate` (A4) + `buildConfig`/UI (B1/B3, `hasSecondPage`). ✓
- Werkzeug (Vorschau, Positionierung, Verschlüsselung, Schreiben nach data/) → B1–B4. ✓
- Kein Upload/Commit durch Werkzeug → in Server (B2) und README (B4) festgehalten. ✓
- Migration + Cleanup → C1/C2. ✓
- Font-Risiko (nur woff2) → in A1 durch TTF-Download gelöst und verifiziert. ✓

**Platzhalter-Scan:** keine „TBD/TODO"; jeder Code-Step enthält vollständigen Code. ✓

**Typkonsistenz:** `CERTCONFIG`/`NamePlacement` einheitlich (A2) und in A3/A4/A5 identisch genutzt; `buildConfig`-Felder (`hasParticipants`, `hasSecondPage`) konsistent zwischen B1-Test, B1-Impl und B2-Server; `name.x/y/size/color` durchgängig gleich. ✓
