// ─── Aktive Inhalte in Office- und PDF-Dateien erkennen (Server, Prüf-Fund 11.10.) ─────────────────────────────────────────────────────────
// „Office ohne Makros“ prüfte bis 11.10. nur `vbaProject.bin`. Für Unterlagen von außen (Kunden-Link, Fulfillment) und die interne
// Aufgaben-Ablage gilt jetzt dieselbe strengere Regel — eine aktive Datei wird abgelehnt (415), nie gespeichert:
//   · Office (DOCX/XLSX/PPTX): Makro-Projekt (`vbaProject.bin`, `vbaData.xml`), ActiveX (`activeX/`), eingebettete Objekte (`embeddings/`) —
//     AUSNAHME: eingebettete OOXML-Pakete (`.xlsx`/`.docx`/`.pptx`, z. B. die Tabelle hinter einem Diagramm), die selbst diese Prüfung bestehen
//     (eine Ebene tief). Dazu Verweise in jeder `.rels`-Datei: `attachedTemplate` (Vorlage aus dem Netz) und jeder `TargetMode="External"`
//     außer Hyperlinks (externe Bilder, Rahmen, OLE-Verknüpfungen öffnen beim Öffnen der Datei eine Verbindung).
//   · PDF: die Namen `/JavaScript`, `/JS`, `/Launch` (auch als `#xx` getarnt, auch in komprimierten Objekt-Strömen), eingebettete Dateien
//     (`/EmbeddedFile(s)`) — AUSNAHME: nur XML-Anhänge (E-Rechnung ZUGFeRD/Factur-X/XRechnung) — und `/OpenAction` mit einer Aktion
//     außer „GoTo“ (ein Sprungziel als Liste ist harmlos).
// Grenzen: Verweis-Dateien, entpackte Bytes und Ströme gedeckelt — darüber gilt die Datei als nicht prüfbar (abgelehnt).
// Nur Server (zlib) — die reinen Regeln in lib/dateien/aufgaben-regeln.ts bleiben client-sicher.

import { inflateRawSync, inflateSync } from 'zlib';
import { zipVerzeichnis, type ZipEintrag } from './aufgaben-regeln';

export const AKTIV_GRENZEN = {
  relsDateien: 400,
  relsEntpackt: 8 * 1024 * 1024,
  eingebettetEntpackt: 30 * 1024 * 1024,
  pdfStroeme: 300,
  pdfEntpackt: 30 * 1024 * 1024,
} as const;

const OFFICE = /officedocument/;
const PAKET = /\.(xlsx|docx|pptx)$/i;

/** Grund, warum die Datei aktive Inhalte trägt (bzw. nicht prüfbar ist) — null = in Ordnung. Andere Typen: immer null. */
export function aktiveInhalte(typ: string, b: Uint8Array): string | null {
  try {
    if (typ === 'application/pdf') return pdfAktiv(Buffer.from(b.buffer, b.byteOffset, b.byteLength));
    if (OFFICE.test(typ)) return officeAktiv(Buffer.from(b.buffer, b.byteOffset, b.byteLength), 0);
    return null;
  } catch {
    return 'Die Datei ließ sich nicht sicher prüfen.';
  }
}

/** Text für die Ablehnung (415) — für Menschen. */
export const AKTIV_TEXT = 'Die Datei enthält aktive Inhalte (Makros, eingebettete Programme, externe Verweise oder Skripte) — bitte ohne diese senden, z. B. als PDF ohne Formular-Skripte.';

// ── Office ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

function eintragLesen(b: Buffer, e: ZipEintrag, max: number): Buffer | null {
  if (e.lokal + 30 > b.length || b.readUInt32LE(e.lokal) !== 0x04034b50) return null;
  const start = e.lokal + 30 + b.readUInt16LE(e.lokal + 26) + b.readUInt16LE(e.lokal + 28);
  if (start + e.komprimiert > b.length) return null;
  const roh = b.subarray(start, start + e.komprimiert);
  if (e.methode === 0) return roh.length > max ? null : roh;
  if (e.methode !== 8) return null;
  try { return inflateRawSync(roh, { maxOutputLength: max }); } catch { return null; }
}

