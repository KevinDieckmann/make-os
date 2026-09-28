// ─── CRM-Bestand — Stand je Eintrag und Löschsperre bei Verweisen (28.09., K4) ─
// Nur Server (node:crypto über lib/store/fingerabdruck.ts).
//
// Stand (#35/#42/#107): Jeder Eintrag der CRM-Listen geht mit `stand` hinaus —
// dem Fingerabdruck des gespeicherten Datensatzes (wie `listePatchen`). Schickt
// der Browser ihn mit `teil`/`upsert`/`delete` zurück und passt er nicht mehr,
// hat inzwischen jemand anders geschrieben: 409 mit dem aktuellen Eintrag, nichts
// wird überschrieben. Ohne Stand (Altweg: ZOE, Heads, Server) bleibt nur `teil`
// erlaubt — feldweise, er überschreibt keine fremden Felder. Ein `upsert` auf
// einen bestehenden Eintrag ohne Stand ist abgelehnt; einzige Ausnahme sind
// Firmen: dort füllt ein Upsert mit bestehender Kennung nur leere Felder
// (`firmaZusammenfuehren`, F1) und überschreibt nie.
//
// Löschsperre (#49): Eine Firma mit Personen, Deals, Mandaten oder Rechnungen und
// ein Mandat mit Rechnungen werden nicht gelöscht — 409 mit den Anzahlen (keine
// Namen, keine Beträge), die Oberfläche zeigt den Text.
// Seit 28.09. abends (Integritätsprüfung W6) zusätzlich: Firmen/Mandate mit Einträgen
// der Dateiablage oder offenen Follow-ups; Produkte, auf die Deals/Mandate zeigen
// (→ „eingestellt“ setzen); Segmente in Events/Kampagnen; Beiträge in Newslettern.
// Events: nie mit Teilnahmen/offenen Follow-ups allein löschen — der Serverweg
// `POST /api/crm/events { aktion: 'loeschen' }` legt die Kaskade (`loeschKaskade`)
// in DERSELBEN Änderung dazu: Teilnahmen weg, offene Follow-ups des Events abgesagt.

import { fingerabdruck } from '@/lib/store/fingerabdruck';
import type { ListenOp } from '@/lib/sync';
import { CRM_LISTEN, type CrmBestand, type CrmListe, type FollowUp } from './typen';
import { dealZuFirma, mandatZuFirma } from './firmen-bezug';
import { rechnungPasst, type RechnungKurz } from './kunden';
import { personenDerFirma } from './stationen';
import { toechter } from './konzern';
import type { Kontakt } from '@/lib/make-one/crm';
import type { DateiEintrag } from '@/lib/dateien/regeln';

export type CrmKonfliktGrund = 'inzwischen geändert' | 'inzwischen gelöscht' | 'ohne Stand';
export interface CrmKonflikt { liste: CrmListe; id: string; grund: CrmKonfliktGrund; aktuell?: Record<string, unknown> & { stand: string } }

/** Fingerabdruck eines gespeicherten CRM-Eintrags (ohne das Feld `stand`). */
export const standVon = (e: object): string => fingerabdruck(e as Record<string, unknown>);

/** Der Bestand, wie er an den Browser geht: jeder Eintrag jeder CRM-Liste mit `stand`. Nie so speichern. */
export function crmMitStand(b: CrmBestand): CrmBestand {
  const neu: Record<string, unknown> = { ...b };
  for (const l of CRM_LISTEN) neu[l] = ((b[l] ?? []) as unknown as Record<string, unknown>[]).map(e => ({ ...e, stand: standVon(e) }));
  return neu as unknown as CrmBestand;
}

const istListe = (l: string): l is CrmListe => (CRM_LISTEN as readonly string[]).includes(l);
const opId = (o: ListenOp): string => String((o.op === 'upsert' ? (o.eintrag as { id?: unknown } | undefined)?.id : o.id) ?? '');
/**
 * Stand der Änderung — nur am Op. Ein `stand` IM Eintrag zählt nicht: Oberflächen bauen Einträge oft aus dem
 * Browser-Stand zusammen (`{ ...f, notiz }`), der mitgeschleppte Wert sagt nichts darüber, was der Schreiber sah.
 */
const standDer = (o: ListenOp): string | undefined => (typeof o.stand === 'string' && o.stand ? o.stand : undefined);

