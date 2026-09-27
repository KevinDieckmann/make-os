'use client';

// ─── MAKE OS — Sport: Ziele & Plan · Hyrox · Running · Gym · Erholung ───────
// Kevins Auftrag 27.09.: „Im Gesundheitsbereich einen Sport-Bereich einbauen —
// speziell für Malin ausgebaut mit Hyrox, Running, Gym und Erholung, damit sie
// ihre Ziele am Anfang schon perfekt planen kann.“ Persönlich je Person; beim
// ersten Öffnen ein geführter Einstieg. Nur Vorschläge, keine Trainingsberatung.

import { useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Seite, Karte, Segmente, Leer, LEUCHT } from '../schlank';
import { useSport } from './daten';
import { Einstieg } from './Einstieg';
import { ZielePlan } from './ZielePlan';
import { HyroxTeil } from './HyroxTeil';
import { RunningTeil } from './RunningTeil';
import { GymTeil } from './GymTeil';
import { ErholungTeil } from './ErholungTeil';
import { WEG } from '@/lib/wege';
import { stilLink } from './teile';

type Reiter = 'plan' | 'hyrox' | 'lauf' | 'gym' | 'erholung';
const REITER: { id: Reiter; label: string }[] = [
  { id: 'plan', label: 'Ziele & Plan' }, { id: 'hyrox', label: 'Hyrox' }, { id: 'lauf', label: 'Running' }, { id: 'gym', label: 'Gym' }, { id: 'erholung', label: 'Erholung' },
];

export function SportView() {
  const router = useRouter();
  const pfad = usePathname();
  const params = useSearchParams();
  const reiter = (REITER.find(r => r.id === params.get('s'))?.id ?? 'plan') as Reiter;
  const { d, fehler, meldung, schicke } = useSport();
  const geheZu = useCallback((r: Reiter) => { const p = new URLSearchParams(params.toString()); if (r === 'plan') p.delete('s'); else p.set('s', r); router.replace(`${pfad}${p.toString() ? `?${p}` : ''}`, { scroll: false }); }, [params, pfad, router]);

  return (
    <Seite titel="Sport" unter={<span>Hyrox · Running · Gym · Erholung — <Link href={WEG.gesundheit()} style={stilLink}>Gesundheit</Link></span>}
      rechts={<div style={{ maxWidth: '100%', overflowX: 'auto', paddingBottom: 2 }}><Segmente liste={REITER} aktiv={reiter} onWahl={geheZu} /></div>}>
      {meldung && <div role="status" style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 50, background: C.flaecheHoch, color: C.ink, borderRadius: 999, padding: '10px 18px', fontSize: TYP.bedien, fontWeight: 600, boxShadow: '0 12px 32px rgba(0,0,0,.45)' }}>{meldung}</div>}
      {fehler && <Karte i={0}><div style={{ color: LEUCHT.kritisch, fontSize: TYP.bedien }}>{fehler}</div></Karte>}
      {!d && !fehler && <Karte i={0}><Leer>…</Leer></Karte>}
      {d && !d.stand.einstieg.fertig && <Einstieg heute={d.heute} onFertig={ops => schicke(ops, 'Dein Plan steht.')} />}
      {d && d.stand.einstieg.fertig && (
        <>
          {reiter === 'plan' && <ZielePlan stand={d.stand} heute={d.heute} schicke={schicke} onReiter={geheZu} />}
          {reiter === 'hyrox' && <HyroxTeil stand={d.stand} heute={d.heute} schicke={schicke} />}
          {reiter === 'lauf' && <RunningTeil stand={d.stand} heute={d.heute} schicke={schicke} />}
          {reiter === 'gym' && <GymTeil stand={d.stand} heute={d.heute} schicke={schicke} />}
          {reiter === 'erholung' && <ErholungTeil stand={d.stand} heute={d.heute} vitals={d.vitals} schicke={schicke} />}
        </>
      )}
    </Seite>
  );
}
