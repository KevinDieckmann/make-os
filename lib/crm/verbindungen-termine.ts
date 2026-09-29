// ─── Verbindungsprüfung: Termine ↔ Events, Waisen, Follow-ups (rein, getestet, K6a, 29.09.) ─────
// Eingehängt in lib/crm/verbindungen.ts (Prüfen/Reparieren) und app/api/crm/verbindungen (Schreiben):
//   event-termin-verwaist      Das Event wurde im CRM gelöscht, sein Termin steht noch im Kalender (Bezug `eventId` tot,
//                              Termin lebt). „Termin entfernen“ löscht ihn in iCloud — nach der Vorschau/Rückfrage der
//                              Oberfläche; Termine mit Gästen NIE (Teilnehmer-Sperre, K3: dafür müsste eine Absage raus).
//   termin-waise-neu           (#100, R-K1) Ein Termin mit CRM- oder Aufgaben-Bezug wurde in Apple gelöscht, und am selben
//                              Tag (±1) steht ein neuer Termin mit gleichem Titel ohne Bezug (typisch: in Apple gelöscht
//                              und neu angelegt). „Neu zuordnen“ hängt Bezug und Meetings um — nur per Klick, nie von selbst.
//                              Den Titel des gelöschten Termins kennt MAKE OS nur aus dem Meeting („Meeting: …“) bzw. der
//                              eingeplanten Aufgabe (Bezüge tragen keine Titel).
//   followup-termin-verschoben Offenes Follow-up hängt an einem Termin (`terminUid`, z. B. „Termin vorbereiten“ einer
//                              Buchung) und steht nicht mehr am Vortag des Termins — der Termin wurde verschoben.
//                              „Nachziehen“ setzt den Vortag (von Hand verschobene bleiben, wie sie sind).
//   buchung-followup-ohne-termin „Termin vorbereiten“ einer bestätigten Buchung hängt noch nicht am Termin — „Verknüpfen“
//                              setzt `terminUid` (dann zieht es mit). Buchungen selbst bleiben unberührt (R-K2).
//   followup-termin-tot        (F2 M3) Offenes Follow-up zeigt auf einen Termin, den es in iCloud nicht mehr gibt (im
//                              Holfenster, kein Waisen-Paar) — „Vom Termin lösen“ nimmt nur `terminUid` weg, das Follow-up
//                              bleibt mit seinem Datum. Ein Waisen-Paar (`termin-waise-neu`) hängt Follow-ups mit um.
// Beispiele sind Schlüssel/Kennungen — nie Titel.

import type { FollowUp } from './typen';
import { schluesselPasst, schluesselTeile, lebendAus, verweisLebt, altSchluessel, type BezugKennungen } from '@/lib/kalender/bezug';
import { tagPlus } from '@/lib/kalender/zeit';
import type { KalenderPruefBestand } from './verbindungen-kalender';
import { toteTermine } from './verbindungen-kalender';
import { uidVonSchluessel } from '@/lib/kalender/bezug';

/** Lebende Termine im Holfenster (Einzeltermine und Vorkommen) — nur, was die Prüfung braucht. */
export interface TermineStand {
  termine: { id: string; tag: string; titel: string; mitTeilnehmern: boolean }[];
  /** Buchung → „Termin vorbereiten“ (nur Kennungen, bestätigte Buchungen mit Termin). */
  buchungFollowups: { buchungId: string; terminUid: string; followUpId: string }[];
}

const e = (n: number, ein: string, mehr: string) => (n === 1 ? ein : mehr);

