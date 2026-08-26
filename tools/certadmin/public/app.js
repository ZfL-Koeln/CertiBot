import * as pdfjsLib from '/vendor/pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.mjs';

const RENDER_SCALE = 1.0; // 1 CSS-Pixel = 1 PDF-Punkt

// Standard-Platzierung des Namens (pdf-lib-Konvention: Ursprung unten-links).
// Wird beim Laden einer PDF vorbelegt und kann per Klick/Regler überschrieben werden.
const DEFAULT_NAME = { x: 300, y: 542, size: 15, color: '#005179' };

function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

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
  pdfBase64 = bufToBase64(buf);

  const pdf = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  pageHeightPt = viewport.height / RENDER_SCALE;
  els.canvas.width = viewport.width;
  els.canvas.height = viewport.height;
  await page.render({ canvasContext: els.canvas.getContext('2d'), viewport }).promise;

  // Standard-Position/-Größe vorbelegen (per Klick/Regler überschreibbar).
  // yTopPt = Seitenhöhe − DEFAULT_NAME.y, damit im Ergebnis exakt y=DEFAULT_NAME.y steht.
  els.size.value = String(DEFAULT_NAME.size);
  els.sizeLabel.textContent = String(DEFAULT_NAME.size);
  placement = { xPt: DEFAULT_NAME.x, yTopPt: pageHeightPt - DEFAULT_NAME.y };
  updateMarker();

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
      color: DEFAULT_NAME.color,
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
  // Der Pfad ist relativ zur Basis-URL der ausgelieferten App — NICHT zu diesem
  // Werkzeug (das auf Port 4300 läuft). Deshalb kein relativer <a>-Link, der
  // gegen localhost:4300 auflösen würde, sondern der Pfad als kopierbarer Text
  // plus ein absoluter Test-Link auf den Angular-Dev-Server (Port 4200).
  const path = `/certificate/${data.id}`;
  els.result.innerHTML =
    `<strong>Angelegt.</strong> Pfad: <code>${path}</code><br>` +
    `Lokal testen: <a href="http://localhost:4200${path}" target="_blank" rel="noopener">http://localhost:4200${path}</a> ` +
    `<small>(Dev-Server ggf. neu starten, damit die neuen Dateien eingelesen werden)</small><br>` +
    `Produktiv: an die Basis-URL der App anhängen (z. B. <code>https://…${path}</code>).<br>` +
    `Die Dateien liegen in <code>data/</code> — jetzt committen/pushen und auf den Server hochladen.`;
});
