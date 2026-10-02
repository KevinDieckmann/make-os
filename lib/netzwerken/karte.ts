// ─── Netzwerken · Meine Visitenkarten (02.10., Paket B) — rein, client-sicher ─────
// Jede Person pflegt mehrere Karten-Profile (z. B. eins je Firma, für die sie unterwegs ist). Ein Profil ist ihre EIGENE
// Visitenkarte: Name, Rolle, Firma, Erreichbarkeit — nichts davon kommt aus dem Code, alles trägt die Person selbst ein.
// Hier: Form, Prüfung (`pruefeKarte`) und die vCard 3.0 (`vcard`), die der QR-Code und die .vcf-Datei tragen.
//
// vCard 3.0 (RFC 2426): Zeilen mit CRLF, Texte mit `\\ \, \; \n` maskiert, UTF-8 (Umlaute bleiben Umlaute). Eine Zeile
// ist höchstens 75 Oktette lang — in der DATEI wird gefaltet (Folgezeile beginnt mit einem Leerzeichen, nie mitten in
// einem Mehrbyte-Zeichen); im QR-Code bleibt es ungefaltet (kleinerer Code, alle Scanner lesen es). Es kommen NUR die
// gesetzten Felder des Profils hinein — nie Farbe, Profilname; das Logo nur in der .vcf-Datei (PHOTO, wenn es ein kleines
// PNG/JPG ist), nie im QR-Code.
//
// FIRMEN-DESIGN (Kevin 02.10.): Jedes Profil trägt sein eigenes Aussehen — Logo (SVG/PNG/JPG/WebP, ≤ ~200 KB, SVG wird
// gesäubert), Hintergrund-, Text- und Akzentfarbe, Schrift. Alles optional, der Standard ist neutral (weiß/schwarz, Systemschrift,
// keine Marke). Die Karte zeigt NUR dieses Design; das MAKE-Aussehen der App gehört nicht dazu (`kartenDesign`).

import { saeubereSvg } from './svg';

export const MAX_KARTEN = 20;
export const KARTE_ID = /^v-[0-9a-f-]{36}$/;
export const FARBE_OK = /^#[0-9a-f]{6}$/i;
/** Logo: Data-URL ≤ 280.000 Zeichen (≈ 200 KB Bild). Raster-Logos verkleinert der Browser vorher. */
export const LOGO_MAX = 280_000;
const LOGO_RASTER = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const LOGO_SVG = /^data:image\/svg\+xml;base64,([A-Za-z0-9+/]+={0,2})$/;
/** Ein Logo bis zu dieser Größe (Zeichen Base64) darf als PHOTO in die .vcf-Datei (nur PNG/JPG). */
export const VCARD_LOGO_MAX = 40_000;
/** Wählbare Schriften: Systemschrift (Standard), Urbanist (lokal gebündelt, OFL), Serifenschrift des Systems. */
export const SCHRIFTEN = ['system', 'urbanist', 'serif'] as const;
export type KartenSchrift = (typeof SCHRIFTEN)[number];

export interface Visitenkarte {
  id: string;
  /** Wie das Profil im Umschalter heißt („Unterwegs für: …“) — leer: die Firma. */
  bezeichnung?: string;
  vorname?: string;
  nachname?: string;
  rolle?: string;
  firma?: string;
  email?: string;
  handy?: string;
  telefon?: string;
  web?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  land?: string;
  linkedin?: string;
  /** Akzentfarbe der Karte (Rahmen um den Code, Linien) — nur Anzeige. */
  farbe?: string;
  /** Hintergrundfarbe der Karte und des Vollbilds (Standard weiß) — nur Anzeige. */
  hintergrund?: string;
  /** Textfarbe auf dem Hintergrund (Standard fast schwarz) — nur Anzeige. */
  textfarbe?: string;
  /** Schrift der Karte (Standard: Systemschrift) — nur Anzeige. */
  schrift?: KartenSchrift;
  /** Logo als Data-URL (SVG gesäubert, PNG/JPG/WebP) — Anzeige; als PHOTO nur in der .vcf, wenn klein. */
  logo?: string;
  /** Reihenfolge im Umschalter (kleiner = weiter vorn). */
  rang: number;
  geaendert?: string;
}
/** Wie die Karte an den Browser geht: mit Fingerabdruck. */
export type KarteMitStand = Visitenkarte & { stand: string };

