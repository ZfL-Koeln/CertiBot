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
    return new Blob([new Uint8Array(out)], { type: 'application/pdf' });
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