export const PRUEFUNGEN_TERMINE = {
  'event-termin-verwaist': { schwere: 'warnung', bereich: 'kalender', reparierbar: true, art: 'kennung', knopf: 'Termin entfernen', text: (n: number) => `${n} ${e(n, 'Termin gehört', 'Termine gehören')} zu einem Event, das im CRM gelöscht wurde, und ${e(n, 'steht', 'stehen')} noch im Kalender — „Termin entfernen“ löscht ${e(n, 'ihn', 'sie')} in iCloud (Termine mit Gästen nie: dort in Apple absagen).` },
  'termin-waise-neu': { schwere: 'hinweis', bereich: 'kalender', reparierbar: true, art: 'kennung', knopf: 'Neu zuordnen', text: (n: number) => `${n} ${e(n, 'gelöschter Termin mit Bezug hat', 'gelöschte Termine mit Bezug haben')} einen neuen Termin mit gleichem Titel am selben Tag (±1) — „Neu zuordnen“ hängt Kontakt/Firma/Deal/Aufgabe und Meetings an den neuen Termin.` },
  'followup-termin-verschoben': { schwere: 'hinweis', bereich: 'followup', reparierbar: true, art: 'followup', knopf: 'Nachziehen', text: (n: number) => `${n} Follow-${e(n, 'up hängt', 'ups hängen')} an einem Termin, der sich verschoben hat — „Nachziehen“ setzt den Vortag des Termins.` },
  'followup-termin-tot': { schwere: 'hinweis', bereich: 'followup', reparierbar: true, art: 'followup', knopf: 'Vom Termin lösen', text: (n: number) => `${n} Follow-${e(n, 'up hängt', 'ups hängen')} an einem Termin, den es in iCloud nicht mehr gibt — „Vom Termin lösen“ nimmt nur die Verbindung weg (das Follow-up bleibt).` },
  'buchung-followup-ohne-termin': { schwere: 'hinweis', bereich: 'followup', reparierbar: true, art: 'followup', knopf: 'Mit dem Termin verknüpfen', text: (n: number) => `${n} „Termin vorbereiten“ ${e(n, 'einer Buchung hängt', 'von Buchungen hängen')} noch nicht am Termin — verknüpft zieht ${e(n, 'es', 'sie')} beim Verschieben mit.` },
} as const;
export type TerminePruefungId = keyof typeof PRUEFUNGEN_TERMINE;

const norm = (t: string) => t.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const MEETING = /^Meeting:\s*/;
const CRM_ODER_AUFGABE: readonly (keyof BezugKennungen)[] = ['kontaktId', 'firmaId', 'mandatId', 'dealId', 'aufgabeId'];

/** Termine mit Bezug zu einem gelöschten Event, die noch leben (Schlüssel des Bezugs) — nur ganze Termine, nie ein Vorkommen. */
export function verwaisteEventTermine(k: KalenderPruefBestand | null | undefined, events: ReadonlySet<string>): string[] {
  if (!k) return [];
  const da = lebendAus(k.objekte);
  return k.bezuege.filter(x => x.kennungen.eventId && !events.has(x.kennungen.eventId) && !schluesselTeile(x.schluessel).rid && verweisLebt(x.schluessel, da)).map(x => x.schluessel);
}

/**
 * #100 Waisen: je gelöschtem Termin mit CRM-/Aufgaben-Bezug der EINE neue Termin mit gleichem Titel (±1 Tag) ohne Bezug.
 * Liefert Paare [alter Schlüssel, neuer Schlüssel] — mehrdeutig (zwei Kandidaten) → kein Vorschlag.
 */
export function waisenPaare(
  k: KalenderPruefBestand | null | undefined, t: TermineStand | null | undefined,
  kontakte: readonly { aktivitaeten?: readonly { terminUid?: string; art?: string; text?: string }[] }[],
  aufgaben: readonly { id: string; title: string }[],
): [string, string][] {
  if (!k?.fenster || !t) return [];
  const tot = new Set(toteTermine(k).bezuege);
  const mitBezug = new Set(k.bezuege.map(x => x.schluessel));
  const titelAufgabe = new Map(aufgaben.map(a => [a.id, a.title]));
  const vergeben = new Set<string>();
  const raus: [string, string][] = [];
  for (const x of k.bezuege) {
    if (!tot.has(x.schluessel) || !x.tag || !CRM_ODER_AUFGABE.some(f => !!x.kennungen[f])) continue;
    const hinweise = new Set<string>();
    for (const kt of kontakte) for (const a of kt.aktivitaeten ?? []) if (a.art === 'termin' && a.text && MEETING.test(a.text) && schluesselPasst(a.terminUid, x.schluessel, { serie: true })) hinweise.add(norm(a.text.replace(MEETING, '')));
    if (x.kennungen.aufgabeId && titelAufgabe.has(x.kennungen.aufgabeId)) hinweise.add(norm(titelAufgabe.get(x.kennungen.aufgabeId)!));
    if (!hinweise.size) continue;
    const von = tagPlus(x.tag, -1), bis = tagPlus(x.tag, 1);
    const kandidaten = t.termine.filter(z => !mitBezug.has(z.id) && !mitBezug.has(altSchluessel(z.id)) && !vergeben.has(z.id) && z.tag >= von && z.tag <= bis && hinweise.has(norm(z.titel)));
    if (kandidaten.length !== 1) continue;
    vergeben.add(kandidaten[0].id);
    raus.push([x.schluessel, kandidaten[0].id]);
  }
  return raus;
}

