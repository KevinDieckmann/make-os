// ─── Dateien an Projekten und Aufgaben · Regeln (rein, client-sicher, getestet, 28.09. C2) ───
// Kevin 28.09.: „Mit Dateien, Uploads etc. — da muss alles möglich sein.“ Hier steht alles, was ohne Platte
// und ohne Schlüssel geht: erlaubte Typen (am INHALT erkannt, Office an der ZIP-Struktur), Größe, Säuberung
// der Metadaten, Filter je Projekt/Aufgabe, Abschnitte für ZOE.
//
// Abgrenzung (Kevins Wahl): Diese Dateien liest ZOE — immer als Fremdtext gekapselt, höchstens
// `ZOE_ZEICHEN` je Aufruf (lib/zoe/aufgaben-unterlagen.ts). Die CRM-Ablage (lib/dateien/regeln.ts:
// Angebote, Rechnungen, Einwilligungsbelege, Mandatsunterlagen) bleibt außerhalb von ZOE — eigener
// Bestand, eigene Route, kein Werkzeug.

/** Die erlaubten Typen für Projektarbeit — mit Endungen. Alles andere: 415. */
export const AUFGABEN_TYPEN = {
  'application/pdf': ['pdf'],
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/webp': ['webp'],
  'image/heic': ['heic', 'heif'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
  'text/csv': ['csv'],
  'text/plain': ['txt'],
  'text/markdown': ['md'],
} as const;
export type AufgabenDateiTyp = keyof typeof AUFGABEN_TYPEN;
export const AUFGABEN_ANNEHMEN = Object.values(AUFGABEN_TYPEN).flat().map(e => `.${e}`).join(',');

/** Metadaten-Bestand je Haushalt: `aufgaben-dateien--<haushalt>` (Inhalt im selben Ordner wie die CRM-Ablage). */
export const AUFGABEN_DATEI_PRAEFIX = 'aufgaben-dateien--';

/** Höchstens 25 MB je Datei (Projektarbeit: Präsentationen, Scans). Die CRM-Ablage bleibt bei 15 MB. */
export const MAX_AUFGABEN_DATEI_BYTES = 25 * 1024 * 1024;
/** Höchstens so viele Einträge je Haushalt. */
export const MAX_AUFGABEN_EINTRAEGE = 5000;
/** So viele Zeichen gibt ein ZOE-Aufruf höchstens zurück — darüber: Hinweis + Abschnitt wählen, nie still gekürzt. */
export const ZOE_ZEICHEN = 30_000;

/** Kennungen von Projekten und Aufgaben — dieselbe Form wie lib/aufgaben/saeubern.ts (KENNUNG). */
export const AUFGABEN_KENNUNG = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;
const kennung = (v: unknown) => (typeof v === 'string' && AUFGABEN_KENNUNG.test(v) ? v : undefined);

export type Bereich = 'privat' | 'business';
export const istBereich = (v: unknown): v is Bereich => v === 'privat' || v === 'business';

// ── Erkennung am Inhalt ────────────────────────────────────────────────────

const beginntMit = (b: Uint8Array, sig: number[], ab = 0) => b.length >= ab + sig.length && sig.every((x, i) => b[ab + i] === x);
const ascii = (b: Uint8Array, von: number, bis: number) => String.fromCharCode(...Array.from(b.subarray(von, bis)));
const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

export interface ZipEintrag { name: string; methode: number; komprimiert: number; gross: number; /** Beginn des lokalen Kopfs. */ lokal: number }

/**
 * Inhaltsverzeichnis eines ZIP (zentrales Verzeichnis) lesen — ohne etwas zu entpacken. null, wenn es kein
 * gültiges ZIP ist, ZIP64 braucht (bei ≤ 25 MB nie nötig) oder mehr als 5.000 Einträge hat.
 */
export function zipVerzeichnis(b: Uint8Array): ZipEintrag[] | null {
  if (!beginntMit(b, [0x50, 0x4b, 0x03, 0x04]) || b.length < 22) return null;
  let ende = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 0xffff); i--) {
    if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06) { ende = i; break; }
  }
  if (ende < 0) return null;
  const anzahl = u16(b, ende + 10);
  const start = u32(b, ende + 16);
  if (anzahl === 0xffff || start === 0xffffffff || anzahl > 5000 || start >= b.length) return null;
  const raus: ZipEintrag[] = [];
  let o = start;
  for (let n = 0; n < anzahl; n++) {
    if (o + 46 > b.length || u32(b, o) !== 0x02014b50) return null;
    const nameLaenge = u16(b, o + 28), extra = u16(b, o + 30), kommentar = u16(b, o + 32);
    if (o + 46 + nameLaenge > b.length) return null;
    const name = new TextDecoder().decode(b.subarray(o + 46, o + 46 + nameLaenge));
    raus.push({ name, methode: u16(b, o + 10), komprimiert: u32(b, o + 20), gross: u32(b, o + 24), lokal: u32(b, o + 42) });
    o += 46 + nameLaenge + extra + kommentar;
  }
  return raus;
}

