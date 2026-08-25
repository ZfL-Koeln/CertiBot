const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
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
  try {
    for await (const chunk of req) raw += chunk;
  } catch (err) {
    if (!res.headersSent) send(res, 400, JSON.stringify({ error: 'Anfrage abgebrochen oder ungültig' }), 'application/json');
    return;
  }
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return send(res, 400, JSON.stringify({ error: 'Ungültiges JSON' }), 'application/json');
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
  if (req.method === 'POST' && url.pathname === '/api/create') {
    handleCreate(req, res).catch((err) => {
      console.error(err);
      if (!res.headersSent) send(res, 500, JSON.stringify({ error: 'Serverfehler' }), 'application/json');
    });
    return;
  }

  if (url.pathname.startsWith('/vendor/')) {
    const name = path.basename(url.pathname);
    return serveFile(res, path.join(PDFJS_DIR, name));
  }
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  return serveFile(res, path.join(PUBLIC_DIR, rel));
});

server.listen(PORT, '127.0.0.1', () => {
  const link = `http://localhost:${PORT}`;
  console.log(`certadmin läuft auf ${link}`);
  console.log(`Schreibt nach: ${DATA_DIR}`);
  // Browser öffnen (macOS)
  try { require('node:child_process').exec(`open ${link}`); } catch { /* ignore */ }
});
