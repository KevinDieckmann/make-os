'use client';

// ─── Standard · FlussKarte — der Überblick „Für dich“ je Bereich (04.10.2026 abends) ─
// Kevin (04.10.): „Lass uns so immer den Überblick gestalten und dann den Flow so anzeigen, wie es die letzten 3 Monate war, wie es
// jetzt ist und wie der Forecast ist … für jeden einzelnen Bereich.“ (UMBAU_ABEND_0410.md › 4, Vorbild Markttraktion › „Für dich“)
//   Karte ton="fokus" · Überschrift (+ rechts z. B. die Person) · die Linie: Ist der letzten 3 Monate (durchgezogen, leise Fläche) →
//   HEUTE (ruhige senkrechte Linie) → Prognose (gestrichelt, leiser, beschriftet „Prognose“) · Achse „−3 M · heute · +3 M“ ·
//   darunter wenige priorisierte Zeilen (Punkt · Titel · Unterzeile · Zahl-Pille).
// Daten: GET /api/fluss (Server filtert nach Person, Haushalt, Sicht — lib/fluss/server.ts) über `useFluss`, oder fertig
// übergeben (`fluss`, z. B. Markttraktion aus /api/crm/traktion). Ohne Prognose-Grundlage steht dort ein klarer Leerzustand,
// nie eine Schätzung. 80/20: die Linie ist der Akzent, alles andere ruhig. Wächter: tests/fluss.test.ts.

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { FARBE as C, FOKUS_LICHT, LEUCHT, BEDEUTUNG_FARBE, SCHRIFT, TYP } from '@/lib/make-one/design';
import { flussAchse, flussHatLinie, flussText, flussZahl, type FlussBereich, type FlussReihe, type FlussTon } from '@/lib/fluss/modell';
import { Karte, Ueberschrift, Liste, Zeile } from './flaechen';
import { Chip, Knopf } from './knoepfe';
import { Hinweis, Leer } from './rueckmeldung';

/** Die Reihe eines Bereichs vom Server holen (Person aus der Sitzung). `space` nur für die Planung. */
export function useFluss(bereich: FlussBereich, space?: 'privat' | 'business' | null): { fluss: FlussReihe | null; laedt: boolean; fehler: string | null; neu: () => void } {
  const [fluss, setFluss] = useState<FlussReihe | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const laden = useCallback(() => {
    setLaedt(true);
    const q = new URLSearchParams({ bereich, ...(space ? { space } : {}) });
    fetch(`/api/fluss?${q}`, { cache: 'no-store' })
      .then(r => r.json().catch(() => ({ ok: false })))
      .then(d => { if (d?.ok) { setFluss(d.fluss ?? null); setFehler(null); } else setFehler(d?.fehler ?? 'Überblick nicht ladbar.'); })
      .catch(() => setFehler('Nicht erreichbar.'))
      .finally(() => setLaedt(false));
  }, [bereich, space]);
  useEffect(() => { laden(); }, [laden]);
  return { fluss, laedt, fehler, neu: laden };
}

const TON: Record<FlussTon, string> = { gut: BEDEUTUNG_FARBE.gut, achtung: BEDEUTUNG_FARBE.achtung, kritisch: BEDEUTUNG_FARBE.kritisch, info: FOKUS_LICHT, neutral: C.inkLeise };

export interface FlussKarteProps {
  /** Fertige Reihe (sonst lädt die Karte selbst über `bereich`). */
  fluss?: FlussReihe | null;
  bereich?: FlussBereich;
  space?: 'privat' | 'business' | null;
  /** Überschrift der Karte — Standard „Für dich“. */
  titel?: string;
  rechts?: ReactNode;
  /** Bereichsfarbe der Linie (Standard Fokus-Cyan). */
  farbe?: string;
  /** Eigene Zeilen statt der Zeilen der Reihe (Markttraktion: „Für dich“ aus dem Team-Modell). */
  children?: ReactNode;
  i?: number;
}

/** Der Baustein. Lädt selbst, wenn nur `bereich` gegeben ist. */
export function FlussKarte(p: FlussKarteProps) {
  if (p.fluss !== undefined || !p.bereich) return <FlussKarteInhalt {...p} fluss={p.fluss ?? null} laedt={false} fehler={null} neu={null} />;
  return <FlussKarteLadend {...p} bereich={p.bereich} />;
}
function FlussKarteLadend(p: FlussKarteProps & { bereich: FlussBereich }) {
  const { fluss, laedt, fehler, neu } = useFluss(p.bereich, p.space);
  return <FlussKarteInhalt {...p} fluss={fluss} laedt={laedt} fehler={fehler} neu={neu} />;
}

function FlussKarteInhalt({ fluss, laedt, fehler, neu, titel = 'Für dich', rechts, farbe = FOKUS_LICHT, children, i = 0 }: FlussKarteProps & { fluss: FlussReihe | null; laedt: boolean; fehler: string | null; neu: (() => void) | null }) {
  const router = useRouter();
  return (
    <Karte i={i} ton="fokus" licht={farbe}>
      <div data-flusskarte="" style={{ display: 'contents' }} />
      <Ueberschrift rechts={rechts}>{titel}</Ueberschrift>
      {fehler && <Hinweis art="kritisch" rolle="alert" aktion={neu ? <Knopf leise onClick={neu}>Noch einmal versuchen</Knopf> : undefined}>{fehler}</Hinweis>}
      {!fluss && !fehler && (laedt ? <div aria-busy="true" aria-label="Überblick lädt" style={{ height: 96 }} /> : <Leer>Für diesen Bereich gibt es noch keinen Verlauf.</Leer>)}
      {fluss && (flussHatLinie(fluss) ? <FlussLinie f={fluss} farbe={farbe} /> : <Leer>{fluss.leer ?? 'Noch kein Verlauf.'}</Leer>)}
      {children ?? (fluss && fluss.zeilen.length > 0 && (
        <Liste>
          {fluss.zeilen.map(z => (
            <Zeile key={z.id} onClick={z.link ? () => router.push(z.link!) : undefined}
              links={<span aria-hidden="true" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: TON[z.ton ?? 'neutral'] }} />}
              titel={<span style={{ whiteSpace: 'normal' }}>{z.titel}</span>} unter={<span style={{ whiteSpace: 'normal' }}>{z.unter}</span>}
              rechts={z.zahl ? <Chip farbe={TON[z.ton ?? 'neutral']}>{z.zahl}</Chip> : undefined} />
          ))}
        </Liste>
      ))}
    </Karte>
  );
}