/** Die Felder, die ein Profil trägt (in der Reihenfolge des Formulars) — Wächter und Formular lesen dieselbe Liste. */
export const KARTEN_TEXTFELDER = ['bezeichnung', 'vorname', 'nachname', 'rolle', 'firma', 'email', 'handy', 'telefon', 'web', 'strasse', 'plz', 'ort', 'land', 'linkedin'] as const;
export type KartenTextfeld = (typeof KARTEN_TEXTFELDER)[number];
const GRENZE: Record<KartenTextfeld, number> = {
  bezeichnung: 60, vorname: 80, nachname: 80, rolle: 100, firma: 120, email: 160, handy: 40, telefon: 40, web: 200, strasse: 120, plz: 12, ort: 80, land: 60, linkedin: 200,
};

/** Eine Zeile: Steuerzeichen raus, Leerraum glatt, gekürzt (die Länge prüft `pruefeKarte` vorher und lehnt zu Langes ab). */
const zeile = (v: unknown): string => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '');

/** Web-Adresse mit https:// (ohne Schema gibt es kein Kontaktprogramm, das den Link öffnet). */
export function webAdresse(roh: string): string {
  const t = roh.trim();
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}
/** LinkedIn: volle Adresse, „linkedin.com/in/…“ oder nur der Name nach /in/. */
export function linkedinAdresse(roh: string): string {
  const t = roh.trim().replace(/^@/, '');
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  if (/linkedin\.com/i.test(t)) return `https://${t.replace(/^\/+/, '')}`;
  return /^[\p{L}\p{N}_.%-]+$/u.test(t) ? `https://www.linkedin.com/in/${t}` : '';
}

const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ziffern = (t: string) => t.replace(/\D/g, '').length;
const TELEFON_ZEICHEN = /^[+0-9 ()/.\-–]+$/;

export type KartenPruefung = { ok: true; karte: Visitenkarte } | { ok: false; fehler: string };

/**
 * Ein Profil aus dem Netz, geprüft. Zu lange Felder werden ABGELEHNT (nie still gekürzt), ungültige Mail/Telefon/Farbe/
 * Logo mit einem Satz benannt. Mindestens ein Name, die Firma oder eine Erreichbarkeit muss drinstehen — eine leere
 * Karte ergäbe einen leeren QR-Code. Die Kennung kommt, falls vorhanden, unverändert zurück (neue vergibt der Aufrufer).
 */
export function pruefeKarte(roh: unknown, jetzt: string): KartenPruefung {
  const e = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>;
  const k: Visitenkarte = { id: typeof e.id === 'string' ? e.id : '', rang: Number.isFinite(Number(e.rang)) ? Math.max(0, Math.min(9999, Math.round(Number(e.rang)))) : 0, geaendert: jetzt };
  if (!KARTE_ID.test(k.id)) return { ok: false, fehler: 'Ungültige Kennung des Profils.' };
  for (const f of KARTEN_TEXTFELDER) {
    const t = zeile(e[f]);
    if (t.length > GRENZE[f]) return { ok: false, fehler: `„${FELD_LABEL[f]}“ ist zu lang (höchstens ${GRENZE[f]} Zeichen).` };
    if (t) k[f] = t;
  }
  if (k.email) { k.email = k.email.toLowerCase(); if (!MAIL.test(k.email)) return { ok: false, fehler: 'Die E-Mail-Adresse sieht nicht gültig aus.' }; }
  for (const f of ['handy', 'telefon'] as const) {
    const t = k[f];
    if (t && (!TELEFON_ZEICHEN.test(t) || ziffern(t) < 5)) return { ok: false, fehler: `„${FELD_LABEL[f]}“: nur Ziffern, + ( ) / - und Leerzeichen, mindestens 5 Ziffern.` };
  }
  if (k.web) { k.web = webAdresse(k.web); if (!/^https?:\/\/[^\s/]+\.[^\s/]{2,}(\/\S*)?$/i.test(k.web) || k.web.length > 200) return { ok: false, fehler: 'Die Website sieht nicht gültig aus.' }; }
  if (k.linkedin) { const l = linkedinAdresse(k.linkedin); if (!l || l.length > 200) return { ok: false, fehler: 'LinkedIn: bitte die Profil-Adresse oder den Namen nach /in/ eintragen.' }; k.linkedin = l; }
  for (const f of ['farbe', 'hintergrund', 'textfarbe'] as const) {
    const roh = zeile(e[f]);
    if (!roh) continue;
    const hex = hexNorm(roh);
    if (!hex) return { ok: false, fehler: `${FARB_LABEL[f]}: bitte wie #3B6EF6 schreiben.` };
    k[f] = hex;
  }
  const schrift = zeile(e.schrift);
  if (schrift) { if (!(SCHRIFTEN as readonly string[]).includes(schrift)) return { ok: false, fehler: 'Unbekannte Schrift.' }; if (schrift !== 'system') k.schrift = schrift as KartenSchrift; }
  if (typeof e.logo === 'string' && e.logo) {
    const l = logoPruefen(e.logo);
    if (!l.ok) return { ok: false, fehler: l.fehler };
    k.logo = l.logo;
  }
  if (!(k.vorname || k.nachname || k.firma || k.email || k.handy || k.telefon)) return { ok: false, fehler: 'Ein Profil braucht mindestens einen Namen, eine Firma oder eine Erreichbarkeit.' };
  return { ok: true, karte: k };
}

