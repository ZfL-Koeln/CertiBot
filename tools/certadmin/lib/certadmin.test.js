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
