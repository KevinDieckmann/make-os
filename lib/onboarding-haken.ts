// ─── MAKE OS — Onboarding: Häkchen je Person und gemeinsam (Server, 08.10. spät, Paket B0/B2; Nachbesserung 08.10. spät) ────────────
// Persönliche Schritte (Ebene „ich“) → Bestand `onboarding--<speicher>` (IMMER mit Suffix, auch beim Erstkonto — der gemeinsame
// Bestand heißt schon `onboarding`, `speicherFuer` wäre hier falsch); lesen und schreiben nur die Person selbst. Gemeinsame und
// Instanz-Schritte → Bestand `onboarding` (alle im Haushalt sehen den Stand). `von` ist der Speichername der Sitzung, nie ein Vorname.
//
// Alte Häkchen (frühere Spuren `<speicher>-…`, `updates`) stehen im gemeinsamen Bestand und bleiben dort UNANGETASTET liegen. Sie zählen
// nie als getan (Gegenprüfung: die neuen Schritte bedeuten mehr) — wo erlaubt (`frueherErlaubt`: ohne Prüfung, ohne Stichtagsbezug)
// erscheinen sie als „früher abgehakt — bitte bestätigen“; persönliche nur für die Person mit genau diesem Speichernamen.
// Lesen schreibt nie. Wächter: tests/onboarding-stand.test.ts.
//
// B10 (Update 2, 16.10.): im persönlichen Bestand steht zusätzlich `gruen` — Kennung eines Schritts mit Prüfung → Tag, an dem er zum ersten
// Mal fertig war. Geschrieben NUR vom Morgenlauf (`gruenFesthalten`, lib/onboarding-status.ts `einrichtungFesthalten`), nie beim Lesen; gelesen nur
// von der Person selbst. Nur Kennungen und Tage — nie ein Wert.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { ALT_ZU_NEU, altePerson, frueherErlaubt, istPersoenlich, schrittMitId } from '@/lib/make-one/onboarding-data';

export interface Haken { at: string; von: string }
export interface HakenDatei { erledigt: Record<string, Haken>; gruen?: Record<string, string> }
export interface HakenSicht { erledigt: Record<string, Haken>; frueher: string[]; gruen: Record<string, string> }

const PERSON = /^[a-z0-9-]{1,40}$/;
/** Der gemeinsame Bestand (Haushalt + Instanz). */
export const GEMEINSAM = 'onboarding';
/** Der persönliche Bestand einer Person — immer `onboarding--<speicher>`. */
export const persoenlichName = (person: string) => `onboarding--${person}`;

const istHaken = (h: unknown): h is Haken => !!h && typeof h === 'object' && typeof (h as Haken).at === 'string' && (h as Haken).at.length <= 40;
const liste = (d: HakenDatei | null | undefined): [string, Haken][] =>
  Object.entries(d?.erledigt && typeof d.erledigt === 'object' ? d.erledigt : {}).filter((e): e is [string, Haken] => istHaken(e[1]));

/**
 * Die Sicht einer Person (rein): gemeinsame Häkchen + ihre eigenen; alte Häkchen nur als `frueher` (Kennungen der neuen Schritte, bei
 * denen „bitte bestätigen“ erscheinen darf) — persönliche nur für genau diese Person. Häkchen persönlicher Schritte im gemeinsamen
 * Bestand gibt es nie.
 */
export function hakenSicht(gemeinsam: HakenDatei | null | undefined, eigen: HakenDatei | null | undefined, person: string | null): HakenSicht {
  const erledigt: Record<string, Haken> = {};
  const frueher = new Set<string>();
  for (const [id, h] of liste(gemeinsam)) {
    const s = schrittMitId(id);
    if (s) { if (!istPersoenlich(s)) erledigt[id] = { at: h.at, von: String(h.von ?? '') }; continue; }
    const neu = ALT_ZU_NEU[id]; const z = neu ? schrittMitId(neu) : null;
    if (!neu || !z || !frueherErlaubt(z)) continue;
    if (istPersoenlich(z) && (!person || altePerson(id) !== person)) continue;
    frueher.add(neu);
  }
  if (person) for (const [id, h] of liste(eigen)) { const s = schrittMitId(id); if (s && istPersoenlich(s)) erledigt[id] = { at: h.at, von: person }; }
  return { erledigt, frueher: [...frueher].filter(id => !erledigt[id]).sort(), gruen: person ? gruenAus(eigen) : {} };
}

