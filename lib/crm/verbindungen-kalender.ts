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
//   aktivitaet-termin-tot      (K3, 30.09.) Aktivität „Meeting“ mit `terminUid`, deren Termin es nicht mehr gibt (in Apple
//                              gelöscht). Geprüft nur, wo wir es wissen: Termin nicht im Stand UND (kein Bezug-Eintrag mehr
//                              oder sein Starttag im Holfenster). Reparieren löst nur den Verweis — die Aktivität bleibt
//                              (ihre Zeit ist dann der Tag, an dem sie festgehalten wurde).
// Beispiele sind UIDs bzw. Schlüssel — nie Titel. Eingehängt in lib/crm/verbindungen.ts.
// Seit R-K1 (#46): Verweise tragen den Kalender (`kalender|uid`); ältere nur die UID — `verweisLebt` prüft beide Formen
// (neue: genau dieser Kalender, alte: irgendwo im Stand).

import type { FokusBlock, ZeitDatei } from '@/lib/zeitmessung/modell';
import { uidVonSchluessel, schluesselTeile, lebendAus, verweisLebt, BEZUG_FELDER, type BezugFeld, type BezugKennungen } from '@/lib/kalender/bezug';

export interface KalenderPruefBestand {
  /** Fenster [von, bis), in dem der iCloud-Stand alle Termine kennt — null: Stand fehlt oder letzter Lauf scheiterte. */
  fenster: { von: string; bis: string } | null;
  /** Alle iCloud-Objekte: UID, Schlüssel (`kalender|uid`) und ob ihr Text X-MAKE-ART trägt. */
  objekte: { uid: string; schluessel?: string; mitArt: boolean }[];
  /** Einträge in `kalender-bezug` — Schlüssel, Starttag, Sicherung der Art, Kennungen. */
  bezuege: { schluessel: string; tag?: string; art?: string; kennungen: BezugKennungen }[];
}

const e = (n: number, ein: string, mehr: string) => (n === 1 ? ein : mehr);

export const PRUEFUNGEN_KALENDER = {
  'termin-uid-tot': { schwere: 'hinweis', bereich: 'kalender', reparierbar: true, art: 'kennung', knopf: 'Eintrag entfernen', text: (n: number) => `${n} ${e(n, 'Kalender-Bezug gehört', 'Kalender-Bezüge gehören')} zu einem Termin, den es in iCloud nicht mehr gibt (in Apple gelöscht) — „Eintrag entfernen“ räumt ab.` },
  'kalender-bezug-kennung-tot': { schwere: 'warnung', bereich: 'kalender', reparierbar: true, art: 'kennung', knopf: 'Bezug entfernen', text: (n: number) => `${n} ${e(n, 'Termin zeigt', 'Termine zeigen')} auf eine Aufgabe, ein Mandat, eine Person, Firma, einen Deal oder ein Event, die es nicht mehr gibt — „Bezug entfernen“ nimmt nur den toten Verweis weg (der Termin bleibt).` },
  'termin-art-verloren': { schwere: 'hinweis', bereich: 'kalender', reparierbar: false, art: 'kennung', text: (n: number) => `${n} ${e(n, 'Termin hat', 'Termine haben')} die Art (Abwesend, Fokuszeit, Arbeitsort) in Apple verloren — MAKE OS zeigt sie aus der Sicherung weiter und schreibt sie beim nächsten Speichern zurück.` },
  'zeit-termin-tot': { schwere: 'hinweis', bereich: 'zeit', reparierbar: true, art: 'kennung', knopf: 'Verweis entfernen', text: (n: number) => `${n} Fokus-${e(n, 'Block stammt', 'Blöcke stammen')} aus einer Fokuszeit, die es im Kalender nicht mehr gibt — die Zeit zählt weiter; „Verweis entfernen“ löst nur die Verbindung.` },
  'aktivitaet-termin-tot': { schwere: 'hinweis', bereich: 'kontakte', reparierbar: true, art: 'kennung', knopf: 'Verweis lösen', text: (n: number) => `${n} ${e(n, 'Meeting im CRM zeigt', 'Meetings im CRM zeigen')} auf einen Termin, den es im Kalender nicht mehr gibt (in Apple gelöscht) — „Verweis lösen“ lässt die Aktivität stehen und nimmt nur die Verbindung weg.` },
} as const;
export type KalenderPruefungId = keyof typeof PRUEFUNGEN_KALENDER;

/** Lebende Kennungen je Bezugsfeld (Aufgaben nur, wenn geladen). */
export type KalenderLebend = Partial<Record<BezugFeld, ReadonlySet<string>>>;

const imFenster = (tag: string | undefined, f: { von: string; bis: string }) => !!tag && tag >= f.von && tag < f.bis;

/** Was die Prüfung von der Kartei braucht: je Kontakt die Aktivitäten mit Termin-Verweis. */
export type KontaktTermine = readonly { id: string; aktivitaeten?: readonly { terminUid?: string }[] }[];

/**
 * Meetings, deren Termin es nicht mehr gibt (Schlüssel `kontaktId|terminUid`). Nur bei gelungenem Stand; ein Termin mit
 * Bezug-Eintrag außerhalb des Holfensters bleibt unentschieden (wir kennen ihn nicht).
 */
export function toteMeetings(k: KalenderPruefBestand | null | undefined, kontakte: KontaktTermine | null | undefined): string[] {
  if (!k?.fenster) return [];
  const da = lebendAus(k.objekte);
  const tag = new Map(k.bezuege.map(b => [uidVonSchluessel(b.schluessel), b.tag]));
  const raus: string[] = [];
  for (const kt of kontakte ?? []) for (const a of kt.aktivitaeten ?? []) {
    if (!a.terminUid) continue;
    const uid = uidVonSchluessel(a.terminUid);
    if (verweisLebt(a.terminUid, da)) continue;
    if (tag.has(uid) && !imFenster(tag.get(uid), k.fenster)) continue;
    raus.push(`${kt.id}|${a.terminUid}`);
  }
  return raus;
}