/**
 * Welche Änderungen auf einen veralteten Stand treffen — geprüft gegen den Bestand IN der Sperre (aendereCrm).
 * Ein Konflikt lehnt die ganze Änderung ab (wie `listePatchen`): halbe Stände sind schlimmer als eine Nachfrage.
 */
export function crmKonflikte(b: CrmBestand, ops: ListenOp[]): CrmKonflikt[] {
  const k: CrmKonflikt[] = [];
  for (const o of ops) {
    if (!istListe(o.liste)) continue;
    const id = opId(o);
    const alt = ((b[o.liste] ?? []) as unknown as Record<string, unknown>[]).find(e => String(e.id) === id);
    const stand = standDer(o);
    if (stand === undefined) {
      // Altweg ohne Stand: `teil` (feldweise) und `delete` wie bisher; ein ganzer Eintrag über einen bestehenden nur mit Stand.
      if (o.op === 'upsert' && alt && o.liste !== 'firmen') k.push({ liste: o.liste, id, grund: 'ohne Stand', aktuell: { ...alt, stand: standVon(alt) } });
      continue;
    }
    if (!alt) { k.push({ liste: o.liste, id, grund: 'inzwischen gelöscht' }); continue; }
    const jetzt = standVon(alt);
    if (jetzt !== stand) k.push({ liste: o.liste, id, grund: 'inzwischen geändert', aktuell: { ...alt, stand: jetzt } });
  }
  return k;
}

/**
 * Was beim Löschen gebraucht wird, aber nicht im CRM-Bestand liegt: Personen (Kartei), Rechnungen (Finanzplan) und
 * die Einträge der Dateiablage des Haushalts (nur die Bezüge). Fehlt `dateien`, wird die Ablage nicht gezählt.
 */
export interface VerweisKontext {
  kontakte?: Pick<Kontakt, 'id' | 'firmaId' | 'position' | 'stationen'>[];
  rechnungen?: (RechnungKurz & { mandatId?: string })[];
  dateien?: Pick<DateiEintrag, 'firmaId' | 'mandatId'>[];
}
/**
 * `personen` zählt jede Station (auch beendete — sonst verlöre die Historie ihre Firma); `toechter` die Firmen mit
 * dieser Mutter (28.09.); `dateien`/`followups` Ablage-Einträge und offene Follow-ups; `teilnahmen` Gäste eines Events;
 * `events`/`kampagnen`/`newsletter` Verwendungen eines Segments bzw. Beitrags.
 */
export interface VerweisAnzahl {
  personen: number; deals: number; mandate: number; rechnungen: number; toechter?: number;
  dateien?: number; followups?: number; teilnahmen?: number; events?: number; kampagnen?: number; newsletter?: number;
}
export type LoeschListe = 'firmen' | 'mandate' | 'leistungen' | 'events' | 'segmente' | 'beitraege';
export interface LoeschSperre { liste: LoeschListe; id: string; anzahl: VerweisAnzahl; text: string }

const wort = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;
const teileVon = (a: VerweisAnzahl) => [
  a.personen && wort(a.personen, 'Person', 'Personen'), a.deals && wort(a.deals, 'Deal', 'Deals'),
  a.mandate && wort(a.mandate, 'Mandat', 'Mandate'), a.rechnungen && wort(a.rechnungen, 'Rechnung', 'Rechnungen'),
  a.toechter && wort(a.toechter, 'Tochterfirma', 'Tochterfirmen'), a.dateien && wort(a.dateien, 'Datei in der Ablage', 'Dateien in der Ablage'),
  a.followups && wort(a.followups, 'offenes Follow-up', 'offene Follow-ups'), a.teilnahmen && wort(a.teilnahmen, 'Teilnahme', 'Teilnahmen'),
  a.events && wort(a.events, 'Event', 'Events'), a.kampagnen && wort(a.kampagnen, 'Kampagne', 'Kampagnen'),
  a.newsletter && wort(a.newsletter, 'Newsletter-Ausgabe', 'Newsletter-Ausgaben'),
].filter(Boolean);
/** „noch 3 Personen · 1 Deal · 2 Rechnungen“ — nur Anzahlen, nie Namen oder Beträge. */
export function verweisText(name: string, a: VerweisAnzahl, rat = 'erst umhängen oder beenden, dann löschen'): string {
  return `„${name}“ wird nicht gelöscht: daran hängen noch ${teileVon(a).join(' · ')} — ${rat}.`;
}
const summe = (a: VerweisAnzahl) => Object.values(a).reduce<number>((x, v) => x + (typeof v === 'number' ? v : 0), 0);
const OFFEN: readonly FollowUp['status'][] = ['offen', 'verpasst'];

