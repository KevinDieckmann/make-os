// ─── MAKE OS — Social: Wann wird was wo gepostet? (rein) — 27.10.2026 ───────────────────────────────────────────────────────────────
// Die EINE Regel für den Veröffentlicher (veroeffentlichen-server.ts) UND die Anzeige „Automatik“ in der Oberfläche: je Folge und Plattform
// ein Zustand mit Grund. Gepostet wird nur, wenn ALLES stimmt:
//   · die Folge hat einen Termin und er ist erreicht (Berliner Wandzeit), höchstens `VERSPAETET_MAX_STD` Stunden zu spät — sonst nie still
//     „nachholen“ (nach einem Ausfall gingen sonst viele Beiträge auf einmal raus); eine Person plant neu;
//   · die Leitplanken erlauben es (`autonomieFuer`: „selbst“ oder von einer Person „freigegeben“ = „bereit“);
//   · eine aktive Verbindung für diese Plattform besteht und ihr Anbieter kann diese Inhaltsart;
//   · auf dieser Plattform ist sie nicht schon online, und kein Versuch läuft oder endete unklar (nie doppelt).

import type { AutonomieErgebnis } from './autonomie';
import type { SocialFolge, SocialPlattform } from './typen';

export const VERSPAETET_MAX_STD = 12;

export type PostZustand = 'online' | 'faellig' | 'geplant' | 'ohne-termin' | 'verpasst' | 'leitplanke' | 'ohne-verbindung' | 'kann-nicht' | 'laeuft' | 'fehler' | 'unklar';
export const POST_ZUSTAND_NAME: Record<PostZustand, string> = {
  online: 'online', faellig: 'geht jetzt raus', geplant: 'geht automatisch raus', 'ohne-termin': 'ohne Termin', verpasst: 'Termin verpasst',
  leitplanke: 'wartet auf euch', 'ohne-verbindung': 'nicht verbunden', 'kann-nicht': 'von Hand', laeuft: 'wird gepostet', fehler: 'fehlgeschlagen', unklar: 'unklar — bitte nachsehen',
};

export interface PostSchritt { plattform: SocialPlattform; zustand: PostZustand; grund: string }

export interface PostKontext {
  /** Termin der Folge als Wandzeit `JJJJ-MM-TTTHH:MM` (plan.ts `terminVon`) — null ohne Termin. */
  termin: string | null;
  /** Jetzt als Wandzeit. */
  jetzt: string;
  weg: AutonomieErgebnis;
  plattformen: readonly SocialPlattform[];
  /** Je Plattform: ist verbunden, und kann der Anbieter diese Folge? (null = keine Verbindung) */
  verbindung: (p: SocialPlattform) => { kann: { ok: true } | { ok: false; grund: string } } | null;
}

/** Stunden zwischen zwei Wandzeiten (grob, für „verpasst“). */
function stundenZwischen(von: string, bis: string): number {
  const ms = (w: string) => Date.UTC(+w.slice(0, 4), +w.slice(5, 7) - 1, +w.slice(8, 10), +w.slice(11, 13), +w.slice(14, 16));
  return (ms(bis) - ms(von)) / 3_600_000;
}

export function postPlan(f: SocialFolge, k: PostKontext): PostSchritt[] {
  return k.plattformen.map(p => {
    if (f.veroeffentlicht.some(v => v.plattform === p)) return { plattform: p, zustand: 'online', grund: 'Veröffentlicht.' };
    const versuch = (f.versuche ?? []).find(v => v.plattform === p);
    if (versuch?.zustand === 'laeuft') return { plattform: p, zustand: 'laeuft', grund: 'Wird gerade gepostet.' };
    if (versuch?.zustand === 'unklar') return { plattform: p, zustand: 'unklar', grund: `Antwort der Plattform fehlte — bitte dort nachsehen, ob der Beitrag online ist, dann hier lösen.${versuch.text ? ` (${versuch.text})` : ''}` };
    if (versuch?.zustand === 'fehler') return { plattform: p, zustand: 'fehler', grund: versuch.text ?? 'Fehlgeschlagen.' };
    if (f.status === 'verworfen' || f.status === 'idee') return { plattform: p, zustand: 'leitplanke', grund: f.status === 'idee' ? 'Noch eine Idee.' : 'Verworfen.' };
    // Teilweise veröffentlicht: die übrigen Plattformen entscheidet dieselbe Leitplanke wie vorher.
    if (k.weg.weg !== 'selbst' && k.weg.weg !== 'bereit') return { plattform: p, zustand: 'leitplanke', grund: k.weg.grund };
    const v = k.verbindung(p);
    if (!v) return { plattform: p, zustand: 'ohne-verbindung', grund: 'Keine Verbindung zu dieser Plattform — unter „Automatik“ verbinden oder von Hand posten.' };
    if (!v.kann.ok) return { plattform: p, zustand: 'kann-nicht', grund: v.kann.grund };
    if (!k.termin) return { plattform: p, zustand: 'ohne-termin', grund: 'Ohne Termin geht nichts automatisch raus.' };
    if (k.termin > k.jetzt) return { plattform: p, zustand: 'geplant', grund: `Geht am ${k.termin.slice(8, 10)}.${k.termin.slice(5, 7)}. um ${k.termin.slice(11, 16)} Uhr raus.` };
    if (stundenZwischen(k.termin, k.jetzt) > VERSPAETET_MAX_STD) return { plattform: p, zustand: 'verpasst', grund: `Der Termin ist über ${VERSPAETET_MAX_STD} Stunden vorbei — neu planen (nie still nachholen).` };
    return { plattform: p, zustand: 'faellig', grund: 'Der Termin ist erreicht.' };
  });
}
