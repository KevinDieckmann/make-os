// ─── Personen-Schranke im CRM-Bestand (28.09. spät, Prüfbefund „Server nimmt Gesperrte an“) ─
// Bis hierher prüfte nur der Browser (Kampagnen-Auswahl, Event-Gästeliste, Deal-Dialog), ob eine
// Person gesperrt ist — `PATCH /api/crm/bestand` nahm jede Kennung an. Jetzt prüft der Server in
// `wendeCrmAn` (lib/crm/speicher.ts) jeden NEU hinzukommenden Personen-Verweis:
//
//   Liste         Art. 18 (eingeschränkt)      Werbesperre (Art. 21)
//   teilnahmen    409 EINGESCHRAENKT_FEHLER    409 — keine Einladung
//   kampagnen     409 (nur aktiv/Entwurf)       409 — keine Kampagne (nur aktiv/Entwurf)
//   chancen       409                          erlaubt (Vertragsbeziehung, keine Werbung)
//   mandate       409                          erlaubt (Vertragsbeziehung, keine Werbung)
//   events        409 (Zielpersonen, 03.10.)   erlaubt (Vorbereitung, keine Werbung)
//
// Nur NEUE Verweise: wer schon drinsteht, wird nicht rückwirkend abgelehnt (die Verbindungsprüfung
// meldet solche Altfälle reparierbar). Texte tragen nie Namen oder Kennungen der Person. Rein, getestet.

import type { ListenOp } from '@/lib/sync';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand, KampagnenStatus } from './typen';
import { EINGESCHRAENKT_FEHLER } from './einschraenkung';

/** Was die Schranke von einer Person braucht — mehr nicht. */
export type PersonSchranke = Pick<Kontakt, 'id' | 'werbesperre' | 'eingeschraenkt'>;

/** Listen mit Personen-Verweisen, die die Schranke prüft. */
export type SchrankenListe = 'teilnahmen' | 'kampagnen' | 'chancen' | 'mandate' | 'events';
/** Kampagnen in diesen Zuständen sprechen (noch) an — nur dort zählt ein neuer Verweis. */
export const KAMPAGNE_SPRICHT_AN: readonly KampagnenStatus[] = ['aktiv', 'entwurf'];

export interface NeuerVerweis {
  liste: SchrankenListe;
  /** Kennung des Eintrags (Teilnahme, Kampagne, Deal, Mandat). */
  id: string;
  /** Anzeigename des Eintrags (Kampagnen-Name, Event-Titel …) für den Text — nie der Name der Person. */
  wo: string;
  kontaktIds: string[];
  /** Werbung (Kampagne, Einladung)? Dann sperrt auch die Werbesperre. */
  werbung: boolean;
}

const nurText = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
const rohVon = (o: ListenOp): Record<string, unknown> | undefined => (o.op === 'teil' ? o.felder : o.op === 'upsert' ? o.eintrag : undefined);
const idVon = (o: ListenOp): string => String((o.op === 'teil' ? o.id : (o.eintrag as { id?: unknown } | undefined)?.id) ?? '');

/**
 * Die Personen-Verweise, die eine Änderung NEU hinzufügt — gemessen am Bestand vor der Änderung.
 * `teil` auf einen fehlenden Eintrag legt nichts an (`wendeAn`) und zählt deshalb nicht.
 */
export function neuePersonenVerweise(b: CrmBestand, ops: ListenOp[]): NeuerVerweis[] {
  const raus: NeuerVerweis[] = [];
  for (const o of ops) {
    const roh = rohVon(o);
    if (!roh) continue;
    const id = idVon(o);
    if (o.liste === 'teilnahmen') {
      const alt = (b.teilnahmen ?? []).find(t => t.id === id);
      if (o.op === 'teil' && !alt) continue;
      if (!('kontaktId' in roh)) continue;
      const k = String(roh.kontaktId ?? '');
      if (!k || k === alt?.kontaktId) continue;
      const eventId = String(roh.eventId ?? alt?.eventId ?? '');
      const titel = (b.events ?? []).find(e => e.id === eventId)?.titel ?? 'Event';
      // Eine Einladung ist Werbung; wer „da“ war, nicht gekommen ist oder abgesagt hat, wird nicht eingeladen (Art. 18 sperrt trotzdem — 29.10. Netzwerken: Begegnung mit Werbesperre bleibt erfassbar).
      const status = String(roh.status ?? alt?.status ?? 'vorgemerkt');
      raus.push({ liste: 'teilnahmen', id, wo: titel, kontaktIds: [k], werbung: !['da', 'no_show', 'abgesagt'].includes(status) });
    } else if (o.liste === 'kampagnen') {
      const alt = (b.kampagnen ?? []).find(k => k.id === id);
      if (o.op === 'teil' && !alt) continue;
      const status = String(roh.status ?? alt?.status ?? 'entwurf') as KampagnenStatus;
      if (!KAMPAGNE_SPRICHT_AN.includes(status) || !('kontaktIds' in roh)) continue;
      const vorher = new Set(alt?.kontaktIds ?? []);
      const neu = nurText(roh.kontaktIds).filter(k => !vorher.has(k));
      if (neu.length) raus.push({ liste: 'kampagnen', id, wo: String(roh.name ?? alt?.name ?? 'Kampagne'), kontaktIds: neu, werbung: true });
    } else if (o.liste === 'events') {
      // Besuchte Events (03.10.): „wen wollen wir treffen“ — eine eingeschränkte Person (Art. 18) kommt nie neu auf die Liste.
      const alt = (b.events ?? []).find(e => e.id === id);
      if (o.op === 'teil' && !alt) continue;
      if (!('zielpersonen' in roh) || !Array.isArray(roh.zielpersonen)) continue;
      const vorher = new Set((alt?.zielpersonen ?? []).map(z => z.kontaktId).filter((k): k is string => !!k));
      const neu = Array.from(new Set((roh.zielpersonen as unknown[]).map(z => (z && typeof z === 'object' ? String((z as { kontaktId?: unknown }).kontaktId ?? '') : '')).filter(k => k && !vorher.has(k))));
      if (neu.length) raus.push({ liste: 'events', id, wo: String(roh.titel ?? alt?.titel ?? 'Event'), kontaktIds: neu, werbung: false });
    } else if (o.liste === 'chancen' || o.liste === 'mandate') {
      const alt = o.liste === 'chancen' ? (b.chancen ?? []).find(c => c.id === id) : (b.mandate ?? []).find(m => m.id === id);
      if (o.op === 'teil' && !alt) continue;
      const vorher = new Set<string>([...(alt?.kontaktIds ?? []), ...Object.keys((alt as { personenRollen?: Record<string, string> } | undefined)?.personenRollen ?? {})]);
      const kandidaten = [...nurText(roh.kontaktIds), ...(roh.personenRollen && typeof roh.personenRollen === 'object' ? Object.keys(roh.personenRollen as Record<string, unknown>) : [])];
      const neu = Array.from(new Set(kandidaten.filter(k => !vorher.has(k))));
      const wo = o.liste === 'chancen' ? String(roh.titel ?? (alt as { titel?: string } | undefined)?.titel ?? 'Deal') : String(roh.titel ?? (alt as { titel?: string } | undefined)?.titel ?? 'Mandat');
      if (neu.length) raus.push({ liste: o.liste, id, wo, kontaktIds: neu, werbung: false });
    }
  }
  return raus;
}

