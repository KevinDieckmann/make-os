'use client';

// ─── MAKE OS — Kapazität am Meilenstein und am Ziel (04.10.) ────────────────
// Eine Zeile im Kopf der Detailseiten: Aufwand, wer daran arbeitet, Machbarkeit („machbar / eng / nicht machbar —
// bräuchte N h/Tag“). Nur lesen — geändert wird im Meilenstein-Fenster bzw. am Ziel; gerechnet auf dem Server.

import Link from 'next/link';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { WEG } from '@/lib/wege';
import { zielMachbarkeit } from '@/lib/kapazitaet/modell';
import { MACHBAR_LABEL } from '@/lib/kapazitaet/typen';
import { useKapazitaet } from './useKapazitaet';
import { MachbarMarke, MACHBAR_FARBE } from './teile';

const z = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 });

export function MachbarZeile({ art, id }: { art: 'meilenstein' | 'ziel'; id: string }) {
  const k = useKapazitaet();
  if (!k.stand) return null;
  const namen = new Map(k.stand.personen.map(p => [p.id, p.name.split(/\s+/)[0]]));
  if (art === 'meilenstein') {
    const m = k.stand.posten.find(p => p.art === 'meilenstein' && p.id === id);
    if (!m || m.status === 'erledigt') return null;
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 8, fontSize: TYP.bedien, color: C.inkLeise }}>
        <span style={{ fontWeight: 600, color: C.inkDim }}>Kapazität</span>
        {m.aufwand ? <span>{z(m.aufwand)} h Aufwand{m.rest != null && m.rest !== m.aufwand ? ` · Rest ${z(m.rest)} h` : ''}{m.istStunden ? ` · ${z(m.istStunden)} h gemessen` : ''}</span> : null}
        <span>{m.personen.length ? m.personen.map(p => namen.get(p) ?? p).join(', ') : 'ganzes Team'}</span>
        <MachbarMarke m={m} mitText />
        <Link href={WEG.kapazitaet()} style={{ color: C.inkLeise }}>Kapazität ›</Link>
      </div>
    );
  }
  const g = zielMachbarkeit(k.stand, id);
  if (!g || g.status === 'erledigt') return null;
  const eigen = g.posten.find(p => p.art === 'ziel');
  const ms = g.posten.filter(p => p.art === 'meilenstein' && p.status !== 'erledigt');
  const zaehl = (s: string) => ms.filter(p => p.status === s).length;
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 8, fontSize: TYP.bedien, color: C.inkLeise }}>
      <span style={{ fontWeight: 600, color: C.inkDim }}>Kapazität</span>
      <span style={{ color: MACHBAR_FARBE[g.status], fontWeight: 700 }}>{MACHBAR_LABEL[g.status]}</span>
      {ms.length > 0 && <span>{ms.length} Meilenstein{ms.length === 1 ? '' : 'e'}: {[['machbar', 'machbar'], ['eng', 'eng'], ['nicht-machbar', 'nicht machbar'], ['ueberfaellig', 'überfällig'], ['aufwand-fehlt', 'ohne Aufwand']].map(([s, t]) => zaehl(s) ? `${zaehl(s)} ${t}` : '').filter(Boolean).join(' · ')}</span>}
      {eigen && <MachbarMarke m={eigen} mitText />}
      <Link href={WEG.kapazitaet()} style={{ color: C.inkLeise }}>Kapazität ›</Link>
    </div>
  );
}
