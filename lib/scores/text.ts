// ─── Die zwei Scores als Text für ZOE und Agenten (21.10.) — rein ──────────────────────────────────────────────────────────────────
// EINE Stelle, an der Prompts (Brain-Block, Loops, Score-Agent) die Scores lesen: je Score eine Zeile, nie eine gemischte Zahl. Was an die KI
// geht, entscheidet vorher `scoreFuerKi` (lib/datenschutz/gesundheit-ki.ts): ohne Einwilligung (b) fehlen Gesundheits-Säule und Gesamtzahl des
// Privat-Scores. Der Business-Score erscheint nur, wenn die Person ihn sehen darf (lib/scores/sicht.ts) — und nie in einer Privat-Sicht.

import { SCORE_NAME, type ScoreKurz, type ScoreSicht } from './sicht';

const ADRESSE: Record<ScoreSicht, string> = { privat: '/os/score?space=privat', business: '/os/score?space=business' };

/** Eine Zeile je Score (rein). `mitSaeulen` = die Säulen mit Wert; `ohneGesundheitHinweis` = Satz, warum der Privat-Score ohne Zahl dasteht. */
export function scoreZeile(s: ScoreKurz, o: { mitSaeulen?: boolean; ohneGesundheitHinweis?: boolean } = {}): string {
  const name = SCORE_NAME[s.sicht].toUpperCase();
  const zahl = s.index != null ? `${s.index} (${s.label}), Datenbasis ${Math.round(s.abdeckung * 100)} %`
    : o.ohneGesundheitHinweis && s.sicht === 'privat' ? 'Gesamtzahl privat (ohne Einwilligung „An die KI geben“ — nur die Säulen ohne Gesundheit)'
    : `noch keine Zahl — ${s.status.satz}`;
  const saeulen = o.mitSaeulen !== false ? ` Säulen: ${s.saeulen.map(x => `${x.label} ${x.score ?? '—'}${x.zuDuenn ? ' (zu dünn, zählt nicht)' : ''}`).join(' · ') || '—'}.` : '';
  const hebel = s.hebel ? ` Größter Hebel: ${s.hebel.label} (${s.hebel.saeule}).` : '';
  return `${name}: ${zahl}.${saeulen}${hebel} Alles dazu: ${ADRESSE[s.sicht]}.`;
}

/** Beide Scores als Block (rein) — fehlt einer, steht er nicht da. Leer = für die Person gibt es keinen Score. */
export function scoresSatz(s: Partial<Record<ScoreSicht, ScoreKurz | null | undefined>>, o: { mitSaeulen?: boolean; ohneGesundheitHinweis?: boolean } = {}): string {
  const zeilen = (['privat', 'business'] as const).map(k => s[k]).filter((x): x is ScoreKurz => !!x).map(x => scoreZeile(x, o));
  if (!zeilen.length) return '';
  return `${zeilen.join('\n')}\nZwei getrennte Scores (Privat und Business) — nie zu einer Zahl mischen. Eine Säule mit dünner Datenbasis ist KEIN schlechter Wert, sondern eine Messlücke: sag dann, was die Person eintragen müsste.`;
}
