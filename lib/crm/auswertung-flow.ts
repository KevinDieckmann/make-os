// ─── Markttraktion › Auswertung — der Weg zum Kunden als Flow (22.10., rein, client-sicher, getestet) ──────────────────────────────────────
// Kevin 22.10.: „Auswertung an die Markttraktion-Kennzahlen anlegen, dann haben wir auch einen geilen Flow.“ Der Trichter Kontakte → Leads →
// MQL/SQL → Deals → Angebote → Gewonnen steht als EINE Zeile (components/os/ui/reise `ReiseBild`, derselbe Baustein wie Kreislauf und Fulfillment),
// darunter läuft der Lichtfaden (Markenzeichen: der Flow). Gerechnet wird hier NICHTS neu — jede Zahl kommt aus ihrer einen Rechenstelle:
//   Kontakte   `bestand.kontakte` aus /api/crm/traktion (die Kartei, wie in der Grundlage des Traktions-Index)
//   Leads      `passtLeadFilter(z, 'aktiv')` (lib/crm/leads.ts) — dieselbe Zählregel wie die Pille „In Arbeit“ der Leads-Liste
//   MQL        `mqlErreicht` unter denselben Leads (MQL nur mit Marketing-Herkunft — die Regel steckt im Scoring, lib/crm/scoring.ts)
//   SQL        `passtLeadFilter(z, 'sql')` — die Pille „SQL · Deal“
//   Deals      Trichter-Stufe „Deals offen“ (`trichter`, nur Business) samt Wert
//   Angebote   offene (gestellte) Angebote (`istOffen`, lib/crm/angebote.ts), nur Business (`nurBusinessGezaehlt`)
//   Gewonnen   Trichter-Stufe „Gewonnen“ (Klick: Deals mit aufgeklappter Karte „Gewonnen · Verloren · Geparkt“); die Quoten Gespräch → SQL und SQL → gewonnen aus dem Trichter (EINE Stelle: lib/crm/quoten.ts)
// Ohne Daten (noch nicht geladen) bleibt eine Stufe grau mit „—“, eine echte Null sagt es in Worten („noch keine …“) — nie eine erfundene Zahl.
// Ein Klick auf eine Stufe bzw. eine Zahl führt in die Liste dahinter (`ziel`; mit `filter` öffnet die Leads-Liste genau die gezählte Pille).

import type { CrmBestand } from './typen';
import { markttraktion, type Bereich } from './adresse';
import type { LeadFilter, LeadZeile, Trichter } from './leads';
import { passtLeadFilter, mqlErreicht } from './leads';
import { istOffen } from './angebote';
import { nurBusinessGezaehlt } from './zaehlung-business';
import { KAESTCHEN_MAX, type BildKaestchen, type BildSpalte } from '@/lib/reise/bild';

export type FlowStufeId = 'kontakte' | 'leads' | 'quali' | 'deals' | 'angebote' | 'gewonnen';
/** Welche Welt eine Stufe trägt — die Oberfläche setzt die Farbe (Marketing, Sales, Kunde; die Kartei ist die Grundlage). */
export type FlowWelt = 'grundlage' | 'marketing' | 'sales' | 'kunde';
/**
 * Ziel eines Klicks: ein Ort der Markttraktion; `filter` = die Pille der Leads-Liste, nach der gezählt wurde; `zu` = in den Deals die Karte
 * „Gewonnen · Verloren · Geparkt“ aufgeklappt (Adresse `zu=1`).
 */
export interface FlowZiel { s: Bereich; a?: string; filter?: LeadFilter; zu?: true }
export interface FlowZahl {
  id: string;
  /** null = noch nicht geladen (grau, „—“). */
  anzahl: number | null;
  /** Das Wort hinter der Zahl („in Arbeit“, „offen“ …). */
  wort: string;
  /** Der Satz, wenn die Zahl 0 ist („noch kein SQL“) — nie „0 SQL“. */
  leer: string;
  ziel: FlowZiel;
}
export interface FlowStufe { id: FlowStufeId; label: string; welt: FlowWelt; zahlen: FlowZahl[]; /** Kurze Sätze (Wert, Quote) — nur aus echten Werten. */ saetze: string[]; ziel: FlowZiel }

export interface FlowEingabe {
  /** Anzahl der Kontakte in der Kartei (`bestand.kontakte` aus /api/crm/traktion) — null, solange nicht geladen. */
  kontakte: number | null;
  /** Die Lead-Zeilen aus /api/crm/lead — null, solange nicht geladen. */
  zeilen: readonly LeadZeile[] | null;
  /** Der Trichter aus /api/crm/lead (`trichter`) — null, solange nicht geladen. */
  trichter: Pick<Trichter, 'stufen' | 'gespraechZuSql' | 'sqlZuGewonnen'> | null;
  /** Der CRM-Bestand (für die offenen Angebote) — null, solange nicht geladen. */
  crm: (Pick<CrmBestand, 'chancen'> & { mandate?: CrmBestand['mandate']; angebote?: CrmBestand['angebote'] }) | null;
}

const zahlAus = (stufen: Trichter['stufen'] | undefined, id: string): number | null => stufen?.find(s => s.id === id)?.anzahl ?? null;
const euro = (n: number) => `${Math.round(n).toLocaleString('de-DE')} €`;
const prozent = (n: number) => `${Math.round(n).toLocaleString('de-DE')} %`;

