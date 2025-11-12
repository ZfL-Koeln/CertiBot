import {Component, ElementRef, inject, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import html2canvas from 'html2canvas';
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
          } finally {
            this.ready = false;
          }
        }
      });
  }

  private async generatePdfFromContent(): Promise<void> {
    const contentEl = this.contentRef?.nativeElement ?? document.getElementById('content');
    if (!contentEl) throw new Error('Content element not found');

    // Render DOM -> canvas
    const canvas = await html2canvas(contentEl);
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
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}
