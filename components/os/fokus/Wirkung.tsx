'use client';

// ─── Fokus › Wirkung (10.10., früher die Seite „Wachstum“) ───────────────────────────────────────────────────────────────────────
// Bis 21.10. stand hier der Wachstums-Score, je Bereich gefiltert. Seit 21.10. (Kevin: nur noch zwei Scores — „Privat wie auch im Business einen
// Score, der alles zusammenbringt“) ist die Wirkung der Score DES BEREICHS: Privat → Privat-Score, Business → Business-Score (= Business-Index).
// Dieselbe Quelle und derselbe Block wie oben auf Heute (GET /api/scores, components/os/scores/BereichScores.tsx) — der Server liefert nur den
// eigenen Score und nur, wenn die Person ihn sehen darf. Der Ring und „Alles öffnen“ führen auf /os/score.

import Link from 'next/link';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { WEG } from '@/lib/wege';
import type { SteuerBereich } from '@/lib/fokus/steuerung';
import { Karte, Ueberschrift, Leer, Hinweis, zoneFarbe } from '../ui';
import { ScoreBlock, useScores } from '../scores/BereichScores';

export function Wirkung({ bereich, i = 0 }: { bereich: SteuerBereich; i?: number }) {
  const d = useScores(bereich);
  const s = d?.[bereich];
  if (d === undefined) return <Karte i={i}><Leer>lädt …</Leer></Karte>;
  if (!d || !s) return <Karte i={i}><Hinweis art="info">Für dein Konto gibt es in diesem Bereich keinen Score.</Hinweis></Karte>;
  return (
    <Karte i={i} ton={s.index != null ? zoneFarbe(s.index) : undefined}>
      <Ueberschrift farbe={zoneFarbe(s.index)} erklaerung="fokus.wirkung" rechts={<Link href={WEG.score(bereich)} style={{ color: C.inkLeise, textDecoration: 'none' }}>Alles öffnen ›</Link>}>
        Wirkung {bereich === 'privat' ? 'Privat' : 'Business'}
      </Ueberschrift>
      <ScoreBlock s={s} />
      <p style={{ fontSize: TYP.bedien, color: C.inkLeise, margin: '14px 0 0', lineHeight: 1.5 }}>
        Worauf Fokus und Zeit einzahlen: der {s.name}. Säulen ohne genug Messung sind eine Lücke, kein schlechter Wert.
      </p>
    </Karte>
  );
}
