// ─── Verträge · Import einer Vorlage aus DOCX/PDF/Text — Regelwerk OHNE Modell (rein, client-sicher, 01.11.) ─────────────────────
// Der Text kommt aus lib/dateien/text-auslesen.ts (Server). Hier: Absätze → Paragraphen über §-Überschriften („§ 3 Vergütung“, „§ 3“ in einer
// eigenen Zeile mit dem Titel darunter, „3. Vergütung“ als Rückfall), Titel aus der ersten Zeile, Kandidaten für Platzhalter (Beträge, Daten,
// Lücken wie „[…]“ oder „____“) NUR als Vorschlag. Gespeichert wird erst per Klick (POST speichern) — die Vorschau schreibt nichts.
// Der Text ist Text DRITTER: er wird nur gelesen und angezeigt; lineare Muster.

import { VERTRAG_GRENZEN, istFesterPlatzhalter } from './modell';

export const IMPORT_MAX_ZEICHEN = 400_000;

export interface ImportParagraph { nr: string; titel: string; text: string }
export interface ImportKandidat { wert: string; art: 'betrag' | 'datum' | 'luecke'; anzahl: number }
export interface VorlageImport { titel: string; paragraphen: ImportParagraph[]; kandidaten: ImportKandidat[]; hinweis?: string; zeichen: number }

const PAR_KOPF = /^§\s*(\d{1,3}[a-z]?)\s*[.:)\-–]?\s*(.{0,160})$/;
const NUM_KOPF = /^(\d{1,2})\.\s+([A-ZÄÖÜ][^.]{1,100})$/;

/** Text → Vorschlag einer Vorlage (rein). */
export function vorlageAusText(roh: string): VorlageImport {
  const gekuerzt = roh.length > IMPORT_MAX_ZEICHEN;
  const text = (gekuerzt ? roh.slice(0, IMPORT_MAX_ZEICHEN) : roh).replace(/\r\n?/g, '\n').replace(/ /g, ' ');
  const zeilen = text.split('\n').map(z => z.replace(/[ \t]+/g, ' ').trim()).filter(z => !/^— Seite \d+ —$/.test(z));
  const nichtLeer = zeilen.filter(Boolean);
  const titel = (nichtLeer.find(z => !PAR_KOPF.test(z) && z.length <= 160) ?? '').slice(0, VERTRAG_GRENZEN.titel);
  const mitPar = nichtLeer.some(z => PAR_KOPF.test(z));
  const paragraphen: ImportParagraph[] = [];
  let akt: { nr: string; titel: string; zeilen: string[] } | null = null;
  let titelOffen = false;
  const abschliessen = () => {
    if (!akt) return;
    const t = akt.zeilen.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    paragraphen.push({ nr: akt.nr, titel: akt.titel, text: t.slice(0, VERTRAG_GRENZEN.text) });
  };
  for (const z of zeilen) {
    const m = mitPar ? PAR_KOPF.exec(z) : NUM_KOPF.exec(z);
    if (m) {
      abschliessen();
      akt = { nr: mitPar ? `§ ${m[1]}` : `${m[1]}.`, titel: (m[2] ?? '').trim(), zeilen: [] };
      titelOffen = mitPar && !akt.titel;
      continue;
    }
    if (!akt) continue; // Präambel/Titel vor dem ersten Paragraphen bleibt außen vor (Titel s. o.)
    if (titelOffen && z) { akt.titel = z.slice(0, VERTRAG_GRENZEN.paragraphTitel); titelOffen = false; continue; }
    akt.zeilen.push(z);
  }
  abschliessen();
  if (!paragraphen.length && nichtLeer.length) {
    // Keine Überschriften erkannt: Absätze (Leerzeile) werden Paragraphen ohne Nummer.
    const absaetze = text.split(/\n\s*\n/).map(a => a.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).slice(0, VERTRAG_GRENZEN.paragraphen);
    absaetze.forEach((a, i) => { if (!(i === 0 && a === titel)) paragraphen.push({ nr: '', titel: '', text: a.slice(0, VERTRAG_GRENZEN.text) }); });
  }
  const kandidaten = kandidatenIn(paragraphen.map(p => p.text).join('\n'));
  const zuViele = paragraphen.length > VERTRAG_GRENZEN.paragraphen;
  const hinweis = [
    !nichtLeer.length ? 'Kein Text gefunden (vermutlich ein Scan ohne Texterkennung).' : '',
    nichtLeer.length && !mitPar ? 'Keine §-Überschriften erkannt — bitte die Paragraphen prüfen.' : '',
    gekuerzt ? `Nur die ersten ${IMPORT_MAX_ZEICHEN.toLocaleString('de-DE')} Zeichen gelesen.` : '',
    zuViele ? `Mehr als ${VERTRAG_GRENZEN.paragraphen} Paragraphen — bitte zusammenfassen, sonst lässt sich die Vorlage nicht speichern.` : '',
  ].filter(Boolean).join(' ');
  return { titel, paragraphen, kandidaten, ...(hinweis ? { hinweis } : {}), zeichen: roh.length };
}

/** Kandidaten für Platzhalter (rein): Beträge, Daten, Lücken — mit Anzahl, häufigste zuerst. */
export function kandidatenIn(text: string): ImportKandidat[] {
  const zaehler = new Map<string, ImportKandidat>();
  const plus = (wert: string, art: ImportKandidat['art']) => { const k = zaehler.get(wert); if (k) k.anzahl++; else zaehler.set(wert, { wert, art, anzahl: 1 }); };
  for (const m of text.matchAll(/\d{1,3}(?:\.\d{3})*(?:,\d{2})?\s?(?:€|EUR|Euro)/g)) plus(m[0], 'betrag');
  for (const m of text.matchAll(/\b\d{1,2}\.\d{1,2}\.\d{4}\b/g)) plus(m[0], 'datum');
  for (const m of text.matchAll(/\[[^\]\n]{0,40}\]|_{4,}|\.{5,}/g)) plus(m[0], 'luecke');
  return [...zaehler.values()].sort((a, b) => b.anzahl - a.anzahl).slice(0, 40);
}

/** Einen markierten Wert in allen Paragraphen durch `{{schluessel}}` ersetzen (rein) — wie oft ersetzt wurde. */
export function wertAlsPlatzhalter<T extends { text: string }>(paragraphen: readonly T[], wert: string, schluessel: string): { paragraphen: T[]; ersetzt: number } {
  const w = String(wert ?? '');
  if (!w.trim() || !/^[a-z][a-z0-9_.]{1,40}$/.test(schluessel)) return { paragraphen: [...paragraphen], ersetzt: 0 };
  let ersetzt = 0;
  const neu = paragraphen.map(p => {
    const teile = p.text.split(w);
    if (teile.length < 2) return p;
    ersetzt += teile.length - 1;
    return { ...p, text: teile.join(`{{${schluessel}}}`) };
  });
  return { paragraphen: neu, ersetzt };
}

/** Ein eigener Schlüssel aus einem Label — kollidiert nie mit einem festen Platzhalter (rein). */
export function schluesselAus(label: string, vergeben: readonly string[] = []): string {
  const basis = String(label ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'feld';
  let s = /^[a-z]/.test(basis) ? basis : `f_${basis}`;
  if (s.length < 2) s = `${s}_x`;
  let i = 2;
  const frei = (x: string) => !istFesterPlatzhalter(x) && !vergeben.includes(x);
  const start = s;
  while (!frei(s)) s = `${start}_${i++}`;
  return s;
}