const TAG = /^\d{4}-\d{2}-\d{2}$/;
/** Die gemerkten grünen Schritte (nur bekannte Schritte mit Prüfung, nur gültige Tage). */
function gruenAus(d: HakenDatei | null | undefined): Record<string, string> {
  const roh = d?.gruen && typeof d.gruen === 'object' ? d.gruen : {};
  return Object.fromEntries(Object.entries(roh).filter(([id, tag]) => typeof tag === 'string' && TAG.test(tag) && !!schrittMitId(id)?.pruefung));
}

/** Häkchen lesen — Lesen schreibt nie. */
export async function hakenLesen(person: string | null): Promise<HakenSicht> {
  const p = person && PERSON.test(person) ? person : null;
  const [g, e] = await Promise.all([loadJson<HakenDatei>(GEMEINSAM), p ? loadJson<HakenDatei>(persoenlichName(p)) : Promise.resolve(null)]);
  return hakenSicht(g, e, p);
}

/**
 * Ein Häkchen setzen oder entfernen — die Route hat Person, Kennung und Recht schon geprüft. Persönliche in den eigenen Bestand,
 * gemeinsame in den gemeinsamen (mit Speichername). Alte Häkchen bleiben, wie sie sind.
 */
export async function hakenSetzen(person: string, id: string, an: boolean, jetzt = new Date()): Promise<HakenSicht> {
  if (!PERSON.test(person)) throw new Error('Person ungültig.');
  const s = schrittMitId(id);
  if (!s) throw new Error('Schritt unbekannt.');
  const at = jetzt.toISOString();
  const name = istPersoenlich(s) ? persoenlichName(person) : GEMEINSAM;
  await updateJson<HakenDatei>(name, cur => {
    const erledigt: Record<string, Haken> = Object.fromEntries(liste(cur));
    // Alte Häkchen und Fremdes im gemeinsamen Bestand bleiben stehen (nur gültige Einträge werden hier neu geschrieben — alles
    // andere bleibt über `...cur` erhalten).
    const roh = (cur?.erledigt && typeof cur.erledigt === 'object' ? cur.erledigt : {}) as Record<string, unknown>;
    const neu: Record<string, unknown> = { ...roh, ...erledigt };
    if (an) neu[id] = { at, von: person }; else delete neu[id];
    return { ...(cur ?? {}), erledigt: neu as Record<string, Haken> };
  });
  return hakenLesen(person);
}

/**
 * B10: die Schritte mit Prüfung, die für diese Person gerade fertig sind, als „grün am <tag>“ festhalten — im persönlichen Bestand (nur
 * Kennungen und Tage). Nur hinzufügen, nie entfernen und nie umschreiben („war schon einmal grün“) — nichts Neues → kein Schreiben.
 * Aufrufer: der Morgenlauf (nie ein GET). Liefert die Zahl neu gemerkter Schritte.
 */
export async function gruenFesthalten(person: string, ids: readonly string[], tag: string): Promise<number> {
  if (!PERSON.test(person) || !TAG.test(tag)) throw new Error('Person oder Tag ungültig.');
  const gueltig = ids.filter(id => !!schrittMitId(id)?.pruefung);
  if (!gueltig.length) return 0;
  const alt = gruenAus(await loadJson<HakenDatei>(persoenlichName(person)));
  const neu = gueltig.filter(id => !alt[id]);
  if (!neu.length) return 0;
  await updateJson<HakenDatei>(persoenlichName(person), cur => {
    const g = { ...gruenAus(cur) };
    for (const id of gueltig) g[id] ??= tag;
    return { ...(cur ?? {}), erledigt: (cur?.erledigt && typeof cur.erledigt === 'object' ? cur.erledigt : {}) as Record<string, Haken>, gruen: g };
  });
  return neu.length;
}
