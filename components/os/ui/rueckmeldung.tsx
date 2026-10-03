'use client';

// ─── Standard · Rückmeldung: Hinweis, Leerzustand, Schritte, Erfolg (03.10.) ─
// Hinweise sind Karten NACH BEDEUTUNG (gut · achtung · kritisch · info), in ganzen Sätzen. Ein leerer Zustand ist nie nur grauer Text:
// Symbol, ein Satz, ein Weg weiter (Leerzustand) — oder, wo eine Zeile reicht, `Leer` in derselben Sprache.

import type { ReactNode } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, Check, Info } from 'lucide-react';
import { FARBE as C, TYP, TIEF, SCHRIFT, BEDEUTUNG_FARBE, RAND, type Bedeutung } from '@/lib/make-one/design';

const SYMBOL: Record<Bedeutung, ReactNode> = {
  gut: <CheckCircle2 size={18} />, achtung: <AlertTriangle size={18} />, kritisch: <AlertOctagon size={18} />, info: <Info size={18} />, neutral: null,
};
/** Altes Schreibweise `farbe` (Netzwerken, Zustandsfarbe) → Bedeutung. */
const AUS_FARBE: Record<string, Bedeutung> = { [BEDEUTUNG_FARBE.gut]: 'gut', [BEDEUTUNG_FARBE.achtung]: 'achtung', [BEDEUTUNG_FARBE.kritisch]: 'kritisch', [BEDEUTUNG_FARBE.info]: 'info' };

/**
 * Hinweiskarte nach Bedeutung. Mit `titel` eine fette erste Zeile, mit `aktion` ein Weg (Knopf) darunter.
 * `art` ist der Standard; `farbe` bleibt als Kurzform für Stellen, die eine Zustandsfarbe schon in der Hand haben (andere Farben = freie Tönung).
 */
export function Hinweis({ art, farbe, titel, children, rolle, aktion }: { art?: Bedeutung; farbe?: string; titel?: ReactNode; children?: ReactNode; rolle?: 'alert' | 'status'; aktion?: ReactNode }) {
  const b: Bedeutung = art ?? (farbe ? AUS_FARBE[farbe] ?? (farbe === C.inkDim ? 'neutral' : 'info') : 'neutral');
  const f = art || !farbe || AUS_FARBE[farbe] || farbe === C.inkDim ? BEDEUTUNG_FARBE[b] : farbe;
  const neutral = b === 'neutral' && (!farbe || farbe === C.inkDim);
  return (
    <div role={rolle ?? (b === 'kritisch' ? 'alert' : undefined)} className="ui-hinweis" style={{ border: `1px solid ${neutral ? RAND.flaeche : TIEF.rand(f)}`, background: neutral ? 'rgba(255,255,255,.03)' : TIEF.flaeche(f) }}>
      {SYMBOL[b] && <span aria-hidden className="ui-hinweis-symbol" style={{ color: f }}>{SYMBOL[b]}</span>}
      <div style={{ minWidth: 0, flex: 1 }}>
        {titel && <div style={{ fontWeight: 700, marginBottom: children ? 2 : 0 }}>{titel}</div>}
        {children}
        {aktion && <div className="ui-hinweis-aktion">{aktion}</div>}
      </div>
    </div>
  );
}

/** Freundlicher leerer Zustand: Symbol, ein Satz, was jetzt zu tun ist — und ein Weg dorthin. */
export function Leerzustand({ symbol, titel, children, aktion, ton = C.aktiv }: { symbol: ReactNode; titel: string; children?: ReactNode; aktion?: ReactNode; ton?: string }) {
  return (
    <section className="ui-leerzustand">
      <span aria-hidden className="ui-leerzustand-symbol" style={{ color: ton, background: `${ton}24`, border: `1px solid ${TIEF.rand(ton)}` }}>{symbol}</span>
      <h2 style={{ fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.2, margin: 0, color: C.ink }}>{titel}</h2>
      {children && <div style={{ fontSize: TYP.body, color: C.inkDim, lineHeight: 1.5, maxWidth: 360 }}>{children}</div>}
      {aktion && <div style={{ width: '100%', maxWidth: 360, marginTop: 4 }}>{aktion}</div>}
    </section>
  );
}

/** Die kleine Form des leeren Zustands — eine Zeile Text (optional mit Symbol und Weg) statt grauer Leere in einer Karte. */
export function Leer({ children, symbol, aktion }: { children: ReactNode; symbol?: ReactNode; aktion?: ReactNode }) {
  return (
    <div className="ui-leer">
      {symbol && <span aria-hidden className="ui-leer-symbol">{symbol}</span>}
      <div style={{ minWidth: 0 }}>{children}</div>
      {aktion && <div style={{ marginTop: 4 }}>{aktion}</div>}
    </div>
  );
}

/** Haken im Kreis, der sich zeichnet (Erfolg) — bei „Bewegung reduzieren“ steht er sofort da. */
export function Erfolg({ groesse = 28 }: { groesse?: number }) {
  return (
    <span aria-hidden className="ui-erfolg" style={{ width: groesse, height: groesse, borderRadius: groesse / 2, color: C.grund, background: C.aktiv, display: 'inline-grid', placeItems: 'center' }}>
      <Check size={Math.round(groesse * 0.58)} strokeWidth={3} />
    </span>
  );
}

/** Fortschritt in Schritten: Kreise mit Nummer bzw. Haken, dazwischen eine Linie, die sich beim Weitergehen füllt. */
export function Schritte({ punkte, nr }: { punkte: readonly string[]; nr: number }) {
  return (
    <ol aria-label="Fortschritt" style={{ display: 'flex', alignItems: 'center', gap: 8, listStyle: 'none', margin: 0, padding: 0 }}>
      {punkte.map((p, i) => {
        const fertig = i < nr, jetzt = i === nr;
        return (
          <li key={p} aria-current={jetzt ? 'step' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: i < punkte.length - 1 ? '1 1 0' : '0 0 auto', minWidth: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, flex: '0 0 auto' }}>
              <span aria-hidden style={{ width: 24, height: 24, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: TYP.bedien, fontWeight: 700, fontVariantNumeric: 'tabular-nums', transition: 'background .25s ease, border-color .25s ease, color .25s ease',
                color: jetzt ? C.aktiv : fertig ? C.grund : C.inkLeise, background: fertig ? C.aktiv : jetzt ? C.aktivSanft : 'transparent', border: `1.5px solid ${fertig || jetzt ? C.aktiv : 'rgba(255,255,255,.16)'}` }}>
                {fertig ? <Check size={14} strokeWidth={3} /> : i + 1}
              </span>
              <span style={{ fontSize: TYP.bedien, fontWeight: jetzt ? 700 : 600, color: jetzt ? C.ink : fertig ? C.inkDim : C.inkLeise, whiteSpace: 'nowrap' }}><span className="sr-only">{i + 1} · </span>{p}</span>
            </span>
            {i < punkte.length - 1 && <span aria-hidden style={{ flex: 1, height: 2, borderRadius: 1, minWidth: 8, background: fertig ? C.aktiv : 'rgba(255,255,255,.09)', transition: 'background .3s ease' }} />}
          </li>
        );
      })}
    </ol>
  );
}
