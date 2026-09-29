'use client';

// ─── MAKE OS — Heute (26.09. abends, Kevin: „oben wieder Heute, Heute soll ein
// eigenes Bild haben — der Home-Bildschirm wird für jeden selbst aufgebaut“) ──
// Die feste Tagesseite: Gruß, Datum, Tagesstart/-ende, dann das, was HEUTE
// zählt — Fokus, Aufgaben (beide Spaces), Termine, Körper, ZOE. Nicht
// gestaltbar; das Dashboard zum Selberbauen ist Home.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Seite, Spalten, Spalte } from './schlank';
import { WIDGETS } from './flaeche/widgets';
import { Anlaesse } from './kalender/Anlaesse';
import { Anstehend } from './heute/Anstehend';

export function HeuteView() {
  const [datum, setDatum] = useState('');
  const [gruss, setGruss] = useState('Hallo');
  const [vorname, setVorname] = useState('');
  const [abend, setAbend] = useState(false);
  useEffect(() => {
    const jetzt = new Date();
    setDatum(jetzt.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }));
    setGruss(jetzt.getHours() < 11 ? 'Guten Morgen' : jetzt.getHours() < 18 ? 'Guten Tag' : 'Guten Abend');
    setAbend(jetzt.getHours() >= 17);
    fetch('/api/konto/ich').then(r => r.json()).then(d => setVorname((d.ich?.name ?? '').split(' ')[0])).catch(() => {});
  }, []);
  const W = WIDGETS;
  return (
    <Seite titel={<>{gruss}{vorname ? `, ${vorname}` : ''}</>} unter={<span suppressHydrationWarning>{datum} · <Link href={`/os/ritual?modus=${abend ? 'abend' : 'morgen'}`} style={{ color: C.inkDim }}>{abend ? 'Tagesende' : 'Tagesstart'} ›</Link></span>}>
      {/* Der Tag in einer Zeile: was heute zählt */}
      <div style={{ fontFamily: SCHRIFT.display, fontSize: TYP.mikro, letterSpacing: '.12em', textTransform: 'uppercase', color: C.inkLeise, margin: '-6px 0 14px', fontWeight: 600 }}>Was heute zählt</div>
      {/* K2 (29.09.): Feiertag NRW heute/morgen und Geburtstage der nächsten 7 Tage (Familie + CRM). */}
      <Anlaesse />
      <Spalten verhaeltnis="2:1">
        <Spalte>
          <W.fokus.Komponente e={{ horizont: 'tag' }} i={0} />
          <W.aufgaben.Komponente e={{ nur: 'dran', anzahl: 10 }} titel="Heute dran" i={1} />
          <W.termine.Komponente e={{ tage: 1, business: true }} titel="Termine heute" i={2} />
          {/* K6a (29.09.): Nachbereiten, Fristen, Follow-ups, Buchungsanfragen, ZOE-Kalender-Vorschläge, Geburtstage — dieselbe Quelle wie die Glocke. */}
          <Anstehend i={3} />
        </Spalte>
        <Spalte>
          <W.koerper.Komponente e={{}} i={1} />
          <W.zoe.Komponente e={{ inbox: true }} i={2} />
          <W.essen.Komponente e={{}} i={3} />
        </Spalte>
      </Spalten>
    </Seite>
  );
}