/** Welche Office-Art trägt das ZIP? An der Struktur, nicht an der Endung. Makro-Projekte → null. */
export function officeArt(b: Uint8Array): 'docx' | 'xlsx' | 'pptx' | null {
  const v = zipVerzeichnis(b);
  if (!v) return null;
  const namen = new Set(v.map(e => e.name));
  if (!namen.has('[Content_Types].xml')) return null;
  if (v.some(e => /(^|\/)vbaProject\.bin$/i.test(e.name))) return null;
  if (namen.has('word/document.xml')) return 'docx';
  if (namen.has('xl/workbook.xml')) return 'xlsx';
  if (namen.has('ppt/presentation.xml')) return 'pptx';
  return null;
}

/** Signaturen anderer Formate — ein Text, der so beginnt, ist keiner (gefälschte Endung). */
const FREMDE_ANFAENGE: number[][] = [
  [0x25, 0x50, 0x44, 0x46, 0x2d], [0x50, 0x4b, 0x03, 0x04], [0x89, 0x50, 0x4e, 0x47], [0xff, 0xd8, 0xff], [0x52, 0x49, 0x46, 0x46],
  [0x4d, 0x5a], [0x7f, 0x45, 0x4c, 0x46], [0xca, 0xfe, 0xba, 0xbe], [0xcf, 0xfa, 0xed, 0xfe], [0x1f, 0x8b], [0x37, 0x7a, 0xbc, 0xaf],
  // Die Hülle der Ablage selbst („MKOSDAT1“, seit 29.09. auch „MKOSDAT2“) — sonst hielte das Lesen den Text für verschlüsselt.
  [0x4d, 0x4b, 0x4f, 0x53, 0x44, 0x41, 0x54, 0x31],
  [0x4d, 0x4b, 0x4f, 0x53, 0x44, 0x41, 0x54, 0x32],
];

/**
 * Ist das Text (CSV, TXT, MD)? UTF-8 (auch mit BOM) oder ein Einzelbyte-Zeichensatz (Excel-CSV in Windows-1252) —
 * aber ohne NUL und ohne Steuerzeichen außer Tab/Zeilenumbruch/Seitenvorschub/Escape und nicht mit der Signatur eines
 * anderen Formats am Anfang.
 */
export function istText(b: Uint8Array): boolean {
  if (FREMDE_ANFAENGE.some(sig => beginntMit(b, sig))) return false;
  for (let i = 0; i < b.length; i++) {
    const x = b[i];
    if (x < 0x20 && x !== 0x09 && x !== 0x0a && x !== 0x0d && x !== 0x0c && x !== 0x1b) return false;
  }
  return true;
}

/** Text dekodieren: UTF-8 (BOM weg), sonst Windows-1252. */
export function textDekodieren(b: Uint8Array): string {
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(b); }
  catch { return new TextDecoder('windows-1252').decode(b); }
}

const HEIC_MARKEN = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1']);

/**
 * Typ am INHALT erkennen und mit der Endung abgleichen — die Angabe des Browsers zählt nicht.
 * Braucht den ganzen Inhalt (Office: ZIP-Verzeichnis am Ende; Text: jedes Byte). Passt es nicht: null (→ 415).
 */
export function aufgabenTypErkennen(name: string, b: Uint8Array): AufgabenDateiTyp | null {
  const e = (/\.([a-z0-9]{1,5})$/i.exec(name)?.[1] ?? '').toLowerCase();
  switch (e) {
    case 'pdf': return beginntMit(b, [0x25, 0x50, 0x44, 0x46, 0x2d]) ? 'application/pdf' : null;
    case 'png': return beginntMit(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) ? 'image/png' : null;
    case 'jpg': case 'jpeg': return beginntMit(b, [0xff, 0xd8, 0xff]) ? 'image/jpeg' : null;
    case 'webp': return beginntMit(b, [0x52, 0x49, 0x46, 0x46]) && b.length >= 12 && ascii(b, 8, 12) === 'WEBP' ? 'image/webp' : null;
    case 'heic': case 'heif': return b.length >= 12 && ascii(b, 4, 8) === 'ftyp' && HEIC_MARKEN.has(ascii(b, 8, 12)) ? 'image/heic' : null;
    case 'docx': case 'xlsx': case 'pptx': {
      const art = officeArt(b);
      if (art !== e) return null;
      return art === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : art === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    }
    case 'csv': return istText(b) ? 'text/csv' : null;
    case 'txt': return istText(b) ? 'text/plain' : null;
    case 'md': return istText(b) ? 'text/markdown' : null;
    default: return null;
  }
}

