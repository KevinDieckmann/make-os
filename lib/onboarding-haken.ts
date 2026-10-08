// ─── MAKE OS — Onboarding: Häkchen je Person und gemeinsam (Server, 08.10. spät, Paket B0/B2) ──────────────────────────────
// Bis 08.10. galten alle Häkchen für den ganzen Haushalt (ein Bestand `onboarding`), die Route speicherte Vornamen und kürzte die
// Kennung still. Jetzt (ONBOARDING_PLAN.md A1/B2):
//   · persönliche Schritte (Ebene „ich“)  → Bestand `onboarding--<speicher>` (IMMER mit Suffix, auch beim Erstkonto — der
//     gemeinsame Bestand heißt schon `onboarding`, `speicherFuer` wäre hier falsch); lesen und schreiben nur die Person selbst.
//   · gemeinsame und Instanz-Schritte     → Bestand `onboarding` (alle im Haushalt sehen den Stand).
//   · `von` ist der Speichername der Sitzung, nie ein Vorname; die Anzeige löst ihn über die Konten auf.
// Altbestand: Häkchen der alten Spuren `kevin-…`/`malin-…` und `updates` standen im gemeinsamen Bestand. Beim Lesen gelten sie weiter
// (persönliche NUR für die Person mit genau diesem Speichernamen — nie für eine andere), übernommen werden sie beim nächsten Schreiben
// derselben Person; Lesen schreibt nie. Unbekannte Alt-Kennungen bleiben unangetastet liegen (nichts geht verloren).
// Wächter: tests/onboarding-stand.test.ts.

import { loadJson, updateJson, updateJsonAsync } from '@/lib/store/local-db';
import { ALT_ZU_NEU, altePerson, istPersoenlich, schrittMitId } from '@/lib/make-one/onboarding-data';

export interface Haken { at: string; von: string }
export interface HakenDatei { erledigt: Record<string, Haken> }

const PERSON = /^[a-z0-9-]{1,40}$/;
/** Der gemeinsame Bestand (Haushalt + Instanz). */
export const GEMEINSAM = 'onboarding';
/** Der persönliche Bestand einer Person — immer `onboarding--<speicher>`. */
export const persoenlichName = (person: string) => `onboarding--${person}`;

const istHaken = (h: unknown): h is Haken => !!h && typeof h === 'object' && typeof (h as Haken).at === 'string' && (h as Haken).at.length <= 40;
const liste = (d: HakenDatei | null | undefined): [string, Haken][] =>
  Object.entries(d?.erledigt && typeof d.erledigt === 'object' ? d.erledigt : {}).filter((e): e is [string, Haken] => istHaken(e[1]));

/**
 * Die Sicht einer Person (rein): gemeinsame Häkchen (auch übersetzte Alt-Häkchen) + ihre eigenen. Persönliche Alt-Häkchen
 * (`<speicher>-…`) zählen nur für genau diese Person. Häkchen persönlicher Schritte im gemeinsamen Bestand gibt es nie.
 */
export function hakenSicht(gemeinsam: HakenDatei | null | undefined, eigen: HakenDatei | null | undefined, person: string | null): Record<string, Haken> {
  const aus: Record<string, Haken> = {};
  const alt: [string, Haken][] = [];
  for (const [id, h] of liste(gemeinsam)) {
    const s = schrittMitId(id);
    if (s) { if (!istPersoenlich(s)) aus[id] = { at: h.at, von: String(h.von ?? '') }; continue; }
    alt.push([id, h]);
  }
  // Alt-Häkchen: nur ergänzen, nie ein neues Häkchen überschreiben.
  for (const [altId, h] of alt) {
    const neu = ALT_ZU_NEU[altId]; const s = neu ? schrittMitId(neu) : null;
    if (!neu || !s) continue;
    if (istPersoenlich(s)) {
      if (person && altePerson(altId) === person && !aus[neu]) aus[neu] = { at: h.at, von: person };
    } else if (!aus[neu]) aus[neu] = { at: h.at, von: altePerson(altId) ?? String(h.von ?? '') };
  }
  if (person) for (const [id, h] of liste(eigen)) { const s = schrittMitId(id); if (s && istPersoenlich(s)) aus[id] = { at: h.at, von: person }; }
  return aus;
}

