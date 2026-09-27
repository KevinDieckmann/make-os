// ─── CRM — Brücke vom Event in den Rest der Markttraktion (rein, getestet) ──
// Kevin (26.09.): „Auch das Thema Events ist nicht drin.“ Ein Event war bis
// dahin eine Insel: Gäste kamen, wurden nachgefasst — und nichts davon kam im
// Lead, im Deal, in den Finanzen oder im Kalender an. Hier steht das Rechnen
// für die vier Brücken; Speicher und Netz liegen in der Route
// (app/api/crm/events) und in der Oberfläche (components/os/crm/events):
//   1 Teilnahme → Lead   Gespräch oder Termin beim Nachfassen hebt den Lead
//                        der Firma (ohne Firma: der Person) auf „Im Gespräch“,
//                        wenn er darunter liegt. Bewusst Gesetztes (Kein Fit,
//                        Ruht) bleibt — das entscheidet jemand, nicht ein Klick.
//   2 Teilnahme → Follow-up   Wer da war und noch nicht nachgefasst ist, bekommt
//                        auf Klick ein echtes Follow-up (Frist: 48 h nach dem
//                        Event) — dieselbe Frist wie die virtuelle Zeile.
//   3 Budget → Liquiditätsplan   Ein Planposten „Event: <Titel>“ zum
//                        Eventdatum, feste Kennung ev-<eventId> — einmal, nie
//                        doppelt; Betrag negativ (geht raus).
//   4 Event → Kalender   Ein Termin im gemeinsamen Kalender (3 h Standard),
//                        nur Titel, Ort, Datum und Uhrzeit — keine Gäste, keine
//                        Einladungen. Ob er schon steht, sagt der Kalender-Cache
//                        (Titel + Tag), weil das Event kein Feld dafür hat.
// Der Deal selbst entsteht über den EINEN Weg (components/os/crm/DealAnlegen.tsx
// → /api/crm/deal); die Quelle „event“ trägt die Oberfläche danach nach.

import type { Kontakt } from '@/lib/make-one/crm';
import type { Planposten } from '@/lib/make-one/liquiditaet';
import type { Event, Lead, LeadStatus, Teilnahme, FollowUpArt, FollowUpBezugArt, FollowUpQuelle } from './typen';
import { abgeleitet, leereKriterien, statusLabel } from './leads';
import { followUpBis, eventName } from './events';
import { budgetSumme } from './eventplanung';

// ── 1 · Lead heben ──────────────────────────────────────────────────────────

/** Was beim Nachfassen herauskam — Gespräch und Termin heben den Lead, „nur erledigt“ nicht. */
export type NachfassErgebnis = 'gespraech' | 'termin' | 'erledigt';
export const NACHFASS_ERGEBNISSE: { id: NachfassErgebnis; label: string; hebt: boolean; hinweis: string }[] = [
  { id: 'gespraech', label: 'Gespräch', hebt: true, hinweis: 'Es gab ein echtes Gespräch — der Lead rückt auf „Im Gespräch“.' },
  { id: 'termin', label: 'Termin', hebt: true, hinweis: 'Ein Termin steht — der Lead rückt auf „Im Gespräch“.' },
  { id: 'erledigt', label: 'Nur erledigt', hebt: false, hinweis: 'Nachgefasst, ohne Gespräch — der Lead bleibt, wie er ist.' },
];
export const hebtLead = (e: NachfassErgebnis) => NACHFASS_ERGEBNISSE.find(x => x.id === e)?.hebt === true;

/** Wohin der Lead nach einem Gespräch mindestens gehört. */
export const HEBEN_AUF: LeadStatus = 'im_gespraech';
/** Reihenfolge der Qualifizierung; Kein Fit und Ruht stehen außerhalb (−1). */
const RANG: Record<LeadStatus, number> = { neu: 0, kontaktiert: 1, im_gespraech: 2, qualifizierung: 3, sql: 4, kunde: 5, kein_fit: -1, ruht: -1 };

/** Woran der Lead hängt: an der Firma (kontakt.firmaId), sonst an der Person. */
export function leadZiel(k: Pick<Kontakt, 'id' | 'firmaId'>): { art: 'firma' | 'person'; id: string } {
  return k.firmaId ? { art: 'firma', id: k.firmaId } : { art: 'person', id: k.id };
}

export interface LeadHebung {
  von: LeadStatus; nach: LeadStatus;
  /** Stand jemand den Status von Hand gesetzt (sonst aus den Personen abgeleitet)? */
  gesetzt: boolean;
  geaendert: boolean;
  /** Der neue Lead zum Schreiben — nur, wenn geaendert. */
  lead?: Lead;
  /** Warum nichts passiert ist. */
  grund?: string;
}