const FARB_LABEL = { farbe: 'Akzentfarbe', hintergrund: 'Hintergrundfarbe', textfarbe: 'Textfarbe' } as const;

/** `#rgb` oder `#rrggbb` → `#rrggbb` (klein) — oder null. */
export function hexNorm(roh: string): string | null {
  const t = roh.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(t)) return t;
  const m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(t);
  return m ? `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}` : null;
}

// ── Logo ─────────────────────────────────────────────────────────────────────

const base64Bytes = (b64: string): Uint8Array => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
const bytesBase64 = (u: Uint8Array): string => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
/** Stimmt der Anfang der Datei mit dem behaupteten Bildtyp überein? (Ein „PNG“, das etwas anderes ist, kommt nicht durch.) */
function magisch(typ: string, b: Uint8Array): boolean {
  if (typ === 'png') return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (typ === 'jpeg') return b[0] === 0xff && b[1] === 0xd8;
  return b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50; // webp
}

/**
 * Ein Logo (Data-URL) prüfen: Größe, Typ, Dateikopf; ein SVG wird GESÄUBERT und neu kodiert (lib/netzwerken/svg.ts) —
 * zurück kommt immer die saubere Fassung, nie das Original.
 */
export function logoPruefen(roh: string): { ok: true; logo: string } | { ok: false; fehler: string } {
  if (roh.length > LOGO_MAX) return { ok: false, fehler: 'Das Logo ist zu groß (höchstens etwa 200 KB) — bitte ein kleineres Bild oder ein SVG wählen.' };
  const svg = LOGO_SVG.exec(roh);
  if (svg) {
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(base64Bytes(svg[1])); } catch { return { ok: false, fehler: 'Das SVG konnte nicht gelesen werden.' }; }
    const sauber = saeubereSvg(text);
    if (!sauber) return { ok: false, fehler: 'Dieses SVG enthält nichts, was als Logo gezeigt werden kann (nur Formen und Text sind erlaubt).' };
    const logo = `data:image/svg+xml;base64,${bytesBase64(new TextEncoder().encode(sauber))}`;
    return logo.length > LOGO_MAX ? { ok: false, fehler: 'Das Logo ist zu groß (höchstens etwa 200 KB).' } : { ok: true, logo };
  }
  const r = LOGO_RASTER.exec(roh);
  if (!r) return { ok: false, fehler: 'Das Logo muss ein SVG-, PNG-, JPG- oder WebP-Bild sein.' };
  let bytes: Uint8Array;
  try { bytes = base64Bytes(r[2]); } catch { return { ok: false, fehler: 'Das Bild konnte nicht gelesen werden.' }; }
  if (!magisch(r[1], bytes)) return { ok: false, fehler: 'Die Datei ist kein gültiges Bild des angegebenen Typs.' };
  return { ok: true, logo: roh };
}

// ── Design (Firmen-Design je Profil) ─────────────────────────────────────────

