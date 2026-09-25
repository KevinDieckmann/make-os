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
import { GesamtView } from './haushalt/GesamtView';
import { FinanzchefView } from './FinanzchefView';

type Sicht = 'privat' | 'business' | 'gesamt' | 'chef';

export function FinanzenView() {
  const router = useRouter(); const pfad = usePathname(); const p = useSearchParams();
  const [zugang, setZugang] = useState<boolean | null>(null);
  useEffect(() => { fetch('/api/haushalt?nur=zugang').then(r => setZugang(r.ok)).catch(() => setZugang(false)); }, []);
  const gewuenscht = p.get('s') as Sicht | null;
  // Der Head of Finance ist für alle da — ohne Haushalt sieht er nur Business.
  const sicht: Sicht = gewuenscht === 'chef' ? 'chef' : zugang === false ? 'business' : gewuenscht === 'business' || gewuenscht === 'gesamt' ? gewuenscht : zugang ? 'privat' : (gewuenscht ?? 'privat');
  const setze = (s: Record<string, string | null>) => {
    const q = new URLSearchParams(p.toString());
    for (const [k, v] of Object.entries(s)) { if (v === null) q.delete(k); else q.set(k, v); }
    // Sicht wechseln ist ein Ortswechsel — Zurück führt zur vorigen Sicht (25.09.).
    router.push(`${pfad}?${q.toString()}`, { scroll: false });
  };
  const chef = { id: 'chef' as Sicht, label: 'Head of Finance' };
  const liste = zugang ? [{ id: 'privat' as Sicht, label: 'Privat' }, { id: 'business' as Sicht, label: 'Business' }, { id: 'gesamt' as Sicht, label: 'Gesamt' }, chef] : [{ id: 'business' as Sicht, label: 'Business' }, chef];

  return (
    <Seite titel="Zahlen" unter={sicht === 'privat' ? 'Privat · eure Haushaltsfinanzen' : sicht === 'gesamt' ? 'Gesamt · was das Business fürs Leben bringen muss' : sicht === 'chef' ? 'Head of Finance · Lage, Fristen, Vorschläge zur Freigabe' : 'Business · Firmen, Liquidität, Grundlage'} rechts={zugang !== null ? <Segmente liste={liste} aktiv={sicht} onWahl={s => setze({ s, t: null })} /> : undefined}>
      {zugang === null && sicht === 'privat' ? null : sicht === 'privat' ? <HaushaltView reiter={p.get('t')} onReiter={t => setze({ t })} /> : sicht === 'gesamt' ? <GesamtView /> : sicht === 'chef' ? <FinanzchefView /> : <ZahlenBusiness />}
    </Seite>
  );
}
