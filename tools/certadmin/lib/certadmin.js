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
