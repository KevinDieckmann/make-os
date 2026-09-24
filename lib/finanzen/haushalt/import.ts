// ─── Kontoauszug einlesen (aus Malins import.js und pdf-leser.js) ───────────
// N26-PDF (über Zeilen, die im Browser aus pdf.js entstehen), N26-Text, CSV.
// Am echten Januar-Auszug 2026 geprüft: 74 Buchungen, Summen auf den Cent.
//
// Zwei Fallen, die der Parser kennt: Summenzeilen am Ende sehen aus wie
// Buchungen, haben aber kein Datum — ein Datum ist Pflicht. Und „Von
// Hauptkonto“ ist eine Umbuchung vom Sparziel, keine Einnahme.
//
// Abweichungen von Malin:
//   • Beträge in Cent.
//   • Zwei gleiche Buchungen am selben Tag (zwei Kaffee zu 3,20 €) sind keine
//     Dublette. Bei ihr fiel die zweite still weg. Hier bekommt jede weitere
//     eine laufende Nummer im Fingerabdruck — ein erneuter Import derselben
//     Datei erkennt trotzdem alles wieder.

import type { Buchung, Einheit, Regel } from './typen';
import { normal, anwenden } from './regeln';

export const N26_KATEGORIEN: Record<string, string> = {
  'lebensmittel': 'Lebensmittel',
  'bars & restaurants': 'Essen auswärts',
  'restaurants': 'Essen auswärts',
  'transport': 'Mobilität',
  'reisen & urlaub': 'Mobilität',
  'gesundheit & drogerien': 'Gesundheit',
  'medien & telekom': 'Abos & Verträge',
  'abonnements': 'Abos & Verträge',
  'freizeit': 'Freizeit',
  'shopping': 'Shopping',
  'wohnen & haushalt': 'Miete & Wohnen',
  'miete': 'Miete & Wohnen',
  'bildung': 'Bildung',
  'sport': 'Sport',
  'versicherung': 'Versicherungen',
  'steuern': 'Steuern',
  'bargeld': 'Sonstiges',
};

const UMBUCHUNG_MUSTER = [/^von hauptkonto$/i, /^auf hauptkonto$/i, /^von space/i, /^auf space/i, /^von unterkonto/i, /^auf unterkonto/i];
export const istUmbuchungText = (s: string) => UMBUCHUNG_MUSTER.some(r => r.test(s.trim()));