// ── Anzeige ────────────────────────────────────────────────────────────────

export type TypGruppe = 'pdf' | 'bild' | 'word' | 'excel' | 'praesentation' | 'tabelle' | 'text';
export function typGruppe(typ: string): TypGruppe {
  if (typ === 'application/pdf') return 'pdf';
  if (typ.startsWith('image/')) return 'bild';
  if (typ.includes('wordprocessingml')) return 'word';
  if (typ.includes('spreadsheetml')) return 'excel';
  if (typ.includes('presentationml')) return 'praesentation';
  if (typ === 'text/csv') return 'tabelle';
  return 'text';
}
export const TYP_LABEL: Record<TypGruppe, string> = { pdf: 'PDF', bild: 'Bild', word: 'Word', excel: 'Excel', praesentation: 'PowerPoint', tabelle: 'CSV', text: 'Text' };
/** Vorschau im Browser: Bilder (ohne HEIC — das zeigen die meisten Browser nicht) über eine Blob-URL, PDF im neuen Tab. */
export function vorschauArt(typ: string): 'bild' | 'pdf' | null {
  if (typ === 'application/pdf') return 'pdf';
  if (typ === 'image/png' || typ === 'image/jpeg' || typ === 'image/webp') return 'bild';
  return null;
}

// ── Metadaten ──────────────────────────────────────────────────────────────

const txt = (v: unknown, n: number) => { const t = String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); return t || undefined; };

export interface AufgabenMeta { projektId?: string; aufgabeId?: string; bereich?: Bereich; notiz?: string }
/** Bezug + Bereich + Beschreibung aus dem Netz, gesäubert. Ob es Projekt/Aufgabe gibt, prüft der Server. */
export function aufgabenMetaSaeubern(roh: unknown): AufgabenMeta {
  if (!roh || typeof roh !== 'object') return {};
  const o = roh as Record<string, unknown>;
  const projektId = kennung(o.projektId), aufgabeId = kennung(o.aufgabeId), notiz = txt(o.notiz ?? o.beschreibung, 600);
  return { ...(projektId ? { projektId } : {}), ...(aufgabeId ? { aufgabeId } : {}), ...(istBereich(o.bereich) ? { bereich: o.bereich } : {}), ...(notiz ? { notiz } : {}) };
}

interface MitBezug { projektId?: string; aufgabeId?: string; hochgeladenAm: string }
/**
 * Einträge einer Aufgabe (nur ihre) bzw. eines Projekts (die des Projekts UND seiner Aufgaben). Neueste zuerst.
 * Ohne Projekt und ohne Aufgabe: nichts — es gibt keine „alle Dateien“-Sicht über Bereiche hinweg.
 */
export function aufgabenDateienFuer<T extends MitBezug>(liste: readonly T[], f: { projektId?: string; aufgabeId?: string }): T[] {
  if (!f.projektId && !f.aufgabeId) return [];
  return liste.filter(e => (f.aufgabeId ? e.aufgabeId === f.aufgabeId : e.projektId === f.projektId))
    .sort((a, b) => b.hochgeladenAm.localeCompare(a.hochgeladenAm));
}

// ── Abschnitte für ZOE ─────────────────────────────────────────────────────

export interface Abschnitt { text: string; teil: number; teile: number; von: number; bis: number; gesamt: number }
/**
 * Einen Abschnitt wählen (1-basiert). Nie still gekürzt: der Aufrufer bekommt `teile` und sagt dazu, dass es mehr gibt.
 * Ein Teil außerhalb wird auf den letzten gesetzt.
 */
export function abschnittWaehlen(text: string, teil = 1, groesse = ZOE_ZEICHEN): Abschnitt {
  const gesamt = text.length;
  const teile = Math.max(1, Math.ceil(gesamt / groesse));
  const t = Math.min(teile, Math.max(1, Math.floor(Number.isFinite(teil) ? teil : 1)));
  const von = (t - 1) * groesse;
  const bis = Math.min(gesamt, von + groesse);
  return { text: text.slice(von, bis), teil: t, teile, von, bis, gesamt };
}
