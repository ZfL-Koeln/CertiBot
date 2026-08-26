#!/usr/bin/env node
//
// Listet die aktuellen Bescheinigungen aus data/config/ auf, in der Form:
//
//   https://apps.zflkoeln.de/certificate/<id>: <dialogTitle>
//
// Die Liste wird nach tools/certificate-links.txt geschrieben (per .gitignore
// ausgenommen — sie enthält die geheimen Zugangs-IDs) und zusätzlich auf
// stdout ausgegeben.
//
// Nutzung:
//   node tools/list-certificates.js
//   npm run list-certs
//
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CONFIG_DIR = path.join(REPO_ROOT, 'data', 'config');
const OUTPUT_FILE = path.join(__dirname, 'certificate-links.txt');
const BASE_URL = 'https://apps.zflkoeln.de/certificate';

function main() {
  let files;
  try {
    files = fs.readdirSync(CONFIG_DIR).filter((f) => f.endsWith('.json'));
  } catch (err) {
    console.error(`Konnte ${CONFIG_DIR} nicht lesen: ${err.message}`);
    process.exit(1);
  }

  files.sort();

  const lines = files.map((file) => {
    const id = path.basename(file, '.json');
    let title = '';
    try {
      const cfg = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, file), 'utf8'));
      title = cfg.dialogTitle ?? '';
    } catch (err) {
      title = `<Fehler beim Lesen: ${err.message}>`;
    }
    return `${BASE_URL}/${id}: ${title}`;
  });

  const output = lines.length ? lines.join('\n') + '\n' : '';
  fs.writeFileSync(OUTPUT_FILE, output, 'utf8');

  process.stdout.write(output);
  console.error(
    `\n(${lines.length} Bescheinigung(en) -> ${path.relative(REPO_ROOT, OUTPUT_FILE)})`
  );
}

main();
