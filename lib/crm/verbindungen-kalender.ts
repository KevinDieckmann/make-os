// ─── Verbindungsprüfung: Kalender (rein, getestet, 29.09., K1) ──────────────
// Neue Kennungen des Kalenders und worauf sie zeigen (Datenregel KALENDER_VERBINDUNGEN.md 4a):
//   termin-uid-tot             Eintrag in `kalender-bezug` zu einem Termin, den es in iCloud nicht mehr gibt
//                              (in Apple gelöscht). Nur im Holfenster des Stands (-90 … +400 Tage) und nur, wenn der
//                              letzte iCloud-Lauf gelang — sonst wüssten wir es nicht. Reparieren: Eintrag entfernen.
//   kalender-bezug-kennung-tot Kennung im Bezug (Aufgabe, Mandat, Kontakt, Firma, Deal, Event) zeigt ins Leere.
//                              Reparieren: nur die tote Kennung entfernen.
//   termin-art-verloren        Apple hat X-MAKE-ART beim Bearbeiten verloren — die Sicherung im Bezug gilt weiter;
//                              beim nächsten Speichern in MAKE OS wird die Art wieder in den Termin geschrieben.
//   zeit-termin-tot            Fokus-Block aus einer Fokuszeit, deren Termin es nicht mehr gibt. Die Zeit zählt weiter;
//                              Reparieren nimmt nur den Verweis `terminUid` weg.
// Beispiele sind UIDs bzw. Schlüssel — nie Titel. Eingehängt in lib/crm/verbindungen.ts.

import type { FokusBlock, ZeitDatei } from '@/lib/zeitmessung/modell';
import { uidVonSchluessel, BEZUG_FELDER, type BezugFeld, type BezugKennungen } from '@/lib/kalender/bezug';

export interface KalenderPruefBestand {
  /** Fenster [von, bis), in dem der iCloud-Stand alle Termine kennt — null: Stand fehlt oder letzter Lauf scheiterte. */
  fenster: { von: string; bis: string } | null;
  /** Alle iCloud-Objekte: UID und ob ihr Text X-MAKE-ART trägt. */
  objekte: { uid: string; mitArt: boolean }[];
  /** Einträge in `kalender-bezug` — Schlüssel, Starttag, Sicherung der Art, Kennungen. */
  bezuege: { schluessel: string; tag?: string; art?: string; kennungen: BezugKennungen }[];
}

const e = (n: number, ein: string, mehr: string) => (n === 1 ? ein : mehr);

export const PRUEFUNGEN_KALENDER = {
  'termin-uid-tot': { schwere: 'hinweis', bereich: 'kalender', reparierbar: true, art: 'kennung', knopf: 'Eintrag entfernen', text: (n: number) => `${n} ${e(n, 'Kalender-Bezug gehört', 'Kalender-Bezüge gehören')} zu einem Termin, den es in iCloud nicht mehr gibt (in Apple gelöscht) — „Eintrag entfernen“ räumt ab.` },
  'kalender-bezug-kennung-tot': { schwere: 'warnung', bereich: 'kalender', reparierbar: true, art: 'kennung', knopf: 'Bezug entfernen', text: (n: number) => `${n} ${e(n, 'Termin zeigt', 'Termine zeigen')} auf eine Aufgabe, ein Mandat, eine Person, Firma, einen Deal oder ein Event, die es nicht mehr gibt — „Bezug entfernen“ nimmt nur den toten Verweis weg (der Termin bleibt).` },
  'termin-art-verloren': { schwere: 'hinweis', bereich: 'kalender', reparierbar: false, art: 'kennung', text: (n: number) => `${n} ${e(n, 'Termin hat', 'Termine haben')} die Art (Abwesend, Fokuszeit, Arbeitsort) in Apple verloren — MAKE OS zeigt sie aus der Sicherung weiter und schreibt sie beim nächsten Speichern zurück.` },
  'zeit-termin-tot': { schwere: 'hinweis', bereich: 'zeit', reparierbar: true, art: 'kennung', knopf: 'Verweis entfernen', text: (n: number) => `${n} Fokus-${e(n, 'Block stammt', 'Blöcke stammen')} aus einer Fokuszeit, die es im Kalender nicht mehr gibt — die Zeit zählt weiter; „Verweis entfernen“ löst nur die Verbindung.` },
} as const;
export type KalenderPruefungId = keyof typeof PRUEFUNGEN_KALENDER;

/** Lebende Kennungen je Bezugsfeld (Aufgaben nur, wenn geladen). */
export type KalenderLebend = Partial<Record<BezugFeld, ReadonlySet<string>>>;

const imFenster = (tag: string | undefined, f: { von: string; bis: string }) => !!tag && tag >= f.von && tag < f.bis;

/** Tote Kennungen eines Bezugs (nur Felder, deren Menge bekannt ist). */
export function toteKennungen(k: BezugKennungen, l: KalenderLebend): BezugFeld[] {
  return BEZUG_FELDER.filter(f => !!k[f] && !!l[f] && !l[f]!.has(k[f]!));
}