const personenWort = (n: number) => (n === 1 ? 'eine Person' : `${n} Personen`);

/**
 * Lehnt die GANZE Änderung ab (Texte für 409), wenn ein neuer Verweis auf eine gesperrte Person zeigt.
 * Personen, die die Kartei nicht kennt, prüft die Schranke nicht (die Verbindungsprüfung meldet tote Verweise).
 */
export function personenSchranke(b: CrmBestand, ops: ListenOp[], personen: readonly PersonSchranke[]): string[] {
  const verweise = neuePersonenVerweise(b, ops);
  if (!verweise.length) return [];
  const je = new Map(personen.map(p => [p.id, p]));
  const raus: string[] = [];
  let eingeschraenkt = false;
  for (const v of verweise) {
    const ps = v.kontaktIds.map(k => je.get(k)).filter((p): p is PersonSchranke => !!p);
    if (ps.some(p => p.eingeschraenkt)) { eingeschraenkt = true; continue; }
    if (!v.werbung) continue;
    const gesperrt = ps.filter(p => p.werbesperre).length;
    if (!gesperrt) continue;
    raus.push(v.liste === 'teilnahmen'
      ? `Event „${v.wo}“: ${personenWort(gesperrt)} mit Werbesperre (Widerspruch, Art. 21 DSGVO) ${gesperrt === 1 ? 'bekommt' : 'bekommen'} keine Einladung — nichts gespeichert.`
      : `Kampagne „${v.wo}“: ${personenWort(gesperrt)} mit Werbesperre (Widerspruch, Art. 21 DSGVO) ${gesperrt === 1 ? 'kommt' : 'kommen'} in keine Kampagne — nichts gespeichert.`);
  }
  return eingeschraenkt ? [EINGESCHRAENKT_FEHLER, ...raus] : raus;
}

/** Eine Funktions-Änderung (`aendereCrm(b => …)`) wurde von der Personen-Schranke abgelehnt — 409 mit Texten, nichts geschrieben. */
export class PersonenSchrankeFehler extends Error {
  status = 409;
  constructor(public texte: string[]) { super(texte.join(' · ')); this.name = 'PersonenSchrankeFehler'; }
}

/**
 * Was eine Funktions-Änderung an Teilnahmen und Kampagnen NEU hinzugefügt hat, als Einzel-Ops — damit auch sie durch die Schranke laufen
 * (der Ops-Weg prüft in `wendeCrmAn`; Server-Funktionen wie „Netzwerken erfassen“ schrieben bisher an der Schranke vorbei).
 * Gemessen wird am Stand VOR der Änderung; nur neue Einträge bzw. neue Personen in einer Kampagne zählen.
 */
export function funktionsOps(vorher: CrmBestand, nachher: CrmBestand): ListenOp[] {
  const ops: ListenOp[] = [];
  const tAlt = new Map((vorher.teilnahmen ?? []).map(t => [t.id, t]));
  for (const t of nachher.teilnahmen ?? []) { const a = tAlt.get(t.id); if (!a || a.kontaktId !== t.kontaktId || a.status !== t.status) ops.push({ liste: 'teilnahmen', op: 'upsert', eintrag: { ...t } as unknown as Record<string, unknown> }); }
  const kAlt = new Map((vorher.kampagnen ?? []).map(k => [k.id, k]));
  for (const k of nachher.kampagnen ?? []) {
    const a = kAlt.get(k.id);
    if (!a || k.kontaktIds.some(x => !a.kontaktIds.includes(x)) || a.status !== k.status) ops.push({ liste: 'kampagnen', op: 'upsert', eintrag: { ...k } as unknown as Record<string, unknown> });
  }
  return ops;
}
