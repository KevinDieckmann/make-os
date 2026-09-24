'use client';

// ─── MAKE OS — Zahlen: Privat · Business ────────────────────────────────────
// Kevin, 24.09.: „dass wir in unserem Dashboard wirklich über Privat und über
// Business unterscheiden können.“ Privat ist Malins Finanz-Cockpit, aufgegangen
// in MAKE OS (nur für euren Haushalt sichtbar). Business sind die bisherigen
// Zahlen der Firmen. Wer keinen Haushalt hat, sieht nur Business.

import { useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Seite, Segmente } from './schlank';
import { ZahlenBusiness } from './ZahlenView';
import { HaushaltView } from './haushalt/HaushaltView';

type Sicht = 'privat' | 'business';

export function FinanzenView() {
  const router = useRouter(); const pfad = usePathname(); const p = useSearchParams();
  const [zugang, setZugang] = useState<boolean | null>(null);
  useEffect(() => { fetch('/api/haushalt?nur=zugang').then(r => setZugang(r.ok)).catch(() => setZugang(false)); }, []);
  const gewuenscht = p.get('s') as Sicht | null;
  const sicht: Sicht = zugang === false ? 'business' : gewuenscht === 'business' ? 'business' : zugang ? 'privat' : (gewuenscht ?? 'privat');
  const setze = (s: Record<string, string | null>) => {
    const q = new URLSearchParams(p.toString());
    for (const [k, v] of Object.entries(s)) { if (v === null) q.delete(k); else q.set(k, v); }
    router.replace(`${pfad}?${q.toString()}`, { scroll: false });
  };
  const liste = zugang ? [{ id: 'privat' as Sicht, label: 'Privat' }, { id: 'business' as Sicht, label: 'Business' }] : [{ id: 'business' as Sicht, label: 'Business' }];

  return (
    <Seite titel="Zahlen" unter={sicht === 'privat' ? 'Privat · eure Haushaltsfinanzen' : 'Business · Firmen, Liquidität, Grundlage'} rechts={zugang ? <Segmente liste={liste} aktiv={sicht} onWahl={s => setze({ s, t: null })} /> : undefined}>
      {zugang === null && sicht === 'privat' ? null : sicht === 'privat' ? <HaushaltView reiter={p.get('t')} onReiter={t => setze({ t })} /> : <ZahlenBusiness />}
    </Seite>
  );
}
