// ─── Lichtfäden v2 — Parameter der Route prüfen (rein, getestet) ────────────
// GET /api/lichtfaeden?wurzel=…&person=…&von=…&bis=…
//   wurzel  gesamt | space:<privat|business> | thema:<space>:<thema> | ziel:<id> | ms:<id>   (Standard: gesamt)
//   person  ich | alle | <Speichername einer Person des Haushalts>                       (Standard: alle)
//   von/bis YYYY-MM-DD, bis ≥ von, höchstens MAX_SPANNE_TAGE                              (Standard: dieses + nächstes Jahr)

import { GESAMT } from './modell';

export const MAX_SPANNE_TAGE = 1100;
const WURZEL = /^(gesamt|space:(privat|business)|thema:(privat|business):[a-z]{3,20}|ziel:[A-Za-z0-9_.~:-]{1,100}|ms:[A-Za-z0-9_.~:-]{1,100})$/;
const PERSON = /^[a-z0-9-]{1,40}$/;
const TAG = /^\d{4}-\d{2}-\d{2}$/;

export interface LichtAnfrage { wurzel: string; person: string; von: string; bis: string }
export type AnfrageErgebnis = { ok: true; anfrage: LichtAnfrage } | { ok: false; fehler: string };

const gueltigerTag = (t: string) => TAG.test(t) && new Date(`${t}T00:00:00Z`).toISOString().slice(0, 10) === t;

export function anfrageAus(q: URLSearchParams, heute: string): AnfrageErgebnis {
  const wurzel = q.get('wurzel') || GESAMT;
  if (!WURZEL.test(wurzel)) return { ok: false, fehler: 'Unbekannte Ebene.' };
  const person = q.get('person') || 'alle';
  if (!PERSON.test(person)) return { ok: false, fehler: 'Unbekannte Person.' };
  const jahr = Number(heute.slice(0, 4));
  const von = q.get('von') || `${jahr}-01-01`, bis = q.get('bis') || `${jahr + 1}-12-31`;
  if (!gueltigerTag(von) || !gueltigerTag(bis) || bis < von) return { ok: false, fehler: 'Zeitraum ungültig.' };
  if ((Date.parse(`${bis}T00:00:00Z`) - Date.parse(`${von}T00:00:00Z`)) / 864e5 > MAX_SPANNE_TAGE) return { ok: false, fehler: 'Zeitraum zu lang.' };
  return { ok: true, anfrage: { wurzel, person, von, bis } };
}
