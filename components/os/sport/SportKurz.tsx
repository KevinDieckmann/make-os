'use client';

// ─── Sport — Kachel auf der Gesundheitsseite: Ziel, Wochen, heute, Ampel ────
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP, SCHRIFT, LEUCHT } from '@/lib/make-one/design';
import { Karte, Chip, Leer } from '../ui';
import type { SportAntwort } from './daten';
import { hauptziel, wochenBis, wochentagVon, wocheIst, planUmfang } from '@/lib/sport/plan';
import { montagVon } from '@/lib/sport/pace';
import { ampel, bezugAus, AMPEL_LABEL } from '@/lib/sport/ampel';
import { PLAN_LABEL } from '@/lib/sport/modell';
import { WEG } from '@/lib/wege';

const AMPEL_FARBE = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch, unbekannt: C.inkLeise } as const;

/** Nur die eigene Person — Sport wird nicht geteilt; für eine fremde Ansicht zeigt die Kachel nur den Link. */
export function SportKurz({ eigene = true }: { eigene?: boolean }) {
  const [d, setD] = useState<SportAntwort | null>(null);
  useEffect(() => { if (!eigene) return; fetch('/api/sport', { cache: 'no-store' }).then(r => r.json()).then(x => x.ok && setD(x)).catch(() => {}); }, [eigene]);
  if (!eigene) return <Karte i={2}><Leer>Sport ist persönlich — jede Person plant ihren eigenen.</Leer></Karte>;
  if (!d) return <Karte i={2}><Leer>…</Leer></Karte>;
  if (!d.stand.einstieg.fertig) {
    return (
      <Karte i={2} akzent={LEUCHT.business}>
        <Link href={WEG.sport()} style={{ textDecoration: 'none', color: C.ink, display: 'block' }}>
          <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.body }}>Sport einrichten</div>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 4, lineHeight: 1.5 }}>Hyrox, Laufen, Gym, Erholung — Ziel wählen, Datum setzen, Woche planen. Fünf Schritte.</div>
          <div style={{ color: C.inkLeise, fontSize: TYP.bedien, marginTop: 8 }}>Los geht’s ›</div>
        </Link>
      </Karte>
    );
  }
  const s = d.stand;
  const ziel = hauptziel(s.ziele, d.heute);
  const geplant = s.woche[wochentagVon(d.heute)].art;
  const a = ampel(s.erholung[d.heute], geplant, bezugAus(s.erholung, d.heute), d.vitals[d.heute]?.recovery);
  const ist = wocheIst(s, montagVon(d.heute));
  const plan = planUmfang(s.woche).einheiten;
  return (
    <Karte i={2} akzent={AMPEL_FARBE[a.stufe]}>
      <Link href={WEG.sport()} style={{ textDecoration: 'none', color: C.ink, display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.body }}>{ziel?.titel ?? 'Sport'}</span>
          {ziel?.datum && <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{wochenBis(d.heute, ziel.datum)} Wochen</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip farbe={AMPEL_FARBE[a.stufe]}>{AMPEL_LABEL[a.stufe]}</Chip>
          <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>heute {PLAN_LABEL[geplant]} · Woche {ist.einheiten} von {plan}</span>
        </div>
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.45 }}>{a.text}</div>
        <div style={{ color: C.inkLeise, fontSize: TYP.bedien }}>Sport öffnen ›</div>
      </Link>
    </Karte>
  );
}
