// ─── Text aus Aufgaben-Dateien lesen (Server, 28.09. C2) ─────────────────────
// Für ZOE (lib/zoe/aufgaben-unterlagen.ts) — NUR Aufgaben-Dateien, nie die CRM-Ablage.
//   PDF       → pdf.js (vorhandenes pdfjs-dist, Legacy-Build, ohne Worker-Thread, ohne eval), höchstens 500 Seiten
//   DOCX      → word/document.xml (Absätze, Tabs)
//   XLSX      → Blätter als Zeilen mit Tabs (geteilte Zeichenketten, Inline-Text, Werte)
//   PPTX      → Folientexte (a:t), Folie für Folie
//   CSV/TXT/MD → Text (UTF-8, sonst Windows-1252)
//   Bilder    → kein Text (null) — ZOE bekommt nur die Metadaten.
// Entpacken nur einzelner Einträge, jeder höchstens 50 MB entpackt (Schutz gegen ZIP-Bomben), nie auf die Platte.
// Das Ergebnis ist Text DRITTER — der Aufrufer kapselt ihn mit `fremd()`.

import { inflateRawSync } from 'zlib';
import { textDekodieren, typGruppe, zipVerzeichnis, type ZipEintrag } from './aufgaben-regeln';

const MAX_ENTPACKT = 50 * 1024 * 1024;
const MAX_SEITEN = 500;
/** Mehr Text als das wird gar nicht erst zusammengesetzt (der Aufrufer liest ohnehin Abschnitte zu 30.000 Zeichen). */
const MAX_TEXT = 2_000_000;

export interface Ausgelesen { text: string; /** z. B. „PDF, 12 Seiten“. */ umfang?: string; /** Hinweis, wenn nicht alles gelesen wurde. */ hinweis?: string }

export class NichtLesbar extends Error {}

/** Einen Eintrag eines ZIP entpacken (gespeichert oder Deflate) — höchstens `MAX_ENTPACKT`. */
function zipEintrag(b: Buffer, e: ZipEintrag): Buffer {
  if (e.lokal + 30 > b.length || b.readUInt32LE(e.lokal) !== 0x04034b50) throw new NichtLesbar('ZIP beschädigt.');
  const start = e.lokal + 30 + b.readUInt16LE(e.lokal + 26) + b.readUInt16LE(e.lokal + 28);
  const roh = b.subarray(start, start + e.komprimiert);
  if (e.methode === 0) return roh.subarray(0, MAX_ENTPACKT);
  if (e.methode !== 8) throw new NichtLesbar('ZIP-Verfahren unbekannt.');
  try { return inflateRawSync(roh, { maxOutputLength: MAX_ENTPACKT }); }
  catch { throw new NichtLesbar('Eintrag zu groß oder beschädigt.'); }
}

const ENTITAETEN: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export function xmlText(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, x: string) => {
    if (x[0] === '#') { const n = x[1] === 'x' || x[1] === 'X' ? parseInt(x.slice(2), 16) : parseInt(x.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; }
    return ENTITAETEN[x.toLowerCase()] ?? '';
  });
}
const ohneTags = (s: string) => xmlText(s.replace(/<[^>]+>/g, ''));

function docxText(b: Buffer, v: ZipEintrag[]): string {
  const e = v.find(x => x.name === 'word/document.xml');
  if (!e) throw new NichtLesbar('Kein Word-Dokument.');
  const xml = zipEintrag(b, e).toString('utf8');
  return ohneTags(xml.replace(/<w:tab\/>/g, '\t').replace(/<w:br[^>]*\/>/g, '\n').replace(/<\/w:p>/g, '\n'))
    .replace(/\n{3,}/g, '\n\n').trim();
}

