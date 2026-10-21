'use client';

// ─── Die zwei Scores oben auf Heute (21.10.) ─────────────────────────────────────────────────────────────────────────────────────
// Kevin 21.10.: „Am Ende müssen wir Privat wie auch im Business einen Score haben, der alles zusammenbringt, dann haben wir es sauber.“ Klickrunde:
// oben auf Heute je Bereich ein Ring — Sicht Privat → Privat-Score, Sicht Business → Business-Score, „beide“ (z. B. falls „Alles“ zurückkommt) →
// beide nebeneinander. Antippen öffnet alles: die Seite /os/score mit Säulen, Kennzahlen und dem größten Hebel (WEG.score).
// Die Zahlen kommen NUR aus GET /api/scores — der Server liefert jeder Person nur ihre eigenen Scores und nur die, die sie sehen darf
// (lib/scores/sicht.ts); fehlt ein Score in der Antwort, steht hier nichts dazu.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { WEG } from '@/lib/wege';
import { Karte, Ring, Fortschritt, Chip, Hinweis, Leer, LEUCHT, zoneFarbe } from '../ui';
import type { ScoreAnfrage, ScoreKurz, ScoreSicht } from '@/lib/scores/sicht';

type Antwort = { ok?: boolean } & Partial<Record<ScoreSicht, ScoreKurz>>;

/** Lädt die Scores der Sicht (`undefined` = lädt, `null` = kein Zugang/Fehler). */
export function useScores(sicht: ScoreAnfrage): Antwort | null | undefined {
  const [d, setD] = useState<Antwort | null | undefined>(undefined);
  useEffect(() => {
    let aktiv = true;
    setD(undefined);
    fetch(`/api/scores?sicht=${sicht}`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(x => { if (aktiv) setD(x?.ok ? x : null); }).catch(() => { if (aktiv) setD(null); });
    return () => { aktiv = false; };
  }, [sicht]);
  return d;
}

/** Trend über die Reihe (letzter Wert gegen den ältesten der letzten 30 Tage) — nur mit mindestens zwei Tagen. */
export function trendAus(reihe: readonly { wert: number }[]): number | null {
  return reihe.length >= 2 ? reihe[reihe.length - 1].wert - reihe[0].wert : null;
}

/** Ein Score: Ring, Status, Säulen, größter Hebel — alles führt auf die Score-Seite. */
export function ScoreBlock({ s }: { s: ScoreKurz }) {
  const farbe = s.index != null ? zoneFarbe(s.index) : C.inkLeise;
  const ziel = WEG.score(s.sicht);
  const trend = trendAus(s.reihe);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(14px, 3vw, 28px)', minWidth: 0, flexWrap: 'wrap' }}>
      <Ring groesse="normal" label={s.name} wert={s.index != null ? String(s.index) : undefined} farbe={farbe} anteil={s.index != null ? s.index / 100 : undefined}
        href={ziel} hinweis={`${s.name} öffnen — Säulen, Kennzahlen, größter Hebel`} />
      <div style={{ flex: '1 1 220px', minWidth: 0, display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Link href={ziel} style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.body, color: C.ink, textDecoration: 'none' }}>{s.name} ›</Link>
          <Chip farbe={farbe}>{s.status.titel}</Chip>
          {trend != null && trend !== 0 && <Chip farbe={trend > 0 ? LEUCHT.gut : LEUCHT.kritisch}>{trend > 0 ? '▲' : '▼'} {Math.abs(trend)}</Chip>}
        </div>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.4 }}>{s.status.satz}</div>
        {s.saeulen.map(x => {
          // Nie eine Null: eine Säule ohne Wert oder mit zu wenig Messung führt dorthin, wo steht, was fehlt.
          const offen = x.score == null || x.zuDuenn;
          return (
            <div key={x.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.label} <span style={{ color: C.inkLeise }}>{Math.round(x.gewicht * 100)} %</span></span>
              {offen
                ? <Link href={ziel} style={{ color: C.inkLeise, textDecoration: 'none' }} title="Noch zu wenig gemessen — auf der Score-Seite steht je Kennzahl, was fehlt">messen ›</Link>
                : <span style={{ fontVariantNumeric: 'tabular-nums', color: zoneFarbe(x.score) }}>{x.score}</span>}
              {!offen && <div style={{ gridColumn: '1 / -1' }}><Fortschritt anteil={(x.score as number) / 100} farbe={zoneFarbe(x.score)} /></div>}
            </div>
          );
        })}
        {s.hebel && (
          <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>
            Größter Hebel: <Link href={WEG.score(s.sicht, { k: s.hebel.id })} style={{ color: C.ink, fontWeight: 600 }}>{s.hebel.label}</Link> <span style={{ color: C.inkLeise }}>({s.hebel.saeule})</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Die Score-Karte einer Sicht (Heute, Fokus › Wirkung). `beide` zeigt Privat und Business nebeneinander — je soweit erlaubt. */
export function BereichScores({ sicht, i = 0 }: { sicht: ScoreAnfrage; i?: number }) {
  const d = useScores(sicht);
  const scores = (['privat', 'business'] as const).filter(k => sicht === 'beide' || sicht === k).map(k => d?.[k]).filter((x): x is ScoreKurz => !!x);
  if (d === null) return null;
  return (
    <Karte i={i} akzent={scores.length === 1 && scores[0].index != null ? zoneFarbe(scores[0].index) : undefined}>
      {d === undefined && <Leer>Scores laden …</Leer>}
      {d && !scores.length && <Hinweis art="info">Für dein Konto gibt es in diesem Bereich keinen Score.</Hinweis>}
      {scores.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: scores.length > 1 ? 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))' : '1fr', gap: 'clamp(18px, 3vw, 32px)' }}>
          {scores.map(s => <ScoreBlock key={s.sicht} s={s} />)}
        </div>
      )}
    </Karte>
  );
}