/**
 * Übernahme beim Schreiben (rein): aus dem gemeinsamen Bestand wandern die persönlichen Alt-Häkchen DIESER Person in ihren eigenen
 * Bestand; Alt-Häkchen gemeinsamer Schritte bekommen ihre neue Kennung. Persönliche Alt-Häkchen anderer Personen bleiben liegen.
 */
export function altUebernehmen(gemeinsam: HakenDatei | null | undefined, person: string): { gemeinsam: HakenDatei; eigen: Record<string, Haken> } {
  const neu: Record<string, Haken> = Object.fromEntries(liste(gemeinsam));
  const eigen: Record<string, Haken> = {};
  for (const [altId, h] of Object.entries(neu)) {
    if (schrittMitId(altId)) continue;
    const ziel = ALT_ZU_NEU[altId]; const s = ziel ? schrittMitId(ziel) : null;
    if (!ziel || !s) continue;
    const wer = altePerson(altId);
    if (istPersoenlich(s)) {
      if (wer !== person) continue;
      eigen[ziel] = eigen[ziel] ?? { at: h.at, von: person };
      delete neu[altId];
    } else {
      if (!neu[ziel]) neu[ziel] = { at: h.at, von: wer ?? String(h.von ?? '') };
      delete neu[altId];
    }
  }
  return { gemeinsam: { erledigt: neu }, eigen };
}

/** Häkchen lesen — Lesen schreibt nie. */
export async function hakenLesen(person: string | null): Promise<Record<string, Haken>> {
  const p = person && PERSON.test(person) ? person : null;
  const [g, e] = await Promise.all([loadJson<HakenDatei>(GEMEINSAM), p ? loadJson<HakenDatei>(persoenlichName(p)) : Promise.resolve(null)]);
  return hakenSicht(g, e, p);
}

/**
 * Ein Häkchen setzen oder entfernen — die Route hat Person, Kennung und Recht schon geprüft. Beide Bestände in EINER Sperre
 * (außen der gemeinsame, innen der persönliche); dabei werden die Alt-Häkchen dieser Person übernommen.
 */
export async function hakenSetzen(person: string, id: string, an: boolean, jetzt = new Date()): Promise<Record<string, Haken>> {
  if (!PERSON.test(person)) throw new Error('Person ungültig.');
  const s = schrittMitId(id);
  if (!s) throw new Error('Schritt unbekannt.');
  const at = jetzt.toISOString();
  let eigenNachher: HakenDatei | null = null;
  const gemeinsamNachher = await updateJsonAsync<HakenDatei>(GEMEINSAM, async cur => {
    const { gemeinsam, eigen } = altUebernehmen(cur, person);
    if (istPersoenlich(s) || Object.keys(eigen).length) {
      eigenNachher = await updateJson<HakenDatei>(persoenlichName(person), alt => {
        const erledigt: Record<string, Haken> = Object.fromEntries(liste(alt));
        for (const [k, h] of Object.entries(eigen)) if (!erledigt[k]) erledigt[k] = h;
        if (istPersoenlich(s)) { if (an) erledigt[id] = { at, von: person }; else delete erledigt[id]; }
        return { erledigt };
      });
    }
    if (!istPersoenlich(s)) { if (an) gemeinsam.erledigt[id] = { at, von: person }; else delete gemeinsam.erledigt[id]; }
    return gemeinsam;
  });
  return hakenSicht(gemeinsamNachher, eigenNachher ?? await loadJson<HakenDatei>(persoenlichName(person)), person);
}