/** Der Weg zum Kunden — sechs Stufen aus den vorhandenen Rechnungen (siehe Kopf). */
export function auswertungFlow(e: FlowEingabe): FlowStufe[] {
  const z = e.zeilen;
  const leads = z ? z.filter(x => passtLeadFilter(x, 'aktiv')) : null;
  const t = e.trichter;
  const deals = t?.stufen.find(s => s.id === 'deals');
  const angebote = e.crm ? (nurBusinessGezaehlt(e.crm).angebote ?? []).filter(istOffen).length : null;
  return [
    {
      id: 'kontakte', label: 'Kontakte', welt: 'grundlage', saetze: [], ziel: { s: 'kontakte' },
      zahlen: [{ id: 'kontakte', anzahl: e.kontakte, wort: 'in der Kartei', leer: 'Kartei noch leer', ziel: { s: 'kontakte' } }],
    },
    {
      id: 'leads', label: 'Leads', welt: 'marketing', saetze: [], ziel: { s: 'qualifizierung', a: 'leads', filter: 'aktiv' },
      zahlen: [{ id: 'leads', anzahl: leads ? leads.length : null, wort: 'in Arbeit', leer: 'keiner in Arbeit', ziel: { s: 'qualifizierung', a: 'leads', filter: 'aktiv' } }],
    },
    {
      id: 'quali', label: 'MQL · SQL', welt: 'sales', ziel: { s: 'qualifizierung' },
      zahlen: [
        { id: 'mql', anzahl: leads ? leads.filter(mqlErreicht).length : null, wort: 'MQL', leer: 'noch kein MQL', ziel: { s: 'qualifizierung', a: 'leads', filter: 'aktiv' } },
        { id: 'sql', anzahl: z ? z.filter(x => passtLeadFilter(x, 'sql')).length : null, wort: 'SQL', leer: 'noch kein SQL', ziel: { s: 'qualifizierung', a: 'leads', filter: 'sql' } },
      ],
      saetze: t?.gespraechZuSql != null ? [`Gespräch → SQL ${prozent(t.gespraechZuSql)}`] : [],
    },
    {
      id: 'deals', label: 'Deals', welt: 'sales', ziel: { s: 'deals' },
      zahlen: [{ id: 'deals', anzahl: deals ? deals.anzahl : null, wort: 'offen', leer: 'keiner offen', ziel: { s: 'deals' } }],
      saetze: deals?.wert ? [`Wert ${euro(deals.wert)}`] : [],
    },
    {
      id: 'angebote', label: 'Angebote', welt: 'sales', ziel: { s: 'angebot' },
      zahlen: [{ id: 'angebote', anzahl: angebote, wort: 'offen', leer: 'keins offen', ziel: { s: 'angebot' } }],
      saetze: [],
    },
    {
      id: 'gewonnen', label: 'Gewonnen', welt: 'kunde', ziel: { s: 'deals', zu: true },
      zahlen: [{ id: 'gewonnen', anzahl: zahlAus(t?.stufen, 'gewonnen'), wort: 'gewonnen', leer: 'noch keiner gewonnen', ziel: { s: 'deals', zu: true } }],
      saetze: t?.sqlZuGewonnen != null ? [`SQL → gewonnen ${prozent(t.sqlZuGewonnen)}`] : [],
    },
  ];
}

/** Text einer Zahl: „12 in Arbeit“, „noch kein SQL“, ohne Daten „— in Arbeit“. */
export function zahlText(x: Pick<FlowZahl, 'anzahl' | 'wort' | 'leer'>): string {
  if (x.anzahl === null) return `— ${x.wort}`;
  if (x.anzahl === 0) return x.leer;
  return `${x.anzahl.toLocaleString('de-DE')} ${x.wort}`;
}
/** Hat die Stufe echte Daten (mindestens eine Zahl über 0)? Ohne bleibt sie grau. */
export const stufeHatDaten = (s: Pick<FlowStufe, 'zahlen'>): boolean => s.zahlen.some(x => (x.anzahl ?? 0) > 0);

/**
 * Die Stufen als Reise-Zeile: mit Daten `laeuft` in der Farbe ihrer Welt, ohne grau (`offen`) — der Faden ist hell bis zur letzten Stufe mit
 * Daten, dahinter ruhig. Kästchen = die Zahlen, dann die Sätze (höchstens `KAESTCHEN_MAX`).
 */
export function auswertungSpalten(stufen: readonly FlowStufe[], farbe: (w: FlowWelt) => string): BildSpalte[] {
  return stufen.map((s, i): BildSpalte => {
    const alle: BildKaestchen[] = [
      ...s.zahlen.map((x): BildKaestchen => ({ id: x.id, titel: zahlText(x), zustand: 'offen' })),
      ...s.saetze.map((t, j): BildKaestchen => ({ id: `${s.id}-satz-${j}`, titel: t, zustand: 'offen' })),
    ];
    const zeigen = alle.slice(0, KAESTCHEN_MAX);
    const an = stufeHatDaten(s);
    return { id: s.id, nr: i + 1, titel: s.label, zustand: an ? 'laeuft' : 'offen', ...(an ? { farbe: farbe(s.welt) } : {}), kaestchen: zeigen, mehr: alle.length - zeigen.length };
  });
}

/** Wohin ein Klick führt: das Kästchen einer Zahl in seine Liste, sonst (Stufe, Satz) die Liste der Stufe. */
export function flowZiel(stufen: readonly FlowStufe[], stufeId: string, kaestchenId?: string): FlowZiel | null {
  const s = stufen.find(x => x.id === stufeId);
  if (!s) return null;
  return (kaestchenId && s.zahlen.find(x => x.id === kaestchenId)?.ziel) || s.ziel;
}

/** Die Adresse eines Ziels (der Filter der Leads-Liste geht nicht in die Adresse — die Seite setzt ihn beim Sprung, `leadsFilterSetzen`). */
export const flowLink = (z: FlowZiel): string => `${markttraktion(z.s, z.a)}${z.zu ? `${z.s === 'ueberblick' ? '?' : '&'}zu=1` : ''}`;
