// ─── E-Rechnung — Ländercode (rein, 31.10.) ─────────────────────────────────
// Die E-Rechnung (EN 16931, BT-40/BT-55) verlangt das Land als ISO-3166-1-alpha-2-Code. In MAKE OS steht es als Text („Deutschland“,
// „Österreich“ …) bzw. fehlt (= Inland). Hier EINE Übersetzung; was nicht erkannt wird, meldet die Pflichtprüfung, statt zu raten.

const NAMEN: Record<string, string> = {
  deutschland: 'DE', germany: 'DE', 'bundesrepublik deutschland': 'DE',
  oesterreich: 'AT', austria: 'AT', schweiz: 'CH', switzerland: 'CH', liechtenstein: 'LI', luxemburg: 'LU', luxembourg: 'LU',
  niederlande: 'NL', netherlands: 'NL', holland: 'NL', belgien: 'BE', belgium: 'BE', frankreich: 'FR', france: 'FR',
  italien: 'IT', italy: 'IT', spanien: 'ES', spain: 'ES', portugal: 'PT', daenemark: 'DK', denmark: 'DK', schweden: 'SE', sweden: 'SE',
  norwegen: 'NO', norway: 'NO', finnland: 'FI', finland: 'FI', polen: 'PL', poland: 'PL', tschechien: 'CZ', czechia: 'CZ',
  'tschechische republik': 'CZ', slowakei: 'SK', ungarn: 'HU', hungary: 'HU', slowenien: 'SI', kroatien: 'HR', irland: 'IE', ireland: 'IE',
  'vereinigtes koenigreich': 'GB', grossbritannien: 'GB', 'united kingdom': 'GB', england: 'GB', griechenland: 'GR', greece: 'GR',
  rumaenien: 'RO', bulgarien: 'BG', estland: 'EE', lettland: 'LV', litauen: 'LT', malta: 'MT', zypern: 'CY',
  usa: 'US', 'vereinigte staaten': 'US', 'united states': 'US', kanada: 'CA', canada: 'CA', tuerkei: 'TR', tuerkiye: 'TR',
};

const norm = (t: string) => t.normalize('NFC').trim().toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/\s+/g, ' ');

/** Ländercode aus dem Text — leer = Inland (DE); zwei Buchstaben gelten als Code; unbekannt = null. */
export function landCode(land: string | undefined | null): string | null {
  const t = (land ?? '').trim();
  if (!t) return 'DE';
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  return NAMEN[norm(t)] ?? null;
}

/** Mitgliedstaaten der EU (für den Hinweis bei Reverse Charge). */
export const EU_LAENDER = new Set(['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK']);