/** Welche Kennungen derselbe Änderungssatz löscht bzw. welche Follow-ups er absagt — die Kaskade zählt nicht als Verweis. */
function imSelbenSatz(ops: ListenOp[]) {
  const geloescht = new Set<string>(), abgesagt = new Set<string>();
  for (const o of ops) {
    if (o.op === 'delete' && o.id != null) geloescht.add(`${o.liste}:${String(o.id)}`);
    if (o.op === 'teil' && o.liste === 'followups' && o.felder && (o.felder.status === 'abgesagt' || o.felder.status === 'erledigt')) abgesagt.add(String(o.id));
  }
  return { geloescht, abgesagt };
}

/**
 * Löschsperre: Firmen mit Personen/Deals/Mandaten/Rechnungen und Mandate mit Rechnungen.
 * Rechnungen gehören zu einem Mandat über `mandatId`; ältere ohne Kennung über den Kunden-Namen (`rechnungPasst`, dieselbe Regel wie der Zahlungs-Faktor).
 */
export function loeschSperren(b: CrmBestand, ops: ListenOp[], kontext: VerweisKontext = {}): LoeschSperre[] {
  const kontakte = kontext.kontakte ?? [];
  const rechnungen = kontext.rechnungen ?? [];
  const dateien = kontext.dateien ?? [];
  const satz = imSelbenSatz(ops);
  const offeneFu = (art: FollowUp['bezug']['art'], id: string) => (b.followups ?? []).filter(f => f.bezug?.art === art && f.bezug.id === id && OFFEN.includes(f.status) && !satz.abgesagt.has(f.id)).length;
  const nur = (a: VerweisAnzahl): VerweisAnzahl => Object.fromEntries(Object.entries(a).filter(([k, v]) => ['personen', 'deals', 'mandate', 'rechnungen'].includes(k) || !!v)) as unknown as VerweisAnzahl;
  const leer = (): VerweisAnzahl => ({ personen: 0, deals: 0, mandate: 0, rechnungen: 0 });
  const sperren: LoeschSperre[] = [];
  for (const o of ops) {
    if (o.op !== 'delete' || o.id == null) continue;
    const id = String(o.id);
    if (o.liste === 'firmen') {
      const f = b.firmen.find(x => x.id === id);
      if (!f) continue;
      const mandate = b.mandate.filter(m => mandatZuFirma(m, f));
      const mandatIds = new Set(mandate.map(m => m.id));
      const anzahl: VerweisAnzahl = nur({
        personen: personenDerFirma(kontakte, f.id, { nurAktiv: false }).length,
        deals: b.chancen.filter(c => dealZuFirma(c, f)).length,
        mandate: mandate.length,
        rechnungen: rechnungen.filter(r => (r.mandatId ? mandatIds.has(r.mandatId) : rechnungPasst({ kunde: f.name }, r))).length,
        toechter: toechter(b.firmen, f.id).length,
        dateien: dateien.filter(d => d.firmaId === f.id).length,
        followups: offeneFu('firma', f.id),
      });
      if (summe(anzahl)) sperren.push({ liste: 'firmen', id, anzahl, text: verweisText(f.name, anzahl) });
    } else if (o.liste === 'mandate') {
      const m = b.mandate.find(x => x.id === id);
      if (!m) continue;
      const anzahl: VerweisAnzahl = nur({ ...leer(), rechnungen: rechnungen.filter(r => (r.mandatId ? r.mandatId === m.id : rechnungPasst(m, r))).length, dateien: dateien.filter(d => d.mandatId === m.id).length, followups: offeneFu('mandat', m.id) });
      if (summe(anzahl)) sperren.push({ liste: 'mandate', id, anzahl, text: verweisText(m.titel, anzahl) });
    } else if (o.liste === 'leistungen') {
      // Produkte (W6): Deals/Mandate zeigen per `leistungId` darauf — nicht löschen, sondern „eingestellt“ setzen.
      const l = (b.leistungen ?? []).find(x => x.id === id);
      if (!l) continue;
      const anzahl: VerweisAnzahl = { ...leer(), deals: b.chancen.filter(c => c.leistungId === id && !satz.geloescht.has(`chancen:${c.id}`)).length, mandate: b.mandate.filter(m => m.leistungId === id && !satz.geloescht.has(`mandate:${m.id}`)).length };
      if (summe(anzahl)) sperren.push({ liste: 'leistungen', id, anzahl, text: verweisText(l.name, anzahl, 'das Produkt stattdessen auf „eingestellt“ setzen (bleibt an Deals und Mandaten lesbar)') });
    } else if (o.liste === 'events') {
      // Events (W6): Teilnahmen und offene Follow-ups des Events gehen nur MIT (Kaskade im selben Satz, `loeschKaskade`).
      const e = (b.events ?? []).find(x => x.id === id);
      if (!e) continue;
      const anzahl: VerweisAnzahl = nur({ ...leer(), teilnahmen: (b.teilnahmen ?? []).filter(t => t.eventId === id && !satz.geloescht.has(`teilnahmen:${t.id}`)).length, followups: offeneFu('event', id) });
      if (summe(anzahl)) sperren.push({ liste: 'events', id, anzahl, text: verweisText(e.titel, anzahl, '„Event löschen“ im Event nimmt Teilnahmen und offene Follow-ups mit') });
    } else if (o.liste === 'segmente') {
      const sg = (b.segmente ?? []).find(x => x.id === id);
      if (!sg) continue;
      const anzahl: VerweisAnzahl = nur({ ...leer(), events: (b.events ?? []).filter(e => e.segmentId === id && !satz.geloescht.has(`events:${e.id}`)).length, kampagnen: (b.kampagnen ?? []).filter(k => k.segmentId === id && !satz.geloescht.has(`kampagnen:${k.id}`)).length });
      if (summe(anzahl)) sperren.push({ liste: 'segmente', id, anzahl, text: verweisText(sg.name, anzahl, 'erst dort ein anderes Segment wählen') });
    } else if (o.liste === 'beitraege') {
      const bt = (b.beitraege ?? []).find(x => x.id === id);
      if (!bt) continue;
      const anzahl: VerweisAnzahl = nur({ ...leer(), newsletter: (b.newsletter ?? []).filter(n => (n.beitragIds ?? []).includes(id) && !satz.geloescht.has(`newsletter:${n.id}`)).length });
      if (summe(anzahl)) sperren.push({ liste: 'beitraege', id, anzahl, text: verweisText(bt.titel, anzahl, 'erst aus der Ausgabe nehmen') });
    }
  }
  return sperren;
}

