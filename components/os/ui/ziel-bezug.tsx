'use client';

// ─── Standard · Ziel-Bezug (03.10.) ─────────────────────────────────────────
// Kevin: „immer der Fokus auf die Ziele.“ Ein ruhiger Chip unter dem Seitenkopf: auf welches Jahresziel diese Ansicht einzahlt.
// Nur Anzeige und ein Link in die Planung — kein Schreibweg, kein eigener Speicher. Die Auswahl steht in lib/make-one/ziel-bezug.ts.
// Ohne Ziel steht ein leiser Weg („Ziel anlegen“), nie eine leere Fläche; solange nichts geladen ist, bleibt der Platz stehen (kein Springen).

import Link from 'next/link';
import { useMemo } from 'react';
import { FARBE as C, SCHRIFT, TYP, LEUCHT } from '@/lib/make-one/design';
import { zielBezug, type BezugBereich } from '@/lib/make-one/ziel-bezug';
import { useZieleUndMeilensteine } from '@/lib/planung/ziele-client';
import { WEG } from '@/lib/wege';
import { Chip } from './knoepfe';

const ZEILE_HOEHE = 44;

/**
 * Chip „zahlt ein auf · <Ziel> · 40 %“. `bereich` bestimmt, welches Jahresziel gemeint ist (lib/make-one/ziel-bezug.ts).
 * Bei einem echten Bezug (Thema der Meilensteine wie in den Lichtfäden) steht „zahlt ein auf“, sonst ehrlich „Oberstes Ziel“.
 * Daten aus dem EINEN Zwischenspeicher der Planungsdaten (lib/planung/ziele-client.ts), Farbe vom Server.
 */
export function ZielBezug({ bereich, max = 1 }: { bereich: BezugBereich; max?: number }) {
  const daten = useZieleUndMeilensteine();
  const eintraege = useMemo(() => (daten ? zielBezug(bereich, daten.ziele, daten.meilensteine, max) : null), [daten, bereich, max]);

  const reihe: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', minHeight: ZEILE_HOEHE };
  if (!eintraege) return <div className="ui-ziel-bezug" style={reihe} aria-hidden />;
  if (!eintraege.length) {
    return (
      <div className="ui-ziel-bezug" style={reihe}>
        <Link href={WEG.jahr()} className="fassbar" style={{ display: 'inline-flex', alignItems: 'center', minHeight: ZEILE_HOEHE, fontSize: TYP.bedien, color: C.inkDim, textDecoration: 'none' }}>
          Noch kein Jahresziel gesetzt — in der Planung anlegen ›
        </Link>
      </div>
    );
  }
  return (
    <div className="ui-ziel-bezug" style={reihe}>
      {eintraege.map(e => (
        <Link key={e.id} href={WEG.ziel(e.id)} className="fassbar ui-ziel-chip" aria-label={`${e.grund === 'rang' ? 'Oberstes Ziel' : 'Zahlt ein auf'}: ${e.titel}, ${e.fortschritt} Prozent`}
          style={{ display: 'inline-flex', alignItems: 'center', minHeight: ZEILE_HOEHE, maxWidth: '100%', minWidth: 0, textDecoration: 'none' }}>
          <Chip farbe={e.farbe}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: e.farbe, flex: '0 0 auto' }} />
            <span style={{ fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise, flex: '0 0 auto' }}>{e.grund === 'rang' ? 'Oberstes Ziel' : 'Zahlt ein auf'}</span>
            <span className="ui-ziel-text" style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.ink }}>{e.titel}</span>
            <span style={{ fontFamily: SCHRIFT.display, fontSize: TYP.bedien, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: e.fortschritt >= 60 ? LEUCHT.gut : C.inkDim, flex: '0 0 auto' }}>{e.fortschritt} %</span>
          </Chip>
        </Link>
      ))}
    </div>
  );
}