function spalteAus(ref: string): number {
  const m = /^([A-Z]+)/.exec(ref);
  if (!m) return -1;
  let n = 0;
  for (const c of m[1]) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

function xlsxText(b: Buffer, v: ZipEintrag[]): string {
  const lies = (name: string) => { const e = v.find(x => x.name === name); return e ? zipEintrag(b, e).toString('utf8') : ''; };
  const geteilt = Array.from(lies('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)).map(m => ohneTags(Array.from(m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map(t => t[1]).join('')));
  const buch = lies('xl/workbook.xml');
  const namen = Array.from(buch.matchAll(/<sheet\b[^>]*\bname="([^"]*)"[^>]*\br:id="([^"]*)"/g)).map(m => ({ name: xmlText(m[1]), rid: m[2] }));
  const bez = lies('xl/_rels/workbook.xml.rels');
  const ziel = new Map(Array.from(bez.matchAll(/<Relationship\b[^>]*\bId="([^"]*)"[^>]*\bTarget="([^"]*)"/g)).map(m => [m[1], m[2].replace(/^\/?xl\//, '')]));
  const blaetter = namen.length ? namen.map(n => ({ name: n.name, pfad: `xl/${ziel.get(n.rid) ?? ''}` }))
    : v.filter(x => /^xl\/worksheets\/sheet\d+\.xml$/.test(x.name)).map((x, i) => ({ name: `Blatt ${i + 1}`, pfad: x.name }));
  const raus: string[] = [];
  let laenge = 0;
  for (const bl of blaetter) {
    const xml = lies(bl.pfad);
    if (!xml) continue;
    raus.push(`## ${bl.name}`);
    for (const zeile of Array.from(xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g))) {
      const zellen: string[] = [];
      for (const z of Array.from(zeile[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g))) {
        const attr = z[1], inhalt = z[2] ?? '';
        const ref = /\br="([A-Z]+\d+)"/.exec(attr)?.[1] ?? '';
        const typ = /\bt="([^"]+)"/.exec(attr)?.[1];
        const wert = /<v>([\s\S]*?)<\/v>/.exec(inhalt)?.[1];
        const text = typ === 's' ? (geteilt[Number(wert)] ?? '') : typ === 'inlineStr' ? ohneTags(/<is>([\s\S]*?)<\/is>/.exec(inhalt)?.[1] ?? '') : xmlText(wert ?? '');
        const s = spalteAus(ref);
        if (s >= 0 && s < 1000) { while (zellen.length < s) zellen.push(''); zellen[s] = text; } else zellen.push(text);
      }
      const t = zellen.join('\t').replace(/\t+$/, '');
      if (t) { raus.push(t); laenge += t.length; }
      if (laenge > MAX_TEXT) break;
    }
    if (laenge > MAX_TEXT) break;
  }
  return raus.join('\n');
}

function pptxText(b: Buffer, v: ZipEintrag[]): string {
  const folien = v.filter(x => /^ppt\/slides\/slide\d+\.xml$/.test(x.name)).sort((a, c) => Number(/(\d+)\.xml$/.exec(a.name)![1]) - Number(/(\d+)\.xml$/.exec(c.name)![1]));
  return folien.map((f, i) => {
    const xml = zipEintrag(b, f).toString('utf8');
    const absaetze = Array.from(xml.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)).map(p => ohneTags(Array.from(p[1].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)).map(t => t[1]).join(''))).filter(Boolean);
    return `## Folie ${i + 1}\n${absaetze.join('\n')}`;
  }).join('\n\n');
}

interface PdfText { items: { str?: string; hasEOL?: boolean }[] }
interface PdfSeite { getTextContent(): Promise<PdfText>; cleanup(): void }
interface PdfDok { numPages: number; getPage(n: number): Promise<PdfSeite>; destroy(): Promise<void> }
interface PdfJs { getDocument(o: Record<string, unknown>): { promise: Promise<PdfDok> } }

/** pdf.js zur Laufzeit aus node_modules (am Bündler vorbei — er muss es nicht verstehen), Worker im selben Thread. */
const PDFJS = 'pdfjs-dist/legacy/build/pdf.mjs';
const PDFJS_WORKER = 'pdfjs-dist/legacy/build/pdf.worker.mjs';
async function pdfjsLaden(): Promise<PdfJs> {
  // Ohne eigenen Worker-Thread: pdf.js nimmt den Worker aus `globalThis.pdfjsWorker` (so im Node-Betrieb vorgesehen).
  const g = globalThis as unknown as { pdfjsWorker?: unknown };
  if (!g.pdfjsWorker) g.pdfjsWorker = await import(/* webpackIgnore: true */ PDFJS_WORKER);
  return (await import(/* webpackIgnore: true */ PDFJS)) as PdfJs;
}

async function pdfText(b: Buffer): Promise<Ausgelesen> {
  let pdfjs: PdfJs;
  try { pdfjs = await pdfjsLaden(); } catch { throw new NichtLesbar('PDF-Leser nicht verfügbar.'); }
  let dok: PdfDok;
  try { dok = await pdfjs.getDocument({ data: new Uint8Array(b), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 }).promise; }
  catch { throw new NichtLesbar('PDF nicht lesbar (beschädigt oder mit Passwort).'); }
  try {
    const seiten = Math.min(dok.numPages, MAX_SEITEN);
    const teile: string[] = [];
    let laenge = 0;
    let gelesen = 0;
    for (let i = 1; i <= seiten && laenge <= MAX_TEXT; i++) {
      const s = await dok.getPage(i);
      const t = (await s.getTextContent()).items.map(x => `${x.str ?? ''}${x.hasEOL ? '\n' : ' '}`).join('').replace(/[ \t]+\n/g, '\n').trim();
      s.cleanup();
      teile.push(`— Seite ${i} —\n${t}`);
      laenge += t.length;
      gelesen = i;
    }
    const text = teile.join('\n\n');
    const hinweise = [
      gelesen < dok.numPages ? `nur die ersten ${gelesen} von ${dok.numPages} Seiten gelesen` : '',
      !text.replace(/— Seite \d+ —/g, '').trim() ? 'kein Text gefunden (vermutlich ein Scan ohne Texterkennung)' : '',
    ].filter(Boolean);
    return { text, umfang: `PDF, ${dok.numPages} Seite${dok.numPages === 1 ? '' : 'n'}`, ...(hinweise.length ? { hinweis: hinweise.join('; ') } : {}) };
  } finally { await dok.destroy().catch(() => {}); }
}

/**
 * Text aus dem Inhalt — null bei Bildern (kein Text). Wirft `NichtLesbar` mit einem Satz für ZOE.
 * `typ` ist der beim Hochladen am Inhalt erkannte Typ (lib/dateien/aufgaben-regeln.ts).
 */
export async function textAuslesen(bytes: Buffer, typ: string): Promise<Ausgelesen | null> {
  const g = typGruppe(typ);
  if (g === 'bild') return null;
  if (g === 'pdf') return pdfText(bytes);
  if (g === 'tabelle' || g === 'text') {
    const text = textDekodieren(bytes);
    return { text, umfang: `${text.split('\n').length} Zeilen` };
  }
  const v = zipVerzeichnis(bytes);
  if (!v) throw new NichtLesbar('Office-Datei beschädigt.');
  if (g === 'word') return { text: docxText(bytes, v), umfang: 'Word-Dokument' };
  if (g === 'excel') {
    const text = xlsxText(bytes, v);
    return { text, umfang: 'Excel-Mappe', ...(text.length > MAX_TEXT ? { hinweis: 'sehr große Mappe — nicht alle Zeilen gelesen' } : {}) };
  }
  return { text: pptxText(bytes, v), umfang: 'Präsentation' };
}