/** Der Vortag eines Termins (frühestens heute) — dieselbe Regel wie „Termin vorbereiten“ der Buchung (`vorbereitenTag`). */
export const vortagVon = (tag: string, heute: string): string => { const v = tagPlus(tag, -1); return v < heute ? heute : v; };

/** Offene Follow-ups am Termin, deren Datum nicht mehr zum Termin passt (nicht von Hand verschoben): id → Soll-Tag. */
export function followupsNachTermin(followups: readonly FollowUp[], t: TermineStand | null | undefined, heute: string): Map<string, string> {
  const raus = new Map<string, string>();
  if (!t) return raus;
  for (const f of followups) {
    if (f.status !== 'offen' || !f.terminUid || f.verschoben) continue;
    const termin = t.termine.find(z => schluesselPasst(f.terminUid, z.id));
    if (!termin || termin.tag < heute) continue;
    const soll = vortagVon(termin.tag, heute);
    if (f.faellig !== soll) raus.set(f.id, soll);
  }
  return raus;
}

/**
 * Offene Follow-ups, deren Termin es nicht mehr gibt (F2 M3) — nur bei gelungenem Stand und im Holfenster (Tag des Bezugs,
 * sonst das Fälligkeitsdatum); Verweise, die ein Waisen-Paar umhängen würde, bleiben dafür stehen.
 */
export function followupsTerminTot(followups: readonly FollowUp[], k: KalenderPruefBestand | null | undefined, umhaengen: ReadonlySet<string> = new Set(), t?: TermineStand | null): string[] {
  if (!k?.fenster) return [];
  const f0 = k.fenster;
  const da = lebendAus(k.objekte);
  const tag = new Map(k.bezuege.map(b => [uidVonSchluessel(b.schluessel), b.tag]));
  // Lebt, wenn der iCloud-Stand ihn kennt ODER er als Termin/Vorkommen im Holfenster steht (Serien-Vorkommen).
  const lebt = (ref: string) => verweisLebt(ref, da) || !!t?.termine.some(z => schluesselPasst(ref, z.id, { serie: true }));
  return followups.filter(f => {
    if (f.status !== 'offen' || !f.terminUid || lebt(f.terminUid)) return false;
    if ([...umhaengen].some(alt => schluesselPasst(f.terminUid, alt, { serie: true }))) return false;
    const t = tag.get(uidVonSchluessel(f.terminUid)) ?? f.faellig;
    return !!t && t >= f0.von && t < f0.bis;
  }).map(f => f.id);
}

/** „Termin vorbereiten“ bestätigter Buchungen ohne Termin-Verweis: Follow-up-Kennung → Termin-Schlüssel. */
export function buchungFollowupsOhneTermin(followups: readonly FollowUp[], t: TermineStand | null | undefined): Map<string, string> {
  const raus = new Map<string, string>();
  for (const b of t?.buchungFollowups ?? []) {
    const f = followups.find(x => x.id === b.followUpId);
    if (f && f.status === 'offen' && !f.terminUid) raus.set(f.id, b.terminUid);
  }
  return raus;
}

