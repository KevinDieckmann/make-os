// ─── Gesundheitswerte für Prompts — nur mit Einwilligung (b) (05.10., Art. 9 DSGVO) ───────────────────────────────────
// Die Prompt-Bauer holen Gesundheitsangaben nur über diese Helfer. Ohne Einwilligung (b) „An die KI geben“ der Person
// bleibt jeder Wert draußen — vor dem Modell, nicht erst im Prompt-Text:
//   · Vitalwerte (Recovery, Schlaf, HRV, Puls, Notiz)        → `VITALS_GESPERRT` (Nullen, `fallback`)
//   · Performance-Index                                    → ohne Säule „Gesundheit & Energie“ und ohne Gesamtzahl (die enthält sie)
//   · Ernährungs-Profile                                   → ohne Bedürfnisse/Ziel; „verträgt nicht“ geht nur als neutrales „nie“
//                                                            (eine Küchenregel, keine Gesundheitsangabe) — für Gäste immer so
// Rein bis auf `gesundheitKiFuer` (liest die Einwilligung).

import type { ResolvedVitals } from '@/lib/vitals';
import type { PerfIndex } from '@/lib/performance';
import type { Profil } from '@/lib/ernaehrung/modell';

export const VITALS_GESPERRT: ResolvedVitals = { rec: 0, sleep: 0, hrv: 0, rhr: 0, stand: '—', heute: false, alterTage: 999, fallback: true };

/** Säulen-Schlüssel der Gesundheit im Performance-Index (lib/performance.ts). */
export const GESUNDHEIT_SAEULE = 'health';

/** Performance-Index für die KI: ohne Einwilligung ohne Gesundheits-Säule und ohne die Gesamtzahl (rein). */
export function indexFuerKi<T extends Pick<PerfIndex, 'index' | 'saeulen' | 'hebel'> & { hebelKey?: string | null }>(index: T | null, frei: boolean): T | null {
  if (!index || frei) return index;
  const hebelGesundheit = index.hebelKey === GESUNDHEIT_SAEULE || index.saeulen.some(s => s.key === GESUNDHEIT_SAEULE && s.label === index.hebel);
  return {
    ...index,
    index: null,
    saeulen: index.saeulen.filter(s => s.key !== GESUNDHEIT_SAEULE),
    ...(hebelGesundheit ? { hebel: null, hebelKey: null } : {}),
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