/**
 * Lead nach einem Gespräch: auf „Im Gespräch“, wenn er darunter liegt.
 * Der aktuelle Stand ist der gesetzte (alt.status) oder — solange niemand ihn
 * gesetzt hat — der aus den Personen abgeleitete (lib/crm/leads.ts). Bewusst
 * gesetztes „Kein Fit“/„Ruht“ bleibt; ein nur abgeleitetes „Ruht“ (alle
 * Personen ruhen) wird durch das Gespräch wieder lebendig.
 */
export function leadNachGespraech(alt: Lead | undefined, personen: Kontakt[], offenerDeal: boolean, jetzt: string, person: string): LeadHebung {
  const gesetzt = !!alt?.status;
  const von: LeadStatus = alt?.status ?? abgeleitet(personen, offenerDeal);
  const bleibt = (grund: string): LeadHebung => ({ von, nach: von, gesetzt, geaendert: false, grund });
  if (gesetzt && (von === 'kein_fit' || von === 'ruht')) return bleibt(`Lead steht bewusst auf „${statusLabel(von)}“ — nicht angehoben. Unter Firmen › Leads ändern.`);
  if (RANG[von] >= RANG[HEBEN_AUF]) return bleibt(`Lead steht schon auf „${statusLabel(von)}“ — bleibt.`);
  const lead: Lead = {
    status: HEBEN_AUF,
    kriterien: alt?.kriterien ?? leereKriterien(),
    ...(alt?.fit ? { fit: alt.fit } : {}),
    ...(alt?.notiz ? { notiz: alt.notiz } : {}),
    geaendert: jetzt, geaendertVon: person,
  };
  return { von, nach: HEBEN_AUF, gesetzt, geaendert: true, lead };
}

// ── 2 · Follow-up aus der Teilnahme ─────────────────────────────────────────

/** Der Körper für POST /api/crm/followup — genau so, wie die Route ihn nimmt. */
export interface FollowUpEingabe {
  aktion: 'anlegen'; kontaktId: string; bezug: { art: FollowUpBezugArt; id: string };
  art: FollowUpArt; text: string; faellig: string; quelle: FollowUpQuelle; zustaendig?: string;
}

/**
 * Follow-up für einen Gast, der da war: Nachricht, fällig 48 Stunden nach dem
 * Event (followUpBis), Quelle „event“. Zuständig ist, wer eingetragen einlädt
 * und nachfasst; ohne Eintrag entscheidet die Route (wer die Beziehung hält).
 */
export function followUpEingabe(e: Pick<Event, 'id' | 'titel' | 'datum' | 'marke'>, t: Pick<Teilnahme, 'kontaktId' | 'einladenDurch'>): FollowUpEingabe {
  return {
    aktion: 'anlegen', kontaktId: t.kontaktId, bezug: { art: 'event', id: e.id }, art: 'nachricht',
    text: `Nachfassen nach „${eventName(e)}“`.slice(0, 300), faellig: followUpBis(e), quelle: 'event',
    ...(t.einladenDurch ? { zustaendig: t.einladenDurch } : {}),
  };
}

/** Gäste, für die ein Follow-up sinnvoll ist: da, noch nicht nachgefasst, Event vorbei (oder heute). */
export const followUpMoeglich = (e: Pick<Event, 'datum'>, t: Pick<Teilnahme, 'status' | 'followUpAm'>, heute: string) => t.status === 'da' && !t.followUpAm && e.datum <= heute;

// ── 3 · Budget in den Liquiditätsplan ───────────────────────────────────────

/** Feste Kennung je Event — der Plan bekommt den Posten höchstens einmal. Der Plan-Säuberer kürzt Kennungen auf 40 Zeichen. */
export const planpostenId = (eventId: string) => `ev-${eventId}`.slice(0, 40);
export const LIQUIPLAN_KATEGORIE = 'marketing/event';
/** Ab wann ein Event Geld bindet: geplant oder Einladung läuft. Ideen und Vergangenes wandern nicht in den Plan. */
export const LIQUIPLAN_STATUS: ReadonlyArray<Event['status']> = ['geplant', 'einladung'];
const NOTIZ_STEMPEL = /übernommen am (\d{4}-\d{2}-\d{2})/;

/**
 * Der Planposten zu einem Event: „Event: <Titel>“, Betrag = Budget-Summe
 * (negativ, geht raus), einmalig, fällig am Eventdatum. Sicher, sobald die
 * Einladung läuft; geplant zählt mit 80 %. null ohne Budget oder außerhalb
 * der Status geplant/einladung.
 */
export function planpostenAusEvent(e: Event, heute: string): Planposten | null {
  if (!LIQUIPLAN_STATUS.includes(e.status)) return null;
  const summe = budgetSumme(e);
  if (!(summe > 0)) return null;
  const sicher = e.status === 'einladung';
  return {
    id: planpostenId(e.id), titel: `Event: ${e.titel}`.slice(0, 160), betrag: -Math.round(summe), rhythmus: 'einmalig', ab: e.datum,
    sicher, ...(sicher ? {} : { wahrscheinlich: 80 }), kategorie: LIQUIPLAN_KATEGORIE,
    notiz: `Aus dem Event (Markttraktion) · übernommen am ${heute}`,
  };
}

