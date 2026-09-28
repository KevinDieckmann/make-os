// ─── „ZOE fragen“ aus der Markttraktion — der Bezug (28.09., Paket C7, rein, auch im Browser) ───
// Der Knopf „ZOE fragen“ (Kontakt öffnen, Firmenakte, Deal-Akte, Angebot, Reiter-Köpfe) öffnet ZOE mit Art +
// Kennung. Der Bezug ist KEIN Text Dritter — nur eine geprüfte Kennung —, er macht das Gespräch nicht „fremd gelesen“.
// Dieselbe Form trägt ein CRM-Vorschlag im Stapel (`bezug: { art: 'crm', id: '<art>:<kennung>' }`).

/** Ereignis, mit dem ein Knopf ZOE mit Bezug öffnet (components/os/ZoePanel.tsx hört darauf). */
export const ZOE_FRAGEN_EREIGNIS = 'make-zoe-fragen';

export type CrmBezugArt = 'kontakt' | 'firma' | 'deal' | 'angebot' | 'mandat' | 'event' | 'markttraktion' | 'sales' | 'marketing' | 'event-welt' | 'qualifizierung' | 'stammdaten';
export interface CrmBezug { art: CrmBezugArt; id?: string }
export const CRM_BEZUG_ARTEN: readonly CrmBezugArt[] = ['kontakt', 'firma', 'deal', 'angebot', 'mandat', 'event', 'markttraktion', 'sales', 'marketing', 'event-welt', 'qualifizierung', 'stammdaten'];
/** Arten, die eine Kennung brauchen (ein Datensatz) — die anderen sind Reiter. */
const MIT_KENNUNG: ReadonlySet<CrmBezugArt> = new Set(['kontakt', 'firma', 'deal', 'angebot', 'mandat', 'event']);
const KENNUNG = /^[a-z0-9][a-z0-9-]{1,63}$/;

export const CRM_BEZUG_LABEL: Record<CrmBezugArt, string> = {
  kontakt: 'Kontakt', firma: 'Firma', deal: 'Deal', angebot: 'Angebot', mandat: 'Mandat', event: 'Event', markttraktion: 'Markttraktion',
  sales: 'Sales', marketing: 'Marketing', 'event-welt': 'Make.One', qualifizierung: 'Qualifizierung', stammdaten: 'Stammdaten',
};

/** Den Bezug aus dem Browser prüfen — unbekannte Art oder Kennung fallen weg (null). */
export function crmBezugAus(v: unknown): CrmBezug | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const art = CRM_BEZUG_ARTEN.find(a => a === o.art);
  if (!art) return null;
  const id = typeof o.id === 'string' && KENNUNG.test(o.id) ? o.id : undefined;
  if (MIT_KENNUNG.has(art) && !id) return null;
  return { art, ...(id && MIT_KENNUNG.has(art) ? { id } : {}) };
}

/** Gehört ein offener CRM-Vorschlag (Stapel-Art „crm“) zu diesem Datensatz? Firma: auch Vorschläge an ihren Personen/Deals. */
export function passtZuBezug(v: { bezug?: { art: string; id: string }; eingabe?: Record<string, unknown>; werkzeug?: string }, art: string, id: string): boolean {
  if (v.bezug?.art !== 'crm') return false;
  if (v.bezug.id === `${art}:${id}`) return true;
  return art === 'firma' && v.eingabe?.firmaId === id;
}

/**
 * „ZOE fragen“ im Kopf der Markttraktion (rein): aus Reiter (`s`), Ansicht (`a`) und Auswahl (`k`) der Bezug —
 * offener Kontakt/Deal/Angebot/Firma zuerst, sonst der Reiter (Überblick, Sales, Marketing, Make.One, Qualifizierung, Stammdaten).
 */
export function zoeBezugFuer(bereich: string, ansicht: string | null | undefined, k: string | null | undefined): CrmBezug {
  const mit = (art: CrmBezugArt) => crmBezugAus({ art, id: k }) ?? { art: 'markttraktion' as const };
  if (bereich === 'kontakte' && ansicht === 'akte' && k) return mit('kontakt');
  if (bereich === 'kontakte' && k?.startsWith('c-')) return mit('kontakt');
  if ((bereich === 'firmen' || bereich === 'kontakte') && k?.startsWith('f-')) return mit('firma');
  if (bereich === 'deals' && ansicht === 'akte' && k) return mit('deal');
  if (bereich === 'angebot' && k) return mit('angebot');
  switch (bereich) {
    case 'deals': case 'followup': case 'sales': return { art: 'sales' };
    case 'marketing': return { art: 'marketing' };
    case 'event': return { art: 'event-welt' };
    case 'qualifizierung': return { art: 'qualifizierung' };
    case 'stammdaten': return { art: 'stammdaten' };
    default: return { art: 'markttraktion' };
  }
}