/** Deutscher Betrag → Cent. */
export function zahl(s: unknown): number | null {
  let t = String(s ?? '').replace(/[\s€]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(t);
  return Number.isNaN(n) ? null : Math.round(n * 100);
}

/**
 * Malins Fingerabdruck — Zeichen für Zeichen gleich, damit Buchungen aus ihrer
 * Datenbank und neu eingelesene denselben Abdruck bekommen.
 * Betrag geht in EURO mit zwei Stellen ein, wie bei ihr.
 */
export function fingerabdruck(kontoId: string, datum: string, betragCent: number, beschreibung: string): string {
  const roh = [kontoId, datum, (Number(betragCent) / 100).toFixed(2), normal(beschreibung).slice(0, 80)].join('|');
  let h = 0;
  for (let i = 0; i < roh.length; i++) { h = ((h << 5) - h) + roh.charCodeAt(i); h |= 0; }
  return `fp${(h >>> 0).toString(36)}-${roh.length.toString(36)}`;
}

export interface Rohbuchung {
  beschreibung: string; datum: string; betrag: number; empfaenger: string;
  n26Kategorie: string | null; zahlungsart: string | null; istUmbuchung: boolean;
}
export type Kontrolle = Record<string, number>;

const ZEILE = /^(.+?)\s+(\d{2}\.\d{2}\.\d{4})\s+([+-][\d.]*\d,\d{2})\s*€?$/;
const KONTROLLE = /^(Dein alter Kontostand|Dein neuer Kontostand|Einkommende Transaktionen|Ausgehende Transaktionen|Davon Gebühren)\s+([+-][\d.]*\d,\d{2})\s*€?$/;

export function ausN26Zeilen(zeilen: string[]): { buchungen: Rohbuchung[]; kontrolle: Kontrolle } {
  const raus: Rohbuchung[] = [];
  const kontrolle: Kontrolle = {};
  zeilen.forEach((z, i) => {
    const t = String(z).replace(/ /g, ' ').trim();
    const k = t.match(KONTROLLE);
    if (k) { const n = zahl(k[2]); if (n !== null) kontrolle[k[1]] = n; return; }
    const m = t.match(ZEILE);
    if (!m) return;
    const beschreibung = m[1].trim();
    if (/^(Beschreibung|Verbuchungsdatum|Betrag)$/i.test(beschreibung)) return;
    const d = m[2].split('.');
    const folge = String(zeilen[i + 1] ?? '').trim();
    const km = folge.match(/•\s*(.+?)\s*$/);
    const n26Kategorie = km ? (N26_KATEGORIEN[km[1].toLowerCase().trim()] ?? null) : null;
    const zahlungsart = /^(Gutschriften|Belastungen|Lastschriften|Überweisungen|Dauerauftrag)/i.test(folge) ? folge.split(/\s/)[0] : null;
    const betrag = zahl(m[3]);
    if (betrag === null) return;
    raus.push({ beschreibung, datum: `${d[2]}-${d[1]}-${d[0]}`, betrag, empfaenger: beschreibung, n26Kategorie, zahlungsart, istUmbuchung: istUmbuchungText(beschreibung) });
  });
  return { buchungen: raus, kontrolle };
}

/** Eingefügter PDF-Text — Zeilen können umbrechen. */
export function ausN26Text(text: string) {
  const roh = String(text).split(/\r?\n/);
  const zusammen: string[] = [];
  let puffer = '';
  for (let z of roh) {
    z = z.replace(/ /g, ' ').trimEnd();
    if (!z.trim()) { if (puffer) { zusammen.push(puffer); puffer = ''; } continue; }
    const kandidat = (puffer ? `${puffer} ` : '') + z.trim();
    if (ZEILE.test(kandidat)) { zusammen.push(kandidat); puffer = ''; }
    else { zusammen.push(z.trim()); puffer = kandidat.length > 300 ? '' : kandidat; }
  }
  if (puffer) zusammen.push(puffer);
  return ausN26Zeilen(zusammen);
}

function csvZerlegen(text: string): string[][] {
  const z: string[][] = [];
  let feld = '', zeile: string[] = [], inAnf = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inAnf) {
      if (c === '"' && text[i + 1] === '"') { feld += '"'; i++; }
      else if (c === '"') inAnf = false;
      else feld += c;
    } else if (c === '"') inAnf = true;
    else if (c === ',' || c === ';') { zeile.push(feld); feld = ''; }
    else if (c === '\n') { zeile.push(feld); z.push(zeile); zeile = []; feld = ''; }
    else if (c !== '\r') feld += c;
  }
  if (feld || zeile.length) { zeile.push(feld); z.push(zeile); }
  return z.filter(r => r.some(x => String(x).trim()));
}