/** Die Einträge und Blöcke, deren Termin es nicht mehr gibt (nur im Fenster). */
export function toteTermine(k: KalenderPruefBestand | null | undefined, fokus?: { person: string; bloecke: FokusBlock[] }[] | null): { bezuege: string[]; bloecke: string[] } {
  if (!k?.fenster) return { bezuege: [], bloecke: [] };
  const da = new Set(k.objekte.map(o => o.uid));
  const bezuege = k.bezuege.filter(b => imFenster(b.tag, k.fenster!) && !da.has(uidVonSchluessel(b.schluessel))).map(b => b.schluessel);
  const bloecke: string[] = [];
  for (const p of fokus ?? []) for (const bl of p.bloecke ?? []) if (bl.terminUid && !da.has(bl.terminUid) && imFenster(bl.von.slice(0, 10), k.fenster)) bloecke.push(bl.terminUid);
  return { bezuege, bloecke };
}

export function kalenderPruefen(
  b: { kalender?: KalenderPruefBestand | null; fokus?: { person: string; bloecke: FokusBlock[] }[] | null },
  l: KalenderLebend,
  melde: (id: KalenderPruefungId, kennung: string) => void,
): void {
  const k = b.kalender;
  const tot = toteTermine(k, b.fokus);
  for (const s of tot.bezuege) melde('termin-uid-tot', s);
  for (const u of tot.bloecke) melde('zeit-termin-tot', u);
  if (!k) return;
  for (const x of k.bezuege) if (toteKennungen(x.kennungen, l).length) melde('kalender-bezug-kennung-tot', x.schluessel);
  const ohneArt = new Set(k.objekte.filter(o => !o.mitArt).map(o => o.uid));
  for (const x of k.bezuege) if (x.art && x.art !== 'termin' && !x.schluessel.includes('::') && ohneArt.has(x.schluessel)) melde('termin-art-verloren', x.schluessel);
}

export interface KalenderAenderung { befundId: KalenderPruefungId; speicher: 'kalender-bezug' | 'zeit'; anzahl: number; text: string }

/** Reparieren (rein): was „Reparieren“ täte — der Schreibweg (Route) rechnet in der Sperre neu. */
export function kalenderReparieren<P extends { kalender?: KalenderPruefBestand | null; fokus?: { person: string; bloecke: FokusBlock[] }[] | null }>(
  b: P, will: ReadonlySet<string>, l: KalenderLebend,
): { aenderungen: KalenderAenderung[]; kalender: P['kalender']; fokus: P['fokus'] } {
  const aenderungen: KalenderAenderung[] = [];
  let kalender = b.kalender;
  let fokus = b.fokus;
  const tot = toteTermine(b.kalender, b.fokus);
  if (kalender && will.has('termin-uid-tot') && tot.bezuege.length) {
    const weg = new Set(tot.bezuege);
    kalender = { ...kalender, bezuege: kalender.bezuege.filter(x => !weg.has(x.schluessel)) };
    aenderungen.push({ befundId: 'termin-uid-tot', speicher: 'kalender-bezug', anzahl: weg.size, text: `${weg.size} ${e(weg.size, 'Kalender-Bezug', 'Kalender-Bezüge')} zu gelöschten Terminen entfernt` });
  }
  if (kalender && will.has('kalender-bezug-kennung-tot')) {
    let n = 0;
    const bezuege = kalender.bezuege.map(x => {
      const t = toteKennungen(x.kennungen, l);
      if (!t.length) return x;
      n++;
      const kennungen = { ...x.kennungen };
      for (const f of t) delete kennungen[f];
      return { ...x, kennungen };
    });
    if (n) { kalender = { ...kalender, bezuege }; aenderungen.push({ befundId: 'kalender-bezug-kennung-tot', speicher: 'kalender-bezug', anzahl: n, text: `${n} ${e(n, 'Termin', 'Termine')}: tote Verweise entfernt (Termin bleibt)` }); }
  }
  if (fokus && will.has('zeit-termin-tot') && tot.bloecke.length) {
    const weg = new Set(tot.bloecke);
    let n = 0;
    fokus = fokus.map(p => ({ ...p, bloecke: p.bloecke.map(bl => { if (!bl.terminUid || !weg.has(bl.terminUid)) return bl; n++; const { terminUid: _t, ...rest } = bl; return rest; }) }));
    if (n) aenderungen.push({ befundId: 'zeit-termin-tot', speicher: 'zeit', anzahl: n, text: `${n} Fokus-${e(n, 'Block', 'Blöcke')}: Verweis auf gelöschte Fokuszeit entfernt (Zeit bleibt)` });
  }
  return { aenderungen, kalender, fokus };
}

/** Für den Schreibweg: die Zeit-Datei einer Person von toten Termin-Verweisen befreien (Sekunden bleiben). */
export function zeitDateiTermineBereinigen(d: ZeitDatei, toteUids: ReadonlySet<string>): { datei: ZeitDatei; anzahl: number } {
  let anzahl = 0;
  const tage: ZeitDatei['tage'] = {};
  for (const [tag, t] of Object.entries(d.tage ?? {})) {
    let anders = false;
    const bloecke = (t.bloecke ?? []).map(bl => { if (!bl.terminUid || !toteUids.has(bl.terminUid)) return bl; anders = true; anzahl++; const { terminUid: _t, ...rest } = bl; return rest; });
    tage[tag] = anders ? { ...t, bloecke } : t;
  }
  return { datei: anzahl ? { ...d, tage } : d, anzahl };
}
