// ─── Gesundheitswerte für Prompts — nur mit Einwilligung (b) (05.10., Art. 9 DSGVO) ───────────────────────────────────
// Die Prompt-Bauer holen Gesundheitsangaben nur über diese Helfer. Ohne Einwilligung (b) „An die KI geben“ der Person
// bleibt jeder Wert draußen — vor dem Modell, nicht erst im Prompt-Text:
//   · Vitalwerte (Recovery, Schlaf, HRV, Puls, Notiz)        → `VITALS_GESPERRT` (Nullen, `fallback`)
//   · Privat-Score (21.10., ersetzt den Performance-Index)  → ohne Säule „Gesundheit“, ohne Gesamtzahl/Verlauf (die enthalten sie)
//   · Ernährungs-Profile                                   → ohne Bedürfnisse/Ziel; „verträgt nicht“ geht nur als neutrales „nie“
//                                                            (eine Küchenregel, keine Gesundheitsangabe) — für Gäste immer so
// Rein bis auf `gesundheitKiFuer` (liest die Einwilligung).

import type { ResolvedVitals } from '@/lib/vitals';
import { PRIVAT_SCORE_GESUNDHEIT, type ScoreKurz } from '@/lib/scores/sicht';
import type { Profil } from '@/lib/ernaehrung/modell';

export const VITALS_GESPERRT: ResolvedVitals = { rec: 0, sleep: 0, hrv: 0, rhr: 0, stand: '—', heute: false, alterTage: 999, fallback: true };

/** Säulen-Kennung der Gesundheit im Privat-Score (lib/scores/privat-score.ts). Der gemischte Performance-Index ist seit 21.10. weg. */
export const GESUNDHEIT_SAEULE = PRIVAT_SCORE_GESUNDHEIT;

/**
 * Ein Score für die KI (rein): der Business-Score unverändert; der Privat-Score ohne Einwilligung (b) ohne Gesundheits-Säule, ohne Gesamtzahl,
 * ohne Status-Wort, ohne Verlauf (alle enthalten die Gesundheit) und ohne einen Gesundheits-Hebel.
 */
export function scoreFuerKi<T extends Pick<ScoreKurz, 'sicht' | 'index' | 'label' | 'saeulen' | 'hebel' | 'reihe' | 'status'>>(s: T | null | undefined, frei: boolean): T | null {
  if (!s) return null;
  if (frei || s.sicht !== 'privat') return s;
  return {
    ...s,
    index: null,
    label: '',
    status: { titel: 'ohne Gesundheit', satz: 'Gesamtzahl privat — ohne Einwilligung „An die KI geben“ nur die Säulen ohne Gesundheit.', vorlaeufig: false },
    saeulen: s.saeulen.filter(x => x.id !== GESUNDHEIT_SAEULE),
    reihe: [],
    hebel: s.hebel && s.hebel.saeuleId === GESUNDHEIT_SAEULE ? null : s.hebel,
  };
}

/** Ein Ernährungs-Profil für die KI (rein): mit Einwilligung vollständig, sonst nur Küchenregeln. */
export function profilFuerKi(p: Profil, frei: boolean): Profil {
  if (frei && p.konto) return p;
  return { ...p, bedarf: '', ziel: '', unvertraeglich: [], nie: Array.from(new Set([...(p.nie ?? []), ...(p.unvertraeglich ?? [])])) };
}

/** Einwilligungen (b) für mehrere Personen auf einmal (Server). */
export async function gesundheitKiFuer(personen: readonly string[]): Promise<Record<string, boolean>> {
  const { gesundheitAnKi } = await import('./gesundheit-einwilligung');
  const paare = await Promise.all(Array.from(new Set(personen)).map(async p => [p, await gesundheitAnKi(p).catch(() => false)] as const));
  return Object.fromEntries(paare);
}

/** Ernährungs-Profile für einen Prompt (Server): Konto-Profile mit (b) vollständig, alles andere als Küchenregeln. */
export async function profileFuerKi(profile: readonly Profil[]): Promise<{ profile: Profil[]; mitGesundheit: boolean }> {
  const frei = await gesundheitKiFuer(profile.filter(p => p.konto).map(p => p.person));
  const raus = profile.map(p => profilFuerKi(p, !!frei[p.person]));
  return { profile: raus, mitGesundheit: raus.some((p, i) => profile[i].konto && frei[p.person] && (!!p.bedarf || !!p.ziel || p.unvertraeglich.length > 0)) };
}