/**
 * Kaskade beim Löschen eines Events (28.09., W6) — die Ops, die in DENSELBEN Änderungssatz gehören: jede Teilnahme
 * des Events weg, jedes offene Follow-up mit `bezug.event` abgesagt (mit Grund in der Notiz). Rein; der Aufrufer
 * hängt sie an und schreibt alles in EINER Sperre (`wendeCrmAn`) — danach greift `loeschSperren` nicht mehr.
 */
export function loeschKaskade(b: CrmBestand, ops: ListenOp[], jetzt: string): ListenOp[] {
  const raus: ListenOp[] = [];
  const schon = imSelbenSatz(ops);
  for (const o of ops) {
    if (o.op !== 'delete' || o.liste !== 'events' || o.id == null) continue;
    const id = String(o.id);
    const titel = (b.events ?? []).find(e => e.id === id)?.titel ?? id;
    for (const t of b.teilnahmen ?? []) if (t.eventId === id && !schon.geloescht.has(`teilnahmen:${t.id}`)) raus.push({ liste: 'teilnahmen', op: 'delete', id: t.id });
    for (const f of b.followups ?? []) {
      if (f.bezug?.art !== 'event' || f.bezug.id !== id || !OFFEN.includes(f.status) || schon.abgesagt.has(f.id)) continue;
      raus.push({ liste: 'followups', op: 'teil', id: f.id, felder: { status: 'abgesagt', notiz: `${f.notiz ? `${f.notiz}\n` : ''}Abgesagt: Event „${titel}“ gelöscht.`.slice(0, 1000), geaendert: jetzt } });
    }
  }
  return raus;
}
