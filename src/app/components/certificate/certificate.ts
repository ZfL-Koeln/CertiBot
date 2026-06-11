import {Component, ElementRef, inject, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {jsPDF} from 'jspdf';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatDialog} from '@angular/material/dialog';
import {ActivatedRoute} from '@angular/router';
import {HttpClient} from '@angular/common/http';
import {Encryption} from '../../services/encryption';
import {filter, map, switchMap, takeUntil} from 'rxjs/operators';
import {of, Subject} from 'rxjs';
import {NgStyle} from '@angular/common';
import {Dialog} from '../dialog/dialog';
import {ErrorDialog} from '../error-dialog/error-dialog';
import {CERTIFICATES, CERTMODEL} from '../../certificates/certificates';

export interface DialogData {
  name: string;
  title: string;
  body: string;
}

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297; // keep it true A4, previous code used 300
const JPG_QUALITY = 0.5 as const;

@Component({
  selector: 'app-certificate',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, FormsModule, MatButtonModule, NgStyle],
  templateUrl: './certificate.html',
  styleUrls: ['./certificate.scss']
})
export class Certificate implements OnInit, OnDestroy {

  @ViewChild('content', {static: false}) contentRef?: ElementRef<HTMLElement>;
  @ViewChild('nameEl', {static: false}) nameRef?: ElementRef<HTMLElement>;

  private readonly encryption = inject(Encryption);
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  public readonly dialog = inject(MatDialog);
  public readonly errorDialog = inject(MatDialog);
  private readonly destroy$ = new Subject<void>();

  name = '';
  dialogTitle = '';
  dialogBody = '';
  ready = true;

  certificatePath = '';
  private currentCert?: CERTMODEL;
  nameMargin = '-950px';

  participants: string[] = [];
  participantsPath = '';

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map(pm => pm.get('id')),
        switchMap(id => {
          if (!id) return of(null);
          const cfg = CERTIFICATES[id];
          this.currentCert = cfg ?? undefined;
          this.certificatePath = cfg?.image ?? '';
          this.nameMargin = cfg?.nameMargin ?? '-950px';
          this.participantsPath = cfg?.participants ?? '';
          this.dialogTitle = cfg?.dialogTitle ?? '';
          this.dialogBody = cfg?.dialogBody ?? '';
          return of(cfg);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(cfg => {
        if (!cfg) return;

        if (this.participantsPath.length > 0) {
          this.http.get(this.participantsPath, {responseType: 'text'})
            .subscribe(data => {
              const encryptedNames = data.split('\n').filter(Boolean);
              this.participants = encryptedNames.map(name => this.encryption.decrypt(name));
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
    const dialogRef = this.dialog.open(Dialog, {
      data: {
        name: this.name,
        title: this.dialogTitle,
        body: this.dialogBody
      },
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

          const nameHost = this.nameRef?.nativeElement ?? document.getElementById('name');
          if (nameHost) nameHost.innerText = this.name;

          if (this.participants.length > 0) {
            if (!this.participants.includes(this.name)) {
              this.errorDialog.open(ErrorDialog, {
                disableClose: true
              });
              return;
            }
          }

          try {
            await this.generatePdfFromContent();
          } catch (err) {
            console.error('Failed to generate PDF', err);
            this.errorDialog.open(ErrorDialog, { disableClose: true });
          } finally {
            this.ready = false;
          }
        }
      });
  }

  private async generatePdfFromContent(): Promise<void> {
    // Wait for web fonts (Albert Sans) to be available in canvas context.
    await document.fonts.ready;

    // Fetch the certificate image as a blob to avoid canvas cross-origin taint issues.
    const imgBlob = await this.http.get(this.certificatePath, {responseType: 'blob'}).toPromise();
    const imgDataUrl = await blobToDataUrl(imgBlob!);
    const img = await loadImage(imgDataUrl);

    // A4 at 300 dpi
    const W = 2480;
    const H = 3508;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    ctx.drawImage(img, 0, 0, W, H);

    // Overlay the participant name at the configured vertical position.
    const marginPx = parseInt(this.nameMargin, 10) || 1150;
    ctx.font = '60px "Albert Sans Variable", "Albert Sans", sans-serif';
    ctx.fillStyle = '#005179';
    ctx.textAlign = 'center';
    // +48px approximates the font baseline offset within the 60px line height.
    ctx.fillText(this.name, W / 2, marginPx + 48);

    const contentDataURL = canvas.toDataURL('image/jpeg', JPG_QUALITY);
    const pdf = new jsPDF('p', 'mm', 'a4');
    pdf.addImage(contentDataURL, 'JPG', 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM);

    if (this.currentCert?.secondPageImage) {
      const blob = await this.http.get(this.currentCert.secondPageImage, {responseType: 'blob'}).toPromise();
      const base64data = await blobToDataUrl(blob!);
      pdf.addPage();
      pdf.addImage(base64data, 'JPG', 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, '', 'MEDIUM');
    }

    pdf.save(this.currentCert?.outputFile ?? 'teilnahmebescheinigung.pdf');
  }
}

// Helpers
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}
