'use client';

// ─── Prozesse — die Liste (Etappe A, 21.10.; ANALYSE_100.md Punkte 20, 30) ─────────────────────────────────────────────────────────────────
// DASSELBE Modell wie das Bild als verschachtelte Liste je Ebene (lib/prozesse/modell.ts `alsListe`): Bänder → Stufen der Fliege → Prozesse → Phasen →
// Schritte, Rauten als „Wenn ja … · wenn nein …“. Für Screenreader, das Handy (unter 720 px die Vorgabe) und als Text zum Kopieren. Ist ein Prozess in der
// Adresse gewählt, steht er offen; „Im Bild zeigen“ springt an dieselbe Stelle im Bild.

import { useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP, MIKRO, SCHRIFT } from '@/lib/make-one/design';
import { Knopf, Hinweis } from '../ui';
import { WEG } from '@/lib/wege';
import { alsListe, alsText, prozessAlsListe, prozessVon, type ListenKnoten } from '@/lib/prozesse/modell';
import { STUFE_FARBE, BAND_FARBE } from '@/lib/prozesse/farben';
import type { KernStufe, ProzessDef, ProzessPfad, Zahl } from '@/lib/prozesse/typen';

const klein = { fontSize: TYP.bedien, color: C.inkDim } as const;

function Schritte({ k, gewaehlt }: { k: ListenKnoten; gewaehlt?: string }) {
  return (
    <ol className="pz-liste-ol">
      {k.kinder.map(s => (
        <li key={s.id} className="pz-liste-schritt" aria-current={gewaehlt === s.pfad.s ? 'step' : undefined}>
          <Link href={WEG.prozesse({ ...s.pfad, ansicht: 'liste' })} scroll={false} style={{ color: gewaehlt === s.pfad.s ? C.aktiv : C.ink }}>{s.titel}</Link>
          {s.zahl && <span style={{ ...klein, marginLeft: 8 }}>· {s.zahl}</span>}
          {s.text && <div style={klein}>{s.text}</div>}
        </li>
      ))}
    </ol>
  );
}

/** Ein Prozess in der Liste (aufklappbar), mit Phasen und Schritten. */
function ProzessEintrag({ k, offen, pfad }: { k: ListenKnoten; offen: boolean; pfad: ProzessPfad }) {
  return (
    <details className="pz-liste-prozess" open={offen}>
      <summary className="fassbar">
        <span style={{ fontWeight: 650 }}>{k.titel}</span>
        {k.marke && <span style={{ ...MIKRO, marginLeft: 8 }}>{k.marke}</span>}
        {k.zahl && <span style={{ ...klein, marginLeft: 8 }}>· {k.zahl}</span>}
      </summary>
      <div style={{ display: 'grid', gap: 10, padding: '6px 0 4px 4px' }}>
        {k.text && <p style={{ ...klein, margin: 0 }}>{k.text}</p>}
        <ol className="pz-liste-ol">
          {k.kinder.map(ph => (
            <li key={ph.id}>
              <span style={{ fontWeight: 600, color: pfad.ph === ph.pfad.ph ? C.aktiv : C.ink }}>{ph.titel}</span>
              {ph.zahl && <span style={{ ...klein, marginLeft: 8 }}>· {ph.zahl}</span>}
              {ph.text && <div style={klein}>{ph.text}</div>}
              <Schritte k={ph} gewaehlt={pfad.ph === ph.pfad.ph ? pfad.s : undefined} />
            </li>
          ))}
        </ol>
        <div><Knopf leise href={WEG.prozesse({ ...pfad, p: k.pfad.p, ansicht: 'bild' })}>Im Bild zeigen ›</Knopf></div>
      </div>
    </details>
  );
}

export function ProzessListe({ prozesse, zahlen, pfad }: { prozesse: readonly ProzessDef[]; zahlen: Readonly<Record<string, Zahl>>; pfad: ProzessPfad }) {
  const [kopiert, setKopiert] = useState<string | null>(null);
  const baender = alsListe(prozesse, zahlen);
  const gewaehlt = prozessVon(prozesse, pfad.p);
  const kopieren = async () => {
    const text = gewaehlt ? alsText([{ id: gewaehlt.band, titel: gewaehlt.titel, satz: gewaehlt.steckbrief.ergebnis, gruppen: [{ id: 'p', titel: null, prozesse: [prozessAlsListe(gewaehlt, zahlen)] }] }]) : alsText(baender);
    try { await navigator.clipboard.writeText(text); setKopiert('Als Text kopiert.'); } catch { setKopiert('Kopieren ging nicht — der Browser hat es nicht erlaubt.'); }
  };
  return (
    <div className="pz-liste" style={{ display: 'grid', gap: 16, fontFamily: SCHRIFT.text }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <Knopf leise onClick={kopieren}>{gewaehlt ? 'Diesen Prozess als Text kopieren' : 'Alle Prozesse als Text kopieren'}</Knopf>
        {kopiert && <span role="status" style={klein}>{kopiert}</span>}
      </div>
      {gewaehlt ? (
        <ProzessEintrag k={prozessAlsListe(gewaehlt, zahlen)} offen pfad={pfad} />
      ) : baender.map(b => (
        <section key={b.id} aria-label={b.titel} style={{ display: 'grid', gap: 8 }}>
          <h2 style={{ ...MIKRO, fontSize: TYP.mikro, color: BAND_FARBE[b.id as 'fuehrung'] ?? C.inkDim, margin: 0 }}>{b.titel} · <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>{b.satz}</span></h2>
          {b.gruppen.map(g => (
            <div key={g.id} style={{ display: 'grid', gap: 6, ...(g.titel ? { borderLeft: `3px solid ${STUFE_FARBE[g.id as KernStufe]}`, paddingLeft: 12 } : {}) }}>
              {g.titel && <h3 style={{ margin: 0, fontSize: TYP.bedien, fontWeight: 700, color: C.ink }}>{g.titel}</h3>}
              {g.prozesse.map(k => <ProzessEintrag key={k.id} k={k} offen={false} pfad={pfad} />)}
            </div>
          ))}
        </section>
      ))}
      {!baender.length && <Hinweis art="info">Noch keine Prozesse.</Hinweis>}
    </div>
  );
}
