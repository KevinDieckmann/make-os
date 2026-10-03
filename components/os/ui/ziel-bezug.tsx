'use client';

// ─── Standard · Ziel-Bezug (03.10.) ─────────────────────────────────────────
// Kevin: „immer der Fokus auf die Ziele.“ Ein ruhiger Chip unter dem Seitenkopf: auf welches Jahresziel diese Ansicht einzahlt.
// Nur Anzeige und ein Link in die Planung — kein Schreibweg, kein eigener Speicher. Die Auswahl steht in lib/make-one/ziel-bezug.ts.
// Ohne Ziel steht ein leiser Weg („Ziel anlegen“), nie eine leere Fläche; solange nichts geladen ist, bleibt der Platz stehen (kein Springen).

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP, TIEF, LEUCHT } from '@/lib/make-one/design';
import { zielBezug, type BezugBereich, type ZielBezugEintrag } from '@/lib/make-one/ziel-bezug';
import type { Meilenstein, Ziel } from '@/lib/planung/typen';

interface Bestand { ziele: Ziel[]; meilensteine: Meilenstein[] }
let gemerkt: { zeit: number; wert: Promise<Bestand> } | null = null;

/** Ziele und Meilensteine einmal je halbe Minute holen — mehrere Chips auf einer Seite teilen sich die Anfrage. */
function bestandHolen(): Promise<Bestand> {
  if (gemerkt && Date.now() - gemerkt.zeit < 30_000) return gemerkt.wert;
  const wert = Promise.all([
    fetch('/api/state/ziele').then(r => r.json()).catch(() => ({})),
    fetch('/api/state/meilensteine').then(r => r.json()).catch(() => ({})),
  ]).then(([z, m]) => {
    const zd = (z?.state ?? z ?? {}) as { jahr?: Ziel[] };
    return { ziele: Array.isArray(zd.jahr) ? zd.jahr : [], meilensteine: Array.isArray(m?.meilensteine) ? (m.meilensteine as Meilenstein[]) : [] };
  });
  gemerkt = { zeit: Date.now(), wert };
  return wert;
}

const ZEILE_HOEHE = 44;

/**
 * Chip „zahlt ein auf · <Ziel> · 40 %“. `bereich` bestimmt, welches Jahresziel gemeint ist (lib/make-one/ziel-bezug.ts).
 * Bei einem echten Bezug (Meilenstein oder Stichwort) steht „zahlt ein auf“, sonst ehrlich „Oberstes Ziel“.
 */
export function ZielBezug({ bereich, max = 1 }: { bereich: BezugBereich; max?: number }) {
  const [eintraege, setEintraege] = useState<ZielBezugEintrag[] | null>(null);
  useEffect(() => {
    let weg = false;
    bestandHolen().then(b => { if (!weg) setEintraege(zielBezug(bereich, b.ziele, b.meilensteine, max)); }).catch(() => { if (!weg) setEintraege([]); });
    return () => { weg = true; };
  }, [bereich, max]);

  const reihe: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', minHeight: ZEILE_HOEHE };
  if (!eintraege) return <div className="ui-ziel-bezug" style={reihe} aria-hidden />;
  if (!eintraege.length) {
    return (
      <div className="ui-ziel-bezug" style={reihe}>
        <Link href="/os/planung/jahr" className="fassbar" style={{ display: 'inline-flex', alignItems: 'center', minHeight: ZEILE_HOEHE, fontSize: TYP.bedien, color: C.inkDim, textDecoration: 'none' }}>
          Noch kein Jahresziel gesetzt — in der Planung anlegen ›
        </Link>
      </div>
    );
  }
  return (
    <div className="ui-ziel-bezug" style={reihe}>
      {eintraege.map(e => (
        <Link key={e.id} href={`/os/planung/ziel/${encodeURIComponent(e.id)}`} className="fassbar ui-ziel-chip" aria-label={`${e.grund === 'rang' ? 'Oberstes Ziel' : 'Zahlt ein auf'}: ${e.titel}, ${e.fortschritt} Prozent`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minHeight: ZEILE_HOEHE, maxWidth: '100%', boxSizing: 'border-box', padding: '6px 14px 6px 12px', borderRadius: 999, textDecoration: 'none', color: C.ink,
            background: TIEF.flaeche(e.farbe), border: `1px solid ${TIEF.rand(e.farbe)}` }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: e.farbe, flex: '0 0 auto' }} />
          <span style={{ fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise, flex: '0 0 auto' }}>{e.grund === 'rang' ? 'Oberstes Ziel' : 'Zahlt ein auf'}</span>
          <span style={{ fontSize: TYP.bedien, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.titel}</span>
          <span style={{ fontFamily: SCHRIFT.display, fontSize: TYP.bedien, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: e.fortschritt >= 60 ? LEUCHT.gut : C.inkDim, flex: '0 0 auto' }}>{e.fortschritt} %</span>
        </Link>
      ))}
    </div>
  );
}
