import * as pdfjsLib from '/vendor/pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.mjs';

const RENDER_SCALE = 1.0; // 1 CSS-Pixel = 1 PDF-Punkt

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