const B = 1000, H = 72, R = 4;

/** Lage der Punkte: Ist links bis HEUTE (Mitte), Prognose ab HEUTE nach rechts — beide teilen die laufende Periode. */
export function flussPunkte(f: Pick<FlussReihe, 'ist' | 'prognose'>): { ist: [number, number][]; prognose: [number, number][]; heuteX: number; nullY: number } {
  const alle = [...f.ist, ...f.prognose];
  const min = Math.min(0, ...alle), max = Math.max(0, ...alle);
  const spanne = max - min || 1;
  const y = (v: number) => R + (1 - (v - min) / spanne) * (H - 2 * R);
  const heuteX = B / 2;
  const ist = f.ist.map((v, k): [number, number] => [f.ist.length < 2 ? heuteX : (k / (f.ist.length - 1)) * heuteX, y(v)]);
  const prognose = f.prognose.map((v, k): [number, number] => [heuteX + (f.prognose.length < 2 ? 0 : (k / (f.prognose.length - 1)) * (B - heuteX)), y(v)]);
  return { ist, prognose, heuteX, nullY: y(0) };
}

function FlussLinie({ f, farbe }: { f: FlussReihe; farbe: string }) {
  const { ist, prognose, heuteX, nullY } = flussPunkte(f);
  const d = (pt: [number, number][]) => pt.map(([x, y], k) => `${k ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const flaeche = ist.length > 1 ? `${d(ist)} L${ist.at(-1)![0].toFixed(1)},${nullY.toFixed(1)} L${ist[0][0].toFixed(1)},${nullY.toFixed(1)} Z` : '';
  const [links, mitte, rechtsA] = flussAchse(f.raster);
  const leise = { fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: C.inkLeise };
  return (
    <figure className="ui-fluss" role="img" aria-label={flussText(f)} style={{ margin: '0 0 12px', minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'baseline', marginBottom: 6, fontSize: TYP.bedien, color: C.inkDim }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span aria-hidden="true" style={{ width: 16, height: 2, background: farbe, borderRadius: 1 }} />Ist · {f.istLabel}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span aria-hidden="true" style={{ width: 16, height: 0, borderTop: `2px dashed ${farbe}`, opacity: 0.6 }} />Prognose · {f.prognoseLabel}</span>
        <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{f.titel} · {f.raster === 'woche' ? 'diese Woche' : 'dieser Monat'} {flussZahl(f.ist.at(-1) ?? 0, f.einheit)}</span>
      </div>
      <div style={{ position: 'relative', height: H }}>
        <svg aria-hidden="true" width="100%" height={H} viewBox={`0 0 ${B} ${H}`} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
          <defs>
            <linearGradient id={`fluss-${f.bereich}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={farbe} stopOpacity={0.16} /><stop offset="1" stopColor={farbe} stopOpacity={0} /></linearGradient>
          </defs>
          <line x1={0} x2={B} y1={nullY} y2={nullY} stroke="rgba(255,255,255,.1)" strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray="2 4" />
          {flaeche && <path d={flaeche} fill={`url(#fluss-${f.bereich})`} stroke="none" />}
          {ist.length > 1 && <path d={d(ist)} fill="none" stroke={farbe} strokeWidth={1.6} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
          {prognose.length > 1 && <path d={d(prognose)} fill="none" stroke={farbe} strokeOpacity={0.55} strokeWidth={1.4} strokeDasharray="5 4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
          <line x1={heuteX} x2={heuteX} y1={0} y2={H} stroke={LEUCHT.puls} strokeOpacity={0.45} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        </svg>
        {!f.prognoseGrundlage && (
          <div style={{ position: 'absolute', left: '52%', right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px dashed rgba(255,255,255,.12)`, borderRadius: 10, padding: '0 10px', textAlign: 'center', fontSize: TYP.bedien, color: C.inkDim }}>
            Keine Prognose — es liegt nichts Terminiertes vor.
          </div>
        )}
      </div>
      <figcaption aria-hidden="true" style={{ position: 'relative', height: 16, marginTop: 4 }}>
        <span style={{ ...leise, position: 'absolute', left: 0 }}>{links}</span>
        <span style={{ ...leise, position: 'absolute', left: '50%', transform: 'translateX(-50%)', color: LEUCHT.puls }}>{mitte}</span>
        <span style={{ ...leise, position: 'absolute', right: 0 }}>{f.prognoseGrundlage ? `Prognose ${rechtsA}` : rechtsA}</span>
      </figcaption>
      {f.prognoseGrundlage && <p style={{ margin: '2px 0 0', fontSize: TYP.bedien, color: C.inkDim }}>Prognose {f.prognoseGrundlage}.</p>}
    </figure>
  );
}