export function ausCsv(text: string): { buchungen: Rohbuchung[]; kontrolle: Kontrolle } {
  const t = csvZerlegen(text);
  if (t.length < 2) return { buchungen: [], kontrolle: {} };
  const kopf = t[0].map(h => String(h).toLowerCase().trim());
  const idx = (r: RegExp) => kopf.findIndex(h => r.test(h));
  const iDat = idx(/datum|date|booking/), iBes = idx(/verwendung|beschreib|description|referenz|payment reference/);
  const iEmp = idx(/empfaenger|empfänger|partner|name|beguenstigt/), iBet = idx(/betrag|amount|wert/), iKat = idx(/kategorie|category/);
  if (iDat < 0 || iBet < 0) return { buchungen: [], kontrolle: {} };
  const raus: Rohbuchung[] = [];
  for (const r of t.slice(1)) {
    let d = String(r[iDat] ?? '').trim();
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(d)) { const p = d.split('.'); d = `${p[2]}-${p[1]}-${p[0]}`; }
    d = d.slice(0, 10);
    const bes = String((iBes > -1 ? r[iBes] : '') || (iEmp > -1 ? r[iEmp] : '') || 'Buchung').trim();
    const emp = iEmp > -1 ? String(r[iEmp] ?? '').trim() : '';
    const betrag = zahl(r[iBet]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || betrag === null) continue;
    raus.push({
      datum: d, beschreibung: bes, empfaenger: emp || bes, betrag,
      n26Kategorie: iKat > -1 ? (N26_KATEGORIEN[String(r[iKat]).toLowerCase().trim()] ?? null) : null,
      zahlungsart: null, istUmbuchung: istUmbuchungText(bes),
    });
  }
  return { buchungen: raus, kontrolle: {} };
}

/** Text oder CSV erkennen und lesen. */
export function ausText(text: string) {
  const erste = text.split('\n')[0] ?? '';
  let e = /[;,].*[;,]/.test(erste) ? ausCsv(text) : ausN26Text(text);
  if (!e.buchungen.length) e = ausCsv(text);
  return e;
}

export interface Pruefung { ein: number; aus: number; sollEin: number | null; sollAus: number | null; stimmt: boolean | null; abweichung: { ein: number; aus: number } | null }

/** Gegen die Kontrollsummen des Auszugs rechnen. Ein Import, den niemand gegengerechnet hat, ist nur eine Hoffnung. */
export function pruefen(buchungen: Pick<Rohbuchung, 'betrag'>[], kontrolle: Kontrolle): Pruefung {
  const ein = buchungen.filter(b => b.betrag > 0).reduce((s, b) => s + b.betrag, 0);
  const aus = buchungen.filter(b => b.betrag < 0).reduce((s, b) => s + b.betrag, 0);
  const e: Pruefung = { ein, aus, sollEin: kontrolle['Einkommende Transaktionen'] ?? null, sollAus: kontrolle['Ausgehende Transaktionen'] ?? null, stimmt: null, abweichung: null };
  if (e.sollEin !== null && e.sollAus !== null) {
    e.stimmt = ein === e.sollEin && aus === e.sollAus;
    e.abweichung = { ein: ein - e.sollEin, aus: aus - e.sollAus };
  }
  return e;
}

export type Entwurf = Omit<Buchung, 'id' | 'stand' | 'geaendert'>;

/**
 * Rohzeilen in Buchungs-Entwürfe übersetzen: Kategorie aus N26, dann die
 * eigenen Regeln (die gewinnen), Fingerabdruck mit laufender Nummer für
 * gleiche Zeilen in derselben Datei.
 */
export function vorbereiten(roh: Rohbuchung[], kontoId: string, regeln: Regel[], katIdVon: (name: string) => string | null, einheit: Einheit, importId: string, person: string | null): Entwurf[] {
  const zaehler = new Map<string, number>();
  return roh.map(r => {
    const basis: Entwurf = {
      konto_id: kontoId, datum: r.datum, betrag: r.betrag,
      beschreibung: String(r.beschreibung || '').slice(0, 900),
      empfaenger: String(r.empfaenger || r.beschreibung || '').slice(0, 200),
      kategorie_id: r.n26Kategorie ? katIdVon(r.n26Kategorie) : null,
      ist_umbuchung: r.istUmbuchung, ist_fixkosten: false, turnus: 'monatlich', einheit,
      zeilen_hash: null, notiz: null, import_id: importId, erfasst_von: person,
    };
    const b = anwenden(basis, regeln);
    const fp = fingerabdruck(kontoId, b.datum, b.betrag, b.beschreibung);
    const n = (zaehler.get(fp) ?? 0) + 1;
    zaehler.set(fp, n);
    return { ...b, zeilen_hash: n === 1 ? fp : `${fp}#${n}` };
  });
}