export function terminePruefen(
  b: { kalender?: KalenderPruefBestand | null; termine?: TermineStand | null; kontakte: readonly { aktivitaeten?: readonly { terminUid?: string; art?: string; text?: string }[] }[]; aufgaben?: { liste: readonly { id: string; title: string }[] } | null; followups: readonly FollowUp[]; heute: string },
  events: ReadonlySet<string>,
  melde: (id: TerminePruefungId, kennung: string) => void,
): void {
  for (const s of verwaisteEventTermine(b.kalender, events)) melde('event-termin-verwaist', s);
  const paare = waisenPaare(b.kalender, b.termine, b.kontakte, b.aufgaben?.liste ?? []);
  for (const [alt, neu] of paare) melde('termin-waise-neu', `${alt} → ${neu}`);
  for (const id of followupsNachTermin(b.followups, b.termine, b.heute).keys()) melde('followup-termin-verschoben', id);
  for (const id of followupsTerminTot(b.followups, b.kalender, new Set(paare.map(([alt]) => alt)), b.termine)) melde('followup-termin-tot', id);
  for (const id of buchungFollowupsOhneTermin(b.followups, b.termine).keys()) melde('buchung-followup-ohne-termin', id);
}

/** Reparieren (rein): Follow-ups (CRM) und Meetings (Kartei) — Kalender-Schreiben (iCloud, Bezug) macht die Route. */
export function termineReparieren<K extends { id: string; aktivitaeten?: readonly { terminUid?: string }[] }>(
  b: { kalender?: KalenderPruefBestand | null; termine?: TermineStand | null; kontakte: readonly K[]; aufgaben?: { liste: readonly { id: string; title: string }[] } | null; followups: readonly FollowUp[]; heute: string },
  will: ReadonlySet<string>, jetzt: string, person: string, events: ReadonlySet<string>,
): { followups: FollowUp[]; kontakte: K[]; kalender: KalenderPruefBestand | null | undefined; aenderungen: { befundId: TerminePruefungId; speicher: 'crm' | 'kontakte' | 'kalender-bezug' | 'kalender-termine'; anzahl: number; text: string }[] } {
  const aenderungen: { befundId: TerminePruefungId; speicher: 'crm' | 'kontakte' | 'kalender-bezug' | 'kalender-termine'; anzahl: number; text: string }[] = [];
  let followups = [...b.followups];
  let kontakte = [...b.kontakte];
  // Vorschau des Kalenders nach der Reparatur (geschrieben wird er von der Route: Bezug umhängen, Termin in iCloud löschen).
  let kalender = b.kalender;
  if (will.has('followup-termin-verschoben')) {
    const soll = followupsNachTermin(followups, b.termine, b.heute);
    if (soll.size) {
      followups = followups.map(f => (soll.has(f.id) ? { ...f, faellig: soll.get(f.id)!, geaendert: jetzt, geaendertVon: person } : f));
      aenderungen.push({ befundId: 'followup-termin-verschoben', speicher: 'crm', anzahl: soll.size, text: `${soll.size} Follow-${e(soll.size, 'up', 'ups')} auf den Vortag des verschobenen Termins gesetzt` });
    }
  }
  if (will.has('buchung-followup-ohne-termin')) {
    const uid = buchungFollowupsOhneTermin(followups, b.termine);
    if (uid.size) {
      followups = followups.map(f => (uid.has(f.id) ? { ...f, terminUid: uid.get(f.id)!, geaendert: jetzt, geaendertVon: person } : f));
      aenderungen.push({ befundId: 'buchung-followup-ohne-termin', speicher: 'crm', anzahl: uid.size, text: `${uid.size} „Termin vorbereiten“ mit dem Termin verknüpft` });
    }
  }
  if (will.has('termin-waise-neu')) {
    const paare = waisenPaare(b.kalender, b.termine, b.kontakte as readonly { aktivitaeten?: readonly { terminUid?: string; art?: string; text?: string }[] }[], b.aufgaben?.liste ?? []);
    if (paare.length) {
      let n = 0;
      kontakte = kontakte.map(k => {
        if (!(k.aktivitaeten ?? []).some(a => paare.some(([alt]) => schluesselPasst(a.terminUid, alt, { serie: true })))) return k;
        return { ...k, aktivitaeten: (k.aktivitaeten ?? []).map(a => { const p = paare.find(([alt]) => schluesselPasst(a.terminUid, alt, { serie: true })); if (!p) return a; n++; return { ...a, terminUid: p[1] }; }) };
      });
      // F2 M3: auch Follow-ups am alten Termin (z. B. „Termin vorbereiten“) wandern mit — sonst zögen sie nie mehr nach.
      let nf = 0;
      followups = followups.map(f => { const p = f.terminUid ? paare.find(([alt]) => schluesselPasst(f.terminUid, alt, { serie: true })) : undefined; if (!p) return f; nf++; return { ...f, terminUid: p[1], geaendert: jetzt, geaendertVon: person }; });
      if (nf) aenderungen.push({ befundId: 'termin-waise-neu', speicher: 'crm', anzahl: nf, text: `${nf} Follow-${e(nf, 'up hängt', 'ups hängen')} jetzt am neuen Termin` });
      const neuVon = new Map(paare);
      if (kalender) kalender = { ...kalender, bezuege: kalender.bezuege.map(x => (neuVon.has(x.schluessel) ? { ...x, schluessel: neuVon.get(x.schluessel)! } : x)) };
      aenderungen.push({ befundId: 'termin-waise-neu', speicher: 'kalender-bezug', anzahl: paare.length, text: `${paare.length} ${e(paare.length, 'Bezug', 'Bezüge')} an den neuen Termin gehängt${n ? ` (${n} ${e(n, 'Meeting', 'Meetings')} mit)` : ''}` });
      if (n) aenderungen.push({ befundId: 'termin-waise-neu', speicher: 'kontakte', anzahl: n, text: `${n} ${e(n, 'Meeting zeigt', 'Meetings zeigen')} jetzt auf den neuen Termin` });
    }
  }
  if (will.has('followup-termin-tot')) {
    // Nach dem Umhängen der Waisen: was dann noch tot ist, wird gelöst (nur `terminUid` weg).
    const umhaengen = will.has('termin-waise-neu') ? new Set<string>() : new Set(waisenPaare(b.kalender, b.termine, b.kontakte as readonly { aktivitaeten?: readonly { terminUid?: string; art?: string; text?: string }[] }[], b.aufgaben?.liste ?? []).map(([alt]) => alt));
    const tot = new Set(followupsTerminTot(followups, b.kalender, umhaengen, b.termine));
    if (tot.size) {
      followups = followups.map(f => { if (!tot.has(f.id)) return f; const { terminUid: _t, ...rest } = f; return { ...rest, geaendert: jetzt, geaendertVon: person }; });
      aenderungen.push({ befundId: 'followup-termin-tot', speicher: 'crm', anzahl: tot.size, text: `${tot.size} Follow-${e(tot.size, 'up', 'ups')} vom gelöschten Termin gelöst (bleiben mit ihrem Datum)` });
    }
  }
  if (will.has('event-termin-verwaist')) {
    const weg = verwaisteEventTermine(b.kalender, events);
    // Die Zahl nennt die Kandidaten; ob ein Termin Gäste hat (dann bleibt er), entscheidet der Schreibweg mit iCloud.
    if (weg.length) {
      const raus = new Set(weg);
      const uids = new Set(weg.map(x => schluesselTeile(x).uid));
      if (kalender) kalender = { ...kalender, bezuege: kalender.bezuege.filter(x => !raus.has(x.schluessel)), objekte: kalender.objekte.filter(o => !(o.schluessel ? raus.has(o.schluessel) : uids.has(o.uid))) };
      aenderungen.push({ befundId: 'event-termin-verwaist', speicher: 'kalender-termine', anzahl: weg.length, text: `bis zu ${weg.length} ${e(weg.length, 'Termin', 'Termine')} gelöschter Events in iCloud entfernen (mit Gästen nie)` });
    }
  }
  return { followups, kontakte, kalender, aenderungen };
}