/** Die `<Relationship …>`-Tags einer `.rels`-Datei prüfen (linear: jedes Tag endet am nächsten `>`). */
export function relsPruefen(text: string): string | null {
  for (let i = text.indexOf('<Relationship'); i >= 0; i = text.indexOf('<Relationship', i + 1)) {
    const ende = text.indexOf('>', i);
    if (ende < 0) return null;
    const tag = text.slice(i, ende);
    const typ = /\sType\s*=\s*["']([^"']*)["']/.exec(tag)?.[1] ?? '';
    if (/attachedTemplate$/i.test(typ)) return 'Vorlage aus dem Netz (attachedTemplate)';
    if (/\sTargetMode\s*=\s*["']External["']/i.test(tag) && !/\/hyperlink$/i.test(typ)) return 'externer Verweis';
    i = ende;
  }
  return null;
}

function officeAktiv(b: Buffer, tiefe: number): string | null {
  const v = zipVerzeichnis(b);
  if (!v) return 'Office-Datei nicht lesbar.';
  let eingebettet = 0;
  for (const e of v) {
    const n = e.name.replace(/\\/g, '/');
    if (/(^|\/)(vbaProject\.bin|vbaData\.xml)$/i.test(n)) return 'Makro-Projekt';
    if (/(^|\/)activeX\//i.test(n)) return 'ActiveX-Steuerelement';
    if (/(^|\/)embeddings\//i.test(n)) {
      if (n.endsWith('/')) continue;
      if (tiefe > 0 || !PAKET.test(n)) return 'eingebettetes Objekt';
      eingebettet += e.gross;
      if (eingebettet > AKTIV_GRENZEN.eingebettetEntpackt) return 'eingebettete Objekte zu groß';
      const innen = eintragLesen(b, e, AKTIV_GRENZEN.eingebettetEntpackt);
      if (!innen) return 'eingebettetes Objekt nicht lesbar';
      const grund = officeAktiv(innen, tiefe + 1);
      if (grund) return `eingebettet: ${grund}`;
    }
  }
  const rels = v.filter(e => /\.rels$/i.test(e.name));
  if (rels.length > AKTIV_GRENZEN.relsDateien) return 'zu viele Verweis-Dateien';
  let summe = 0;
  for (const e of rels) {
    const x = eintragLesen(b, e, AKTIV_GRENZEN.relsEntpackt - summe);
    if (!x) return 'Verweise nicht lesbar';
    summe += x.length;
    const grund = relsPruefen(x.toString('utf8'));
    if (grund) return grund;
  }
  return null;
}

// ── PDF ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** PDF-Name mit `#xx`-Maskierung lesen (`/J#61vaScript` = `/JavaScript`). */
const nameLesen = (roh: string): string => (roh.includes('#') ? roh.replace(/#([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16))) : roh);
const NAME = /\/([^\s/<>[\](){}%]{1,127})/g;
const XML_UNTERTYP = /^(text\/xml|application\/xml)$/i;

/** Text der Objekt-Ströme (`/Type /ObjStm`, FlateDecode) — dort können Schlüssel wie `/JS` komprimiert stehen. */
function objektStroeme(s: string, b: Buffer): string[] {
  const raus: string[] = [];
  let summe = 0, anzahl = 0;
  for (let i = s.indexOf('/ObjStm'); i >= 0; i = s.indexOf('/ObjStm', i + 1)) {
    const st = s.indexOf('stream', i);
    if (st < 0) break;
    if (++anzahl > AKTIV_GRENZEN.pdfStroeme) throw new Error('zu viele Ströme');
    let start = st + 6;
    if (s[start] === '\r') start++;
    if (s[start] === '\n') start++;
    const ende = s.indexOf('endstream', start);
    if (ende < 0) break;
    try {
      const x = inflateSync(b.subarray(start, ende), { maxOutputLength: AKTIV_GRENZEN.pdfEntpackt - summe, finishFlush: 2 /* Z_SYNC_FLUSH: Rest-Bytes am Ende verzeihen */ });
      summe += x.length;
      raus.push(x.toString('latin1'));
    } catch { /* nicht entpackbar: ein Leser kann ihn auch nicht öffnen */ }
    i = ende;
  }
  return raus;
}

/** Hinter `/OpenAction` (ab Position p): eine Aktion außer GoTo? Ein Sprungziel (Liste) ist harmlos. */
function oeffnenAktiv(s: string, p: number, objekt: (nr: string, gen: string) => string | null): boolean {
  const rest = s.slice(p, p + 4000);
  const m = /^\s*(<<|\[|(\d+)\s+(\d+)\s+R)/.exec(rest);
  if (!m) return false;
  let wert: string | null = m[1] === '<<' ? rest : m[1] === '[' ? null : objekt(m[2], m[3]);
  if (wert === null) return false;
  wert = wert.trimStart();
  if (!wert.startsWith('<<')) return false;
  const art = /\/S\s*\/([^\s/<>[\](){}%]+)/.exec(wert)?.[1];
  return !!art && nameLesen(art) !== 'GoTo';
}

/** Der PDF-Text ohne die Inhalte der Ströme (Bilder, Schriften, Seiten — dort stünden Namen wie `/JS` nur zufällig in Binärdaten). */
export function ohneStroeme(s: string): string {
  const teile: string[] = [];
  let pos = 0;
  for (let i = s.indexOf('stream', 0); i >= 0; i = s.indexOf('stream', i + 6)) {
    if (i < pos || s.startsWith('end', i - 3)) continue;
    const nach = s[i + 6];
    if (nach !== '\r' && nach !== '\n') continue;
    teile.push(s.slice(pos, i));
    const ende = s.indexOf('endstream', i + 6);
    if (ende < 0) { pos = s.length; break; }
    pos = ende + 9;
    i = ende + 3;
  }
  teile.push(s.slice(pos));
  return teile.join(' ');
}

function pdfAktiv(b: Buffer): string | null {
  const s = b.toString('latin1');
  const texte = [ohneStroeme(s), ...objektStroeme(s, b)];
  const objekt = (nr: string, gen: string): string | null => {
    const m = new RegExp(`(?:^|[^0-9])${nr}\\s+${gen}\\s+obj\\b`).exec(s);
    if (!m) return null;
    const ab = m.index + m[0].length;
    const ende = s.indexOf('endobj', ab);
    return s.slice(ab, ende < 0 ? ab + 4000 : Math.min(ende, ab + 4000));
  };
  let dateien = 0, xmlDateien = 0, dateiBaum = false, oeffnen = false, start = false;
  for (const t of texte) {
    for (const m of t.matchAll(NAME)) {
      const name = nameLesen(m[1]);
      if (name === 'JavaScript' || name === 'JS') return 'Skript im PDF';
      if (name === 'Launch') start = true;
      if (name === 'OpenAction' && !oeffnen && oeffnenAktiv(t, (m.index ?? 0) + m[0].length, objekt)) oeffnen = true;
      if (name === 'EmbeddedFiles') dateiBaum = true;
      if (name === 'EmbeddedFile') {
        dateien++;
        // Der Untertyp steht im selben Wörterbuch (Ströme liegen nie in Objekt-Strömen) — in der Nähe suchen.
        const umfeld = t.slice(Math.max(0, (m.index ?? 0) - 400), (m.index ?? 0) + 400);
        const sub = /\/Subtype\s*\/([^\s/<>[\](){}%]+)/.exec(umfeld)?.[1];
        if (sub && XML_UNTERTYP.test(nameLesen(sub))) xmlDateien++;
      }
    }
  }
  if (start) return 'Programmstart im PDF';
  if (oeffnen) return 'Aktion beim Öffnen';
  // Eingebettete Dateien nur als XML-Anhang einer E-Rechnung (ZUGFeRD/Factur-X/XRechnung).
  if ((dateien || dateiBaum) && (dateien === 0 || xmlDateien < dateien)) return 'eingebettete Datei im PDF';
  return null;
}
