import type { CERTCONFIG } from './cert-config';

// Beispielhafte Laufzeit-Konfiguration. Produktiv liegt pro Veranstaltung
// eine Datei config/<id>.json neben der App (siehe README).
export const EXAMPLE_CONFIG: CERTCONFIG = {
  template: 'templates/example.pdf',
  outputFile: 'beispiel-bescheinigung.pdf',
  name: { x: 297, y: 560, size: 15, color: '#005179' },
  dialogTitle: 'Bitte geben Sie Ihren Namen ein:',
  dialogBody: 'Beispielkonfiguration für die lokale Entwicklung.'
};
