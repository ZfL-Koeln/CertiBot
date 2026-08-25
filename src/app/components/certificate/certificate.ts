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
          this.errorDialog.open(ErrorDialog, {
            disableClose: true,
            data: { message: 'Dieser Link ist ungültig oder die Bescheinigung ist nicht (mehr) verfügbar.' }
          });
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
            this.errorDialog.open(ErrorDialog, {
              disableClose: true,
              data: { message: 'Ihr Name befindet sich nicht in der Anmeldeliste.' }
            });
            return;
          }

          try {
            const blob = await this.pdfGenerator.generate(cfg, this.name);
            this.downloadBlob(blob, cfg.outputFile || 'teilnahmebescheinigung.pdf');
          } catch (err) {
            console.error('Failed to generate PDF', err);
            this.errorDialog.open(ErrorDialog, {
              disableClose: true,
              data: { message: 'Die Bescheinigung konnte nicht erstellt werden. Bitte versuchen Sie es erneut.' }
            });
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
