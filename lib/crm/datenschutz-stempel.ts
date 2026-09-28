// ─── Datenschutz-Felder stempelt der Server (28.09., U2, rein, getestet) ─────
// Jeder Schreibweg der Kartei (PATCH /api/state/kontakte: upsert, teil, neu) läuft
// hier durch, bevor gespeichert wird. Was der Browser für diese Felder schickt,
// zählt nur als ABSICHT — Person und Zeit kommen vom Server:
//
//   einwilligungen          lib/crm/einwilligung.ts `einwilligungenStempeln` (Nachweis, unveränderlich, wächst nur)
//   eingeschraenkt          immer der gespeicherte Wert (Setzen/Aufheben nur POST /api/crm/datenschutz)
//   loeschfristVerlaengert  immer der gespeicherte Wert (nur POST /api/crm/datenschutz)
//   geprueftAm/Von          „Stammdaten geprüft“: geändert → heute + Person; sonst der gespeicherte Wert
//   hinweisBeiErhebung      neu/anderer Tag → Tag (höchstens heute) + Person; unverändert → gespeichert (mit Person)
//
// `pruefeDatenschutz` sagt vorher (in der Schreibsperre), ob eine Änderung abgelehnt wird:
// neue Einwilligung ohne Wortlaut/Beleg, Bearbeiten einer eingeschränkten Person (Art. 18).

import type { Kontakt, Einwilligung } from '@/lib/make-one/crm';
import { einwilligungSaeubern, einwilligungenStempeln } from './einwilligung';
import { EINGESCHRAENKT_FEHLER, teilBeiEinschraenkungErlaubt, eintragBeiEinschraenkungErlaubt } from './einschraenkung';

const PERSON = /^[a-z0-9-]{1,40}$/;

export function datenschutzStempeln(neu: Kontakt, alt: Kontakt | undefined, person: string, jetztIso: string, heute: string): Kontakt {
  const wer = PERSON.test(person) ? person : 'system';
  const { eingeschraenkt: _e, loeschfristVerlaengert: _l, geprueftAm: _ga, geprueftVon: _gv, hinweisBeiErhebung: hinweis, einwilligungen: _ew, ...rest } = neu;
  const out: Kontakt = { ...rest } as Kontakt;
  if (alt?.eingeschraenkt) out.eingeschraenkt = alt.eingeschraenkt;
  if (alt?.loeschfristVerlaengert) out.loeschfristVerlaengert = alt.loeschfristVerlaengert;

  const ew = einwilligungenStempeln(alt?.einwilligungen, neu.einwilligungen, wer, jetztIso, heute).liste;
  if (ew.length) out.einwilligungen = ew;

  if (neu.geprueftAm && neu.geprueftAm !== alt?.geprueftAm) { out.geprueftAm = heute; out.geprueftVon = wer; }
  else if (alt?.geprueftAm) { out.geprueftAm = alt.geprueftAm; if (alt.geprueftVon) out.geprueftVon = alt.geprueftVon; }

  if (hinweis?.am) {
    if (alt?.hinweisBeiErhebung && alt.hinweisBeiErhebung.am === hinweis.am) out.hinweisBeiErhebung = alt.hinweisBeiErhebung;
    else out.hinweisBeiErhebung = { am: hinweis.am > heute ? heute : hinweis.am, von: wer };
  }
  return out;
}

/** Die neuen Einwilligungen eines Browser-Werts (roh) — gesäubert. */
const ewAus = (v: unknown): Einwilligung[] | undefined => (Array.isArray(v) ? v.map(einwilligungSaeubern).filter((e): e is Einwilligung => !!e) : undefined);

/**
 * Vorab-Prüfung einer Kartei-Änderung (in der Sperre): liefert den Ablehnungsgrund oder null.
 *  · `teil`/`upsert` an einer eingeschränkten Person: nur Werbewiderspruch bzw. unveränderter Eintrag
 *  · neue Einwilligung (Grundlage „einwilligung“) ohne Wortlaut oder Beleg
 */
export function pruefeDatenschutz(alt: Kontakt | undefined, op: { art: 'teil'; felder: Record<string, unknown> } | { art: 'upsert'; eintrag: Kontakt }, heute: string): string | null {
  if (alt?.eingeschraenkt) {
    if (op.art === 'teil' && !teilBeiEinschraenkungErlaubt(op.felder)) return EINGESCHRAENKT_FEHLER;
    if (op.art === 'upsert' && !eintragBeiEinschraenkungErlaubt(alt, op.eintrag)) return EINGESCHRAENKT_FEHLER;
  }
  const neu = op.art === 'teil' ? ('einwilligungen' in op.felder ? ewAus(op.felder.einwilligungen) : undefined) : op.eintrag.einwilligungen;
  if (neu) {
    const r = einwilligungenStempeln(alt?.einwilligungen, neu, 'system', `${heute}T00:00:00Z`, heute);
    if (r.fehler) return r.fehler;
  }
  return null;
}