/** Wann der Posten in den Plan kam — steht im Notiz-Stempel, weil der Plan kein eigenes Datum führt. */
export function uebernommenAm(p: Pick<Planposten, 'notiz'> | null | undefined): string | null {
  const m = NOTIZ_STEMPEL.exec(p?.notiz ?? '');
  return m ? m[1] : null;
}

export type LiquiplanLage = 'kein-posten' | 'fehlt' | 'ok' | 'abweichend';
export interface LiquiplanStand { lage: LiquiplanLage; vorschlag: Planposten | null; vorhanden: Planposten | null; uebernommenAm: string | null; hinweis: string }

/** Wo das Event im Plan steht: fehlt · ok · abweichend (Budget oder Datum haben sich geändert) · kein Posten (nichts zu übernehmen). */
export function liquiplanStand(e: Event, vorhanden: Planposten | null | undefined, heute: string): LiquiplanStand {
  const vorschlag = planpostenAusEvent(e, heute);
  const alt = vorhanden ?? null;
  const am = uebernommenAm(alt);
  if (!alt) {
    return vorschlag
      ? { lage: 'fehlt', vorschlag, vorhanden: null, uebernommenAm: null, hinweis: `Noch nicht im Liquiditätsplan — ${Math.abs(vorschlag.betrag)} € am ${e.datum}.` }
      : { lage: 'kein-posten', vorschlag: null, vorhanden: null, uebernommenAm: null, hinweis: !LIQUIPLAN_STATUS.includes(e.status) ? 'In den Plan geht ein Event ab Status „Geplant“ oder „Einladung läuft“.' : 'Ohne Budget gibt es nichts zu übernehmen — Positionen oder Pauschale eintragen.' };
  }
  if (vorschlag && (vorschlag.betrag !== alt.betrag || vorschlag.ab !== alt.ab)) {
    return { lage: 'abweichend', vorschlag, vorhanden: alt, uebernommenAm: am, hinweis: `Im Plan stehen ${Math.abs(alt.betrag)} € am ${alt.ab}, das Event sagt ${Math.abs(vorschlag.betrag)} € am ${vorschlag.ab}.` };
  }
  if (e.status === 'abgesagt') return { lage: 'abweichend', vorschlag: null, vorhanden: alt, uebernommenAm: am, hinweis: 'Event abgesagt — der Posten steht noch im Plan (unter Zahlen › Planung entfernen).' };
  return { lage: 'ok', vorschlag, vorhanden: alt, uebernommenAm: am, hinweis: `Im Liquiditätsplan${am ? ` seit ${am}` : ''}: ${Math.abs(alt.betrag)} € am ${alt.ab}.` };
}

// ── 4 · Termin im Kalender ──────────────────────────────────────────────────

/** Dauer, solange der Ablauf nichts anderes sagt — Kevins Vorgabe: drei Stunden. */
export const TERMIN_DAUER_MIN = 180;
/** Genau die Felder, die POST /api/apple-calendar/create nimmt (ohne calendar → Kalender „Gemeinsam“). */
export interface KalenderTermin { title: string; date: string; startHour: number; startMin: number; durationMin: number }

/**
 * Der Termin zum Event: Titel (mit Ort, weil der Kalender-Weg kein eigenes
 * Ortsfeld hat), Tag, Uhrzeit, drei Stunden. Ohne Uhrzeit kein Termin —
 * ein Ganztages-Block wäre etwas anderes als ein Abend.
 */
export function kalenderTermin(e: Pick<Event, 'titel' | 'datum' | 'uhrzeit' | 'ort'>): KalenderTermin | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(e.uhrzeit ?? '');
  if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(e.datum)) return null;
  const startHour = Number(m[1]), startMin = Number(m[2]);
  if (startHour > 23 || startMin > 59) return null;
  const title = (e.ort?.trim() ? `${e.titel} · ${e.ort.trim()}` : e.titel).slice(0, 120);
  return { title, date: e.datum, startHour, startMin, durationMin: TERMIN_DAUER_MIN };
}

const norm = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ');

/** Steht der Termin schon im Kalender? Gleicher Tag und gleicher Titel (auch „Titel · Ort“) — aus dem Kalender-Cache (/api/apple-calendar). */
export function terminBekannt(kalender: ReadonlyArray<{ title?: unknown; startDate?: unknown }>, e: Pick<Event, 'titel' | 'datum'>): boolean {
  const titel = norm(e.titel);
  if (!titel) return false;
  return kalender.some(x => typeof x.startDate === 'string' && x.startDate.slice(0, 10) === e.datum && typeof x.title === 'string' && (norm(x.title) === titel || norm(x.title).startsWith(`${titel} ·`)));
}
