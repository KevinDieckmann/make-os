// ─── CRM — Events (rein, getestet) ──────────────────────────────────────────
// In KEMARIS Operations war /events nur ein Klickdummy; übernommen sind die
// Konzepte: Gästekette eingeladen → zugesagt → da → Folgegespräch → Chance,
// Zusage und Erscheinen als getrennte Achsen, absolute Zahlen statt Quoten
// bei kleinen Events, „verursacht vs. beeinflusst“ (180 Tage) — und:
// Teilnahme ist keine Einwilligung.

import type { Kontakt } from '@/lib/make-one/crm';
import type { Event, Teilnahme, Chance } from './typen';
import { gesamtwert } from './pipeline';
import { budgetSumme } from './eventplanung';

const plusTage = (datum: string, n: number) => { const d = new Date(`${datum}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// Marke (27.09.): Konstante und Ableitung liegen in ./marke — hier nur durchgereicht.
export { MARKE_EVENTS, markeVon, eventName } from './marke';

/** Nachfassen innerhalb von 48 Stunden nach dem Event. */
export const followUpBis = (e: Pick<Event, 'datum'>) => plusTage(e.datum, 2);

/**
 * Stunden bis zum Ende der Nachfass-Frist (Ende des Tages followUpBis, lokale
 * Zeit) — negativ, wenn sie abgelaufen ist. Dieselbe Frist wie in der
 * Tagesliste (lib/crm/heute.ts), nur in Stunden für die Nachfass-Ansicht.
 */
export function nachfassenRest(e: Pick<Event, 'datum'>, jetztMs: number): number {
  const ende = new Date(`${followUpBis(e)}T23:59:59`).getTime();
  return Math.floor((ende - jetztMs) / 3_600_000);
}

export interface EventZahlen {
  eingeladen: number; zugesagt: number; da: number; noShow: number;
  erscheinquote: number | null;
  nachgefasst: number; nachfassenOffen: number;
  folgegespraeche: number;
  beeinflusst: number; verursacht: number;
  /** Wie viele Deals aus dem Event entstanden sind (Quelle „event“ mit diesem Event als Bezug) — ihr Wert steht in `verursacht`. */
  dealsVerursacht: number;
  /** Budget-Summe, sonst die Pauschale (lib/crm/eventplanung.ts budgetSumme). */
  kosten: number;
  kostenJeFolgegespraech: number | null;
  /** Rückmeldungen der Gäste (Teilnahme.feedback, 27.09.): wie viele, und die Note im Schnitt. */
  rueckmeldungen: number;
  /** Ø Note 1–5 auf eine Stelle gerundet — null ohne Noten. */
  noteSchnitt: number | null;
}

export interface FeedbackZahlen { rueckmeldungen: number; noteSchnitt: number | null }

/**
 * Rückmeldungen je Event: eine Rückmeldung zählt, sobald Note ODER Satz da
 * ist; der Schnitt nur über die Noten (1–5, eine Nachkommastelle).
 */
export function feedbackZahlen(teilnahmen: Teilnahme[], eventId: string): FeedbackZahlen {
  const mit = teilnahmen.filter(t => t.eventId === eventId && t.feedback && (typeof t.feedback.note === 'number' || !!t.feedback.text?.trim()));
  const noten = mit.map(t => t.feedback?.note).filter((n): n is number => typeof n === 'number' && n >= 1 && n <= 5);
  return { rueckmeldungen: mit.length, noteSchnitt: noten.length ? Math.round((noten.reduce((a, n) => a + n, 0) / noten.length) * 10) / 10 : null };
}

export function eventZahlen(e: Event, teilnahmen: Teilnahme[], kontakte: Kontakt[], chancen: Chance[]): EventZahlen {
  const t = teilnahmen.filter(x => x.eventId === e.id);
  const zaehl = (...s: Teilnahme['status'][]) => t.filter(x => s.includes(x.status)).length;
  const da = t.filter(x => x.status === 'da');
  const bis30 = plusTage(e.datum, 30), bis180 = plusTage(e.datum, 180);
  const idsDa = new Set(da.map(x => x.kontaktId));
  const folge = kontakte.filter(k => idsDa.has(k.id) && (k.aktivitaeten ?? []).some(a => ['gespraech', 'termin', 'antwort', 'anruf'].includes(a.art) && a.am.slice(0, 10) > e.datum && a.am.slice(0, 10) <= bis30)).length;
  const beeinflusst = chancen.filter(c => c.kontaktIds.some(id => idsDa.has(id)) && c.angelegt.slice(0, 10) <= bis180 && (c.letzteAktivitaet ?? c.angelegt).slice(0, 10) >= e.datum);
  const verursacht = chancen.filter(c => c.quelle === 'event' && c.quelleBezug === e.id);
  const zugesagt = zaehl('zugesagt', 'da', 'no_show');
  const kosten = budgetSumme(e);
  return {
    eingeladen: zaehl('eingeladen', 'zugesagt', 'abgesagt', 'da', 'no_show'), zugesagt, da: da.length, noShow: zaehl('no_show'),
    erscheinquote: zugesagt >= 5 ? Math.round((da.length / zugesagt) * 100) : null,
    nachgefasst: da.filter(x => x.followUpAm).length, nachfassenOffen: da.filter(x => !x.followUpAm).length,
    folgegespraeche: folge,
    beeinflusst: Math.round(beeinflusst.reduce((a, c) => a + gesamtwert(c), 0)),
    verursacht: Math.round(verursacht.reduce((a, c) => a + gesamtwert(c), 0)),
    dealsVerursacht: verursacht.length,
    kosten,
    kostenJeFolgegespraech: kosten && folge ? Math.round(kosten / folge) : null,
    ...feedbackZahlen(t, e.id),
  };
}
