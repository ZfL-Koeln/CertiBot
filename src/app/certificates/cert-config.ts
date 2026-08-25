export interface NamePlacement {
  /** Horizontaler Mittelpunkt des Namens in PDF-Punkten (Ursprung unten-links). */
  x: number;
  /** Textbasislinie in PDF-Punkten (Ursprung unten-links). */
  y: number;
  /** Schriftgröße in pt. */
  size: number;
  /** Hex-Farbe, z. B. "#005179". Default #005179. */
  color?: string;
}

export interface CERTCONFIG {
  /** Pfad zur PDF-Vorlage, relativ zum Ausgabeverzeichnis. */
  template: string;
  /** Dateiname der heruntergeladenen PDF. */
  outputFile: string;
  /** Position/Größe/Farbe des Namens. */
  name: NamePlacement;
  /** Optionaler Pfad zur verschlüsselten Anmeldeliste. */
  participants?: string;
  /** Optionale zweite PDF-Seite (wird angehängt). */
  secondPage?: string;
  /** Überschrift im Namensdialog. */
  dialogTitle: string;
  /** Optionaler Zusatztext im Dialog. */
  dialogBody?: string;
}
