// ─── Make.One — Kennzahlen je Reihe (03.10., rein, getestet) ────────────────
// Kevin: „Fokus Innovation = Event-Reihe unter Make.One.“ Der Make.One-Reiter zeigt je Reihe (und für die Abende ohne
// Reihe): Events, Gäste, Zusagen, Nachgefasst, entstandene Leads und Deals. EINE Rechnung: Die Zahlen je Event kommen
// aus `eventZahlen` (lib/crm/events.ts, vom Server je Event geliefert) und werden hier nur summiert — `zahlenSumme`
// nutzt auch die Kachel „Wirkung“. Leads zählen nach DERSELBEN Regel wie die Marketing-Herkunft im Scoring
// (`alsMarketingAnmeldung`, lib/crm/marke.ts), je Person einmal. Besuchte Events (Netzwerken) zählen nie mit.

import type { Event, Teilnahme } from './typen';
import type { EventZahlen } from './events';
import { EVENT_REIHEN, OHNE_REIHE, reiheVon, reiheName, istNetzwerkenEvent, alsMarketingAnmeldung } from './marke';

/** Summen über mehrere Events — die Felder von `EventZahlen`, die sich addieren lassen. */
export type ZahlenSumme = Pick<EventZahlen, 'eingeladen' | 'zugesagt' | 'da' | 'nachgefasst' | 'nachfassenOffen' | 'folgegespraeche' | 'beeinflusst' | 'verursacht' | 'dealsVerursacht' | 'kosten'>;
const SUMMEN_FELDER: readonly (keyof ZahlenSumme)[] = ['eingeladen', 'zugesagt', 'da', 'nachgefasst', 'nachfassenOffen', 'folgegespraeche', 'beeinflusst', 'verursacht', 'dealsVerursacht', 'kosten'];

/** Summe der Event-Zahlen (fehlende Felder älterer Antworten zählen 0). */
export function zahlenSumme(zahlen: readonly (Partial<EventZahlen> | undefined)[]): ZahlenSumme {
  const s = Object.fromEntries(SUMMEN_FELDER.map(f => [f, 0])) as ZahlenSumme;
  for (const z of zahlen) if (z) for (const f of SUMMEN_FELDER) s[f] += Number(z[f]) || 0;
  return s;
}

/** Schlüssel eines Events für Filter und Übersicht: die Reihen-Kennung oder `OHNE_REIHE`. */
export const reiheSchluessel = (e: Pick<Event, 'reihe' | 'marke'>): string => reiheVon(e)?.id ?? OHNE_REIHE;
/** Passt das Event zur Wahl im Filter? `null` = alle. */
export const passtReihe = (e: Pick<Event, 'reihe' | 'marke'>, wahl: string | null): boolean => wahl === null || reiheSchluessel(e) === wahl;

export interface ReiheZeile {
  /** Reihen-Kennung oder `OHNE_REIHE`. */
  id: string;
  name: string;
  /** Events der Reihe (ohne abgesagte). */
  events: number;
  kommend: number;
  vorbei: number;
  summe: ZahlenSumme;
  /** Personen, deren Anmeldung zu einem Abend der Reihe als Marketing-Herkunft zählt (je Person einmal). */
  leads: number;
  /** Anteil „nachgefasst“ an „da“ — null ohne Gäste. */
  nachgefasstQuote: number | null;
}

const stattgefunden = (e: Event, heute: string) => e.status === 'durchgefuehrt' || e.datum < heute;

/**
 * Übersicht je Reihe: jede Reihe der Werteliste steht immer da (auch mit null Events — „Fokus Innovation“ soll sichtbar sein),
 * unbekannte Kennungen aus dem Bestand dahinter, zuletzt „ohne Reihe“, wenn es solche Abende gibt. Abgesagte Events zählen nicht.
 */
export function reihenUebersicht(events: readonly Event[], zahlen: Readonly<Record<string, Partial<EventZahlen> | undefined>>, teilnahmen: readonly Teilnahme[], heute: string): ReiheZeile[] {
  const eigene = events.filter(e => !istNetzwerkenEvent(e) && e.status !== 'abgesagt');
  const gruppen = new Map<string, Event[]>(EVENT_REIHEN.map(r => [r.id, []]));
  const unbekannt: string[] = [];
  for (const e of eigene) {
    const k = reiheSchluessel(e);
    if (!gruppen.has(k)) { gruppen.set(k, []); if (k !== OHNE_REIHE) unbekannt.push(k); }
    gruppen.get(k)!.push(e);
  }
  const reihenfolge = [...EVENT_REIHEN.map(r => r.id), ...unbekannt.sort(), ...(gruppen.get(OHNE_REIHE)?.length ? [OHNE_REIHE] : [])];
  const nachEvent = new Map(eigene.map(e => [e.id, e]));
  return reihenfolge.map(id => {
    const l = gruppen.get(id) ?? [];
    const ids = new Set(l.map(e => e.id));
    const summe = zahlenSumme(l.map(e => zahlen[e.id]));
    const leads = new Set(teilnahmen.filter(t => ids.has(t.eventId) && alsMarketingAnmeldung(t, nachEvent.get(t.eventId)!)).map(t => t.kontaktId)).size;
    const vorbei = l.filter(e => stattgefunden(e, heute)).length;
    return {
      id, name: id === OHNE_REIHE ? 'Ohne Reihe' : reiheName(id), events: l.length, kommend: l.length - vorbei, vorbei, summe, leads,
      nachgefasstQuote: summe.da ? summe.nachgefasst / summe.da : null,
    };
  });
}

/** Die Pillen des Filters: „Alle“ + jede Reihe, die im Bestand vorkommt, + „Ohne Reihe“ — leer, solange kein Event eine Reihe trägt. */
export function reihenFilter(events: readonly Event[]): { id: string; label: string; anzahl: number }[] {
  const eigene = events.filter(e => !istNetzwerkenEvent(e));
  const zaehl = new Map<string, number>();
  for (const e of eigene) { const k = reiheSchluessel(e); zaehl.set(k, (zaehl.get(k) ?? 0) + 1); }
  const mitReihe = Array.from(zaehl.keys()).filter(k => k !== OHNE_REIHE);
  if (!mitReihe.length) return [];
  const bekannt = EVENT_REIHEN.map(r => r.id).filter(id => zaehl.has(id));
  const rest = mitReihe.filter(k => !bekannt.includes(k)).sort();
  return [...bekannt, ...rest, ...(zaehl.has(OHNE_REIHE) ? [OHNE_REIHE] : [])].map(id => ({ id, label: id === OHNE_REIHE ? 'Ohne Reihe' : reiheName(id), anzahl: zaehl.get(id) ?? 0 }));
}