/**
 * Termin-Verweise (Schlüssel `kalender|uid`), deren Termin es nicht mehr gibt — wie `toteMeetings`, aber für beliebige Verweise (z. B. `Teilnahme.netzwerken.terminId`).
 * `kennung` ist das, was gemeldet wird (nie ein Titel). Nur bei gelungenem Stand; außerhalb des Holfensters unentschieden.
 */
export function toteTerminVerweise(k: KalenderPruefBestand | null | undefined, verweise: readonly { kennung: string; terminId: string }[]): string[] {
  if (!k?.fenster) return [];
  const da = lebendAus(k.objekte);
  const tag = new Map(k.bezuege.map(b => [uidVonSchluessel(b.schluessel), b.tag]));
  return verweise.filter(v => {
    if (verweisLebt(v.terminId, da)) return false;
    const t = tag.get(uidVonSchluessel(v.terminId));
    return !(tag.has(uidVonSchluessel(v.terminId)) && !imFenster(t, k.fenster!));
  }).map(v => v.kennung);
}

/** Tote Kennungen eines Bezugs (nur Felder, deren Menge bekannt ist). */
export function toteKennungen(k: BezugKennungen, l: KalenderLebend): BezugFeld[] {
  return BEZUG_FELDER.filter(f => !!k[f] && !!l[f] && !l[f]!.has(k[f]!));
}

/** Die Einträge und Blöcke, deren Termin es nicht mehr gibt (nur im Fenster). */
export function toteTermine(k: KalenderPruefBestand | null | undefined, fokus?: { person: string; bloecke: FokusBlock[] }[] | null): { bezuege: string[]; bloecke: string[] } {
  if (!k?.fenster) return { bezuege: [], bloecke: [] };
  const da = lebendAus(k.objekte);
  const bezuege = k.bezuege.filter(b => imFenster(b.tag, k.fenster!) && !verweisLebt(b.schluessel, da)).map(b => b.schluessel);
  const bloecke: string[] = [];
  for (const p of fokus ?? []) for (const bl of p.bloecke ?? []) if (bl.terminUid && !verweisLebt(bl.terminUid, da) && imFenster(bl.von.slice(0, 10), k.fenster)) bloecke.push(bl.terminUid);
  return { bezuege, bloecke };
}

export function kalenderPruefen(
  b: { kalender?: KalenderPruefBestand | null; fokus?: { person: string; bloecke: FokusBlock[] }[] | null; kontakte?: KontaktTermine | null },
  l: KalenderLebend,
  melde: (id: KalenderPruefungId, kennung: string) => void,
): void {
  const k = b.kalender;
  const tot = toteTermine(k, b.fokus);
  for (const s of tot.bezuege) melde('termin-uid-tot', s);
  for (const u of tot.bloecke) melde('zeit-termin-tot', u);
  for (const m of toteMeetings(k, b.kontakte)) melde('aktivitaet-termin-tot', m);
  if (!k) return;
  for (const x of k.bezuege) if (toteKennungen(x.kennungen, l).length) melde('kalender-bezug-kennung-tot', x.schluessel);
  const ohneArt = new Set(k.objekte.filter(o => !o.mitArt).flatMap(o => [o.uid, ...(o.schluessel ? [o.schluessel] : [])]));
  for (const x of k.bezuege) if (x.art && x.art !== 'termin' && !schluesselTeile(x.schluessel).rid && ohneArt.has(x.schluessel)) melde('termin-art-verloren', x.schluessel);
}

export interface KalenderAenderung { befundId: KalenderPruefungId; speicher: 'kalender-bezug' | 'zeit' | 'kontakte'; anzahl: number; text: string }

/** Reparieren (rein): was „Reparieren“ täte — der Schreibweg (Route) rechnet in der Sperre neu. */
export function kalenderReparieren<P extends { kalender?: KalenderPruefBestand | null; fokus?: { person: string; bloecke: FokusBlock[] }[] | null; kontakte: readonly { id: string; aktivitaeten?: readonly { terminUid?: string }[] }[] }>(
  b: P, will: ReadonlySet<string>, l: KalenderLebend,
): { aenderungen: KalenderAenderung[]; kalender: P['kalender']; fokus: P['fokus']; kontakte: P['kontakte'] } {
  const aenderungen: KalenderAenderung[] = [];
  let kalender = b.kalender;
  let fokus = b.fokus;
  let kontakte = b.kontakte;
  const tot = toteTermine(b.kalender, b.fokus);
  if (will.has('aktivitaet-termin-tot')) {
    const weg = new Set(toteMeetings(b.kalender, b.kontakte));
    if (weg.size) {
      let n = 0;
      kontakte = b.kontakte.map(kt => {
        if (!(kt.aktivitaeten ?? []).some(a => a.terminUid && weg.has(`${kt.id}|${a.terminUid}`))) return kt;
        return { ...kt, aktivitaeten: (kt.aktivitaeten ?? []).map(a => { if (!a.terminUid || !weg.has(`${kt.id}|${a.terminUid}`)) return a; n++; const { terminUid: _t, ...rest } = a; return rest; }) };
      }) as unknown as P['kontakte'];
      if (n) aenderungen.push({ befundId: 'aktivitaet-termin-tot', speicher: 'kontakte', anzahl: n, text: `${n} ${e(n, 'Meeting', 'Meetings')}: Verweis auf gelöschten Termin gelöst (Aktivität bleibt)` });
    }
  }
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
  return { aenderungen, kalender, fokus, kontakte };
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