/**
 * pdf.js liefert Textschnipsel mit Koordinaten, keine Zeilen. Malins
 * Rekonstruktion: gleiche Höhe (± Toleranz) = eine Zeile, dann links nach rechts.
 */
export function zeilenAusTextItems(items: { str: string; transform: number[] }[], toleranz = 2.5): string[] {
  const gruppen: { y: number; teile: { x: number; text: string }[] }[] = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const x = it.transform[4], y = it.transform[5];
    let g = gruppen.find(gr => Math.abs(gr.y - y) <= toleranz);
    if (!g) { g = { y, teile: [] }; gruppen.push(g); }
    g.teile.push({ x, text: it.str });
  }
  gruppen.sort((a, b) => b.y - a.y);
  return gruppen.map(g => {
    g.teile.sort((a, b) => a.x - b.x);
    let text = '';
    for (const t of g.teile) { if (text && !/\s$/.test(text) && !/^\s/.test(t.text)) text += ' '; text += t.text; }
    return text.replace(/\s+/g, ' ').trim();
  }).filter(z => z.length > 0);
}

/** Kategorie-Kennung zu einem Namen — tolerant: „Mobilität“ findet „Mobilitaet“. */
export function katIdFinder(kategorien: { id: string; name: string }[]): (name: string) => string | null {
  return name => {
    if (!name) return null;
    const genau = kategorien.find(k => k.name === name);
    if (genau) return genau.id;
    const g = normal(name);
    return kategorien.find(k => normal(k.name) === g)?.id ?? null;
  };
}

export type ImportErgebnis =
  | { ok: false; fehler: string; text: string }
  | { ok: true; gefunden: number; neu: Entwurf[]; schonVorhanden: number; zugeordnet: number; umbuchungen: number; pruefung: Pruefung; zeitraum: { von: string; bis: string } | null };

/**
 * Der ganze Import in einem Schritt, ohne zu schreiben: Konto prüfen, lesen,
 * vorbereiten, gegen den Bestand abgleichen. Erst das Konto — ohne gültiges
 * Konto wäre jede Buchung heimatlos (Malins Regression vom 21.09.).
 */
export function importAblauf(
  gelesen: { buchungen: Rohbuchung[]; kontrolle: Kontrolle },
  kontoId: unknown,
  stamm: { konten: { id: string; einheit: Einheit }[]; kategorien: { id: string; name: string }[]; regeln: Regel[] },
  vorhandeneHashes: Set<string>,
  importId: string,
  person: string | null,
): ImportErgebnis {
  const konto = typeof kontoId === 'string' ? stamm.konten.find(k => k.id === kontoId.trim()) : undefined;
  if (!konto) {
    return { ok: false, fehler: 'Kein Konto gewählt', text: stamm.konten.length ? 'Bitte auswählen, auf welches Konto der Auszug gehört.' : 'Es ist noch kein Konto angelegt. Ohne Konto kann kein Auszug eingelesen werden.' };
  }
  if (!gelesen.buchungen.length) return { ok: false, fehler: 'Keine Buchung erkannt', text: 'Keine Zeile sah nach einer Buchung aus. Ist das wirklich ein N26-Kontoauszug oder eine CSV-Datei?' };
  const entwuerfe = vorbereiten(gelesen.buchungen, konto.id, stamm.regeln, katIdFinder(stamm.kategorien), konto.einheit, importId, person);
  const neu = entwuerfe.filter(e => !vorhandeneHashes.has(`${konto.id}|${e.zeilen_hash}`));
  const daten = gelesen.buchungen.map(b => b.datum).sort();
  return {
    ok: true, gefunden: gelesen.buchungen.length, neu, schonVorhanden: entwuerfe.length - neu.length,
    zugeordnet: entwuerfe.filter(e => e.kategorie_id).length, umbuchungen: entwuerfe.filter(e => e.ist_umbuchung).length,
    pruefung: pruefen(gelesen.buchungen, gelesen.kontrolle),
    zeitraum: daten.length ? { von: daten[0], bis: daten[daten.length - 1] } : null,
  };
}
