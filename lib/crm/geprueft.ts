// ─── „Zuletzt geprüft“ je Kontakt (28.09., U2 #34, rein, getestet) ────────────
// Art. 5 Abs. 1 lit. d DSGVO (Richtigkeit): Stammdaten aktiver Beziehungen und Leads
// sollen regelmäßig angesehen werden. `Kontakt.geprueftAm`/`geprueftVon` setzt der
// Knopf „Stammdaten geprüft“ (Kontakt › Stammdaten › Datenschutz; der Server stempelt
// Tag und Person). Befund unter Stammdaten › Datenqualität: „n Kontakte seit über
// 12 Monaten nicht geprüft“ — ohne Prüfung zählt der Import-Tag.

import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand } from './typen';
import { ausgenommen } from './einschraenkung';
import { monateZurueck } from './loeschfristen';

export const PRUEFEN_MONATE = 12;

const IM_KONTAKT = ['angesprochen', 'gespraech', 'termin', 'angebot', 'gewonnen'];
const BEZIEHUNG = ['kunde', 'partner', 'multiplikator', 'interessent'];

/** Aktive Beziehung oder Lead: Kreis, Beziehungs-Lebensphase, laufende Ansprache, offener Lead, Mandat oder offener Deal. */
export function aktiveBeziehung(k: Kontakt, crm?: Pick<CrmBestand, 'mandate' | 'chancen'> | null): boolean {
  if (ausgenommen(k) || k.stufe === 'verloren' || k.stufe === 'ruht') return false;
  if (k.kreis || BEZIEHUNG.includes(k.lebensphase ?? '') || IM_KONTAKT.includes(k.stufe)) return true;
  if (k.lead?.status && k.lead.status !== 'kein_fit' && k.lead.status !== 'ruht') return true;
  return !!crm && (crm.mandate.some(m => m.status !== 'beendet' && (m.kontaktIds ?? []).includes(k.id)) || crm.chancen.some(c => c.stufe !== 'gewonnen' && c.stufe !== 'verloren' && (c.kontaktIds ?? []).includes(k.id)));
}

/** Aktive Kontakte, deren letzte Prüfung (sonst der Import) länger als `monate` her ist — älteste zuerst. */
export function nichtGeprueft(kontakte: Kontakt[], crm: Pick<CrmBestand, 'mandate' | 'chancen'> | null | undefined, heute: string, monate = PRUEFEN_MONATE): { id: string; seit: string; nie: boolean }[] {
  const grenze = monateZurueck(heute, monate);
  return kontakte
    .filter(k => aktiveBeziehung(k, crm))
    .map(k => ({ id: k.id, seit: (k.geprueftAm ?? k.importiertAm ?? '').slice(0, 10), nie: !k.geprueftAm }))
    .filter(x => !!x.seit && x.seit < grenze)
    .sort((a, b) => a.seit.localeCompare(b.seit));
}
