// ─── Gesundheits-Kontext für Planungs-Prompts — nur aus dem eigenen Bestand (S1 #9, 29.09.) ─
// Vorher stand ein fester Gesundheitskontext einer Person wörtlich im Code der Prompts (Kalender-Agent, Wochenplan,
// Loops, Tageslauf, Fokus, Morgen, Performance) — für JEDE fragende Person, also auch, wenn die andere Person plante,
// und im Repo, das an Dritte geht (Rohbau-Regel). Art. 9 DSGVO: Gesundheitsangaben gehören der Person.
//
// Jetzt: kein Gesundheitswort im Code. Optional kommt ein Kontext aus dem, was die FRAGENDE Person selbst gepflegt hat —
// ihr Ernährungs-Profil (`bedarf` „Bedürfnisse und Regeln in eigenen Worten“, `ziel`; nur das Konto-Profil der Person,
// nie ein Gast-Profil und nie das der anderen Person). Fehlt es, steht im Prompt nichts. Die Texte gehen als Daten in den
// Prompt (Kapsel `<eigene_angaben>`), nie als Anweisung.

import { loadJson } from '@/lib/store/local-db';
import type { ErnaehrungFile, Profil } from '@/lib/make-one/ernaehrung-data';

/** Längster Text je Feld im Prompt — darüber wird nichts gekürzt, sondern das Feld weggelassen (Hinweis statt Bruchstück). */
export const KONTEXT_MAX = 600;

const sauber = (t: unknown): string => (typeof t === 'string' ? t.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '');

/** Rein: der Kontext aus den Profilen — nur das Konto-Profil genau dieser Person. Leer, wenn nichts gepflegt ist. */
export function kontextAusProfilen(profile: readonly Partial<Profil>[] | undefined, person: string | null | undefined): string {
  if (!person) return '';
  const p = (profile ?? []).find(x => x?.person === person && x.konto === true);
  if (!p) return '';
  const teile = [
    ['Bedürfnisse und Regeln', sauber(p.bedarf)],
    ['Ziel', sauber(p.ziel)],
  ].filter(([, t]) => t && t.length <= KONTEXT_MAX).map(([k, t]) => `${k}: ${t}`);
  return teile.length ? `<eigene_angaben quelle="profil">\n${teile.join('\n')}\n</eigene_angaben>` : '';
}

/**
 * Der Gesundheits-/Profil-Kontext der fragenden Person für einen Prompt — oder ''. Nur ihr eigener Bestand; wer für eine
 * andere Person plant, bekommt deren Angaben nie (es gibt hier keinen `fuer`-Parameter).
 */
export async function eigenerGesundheitsKontext(person: string | null | undefined): Promise<string> {
  if (!person) return '';
  const f = await loadJson<Partial<ErnaehrungFile>>('ernaehrung').catch(() => null);
  return kontextAusProfilen(f?.profile, person);
}

/** Ein Satz für den System-Prompt, der sagt, wie der Kontext zu lesen ist (nur, wenn es einen gibt). */
export const KONTEXT_REGEL = 'Steht unten ein Block <eigene_angaben>, sind das Angaben, die die fragende Person selbst in ihrem Profil gepflegt hat — berücksichtige sie behutsam, stelle keine Diagnosen, gib keinen medizinischen Rat und erfinde nichts dazu. Fehlt der Block, triff keine Annahmen über Gesundheit oder Beschwerden.';