export const STANDARD_DESIGN = { hintergrund: '#ffffff', text: '#111111', akzent: '#111111' } as const;
const SCHRIFT_STAPEL: Record<KartenSchrift, string> = {
  system: '-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif',
  urbanist: '"Urbanist",-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif',
  serif: 'ui-serif,Georgia,"Times New Roman",serif',
};
export const SCHRIFT_LABEL: Record<KartenSchrift, string> = { system: 'Systemschrift', urbanist: 'Urbanist', serif: 'Serifenschrift' };

/** Das wirksame Aussehen eines Profils — neutral, wo nichts gewählt ist. Nie MAKE-Farben, nie MAKE-Schrift. */
export function kartenDesign(k: Pick<Visitenkarte, 'hintergrund' | 'textfarbe' | 'farbe' | 'schrift'>): { hintergrund: string; text: string; akzent: string; schrift: string } {
  const text = k.textfarbe ?? STANDARD_DESIGN.text;
  return { hintergrund: k.hintergrund ?? STANDARD_DESIGN.hintergrund, text, akzent: k.farbe ?? (k.textfarbe ?? STANDARD_DESIGN.akzent), schrift: SCHRIFT_STAPEL[k.schrift ?? 'system'] };
}

const kanal = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
/** Relative Leuchtdichte (WCAG 2.x) einer Farbe `#rrggbb`. */
export function leuchtdichte(hex: string): number {
  const h = hexNorm(hex) ?? '#000000';
  return 0.2126 * kanal(parseInt(h.slice(1, 3), 16)) + 0.7152 * kanal(parseInt(h.slice(3, 5), 16)) + 0.0722 * kanal(parseInt(h.slice(5, 7), 16));
}
/** Kontrastverhältnis zweier Farben (1 bis 21). */
export function kontrast(a: string, b: string): number {
  const x = leuchtdichte(a), y = leuchtdichte(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/** Warnungen zur Lesbarkeit: Text auf Hintergrund (WCAG AA 4,5:1), Akzent auf Hintergrund (3:1). Leer = in Ordnung. */
export function kontrastWarnungen(k: Pick<Visitenkarte, 'hintergrund' | 'textfarbe' | 'farbe' | 'schrift'>): string[] {
  const d = kartenDesign(k);
  const aus: string[] = [];
  const t = kontrast(d.text, d.hintergrund);
  if (t < 4.5) aus.push(`Text auf Hintergrund ist schlecht lesbar (Kontrast ${t.toFixed(1).replace('.', ',')}:1, empfohlen mindestens 4,5:1).`);
  const a = kontrast(d.akzent, d.hintergrund);
  if (a < 3) aus.push(`Die Akzentfarbe hebt sich kaum vom Hintergrund ab (Kontrast ${a.toFixed(1).replace('.', ',')}:1, empfohlen mindestens 3:1).`);
  return aus;
}

export const FELD_LABEL: Record<KartenTextfeld, string> = {
  bezeichnung: 'Name des Profils', vorname: 'Vorname', nachname: 'Nachname', rolle: 'Rolle / Titel', firma: 'Firma', email: 'E-Mail', handy: 'Handy', telefon: 'Telefon',
  web: 'Website', strasse: 'Straße und Nr.', plz: 'PLZ', ort: 'Ort', land: 'Land', linkedin: 'LinkedIn',
};

/** Der volle Name der Person auf dem Profil („Vorname Nachname“). */
export const kartenName = (k: Pick<Visitenkarte, 'vorname' | 'nachname'>): string => [k.vorname, k.nachname].filter(Boolean).join(' ');
/** Wie das Profil im Umschalter heißt: Bezeichnung, sonst Firma, sonst der Name. */
export const kartenTitel = (k: Visitenkarte): string => k.bezeichnung || k.firma || kartenName(k) || 'Profil';
/** Das Profil in der Reihenfolge des Umschalters. */
export const nachRang = <T extends { rang: number; id: string }>(liste: T[]): T[] => [...liste].sort((a, b) => a.rang - b.rang || a.id.localeCompare(b.id));

// ── vCard 3.0 ────────────────────────────────────────────────────────────────

/** Text in einem vCard-Wert maskieren (RFC 2426 § 4): Backslash, Komma, Semikolon, Zeilenumbruch. */
export const vMaske = (t: string): string => t.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');

/** Eine Zeile auf höchstens 75 Oktette falten (UTF-8, nie mitten in einem Zeichen); Folgezeilen beginnen mit einem Leerzeichen. */
export function vFalten(zeileText: string): string {
  const enc = new TextEncoder();
  if (enc.encode(zeileText).length <= 75) return zeileText;
  const teile: string[] = [];
  let aktuell = '';
  let bytes = 0;
  let grenze = 75; // erste Zeile 75, Folgezeilen 74 (das führende Leerzeichen zählt mit)
  for (const z of Array.from(zeileText)) {
    const b = enc.encode(z).length;
    if (bytes + b > grenze) { teile.push(aktuell); aktuell = ''; bytes = 0; grenze = 74; }
    aktuell += z; bytes += b;
  }
  if (aktuell) teile.push(aktuell);
  return teile.join('\r\n ');
}

/**
 * Die vCard 3.0 eines Profils — nur gesetzte Felder. `falten` für die .vcf-Datei, im QR-Code aus.
 * N/FN nach Konvention (Nachname;Vorname); ohne Namen steht die Firma als FN (Firmenkarte, X-ABShowAs:COMPANY).
 */
export function vcard(k: Visitenkarte, opt: { falten?: boolean; mitLogo?: boolean } = {}): string {
  const z: string[] = ['BEGIN:VCARD', 'VERSION:3.0'];
  const name = kartenName(k);
  z.push(`N:${vMaske(k.nachname ?? '')};${vMaske(k.vorname ?? '')};;;`);
  z.push(`FN:${vMaske(name || k.firma || k.email || k.handy || k.telefon || 'Kontakt')}`);
  if (k.firma) z.push(`ORG:${vMaske(k.firma)}`);
  if (!name && k.firma) z.push('X-ABShowAs:COMPANY');
  if (k.rolle) z.push(`TITLE:${vMaske(k.rolle)}`);
  if (k.email) z.push(`EMAIL;TYPE=INTERNET,WORK:${vMaske(k.email)}`);
  if (k.handy) z.push(`TEL;TYPE=CELL:${vMaske(k.handy)}`);
  if (k.telefon) z.push(`TEL;TYPE=WORK,VOICE:${vMaske(k.telefon)}`);
  // URL ist vom Typ „uri“: nicht maskieren (ein Komma im Link bliebe sonst als „\,“ stehen); Zeilenumbrüche kann es nach der Prüfung nicht geben.
  if (k.web) z.push(`URL:${k.web.replace(/[\r\n]+/g, '')}`);
  if (k.linkedin) z.push(`URL;TYPE=LinkedIn:${k.linkedin.replace(/[\r\n]+/g, '')}`);
  // ADR: Postfach;erweitert;Straße;Ort;Region;PLZ;Land — jede Komponente einzeln maskiert.
  if (k.strasse || k.plz || k.ort || k.land) z.push(`ADR;TYPE=WORK:;;${vMaske(k.strasse ?? '')};${vMaske(k.ort ?? '')};;${vMaske(k.plz ?? '')};${vMaske(k.land ?? '')}`);
  // Logo nur in der Datei (nie im QR) und nur als kleines PNG/JPG — ein SVG kennt kein Kontaktprogramm, ein großes Bild sprengt die Karte.
  if (opt.mitLogo && k.logo) {
    const r = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(k.logo);
    if (r && r[2].length <= VCARD_LOGO_MAX) z.push(`PHOTO;ENCODING=b;TYPE=${r[1] === 'png' ? 'PNG' : 'JPEG'}:${r[2]}`);
  }
  z.push('END:VCARD');
  return (opt.falten ? z.map(vFalten) : z).join('\r\n') + '\r\n';
}

/** Dateiname der .vcf: aus Name/Firma, nur Buchstaben/Ziffern/Bindestrich (Umlaute bleiben lesbar umschrieben). */
export function vcardDateiname(k: Visitenkarte): string {
  const roh = kartenName(k) || k.firma || 'kontakt';
  const s = roh.normalize('NFKD').replace(/ß/g, 'ss').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 40);
  return `${s || 'kontakt'}.vcf`;
}

/** Vorname/Nachname aus einem Konto-Namen („Vorname Rest“) — „aus meinem Konto übernehmen“. */
export function nameAusKonto(name: string): { vorname: string; nachname: string } {
  const t = zeile(name).split(' ').filter(Boolean);
  return t.length <= 1 ? { vorname: t[0] ?? '', nachname: '' } : { vorname: t[0], nachname: t.slice(1).join(' ') };
}
