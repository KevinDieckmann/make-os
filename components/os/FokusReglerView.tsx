'use client';

import Link from 'next/link';
// ─── MAKE OS — Fokus-Regler ─────────────────────────────────────────────────
// Der Score liefert die Datenlage — aber WO der Fokus hingeht, entscheidet
// Kevin selbst. Fünf Regler, einer je Säule. Wirkung: die Aufgaben-Leiste im
// Wochenplaner sortiert danach vor, und Jarvis gewichtet seinen Wochen-
// vorschlag entsprechend.

import { useEffect, useRef, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';

type SaeuleKey = 'health' | 'business' | 'planning' | 'finance' | 'social';
type Regler = Record<SaeuleKey, number>;
interface ScoreSaeule { key: string; label: string; score: number | null; zuDuenn: boolean; gewicht: number }

const lbl = { fontFamily: T.mono, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };

const SAEULEN: { key: SaeuleKey; label: string; farbe: string; hint: string }[] = [
  { key: 'health', label: 'Gesundheit & Energie', farbe: '#58D9CD', hint: 'Reha, Routinen, Schlaf — trägt 35% des Scores' },
  { key: 'business', label: 'Business-Performance', farbe: '#4A6CF7', hint: 'Pipeline, CapOS, Umsatz-Kurs' },
  { key: 'planning', label: 'Planung & Execution', farbe: T.accent, hint: 'Aufgaben abschließen, Woche halten' },
  { key: 'finance', label: 'Finanzen', farbe: '#00C9B8', hint: 'Runway, Rechnungen, Zahlen pflegen' },
  { key: 'social', label: 'Beziehung & Team', farbe: '#C77DFF', hint: 'Malin, Rituale, Delegation' },
];

const stufe = (v: number) => (v >= 75 ? 'Voller Fokus' : v >= 55 ? 'Erhöht' : v >= 45 ? 'Normal' : v >= 25 ? 'Reduziert' : 'Ruht bewusst');

export function FokusReglerView() {
  const [regler, setRegler] = useState<Regler>({ health: 50, business: 50, planning: 50, finance: 50, social: 50 });
  const [score, setScore] = useState<ScoreSaeule[]>([]);
  const [geladen, setGeladen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    fetch('/api/state/fokus-regler').then(r => r.json()).then(d => { setRegler(d.regler); setGeladen(true); }).catch(() => setGeladen(true));
    fetch('/api/performance').then(r => r.json()).then(d => setScore(d.aktuell?.saeulen ?? [])).catch(() => {});
  }, []);

  function setzen(k: SaeuleKey, v: number) {
    setRegler(prev => {
      const next = { ...prev, [k]: v };
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        fetch('/api/state/fokus-regler', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ regler: next }) }).catch(() => {});
      }, 500);
      return next;
    });
  }

  const summe = Object.values(regler).reduce((a, b) => a + b, 0);

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 56px' }}>
        <div style={lbl}>Fokus-Regler</div>
        <h1 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-.02em', margin: '6px 0 4px' }}>Wohin fließt die Energie?</h1>
        <p style={{ fontSize: 13.5, color: T.inkDim, maxWidth: 660, lineHeight: 1.5 }}>
          Der MAKE Score zeigt die Datenlage — <b style={{ color: T.ink }}>aber wo der Fokus hingeht, entscheidest du</b>.
          Die Regler sortieren die Aufgaben im <Link href="/os/planung/woche" style={{ color: T.accentInk, textDecoration: 'none' }}>Wochenplaner</Link> vor,
          und Jarvis gewichtet seinen Wochenvorschlag danach.
        </p>

        {!geladen ? (
          <div style={{ fontFamily: T.mono, fontSize: 12, color: T.muted, marginTop: 20 }}>lade …</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
            {SAEULEN.map(s => {
              const v = regler[s.key];
              const sc = score.find(x => x.key === s.key);
              return (
                <div key={s.key} style={{ ...panel, borderLeft: `3px solid ${s.farbe}`, padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: T.ink }}>{s.label}</span>
                    <span style={{ fontFamily: T.mono, fontSize: 10.5, color: s.farbe }}>{stufe(v)}</span>
                    <span style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: 11, color: T.muted }}>
                      {sc ? (sc.score != null ? `Score: ${sc.score}${sc.zuDuenn ? ' (zu dünn)' : ''}` : 'Score: keine Daten') : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 9 }}>{s.hint}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input type="range" min={0} max={100} step={5} value={v}
                      onChange={e => setzen(s.key, Number(e.target.value))}
                      style={{ flex: 1, accentColor: s.farbe }} />
                    <span style={{ fontFamily: T.mono, fontSize: 15, fontWeight: 700, color: s.farbe, width: 40, textAlign: 'right' }}>{v}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ ...panel, padding: '12px 16px', marginTop: 14, fontSize: 12.5, color: T.inkDim, lineHeight: 1.55 }}>
          <b style={{ color: T.ink }}>So wirkt es:</b> Aufgaben aus Bereichen mit hohem Regler rücken in der Einplan-Leiste nach vorn (◎ markiert),
          Bereiche mit niedrigem Regler treten zurück — Prioritäten wie <b style={{ color: T.crit }}>kritisch</b> schlagen den Regler aber immer.
          {summe < 200 && ' Aktuell ruht vieles bewusst — gut, wenn das Absicht ist.'}
          {summe > 380 && ' Fast alles auf Vollgas — dann ist nichts mehr Fokus. Weniger ist Lenkung.'}
        </div>
      </div>
    </div>
  );
}
